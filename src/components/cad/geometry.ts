/**
 * Pure geometry → SVG path builders for the radial cross-section (mm, centre at origin,
 * SVG y axis pointing down). Slot k sits at θ_k = 90° − 360°·k/Q (clockwise numbering from top).
 */
import { ipmMagnetRects } from '../../core/sizing/rotor/pm';
import type { DesignResult, SlotResult } from '../../core/sizing/result';
import { shapeOf, splitEqualArea, centroid, bounds, type Pt } from '../../core/slots';
import type { LayerArrangement, WindingMatrix } from '../../core/types';

export type XY = [number, number];

export const slotTheta = (k: number, Q: number, offset = 0) => Math.PI / 2 - (2 * Math.PI * k) / Q + offset;

/** Local slot point (u depth, v tangential) → screen coordinates. */
export function toXY(R: number, theta: number, [u, v]: Pt, side: 'stator' | 'rotor'): XY {
  const r = side === 'stator' ? R + u : R - u;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const x = r * c - v * s;
  const y = r * s + v * c;
  return [x, -y];
}

const f = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));
export const pathFrom = (pts: XY[], close = true) => (pts.length ? `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}${close ? 'Z' : ''}` : '');

export function circlePath(r: number, cx = 0, cy = 0): string {
  return `M${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}Z`;
}

/** Annular sector between radii r1 < r2 spanning [a0, a1] (math angles, rad). */
export function sectorPath(r1: number, r2: number, a0: number, a1: number): string {
  const p = (r: number, a: number): XY => [r * Math.cos(a), -r * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x1, y1] = p(r2, a0);
  const [x2, y2] = p(r2, a1);
  const [x3, y3] = p(r1, a1);
  const [x4, y4] = p(r1, a0);
  return `M${f(x1)} ${f(y1)}A${f(r2)} ${f(r2)} 0 ${large} 0 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${f(r1)} ${f(r1)} 0 ${large} 1 ${f(x4)} ${f(y4)}Z`;
}

/**
 * Lamination with Q slots cut from the air-gap surface. Returns one even-odd path:
 * the toothed boundary plus `otherR` (outer circle for stators, shaft hole for rotors).
 */
export function laminationPath(slot: SlotResult, R: number, Q: number, side: 'stator' | 'rotor', otherR: number, offset = 0): string {
  const shape = shapeOf(slot.shape);
  const outline = shape.outline(slot.params);
  let d = '';
  if (shape.closed) {
    d += circlePath(R);
    for (let k = 0; k < Q; k++) d += pathFrom(outline.map((p) => toXY(R, slotTheta(k, Q, offset), p, side)));
  } else {
    const rev = [...outline].reverse(); // from +v edge to −v edge
    const sweep = 1; // clockwise on screen between consecutive slots
    for (let k = 0; k < Q; k++) {
      const pts = rev.map((p) => toXY(R, slotTheta(k, Q, offset), p, side));
      if (k === 0) d += `M${f(pts[0][0])} ${f(pts[0][1])}`;
      else d += `A${f(R)} ${f(R)} 0 0 ${sweep} ${f(pts[0][0])} ${f(pts[0][1])}`;
      d += pts.slice(1).map(([x, y]) => `L${f(x)} ${f(y)}`).join('');
    }
    const first = toXY(R, slotTheta(0, Q, offset), rev[0], side);
    d += `A${f(R)} ${f(R)} 0 0 ${sweep} ${f(first[0])} ${f(first[1])}Z`;
  }
  if (otherR > 0) d += circlePath(otherR);
  return d;
}

export interface ConductorCell {
  slot: number;
  layer: number;
  d: string;
  phase: number;
  sign: 1 | -1 | 0;
  cx: number;
  cy: number;
  label: number; // font size that fits the cell
}

/** Layered conductor polygons for a wound slot set, coloured by the winding matrix. */
export function windingCells(slot: SlotResult, R: number, Q: number, side: 'stator' | 'rotor', matrix: WindingMatrix, arrangement: LayerArrangement, offset = 0): ConductorCell[] {
  const shape = shapeOf(slot.shape);
  const region = shape.conductors(slot.params)[0];
  const L = matrix.length;
  const layers = splitEqualArea(region, L, arrangement); // layer 0 nearest the air gap
  const out: ConductorCell[] = [];
  for (let k = 0; k < Q; k++) {
    const th = slotTheta(k, Q, offset);
    layers.forEach((poly, l) => {
      if (poly.length < 3) return;
      const cell = matrix[l]?.[k] ?? { phase: 0, sign: 0 };
      const pts = poly.map((p) => toXY(R, th, p, side));
      const c = toXY(R, th, centroid(poly), side);
      const b = bounds([poly]);
      // "A+" is about 1.3 em wide and 0.8 em tall
      const label = Math.max(0.3, Math.min((b.vMax - b.vMin) / 1.45, (b.uMax - b.uMin) / 1.0));
      out.push({ slot: k, layer: l, d: pathFrom(pts), phase: cell.phase, sign: cell.sign, cx: c[0], cy: c[1], label });
    });
  }
  return out;
}

/** Bars (cage) or field conductors filling the whole conductor region of each slot. */
export function barPaths(slot: SlotResult, R: number, Q: number, side: 'stator' | 'rotor', offset = 0, filter?: (k: number) => boolean): { slot: number; d: string; cx: number; cy: number }[] {
  const shape = shapeOf(slot.shape);
  const regions = shape.conductors(slot.params);
  const out: { slot: number; d: string; cx: number; cy: number }[] = [];
  for (let k = 0; k < Q; k++) {
    if (filter && !filter(k)) continue;
    const th = slotTheta(k, Q, offset);
    const d = regions.map((poly) => pathFrom(poly.map((p) => toXY(R, th, p, side)))).join('');
    const c = toXY(R, th, centroid(regions[0]), side);
    out.push({ slot: k, d, cx: c[0], cy: c[1] });
  }
  return out;
}

export function slotOutlinePath(slot: SlotResult, R: number, k: number, Q: number, side: 'stator' | 'rotor', offset = 0): string {
  const shape = shapeOf(slot.shape);
  return pathFrom(shape.outline(slot.params).map((p) => toXY(R, slotTheta(k, Q, offset), p, side)));
}

export interface MagnetShape {
  d: string;
  north: boolean;
  pole: number;
  arrow: [XY, XY];
}

const rot = ([x, y]: [number, number], a: number): XY => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const X = x * c - y * s;
  const Y = x * s + y * c;
  return [X, -Y];
};

/** Pole centre angle (math) for pole j: pole 0 at the top, clockwise. */
export const poleTheta = (j: number, poles: number) => Math.PI / 2 - (2 * Math.PI * j) / poles;

export function magnetShapes(r: DesignResult): MagnetShape[] {
  const rotor = r.rotor;
  if (rotor.kind !== 'pm') return [];
  const poles = r.main.poles;
  const mm = 1000;
  const out: MagnetShape[] = [];
  for (let j = 0; j < poles; j++) {
    const th = poleTheta(j, poles);
    const north = j % 2 === 0;
    if (rotor.layout === 'spm') {
      const r1 = rotor.coreOuterR * mm;
      const r2 = r1 + rotor.hm * mm;
      const half = (rotor.poleArc * Math.PI) / poles;
      const a: XY = [((r1 + r2) / 2) * Math.cos(th), -((r1 + r2) / 2) * Math.sin(th)];
      const dir = north ? 1 : -1;
      const len = rotor.hm * mm * 0.38;
      out.push({
        d: sectorPath(r1, r2, th - half, th + half),
        north,
        pole: j,
        arrow: [
          [a[0] - dir * len * Math.cos(th), a[1] + dir * len * Math.sin(th)],
          [a[0] + dir * len * Math.cos(th), a[1] - dir * len * Math.sin(th)],
        ],
      });
    } else {
      const xa = (rotor.Dr / 2 - rotor.apexDepth) * mm;
      const rects = ipmMagnetRects(rotor.layout === 'ipm-v' ? 'v' : 'bar', xa, rotor.hm * mm, rotor.wm * mm, rotor.vAngle, rotor.bridge * mm);
      for (const rect of rects) {
        const pts = rect.map((p) => rot(p, th));
        // magnetisation perpendicular to the long side, towards the air gap for N poles
        const [p0, p1, , p3] = rect;
        const mid: [number, number] = [(p0[0] + p1[0] + rect[2][0] + p3[0]) / 4, (p0[1] + p1[1] + rect[2][1] + p3[1]) / 4];
        const nx = p0[0] - p3[0];
        const ny = p0[1] - p3[1];
        const nl = Math.hypot(nx, ny) || 1;
        const s = (north ? 1 : -1) * rotor.hm * mm * 0.35;
        const a0: [number, number] = [mid[0] - (nx / nl) * s, mid[1] - (ny / nl) * s];
        const a1: [number, number] = [mid[0] + (nx / nl) * s, mid[1] + (ny / nl) * s];
        out.push({ d: pathFrom(pts), north, pole: j, arrow: [rot(a0, th), rot(a1, th)] });
      }
    }
  }
  return out;
}

export interface SalientPole {
  pole: number;
  d: string;
  coils: { d: string; sign: 1 | -1; cx: number; cy: number }[];
}

export function salientPoles(r: DesignResult): { poles: SalientPole[]; hubR: number } {
  const rotor = r.rotor;
  if (rotor.kind !== 'wound_field' || rotor.poleType !== 'salient') return { poles: [], hubR: 0 };
  const mm = 1000;
  const P = r.main.poles;
  const Rr = (rotor.Dr / 2) * mm;
  const shoe = rotor.poleShoeHeight * mm;
  const bp = rotor.poleBodyWidth * mm;
  const hp = rotor.poleBodyHeight * mm;
  const hubR = Rr - shoe - hp;
  const half = (rotor.poleArc * Math.PI) / P;
  const out: SalientPole[] = [];
  for (let j = 0; j < P; j++) {
    const th = poleTheta(j, P);
    const local: [number, number][] = [[hubR - 2, -bp / 2], [Rr - shoe, -bp / 2]];
    const n = 24;
    local.push([(Rr - shoe) * Math.cos(-half), (Rr - shoe) * Math.sin(-half)]);
    for (let i = 0; i <= n; i++) {
      const a = -half + (2 * half * i) / n;
      local.push([Rr * Math.cos(a), Rr * Math.sin(a)]);
    }
    local.push([(Rr - shoe) * Math.cos(half), (Rr - shoe) * Math.sin(half)]);
    local.push([Rr - shoe, bp / 2], [hubR - 2, bp / 2]);
    const coils: SalientPole['coils'] = [];
    const sign: 1 | -1 = j % 2 === 0 ? 1 : -1;
    const ch = Math.min(rotor.coilHeight * mm, hp - 2);
    const top = Rr - shoe - 1.5;
    const wcTop = Math.max(1, rotor.coilWidth * mm);
    for (const s of [1, -1] as const) {
      const y0 = s * (bp / 2 + 1);
      const y1 = s * (bp / 2 + 1 + wcTop);
      const quad: [number, number][] = [[top, y0], [top, y1], [top - ch, y1 * 0.85 + y0 * 0.15], [top - ch, y0]];
      const pts = quad.map((p) => rot(p, th));
      const c = rot([top - ch / 2, (y0 + y1) / 2], th);
      coils.push({ d: pathFrom(pts), sign: (sign * s) as 1 | -1, cx: c[0], cy: c[1] });
    }
    out.push({ pole: j, d: pathFrom(local.map((p) => rot(p, th))), coils });
  }
  return { poles: out, hubR };
}

/** Wound slots of a cylindrical field rotor: slots outside the unwound band around each pole axis. */
export function cylindricalWound(r: DesignResult): { filter: (k: number) => boolean; sign: (k: number) => 1 | -1 } {
  const rotor = r.rotor;
  const P = r.main.poles;
  if (rotor.kind !== 'wound_field') return { filter: () => false, sign: () => 1 };
  const perPole = rotor.Qr / P;
  const unwound = Math.max(0, perPole - rotor.woundSlotsPerPole);
  // position in slot pitches relative to the nearest pole centre (pole j is centred on slot j·perPole)
  const rel = (k: number) => ((((k + perPole / 2) % perPole) + perPole) % perPole) - perPole / 2;
  return {
    filter: (k) => Math.abs(rel(k)) > (unwound - 1) / 2 + 1e-9,
    sign: (k) => {
      const pole = Math.round(k / perPole) % P;
      return ((pole % 2 === 0 ? 1 : -1) * (rel(k) < 0 ? -1 : 1)) as 1 | -1;
    },
  };
}
