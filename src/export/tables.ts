import type { DesignResult } from '../core/sizing/result';
import { harmonicRows, buildReport, windingRows } from './reportModel';

export interface SheetTab {
  title: string;
  rows: string[][];
}

/** Tabular export model shared by CSV and Google Sheets. */
export function exportTabs(r: DesignResult): SheetTab[] {
  const report: string[][] = [['Section', 'Quantity', 'Symbol / formula', 'Value', 'Unit', 'Note']];
  for (const s of buildReport(r)) for (const row of s.rows) report.push([s.title, row.label, row.symbol, row.value, row.unit, row.note ?? '']);
  const env: string[][] = [['Speed [rpm]', 'Torque [N·m]', 'Power [kW]', 'Current [A]', 'Efficiency [%]', 'Power factor']];
  for (const p of r.performance.envelope) env.push([p.speedRpm.toFixed(1), p.torque.toFixed(2), (p.power / 1000).toFixed(3), p.current.toFixed(2), (p.efficiency * 100).toFixed(2), p.powerFactor.toFixed(3)]);
  const checks: string[][] = [['Check', 'Status', 'Value', 'Limit', 'Hint']];
  for (const c of r.checks) checks.push([c.label, c.status, c.value, c.limit, c.hint ?? '']);
  return [
    { title: 'Calculation sheet', rows: report },
    { title: 'Winding layout', rows: windingRows(r) },
    { title: 'Harmonics', rows: harmonicRows(r, 200) },
    { title: 'Torque-speed', rows: env },
    { title: 'Design checks', rows: checks },
  ];
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(r: DesignResult): string {
  return exportTabs(r)
    .map((t) => [`# ${t.title}`, ...t.rows.map((row) => row.map(csvCell).join(','))].join('\n'))
    .join('\n\n');
}
