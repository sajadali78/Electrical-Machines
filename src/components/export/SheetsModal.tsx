import { useState } from 'react';
import { exportToSheets, requestToken } from '../../export/sheets';
import { useDesign } from '../../state/store';

const KEY = 'emds.googleClientId';

export function SheetsModal({ onClose }: { onClose: () => void }) {
  const { result } = useDesign();
  const [clientId, setClientId] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; msg?: string; url?: string }>({ kind: 'idle' });
  const run = async () => {
    if (!result) return;
    try {
      localStorage.setItem(KEY, clientId.trim());
    } catch {
      /* ignore */
    }
    setStatus({ kind: 'busy', msg: 'Waiting for Google sign-in…' });
    try {
      const token = await requestToken(clientId.trim());
      setStatus({ kind: 'busy', msg: 'Creating spreadsheet…' });
      const url = await exportToSheets(result, token);
      setStatus({ kind: 'ok', url });
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sheets-title" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h3 id="sheets-title">Export to Google Sheets</h3>
          <div className="spacer" />
          <button type="button" className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="panel-body">
          <p className="hint" style={{ fontSize: 12.5 }}>
            Creates a new spreadsheet in your Google Drive with the calculation sheet, winding layout, harmonics, torque–speed data and design checks. Authorization runs entirely in your browser
            (Google Identity Services token flow, scope <span className="mono">spreadsheets</span>); nothing passes through a server.
          </p>
          <label htmlFor="gcid">OAuth 2.0 Web client ID</label>
          <input id="gcid" className="input" placeholder="1234567890-abc.apps.googleusercontent.com" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          <p className="hint">
            Create one in Google Cloud Console → APIs &amp; Services → Credentials (type “Web application”), add <span className="mono">{window.location.origin}</span> as an authorized JavaScript
            origin, and enable the Google Sheets API.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn primary" disabled={!clientId.trim() || status.kind === 'busy' || !result} onClick={run}>
              Sign in &amp; export
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
          {status.kind === 'busy' && <p className="hint">{status.msg}</p>}
          {status.kind === 'err' && <p className="hint" style={{ color: 'var(--err)' }}>{status.msg}</p>}
          {status.kind === 'ok' && status.url && (
            <p>
              ✓ Spreadsheet created:{' '}
              <a href={status.url} target="_blank" rel="noreferrer">
                open in Google Sheets
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
