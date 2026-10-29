import type { DesignResult } from '../../core/sizing/result';
import { fmt } from '../../ui/format';
import { Dimension } from './Dimension';

/** Axial (longitudinal) half-symmetric section: stacks, end windings, rings/magnets, shaft, bearings, frame. */
export function AxialView({ r, dims, svgId }: { r: DesignResult; dims: boolean; svgId?: string }) {
  const mm = 1000;
  const st = r.stator;
  const rot = r.rotor;
  const L = r.main.L * mm;
  const Ro = (st.Do / 2) * mm;
  const Rs = (r.main.D / 2) * mm;
  const Rr = (rot.Dr / 2) * mm;
  const Rcore = (rot.Di / 2) * mm; // rotor core bore
  const Rsh = Math.min(Rcore, Math.max((rot.shaftMin / 2) * mm * 1.25, Rcore * 0.45)) / 0.82; // drawn shaft (×0.82 below)
  const hs = st.slot.metrics.depth;
  const oh = st.overhang * mm;
  const frame = Math.max(4, Ro * 0.07);
  const bearingW = Math.max(8, Rsh * 0.9);
  const shaftExt = oh + bearingW * 2.2 + 25;
  const half = L / 2;
  const totalHalf = half + shaftExt + 40;
  const H = Ro + frame;
  const fs = H * 0.05;
  const pad = dims ? H * 0.42 : H * 0.08;
  const vb = `${-totalHalf - 10} ${-H - pad} ${2 * totalHalf + 20} ${2 * (H + pad)}`;
  const sw = H / 400;

  const ring = rot.kind === 'induction' && rot.rotorType === 'cage';
  const ringH = ring ? rot.ringHeight * mm : 0;
  const ringW = ring ? Math.max(2, rot.ringWidth * mm) : 0;

  const halfShape = (sgn: 1 | -1) => {
    const y = (v: number) => sgn * v;
    const ewR0 = Rs + hs * 0.15;
    const ewR1 = Rs + hs * 0.95;
    return (
      <g key={sgn}>
        {/* frame */}
        <rect x={-half - oh - 12} y={Math.min(y(Ro), y(Ro + frame))} width={L + 2 * oh + 24} height={frame} fill="var(--housing)" stroke="var(--steel-edge)" strokeWidth={sw} />
        {/* stator stack: yoke + teeth band */}
        <rect x={-half} y={Math.min(y(Rs), y(Ro))} width={L} height={Ro - Rs} fill="var(--steel)" stroke="var(--steel-edge)" strokeWidth={sw} />
        <rect x={-half} y={Math.min(y(Rs), y(Rs + hs))} width={L} height={hs} fill="var(--copper-fill)" opacity={0.55} />
        {/* end windings */}
        {[-1, 1].map((side) => {
          const x0 = side * half;
          const x1 = side * (half + oh);
          const d = `M${x0} ${y(ewR0)} L${x1 - side * oh * 0.35} ${y(ewR0)} Q${x1} ${y(ewR0)} ${x1} ${y((ewR0 + ewR1) / 2)} Q${x1} ${y(ewR1)} ${x1 - side * oh * 0.35} ${y(ewR1)} L${x0} ${y(ewR1)} Z`;
          return <path key={side} d={d} fill="var(--copper-fill)" stroke="var(--steel-edge)" strokeWidth={sw} />;
        })}
        {/* rotor stack (and hub/spider between shaft and core bore) */}
        <rect x={-half} y={Math.min(y(Rcore), y(Rr))} width={L} height={Rr - Rcore} fill="var(--steel-rotor)" stroke="var(--steel-edge)" strokeWidth={sw} />
        {Rcore > Rsh * 0.82 + 1 && <rect x={-half + L * 0.2} y={Math.min(y(Rsh * 0.82), y(Rcore))} width={L * 0.6} height={Rcore - Rsh * 0.82} fill="var(--surface-3)" stroke="var(--steel-edge)" strokeWidth={sw} />}
        {rot.kind === 'pm' && rot.layout === 'spm' && <rect x={-half} y={Math.min(y(Rr - rot.hm * mm - rot.sleeve * mm), y(Rr - rot.sleeve * mm))} width={L} height={rot.hm * mm} fill={sgn > 0 ? 'var(--magnet-n)' : 'var(--magnet-s)'} />}
        {rot.kind === 'pm' && rot.layout !== 'spm' && (
          <rect x={-half + 1} y={Math.min(y(Rr - rot.apexDepth * mm), y(Rr - rot.apexDepth * mm - rot.hm * mm * 2))} width={L - 2} height={rot.hm * mm * 2} fill={sgn > 0 ? 'var(--magnet-n)' : 'var(--magnet-s)'} opacity={0.9} />
        )}
        {rot.kind === 'induction' && (
          <rect x={-half} y={Math.min(y(Rr - rot.slot.metrics.depth), y(Rr))} width={L} height={rot.slot.metrics.depth} fill={ring && r.spec.induction.barMaterial === 'aluminum' ? 'var(--aluminum)' : 'var(--copper-fill)'} opacity={0.8} />
        )}
        {ring &&
          [-1, 1].map((side) => (
            <rect key={side} x={side > 0 ? half : -half - ringW} y={Math.min(y(Rr - ringH), y(Rr))} width={ringW} height={ringH} fill={r.spec.induction.barMaterial === 'aluminum' ? 'var(--aluminum)' : 'var(--copper-fill)'} stroke="var(--steel-edge)" strokeWidth={sw} />
          ))}
        {rot.kind === 'wound_field' &&
          [-1, 1].map((side) => (
            <rect key={side} x={side > 0 ? half : -half - Math.max(6, rot.coilWidth * mm)} y={Math.min(y(Rr - rot.poleShoeHeight * mm - Math.max(4, rot.coilHeight * mm)), y(Rr - rot.poleShoeHeight * mm))} width={Math.max(6, rot.coilWidth * mm)} height={Math.max(4, rot.coilHeight * mm)} fill="var(--copper-fill)" stroke="var(--steel-edge)" strokeWidth={sw} />
          ))}
        {/* bearings */}
        {[-1, 1].map((side) => {
          const xc = side * (half + oh + bearingW * 1.2);
          return (
            <g key={side}>
              <rect x={xc - bearingW / 2} y={Math.min(y(Rsh * 0.82), y(Rsh * 0.82 + bearingW))} width={bearingW} height={bearingW} fill="var(--surface-3)" stroke="var(--steel-edge)" strokeWidth={sw} />
              <circle cx={xc} cy={y(Rsh * 0.82 + bearingW / 2)} r={bearingW * 0.28} fill="var(--shaft)" stroke="var(--steel-edge)" strokeWidth={sw} />
              {/* end shield */}
              <rect x={side > 0 ? xc + bearingW / 2 : xc - bearingW / 2 - frame * 0.6} y={Math.min(y(Rsh * 0.82), y(Ro + frame))} width={frame * 0.6} height={Ro + frame - Rsh * 0.82} fill="var(--housing)" stroke="var(--steel-edge)" strokeWidth={sw} />
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <svg id={svgId} className="cad-svg" viewBox={vb} role="img" aria-label="Axial section" style={{ maxHeight: '70vh' }}>
      {halfShape(-1)}
      {halfShape(1)}
      {/* shaft */}
      <rect x={-totalHalf} y={-Rsh * 0.82} width={2 * totalHalf} height={Rsh * 1.64} fill="var(--shaft)" stroke="var(--steel-edge)" strokeWidth={sw} />
      <line x1={-totalHalf - 8} y1={0} x2={totalHalf + 8} y2={0} stroke="var(--steel-edge)" strokeWidth={sw} strokeDasharray={`${H * 0.04} ${H * 0.015} ${H * 0.008} ${H * 0.015}`} />
      {dims && (
        <g>
          <Dimension x1={-half} y1={-H - fs * 2.2} x2={half} y2={-H - fs * 2.2} label={`L = ${fmt(L, 1)}`} size={fs} ext1={[-half, -Ro]} ext2={[half, -Ro]} />
          <Dimension x1={half} y1={-H - fs * 4.4} x2={half + oh} y2={-H - fs * 4.4} label={`l_oh ${fmt(oh, 1)}`} size={fs * 0.85} ext1={[half, -Ro]} ext2={[half + oh, -Rs - hs]} />
          <Dimension x1={-half - oh} y1={H + fs * 2.2} x2={half + oh} y2={H + fs * 2.2} label={`L + 2·l_oh = ${fmt(L + 2 * oh, 1)}`} size={fs} ext1={[-half - oh, Rs + hs]} ext2={[half + oh, Rs + hs]} />
          <Dimension x1={-half - oh - 30} y1={-Ro} x2={-half - oh - 30} y2={Ro} label={`Ø D_o ${fmt(2 * Ro, 1)}`} size={fs} ext1={[-half, -Ro]} ext2={[-half, Ro]} />
          <Dimension x1={half + oh + bearingW * 3} y1={-Rr} x2={half + oh + bearingW * 3} y2={Rr} label={`Ø D_r ${fmt(2 * Rr, 1)}`} size={fs} ext1={[half, -Rr]} ext2={[half, Rr]} />
        </g>
      )}
    </svg>
  );
}
