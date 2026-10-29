import { useMemo } from 'react';
import { shapeOf, slotMetrics } from '../../core/slots';
import type { SlotResult } from '../../core/sizing/result';
import type { VernierResult, VernierSpec } from '../../core/vernier/vernier';
import { phaseName } from '../../core/winding/phases';
import { fmt, phaseColor } from '../../ui/format';
import { circlePath, laminationPath, sectorPath, windingCells } from '../cad/geometry';
import { Dimension, Leader } from '../cad/Dimension';

/** Radial cross-section of the surface-PM Vernier machine: open-ish stator slots, 2·P_r surface magnets. */
export function VernierSection({ v, r }: { v: VernierSpec; r: VernierResult }) {
  const geo = useMemo(() => {
    const mm = 1000;
    const Rs = (v.boreDiameterMm / 2);
    const tau = r.slotPitch * mm;
    const bs = Math.max(0.5, tau - r.toothWidth * mm);
    const params = { b0: Math.min(bs, r.b0 * mm), h0: 1, h1: 1.5, bs, hs: Math.max(2, r.slotDepth * mm) };
    const shape = shapeOf('rect_semi');
    const slot: SlotResult = { shape: 'rect_semi', params, metrics: slotMetrics(shape, params, Rs, v.slots, 'stator'), targetArea: r.slotArea, limited: false };
    const depth = params.h0 + params.h1 + params.hs;
    const Ro = Rs + depth + r.yoke * mm;
    const Rr = Rs - v.airgapMm;
    const Rc = Rr - v.magnetThicknessMm;
    const Rsh = Math.max(Rc * 0.35, Rc - Math.max(8, r.yoke * mm * 1.2));
    const half = (Math.min(1, v.magnetArc) * Math.PI) / (2 * r.Pr);
    const magnets = Array.from({ length: 2 * r.Pr }, (_, j) => {
      const th = Math.PI / 2 - (Math.PI * j) / r.Pr;
      return { d: sectorPath(Rc, Rr, th - half, th + half), north: j % 2 === 0 };
    });
    return {
      Rs,
      Ro,
      Rr,
      Rc,
      Rsh,
      depth,
      lam: laminationPath(slot, Rs, v.slots, 'stator', Ro),
      cells: windingCells(slot, Rs, v.slots, 'stator', r.windingMatrix, 'radial'),
      magnets,
    };
  }, [v, r]);
  const pad = geo.Ro * 0.4;
  const sw = geo.Ro / 500;
  const fs = geo.Ro * 0.045;
  return (
    <svg className="cad-svg" viewBox={`${-geo.Ro - pad} ${-geo.Ro - pad * 0.3} ${2 * (geo.Ro + pad)} ${2 * geo.Ro + pad * 1.3}`} role="img" aria-label={`Vernier machine cross-section: ${v.slots} slots, ${2 * r.Pr} rotor poles`} style={{ maxHeight: 560 }}>
      <path d={circlePath(geo.Rs) + circlePath(geo.Rr)} fillRule="evenodd" fill="var(--airgap)" />
      <path d={geo.lam} fill="var(--steel)" fillRule="evenodd" stroke="var(--steel-edge)" strokeWidth={sw} />
      {geo.cells.map((c) => (
        <g key={`${c.slot}-${c.layer}`}>
          <path d={c.d} fill={c.sign ? phaseColor(c.phase) : 'var(--surface-2)'} stroke="var(--surface)" strokeWidth={sw * 0.8} />
          {c.sign < 0 && <path d={c.d} fill="var(--surface)" opacity={0.28} />}
          {v.slots * r.windingMatrix.length <= 120 && c.sign !== 0 && (
            <text x={c.cx} y={c.cy} dy={Math.min(c.label, fs) * 0.35} fontSize={Math.min(c.label, fs)} textAnchor="middle" fill={c.phase === 2 ? '#0b0b0b' : '#fff'} fontWeight={700}>
              {phaseName(c.phase)}
              {c.sign > 0 ? '+' : '−'}
            </text>
          )}
        </g>
      ))}
      <path d={circlePath(geo.Rc) + circlePath(geo.Rsh)} fillRule="evenodd" fill="var(--steel-rotor)" stroke="var(--steel-edge)" strokeWidth={sw} />
      {geo.magnets.map((m, i) => (
        <path key={i} d={m.d} fill={m.north ? 'var(--magnet-n)' : 'var(--magnet-s)'} stroke="var(--steel-edge)" strokeWidth={sw * 0.5} />
      ))}
      <path d={circlePath(geo.Rsh)} fill="var(--shaft)" stroke="var(--steel-edge)" strokeWidth={sw} />
      <Dimension x1={-geo.Ro} y1={geo.Ro + pad * 0.45} x2={geo.Ro} y2={geo.Ro + pad * 0.45} label={`Ø D_o = ${fmt(2 * geo.Ro, 1)}`} size={fs} ext1={[-geo.Ro, 0]} ext2={[geo.Ro, 0]} />
      <Leader x={geo.Rs * Math.cos(2.4)} y={-geo.Rs * Math.sin(2.4)} tx={-geo.Ro * 1.04} ty={-geo.Ro * 0.85} label={`Ø D = ${fmt(2 * geo.Rs, 1)}`} size={fs} />
      <Leader x={((geo.Rr + geo.Rc) / 2) * Math.cos(0.7)} y={-((geo.Rr + geo.Rc) / 2) * Math.sin(0.7)} tx={geo.Ro * 1.02} ty={-geo.Ro * 0.9} label={`${2 * r.Pr} magnets, h_m ${fmt(v.magnetThicknessMm, 1)}`} size={fs} />
      <Leader x={geo.Rs * Math.cos(-0.5)} y={-geo.Rs * Math.sin(-0.5)} tx={geo.Ro * 1.02} ty={geo.Ro * 0.75} label={`${v.slots} slots, b₀/τ_s = ${fmt(v.slotOpeningRatio, 2)}`} size={fs} />
    </svg>
  );
}
