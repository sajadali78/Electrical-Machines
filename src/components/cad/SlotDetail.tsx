import type { SlotResult } from '../../core/sizing/result';
import { centroid, shapeOf, splitByWeights, type SlotDimension, type Pt } from '../../core/slots';
import type { LayerArrangement, WindingCell } from '../../core/types';
import { phaseName } from '../../core/winding/phases';
import { fmt, phaseColor } from '../../ui/format';
import { Dimension } from './Dimension';
import { pathFrom, type XY } from './geometry';

interface Props {
  slot: SlotResult;
  R: number; // air-gap surface radius [mm]
  Q: number;
  side: 'stator' | 'rotor';
  cells?: WindingCell[]; // per layer, for slot 0
  arrangement?: LayerArrangement;
  barFill?: string;
  extraDims?: { toothWidth?: number };
  svgId?: string;
  compact?: boolean;
}

/**
 * Detail drawing of one slot with its neighbouring teeth and all shape dimensions.
 * Screen frame: slot axis vertical; the air gap is at the bottom for stators and at the top for rotors.
 */
export function SlotDetail({ slot, R, Q, side, cells, arrangement = 'radial', barFill, extraDims, svgId, compact }: Props) {
  const shape = shapeOf(slot.shape);
  const p = slot.params;
  const depth = shape.depth(p);
  const H = depth * 1.35 + 2;
  const pitch = (2 * Math.PI) / Q;
  const sgn = side === 'stator' ? 1 : -1;

  // local slot point at angular offset `a` → screen (x right, y down; air gap at y = 0)
  const map = ([u, v]: Pt, a = 0): XY => {
    const r = R + sgn * u;
    const x = r * Math.sin(a) + v * Math.cos(a);
    const yAbs = r * Math.cos(a) - v * Math.sin(a);
    return [x, R - yAbs];
  };
  const arcPts = (rad: number, a0: number, a1: number, n = 40): XY[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return map([sgn * (rad - R), 0], a);
    });

  // Lamination patch covering slots −1, 0, +1 out to 1.5 slot pitches.
  const outline = shape.outline(p);
  const edge = 1.5 * pitch;
  const rFar = R + sgn * H;
  const lam: XY[] = [];
  if (shape.closed) {
    lam.push(...arcPts(R, -edge, edge), ...arcPts(rFar, edge, -edge));
  } else {
    lam.push(map([0, 0], -edge));
    for (const k of [-1, 0, 1]) {
      // walk from −edge to +edge (left to right on screen)
      const pts = outline.map((q) => map(q, k * pitch));
      const ordered = pts[0][0] < pts[pts.length - 1][0] ? pts : [...pts].reverse();
      lam.push(...ordered);
    }
    lam.push(map([0, 0], edge));
    lam.push(...arcPts(rFar, edge, -edge));
  }
  const holes = shape.closed ? [-1, 0, 1].map((k) => outline.map((q) => map(q, k * pitch))) : [];

  const regions = shape.conductors(p);
  const L = cells?.length ?? 0;
  const layerPolys = L > 0 ? splitByWeights(regions[0], (cells ?? []).map((c) => c?.w ?? 1), arrangement) : [];

  const xs = lam.map((q) => q[0]);
  const halfW = Math.max(...xs.map(Math.abs));
  const fs = Math.max(0.6, depth * 0.065, halfW * 0.055);
  const pad = fs * 6;
  const yTop = side === 'stator' ? -H - pad * 0.4 : -pad * 1.4;
  const yBot = side === 'stator' ? pad * 1.4 : H + pad * 0.4;
  const vb = `${-halfW - pad} ${yTop} ${2 * (halfW + pad)} ${yBot - yTop}`;
  const sw = fs * 0.06;

  const dims = shape.dimensions(p);
  const dimEls = dims.map((d, i) => <DimEl key={i} d={d} map={map} fs={fs} side={side} />);

  // tooth width annotation (narrowest point from the metrics profile)
  const prof = slot.metrics.toothProfile;
  let toothDim = null;
  if (prof.length) {
    const minP = prof.reduce((a, b) => (b.width < a.width ? b : a));
    const u = Math.min(depth - 0.01, Math.max(0.01, minP.u));
    // right flank of slot 0 and left flank of slot +1 at depth u
    const halfSlot = (pitchAtU(R, Q, u, sgn) - minP.width) / 2;
    const a = map([u, halfSlot], 0);
    const b = map([u, -halfSlot], pitch);
    toothDim = <Dimension x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} label={`b_t ${fmt(extraDims?.toothWidth ?? minP.width, 2)}`} size={fs * 0.85} />;
  }

  return (
    <svg id={svgId} className="cad-svg" viewBox={vb} role="img" aria-label={`${shape.name} slot detail`} style={{ maxHeight: compact ? 260 : 520 }}>
      <path d={pathFrom(lam) + holes.map((h) => pathFrom(h)).join('')} fill="var(--steel)" fillRule="evenodd" stroke="var(--steel-edge)" strokeWidth={sw} />
      {/* air-gap surface reference */}
      <line x1={-halfW - pad} x2={halfW + pad} y1={0} y2={0} stroke="var(--dim)" strokeWidth={sw} strokeDasharray={`${fs * 0.6} ${fs * 0.4}`} opacity={0.5} />
      <text x={-halfW - pad + fs * 0.4} y={side === 'stator' ? fs * 1.3 : -fs * 0.6} fontSize={fs * 0.8} fill="var(--ink-3)">
        air gap
      </text>
      {layerPolys.length > 0
        ? layerPolys.map((poly, l) => {
            const c = cells?.[l];
            const pts = poly.map((q) => map(q));
            const cc = map(centroid(poly));
            return (
              <g key={l}>
                <path d={pathFrom(pts)} fill={c && c.sign ? phaseColor(c.phase) : 'var(--surface-2)'} stroke="var(--surface)" strokeWidth={sw * 1.5} />
                {c && c.sign < 0 && <path d={pathFrom(pts)} fill="url(#hatch-detail)" />}
                {c && c.sign !== 0 && (
                  <text x={cc[0]} y={cc[1]} dy={fs * 0.35} fontSize={fs} textAnchor="middle" fill={c.phase === 2 ? '#0b0b0b' : '#fff'} fontWeight={700}>
                    {phaseName(c.phase)}
                    {c.sign > 0 ? '+' : '−'}
                  </text>
                )}
              </g>
            );
          })
        : regions.map((poly, i) => <path key={i} d={pathFrom(poly.map((q) => map(q)))} fill={barFill ?? 'var(--copper-fill)'} stroke="var(--steel-edge)" strokeWidth={sw} />)}
      <defs>
        <pattern id="hatch-detail" patternUnits="userSpaceOnUse" width={fs * 0.6} height={fs * 0.6} patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={fs * 0.6} stroke="#fff" strokeWidth={fs * 0.12} strokeOpacity="0.55" />
        </pattern>
      </defs>
      {!compact && dimEls}
      {!compact && toothDim}
    </svg>
  );
}

const pitchAtU = (R: number, Q: number, u: number, sgn: number) => (2 * Math.PI * (R + sgn * u)) / Q;

function DimEl({ d, map, fs, side }: { d: SlotDimension; map: (p: Pt) => XY; fs: number; side: 'stator' | 'rotor' }) {
  if (d.type === 'radius') {
    const c = map(d.c);
    const tip = map([d.c[0] + d.r * Math.cos(d.angle), d.c[1] + d.r * Math.sin(d.angle)]);
    const dx = tip[0] - c[0];
    const dy = tip[1] - c[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const out: XY = [tip[0] + ux * fs * 2.2, tip[1] + uy * fs * 2.2];
    const a = fs * 0.5;
    const ang = Math.atan2(uy, ux);
    return (
      <g style={{ color: 'var(--dim)' }}>
        <line x1={c[0]} y1={c[1]} x2={out[0]} y2={out[1]} stroke="currentColor" strokeWidth={fs * 0.07} />
        <path d={`M${tip[0]} ${tip[1]}L${tip[0] - a * Math.cos(ang - 0.35)} ${tip[1] - a * Math.sin(ang - 0.35)}L${tip[0] - a * Math.cos(ang + 0.35)} ${tip[1] - a * Math.sin(ang + 0.35)}Z`} fill="currentColor" />
        <circle cx={c[0]} cy={c[1]} r={fs * 0.12} fill="currentColor" />
        <text x={out[0] + (ux >= 0 ? fs * 0.3 : -fs * 0.3)} y={out[1]} dy={fs * 0.35} fontSize={fs} textAnchor={ux >= 0 ? 'start' : 'end'} fill="currentColor" stroke="var(--surface)" strokeWidth={fs * 0.25} paintOrder="stroke" fontFamily="var(--font-mono)">
          {d.label} {fmt(d.value, 2)}
        </text>
      </g>
    );
  }
  const a0 = map(d.a);
  const b0 = map(d.b);
  // offset in local (u, v) terms → convert through the map for direction
  const scale = fs * 1.15;
  const oa = map([d.a[0] + d.offset[0] * scale * 0.3, d.a[1] + d.offset[1] * scale * 0.3]);
  const ob = map([d.b[0] + d.offset[0] * scale * 0.3, d.b[1] + d.offset[1] * scale * 0.3]);
  void side;
  return <Dimension x1={oa[0]} y1={oa[1]} x2={ob[0]} y2={ob[1]} label={`${d.label} ${fmt(d.value, 2)}`} size={fs * 0.85} ext1={a0} ext2={b0} />;
}
