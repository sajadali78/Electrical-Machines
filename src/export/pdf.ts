import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import 'svg2pdf.js';
import type { DesignResult } from '../core/sizing/result';
import { fmt } from '../ui/format';
import { downloadBlob, slug } from './download';
import { buildReport, harmonicRows, windingRows } from './reportModel';
import { inlineSvg } from './svgInline';

const FONT = 'DejaVuSans';

async function fontBase64(file: string): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
  if (!res.ok) throw new Error(`font ${file}: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export interface ReportFiguresRefs {
  radial: SVGSVGElement | null;
  axial: SVGSVGElement | null;
  slot: SVGSVGElement | null;
  rotorSlot: SVGSVGElement | null;
}

/** Multi-page vector PDF specification sheet (A4 portrait). */
export async function exportPdf(r: DesignResult, figs: ReportFiguresRefs): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let font = 'helvetica';
  try {
    doc.addFileToVFS('DejaVuSans.ttf', await fontBase64('DejaVuSans.ttf'));
    doc.addFont('DejaVuSans.ttf', FONT, 'normal');
    doc.addFileToVFS('DejaVuSans-Bold.ttf', await fontBase64('DejaVuSans-Bold.ttf'));
    doc.addFont('DejaVuSans-Bold.ttf', FONT, 'bold');
    font = FONT;
  } catch {
    /* fall back to the core font (symbols may not render) */
  }
  doc.setFont(font, 'normal');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const accent: [number, number, number] = [2, 132, 199];
  const ink: [number, number, number] = [15, 23, 42];

  const header = (title: string) => {
    doc.setFillColor(...ink);
    doc.rect(0, 0, W, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(font, 'bold');
    doc.setFontSize(11);
    doc.text('EM Design Suite — Machine specification', M, 10.5);
    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    doc.text(title, W - M, 10.5, { align: 'right' });
    doc.setTextColor(...ink);
  };

  const figure = async (svg: SVGSVGElement | null, x: number, y: number, w: number, h: number, caption: string) => {
    if (!svg) return;
    const clone = inlineSvg(svg, font);
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-30000px;top:0;';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    try {
      const vb = svg.viewBox.baseVal;
      const ar = vb && vb.width ? vb.height / vb.width : 1;
      const fw = Math.min(w, h / ar);
      const fh = fw * ar;
      await doc.svg(clone, { x: x + (w - fw) / 2, y, width: fw, height: fh });
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(caption, x + w / 2, y + fh + 4, { align: 'center' });
      doc.setTextColor(...ink);
    } finally {
      holder.remove();
    }
  };

  // ---- page 1: title, key figures, cross-section
  header(new Date().toISOString().slice(0, 10));
  doc.setFont(font, 'bold');
  doc.setFontSize(18);
  doc.text(r.spec.name, M, 28);
  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${fmt(r.spec.powerKw, 1)} kW · ${fmt(r.spec.voltageV, 0)} V · ${fmt(r.spec.frequencyHz, 1)} Hz · ${r.spec.winding.poles} poles · ${r.spec.winding.slots} slots · ${r.layout.layers}-layer winding`,
    M,
    34,
  );
  doc.setTextColor(...ink);
  const kpis: [string, string][] = [
    ['Bore × length', `${fmt(r.main.D * 1000, 1)} × ${fmt(r.main.L * 1000, 1)} mm`],
    ['Outer diameter', `${fmt(r.stator.Do * 1000, 1)} mm`],
    ['Efficiency', `${fmt(r.losses.efficiency * 100, 2)} %`],
    ['Power factor', fmt(r.performance.rated.powerFactor, 3)],
    ['Rated torque', `${fmt(r.torqueRated, 1)} N·m @ ${fmt(r.ratedSpeedRpm, 0)} rpm`],
    ['Phase current', `${fmt(r.performance.rated.current, 1)} A`],
    ['Winding factor k_w1', fmt(r.winding.kw1 * r.winding.ksk1, 4)],
    ['Active mass', `${fmt(r.masses.total, 1)} kg`],
  ];
  autoTable(doc, {
    startY: 39,
    margin: { left: M, right: M },
    body: kpis,
    theme: 'plain',
    styles: { font, fontSize: 9, cellPadding: 1.4 },
    columnStyles: { 0: { textColor: [100, 116, 139], cellWidth: 45 }, 1: { fontStyle: 'bold' } },
  });
  const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  await figure(figs.radial, M, y1, W - 2 * M, H - y1 - 18, 'Figure 1 — Radial cross-section with principal dimensions (mm)');

  // ---- page 2: axial view and slot details
  doc.addPage();
  header('Geometry');
  await figure(figs.axial, M, 22, W - 2 * M, 100, 'Figure 2 — Axial section');
  const half = (W - 2 * M - 6) / 2;
  await figure(figs.slot, M, 134, half, 120, 'Figure 3 — Stator slot with dimensions (mm)');
  if (figs.rotorSlot) await figure(figs.rotorSlot, M + half + 6, 134, half, 120, 'Figure 4 — Rotor slot with dimensions (mm)');

  // ---- calculation tables
  doc.addPage();
  header('Calculation sheet');
  let first = true;
  for (const s of buildReport(r)) {
    autoTable(doc, {
      startY: first ? 22 : undefined,
      margin: { left: M, right: M, top: 22 },
      head: [[{ content: s.title, colSpan: 4, styles: { fillColor: accent, textColor: 255, fontStyle: 'bold' } }], ['Quantity', 'Symbol / formula', 'Value', 'Unit']],
      body: s.rows.map((row) => [row.note ? `${row.label} (${row.note})` : row.label, row.symbol, row.value, row.unit]),
      styles: { font, fontSize: 8, cellPadding: 1.2 },
      headStyles: { fillColor: [241, 245, 249], textColor: ink, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' }, 1: { textColor: [100, 116, 139] } },
      didDrawPage: () => header('Calculation sheet'),
    });
    first = false;
  }

  // ---- winding layout (chunks of 24 slots) and harmonics
  doc.addPage();
  header('Winding');
  const wr = windingRows(r);
  const Q = wr[0].length - 1;
  let y = 22;
  for (let s0 = 0; s0 < Q; s0 += 24) {
    const cols = [0, ...Array.from({ length: Math.min(24, Q - s0) }, (_, i) => s0 + 1 + i)];
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: 22 },
      head: [cols.map((c) => (c === 0 ? 'Layer \\ slot' : wr[0][c]))],
      body: wr.slice(1).map((row) => cols.map((c) => row[c])),
      styles: { font, fontSize: 7, halign: 'center', cellPadding: 0.8 },
      headStyles: { fillColor: [241, 245, 249], textColor: ink },
      didParseCell: (d) => {
        const t = String(d.cell.raw ?? '');
        const ph = 'ABCDEFGH'.indexOf(t[0]);
        if (d.section === 'body' && ph >= 0 && t.length === 2) {
          const pal: [number, number, number][] = [[227, 73, 72], [42, 120, 214], [237, 161, 0], [27, 175, 122], [98, 80, 214], [232, 123, 164], [0, 131, 0], [235, 104, 52]];
          d.cell.styles.fillColor = pal[ph];
          d.cell.styles.textColor = ph === 2 ? 0 : 255;
          d.cell.styles.fontStyle = t[1] === '+' ? 'bold' : 'normal';
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }
  const hr = harmonicRows(r, Math.max(40, 3 * r.main.p));
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M, top: 22 },
    head: [[{ content: 'Winding factors and MMF harmonics', colSpan: hr[0].length, styles: { fillColor: accent, textColor: 255 } }], hr[0]],
    body: hr.slice(1),
    styles: { font, fontSize: 7.5, halign: 'right', cellPadding: 1 },
    headStyles: { fillColor: [241, 245, 249], textColor: ink },
    didDrawPage: () => header('Winding'),
  });

  // footer page numbers
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${r.spec.name} — page ${i} / ${n}`, W / 2, H - 6, { align: 'center' });
  }
  downloadBlob(doc.output('blob'), `${slug(r.spec.name)}-specification.pdf`);
}
