import type { DesignResult } from '../core/sizing/result';
import { exportTabs } from './tables';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleOAuth {
  accounts: {
    oauth2: {
      initTokenClient(cfg: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { message?: string; type?: string }) => void }): {
        requestAccessToken(o?: { prompt?: string }): void;
      };
    };
  };
}

declare global {
  interface Window {
    google?: GoogleOAuth;
  }
}

function loadGis(): Promise<GoogleOAuth> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google Identity Services did not load')));
    s.onerror = () => reject(new Error('Could not load Google Identity Services'));
    document.head.appendChild(s);
  });
}

/** Browser-side OAuth 2.0 token flow (Google Identity Services); no server or redirect URI needed. */
export async function requestToken(clientId: string): Promise<string> {
  const google = await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error_description || r.error || 'Authorization failed'))),
      error_callback: (e) => reject(new Error(e.message || e.type || 'Authorization cancelled')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

const NUM = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?(e[-+]?\d+)?$/i;

function cell(v: string, header: boolean) {
  const t = v.trim();
  const value = !header && NUM.test(t) ? { numberValue: Number(t.replace(/,/g, '')) } : { stringValue: v };
  return {
    userEnteredValue: value,
    ...(header ? { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.886, green: 0.91, blue: 0.941 } } } : {}),
  };
}

/** Create a new spreadsheet with one tab per table; returns its URL. */
export async function exportToSheets(r: DesignResult, token: string): Promise<string> {
  const tabs = exportTabs(r);
  const body = {
    properties: { title: `${r.spec.name} — EM design ${new Date().toISOString().slice(0, 10)}` },
    sheets: tabs.map((t, i) => ({
      properties: { sheetId: i, title: t.title, gridProperties: { frozenRowCount: 1 } },
      data: [{ startRow: 0, startColumn: 0, rowData: t.rows.map((row, ri) => ({ values: row.map((v) => cell(v, ri === 0)) })) }],
    })),
  };
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Sheets API ${res.status}: ${msg.slice(0, 300)}`);
  }
  const json = (await res.json()) as { spreadsheetUrl: string; spreadsheetId: string };
  // auto-size the columns (best effort)
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${json.spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: tabs.map((_, i) => ({ autoResizeDimensions: { dimensions: { sheetId: i, dimension: 'COLUMNS', startIndex: 0, endIndex: 30 } } })) }),
  }).catch(() => undefined);
  return json.spreadsheetUrl;
}
