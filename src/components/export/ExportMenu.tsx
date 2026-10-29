import { useEffect, useRef, useState } from 'react';
import { downloadBlob, slug } from '../../export/download';
import type { ReportFiguresRefs } from '../../export/pdf';
import { toCsv } from '../../export/tables';
import { useDesign } from '../../state/store';
import { ReportFigures } from './ReportFigures';
import { SheetsModal } from './SheetsModal';

export function ExportMenu() {
  const { result, spec, setSpec, notify } = useDesign();
  const [open, setOpen] = useState(false);
  const [sheets, setSheets] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const prevTheme = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const startPdf = () => {
    setOpen(false);
    prevTheme.current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light'); // print colours
    setPdfBusy(true);
  };
  const onFigures = async (refs: ReportFiguresRefs) => {
    try {
      // PDF libraries are loaded on demand to keep the initial bundle small
      const { exportPdf } = await import('../../export/pdf');
      if (result) await exportPdf(result, refs);
      notify('PDF specification exported');
    } catch (e) {
      notify(`PDF export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (prevTheme.current) document.documentElement.setAttribute('data-theme', prevTheme.current);
      else document.documentElement.removeAttribute('data-theme');
      setPdfBusy(false);
    }
  };

  return (
    <div className="rel" ref={menuRef}>
      <button type="button" className="btn primary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={!result}>
        {pdfBusy ? 'Exporting…' : 'Export ▾'}
      </button>
      {open && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={startPdf}>
            PDF specification report
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setSheets(true);
            }}
          >
            Google Sheets…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              if (result) downloadBlob(new Blob([toCsv(result)], { type: 'text/csv;charset=utf-8' }), `${slug(spec.name)}.csv`);
            }}
          >
            CSV tables
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              downloadBlob(new Blob([JSON.stringify({ app: 'emdesign-suite', version: 1, spec }, null, 2)], { type: 'application/json' }), `${slug(spec.name)}.emdesign.json`);
            }}
          >
            Save design (JSON)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              fileRef.current?.click();
            }}
          >
            Open design (JSON)…
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const data = JSON.parse(await f.text());
            setSpec(data.spec ?? data);
            notify(`Opened ${f.name}`);
          } catch {
            notify('Could not read that file');
          }
        }}
      />
      {sheets && <SheetsModal onClose={() => setSheets(false)} />}
      {pdfBusy && result && <ReportFigures r={result} onReady={onFigures} />}
    </div>
  );
}
