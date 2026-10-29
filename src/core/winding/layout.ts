import { TWO_PI, gcd, mod } from '../math';
import type { LayerPair, WindingCell, WindingMatrix, WindingSpec } from '../types';
import { starOfSlots } from './starOfSlots';

/** A coil: go side in (layer, slot) and return side in (layer, slot). */
export interface Coil {
  phase: number;
  sign: 1 | -1; // polarity of the go side
  go: { layer: number; slot: number };
  ret: { layer: number; slot: number };
}

export interface WindingLayout {
  matrix: WindingMatrix;
  coils: Coil[];
  layers: number;
  kind: 'single' | 'double' | 'multi' | 'custom';
  notes: string[];
}

const EMPTY: WindingCell = { phase: 0, sign: 0 };

export function emptyMatrix(layers: number, Q: number): WindingMatrix {
  return Array.from({ length: layers }, () => Array.from({ length: Q }, () => ({ ...EMPTY })));
}

/** Default (nearest to full) coil pitch, at least one slot. */
export function defaultPitch(Q: number, poles: number): number {
  return Math.max(1, Math.round(Q / poles));
}

/** Electrical angle of one step of the star of slots. */
export function starStep(Q: number, poles: number): number {
  return (TWO_PI * gcd(Q, poles / 2)) / Q;
}

/**
 * Double-layer winding: the top layer of every slot is assigned from the star of slots, the
 * return side lies `pitch` slots further in the bottom layer.
 */
function doubleLayer(Q: number, poles: number, m: number, pitch: number, sectorOffset: number, layerBase = 0) {
  const star = starOfSlots(Q, poles, m, sectorOffset);
  const top: WindingCell[] = [];
  const bottom: WindingCell[] = Array.from({ length: Q }, () => ({ ...EMPTY }));
  const coils: Coil[] = [];
  for (const ph of star.phasors) {
    top[ph.slot] = { phase: ph.phase, sign: ph.sign };
    const r = mod(ph.slot + pitch, Q);
    bottom[r] = { phase: ph.phase, sign: ph.sign === 1 ? -1 : 1 };
    coils.push({
      phase: ph.phase,
      sign: ph.sign,
      go: { layer: layerBase, slot: ph.slot },
      ret: { layer: layerBase + 1, slot: r },
    });
  }
  return { top, bottom, coils };
}

/**
 * Single-layer winding.
 *  - Integer slots per pole (Q divisible by 2p): every slot is classified as a whole
 *    (equivalent to a full-pitch double layer).
 *  - Otherwise: alternate coils (every second coil of an odd-pitch double layer is kept),
 *    which yields e.g. the alternate-teeth-wound fractional-slot windings.
 */
function singleLayer(Q: number, poles: number, m: number, pitch: number) {
  const notes: string[] = [];
  const matrix = emptyMatrix(1, Q);
  const coils: Coil[] = [];
  const star = starOfSlots(Q, poles, m);
  if (Q % poles === 0) {
    const y = Q / poles;
    for (const ph of star.phasors) matrix[0][ph.slot] = { phase: ph.phase, sign: ph.sign };
    for (const ph of star.phasors) {
      if (ph.sign !== 1) continue;
      // pair each positive side with the opposite side one pole pitch further
      coils.push({ phase: ph.phase, sign: 1, go: { layer: 0, slot: ph.slot }, ret: { layer: 0, slot: mod(ph.slot + y, Q) } });
    }
    if (pitch !== y) notes.push(`Single-layer integer-slot winding uses full pitch y = ${y}.`);
    return { matrix, coils, notes };
  }
  if (Q % 2 !== 0) notes.push('A single-layer winding needs an even number of slots.');
  let y = pitch % 2 === 1 ? pitch : pitch + 1;
  if (y < 1) y = 1;
  if (y !== pitch) notes.push(`Single-layer alternate-coil winding needs an odd pitch; using y = ${y}.`);
  for (let k = 0; k < Q; k += 2) {
    const ph = star.phasors[k];
    const r = mod(k + y, Q);
    matrix[0][k] = { phase: ph.phase, sign: ph.sign };
    matrix[0][r] = { phase: ph.phase, sign: ph.sign === 1 ? -1 : 1 };
    coils.push({ phase: ph.phase, sign: ph.sign, go: { layer: 0, slot: k }, ret: { layer: 0, slot: r } });
  }
  return { matrix, coils, notes };
}

/** Default layer pairs for a multi-layer winding: same pitch, successive one-step sector shifts. */
export function defaultPairs(layers: number, pitch: number): LayerPair[] {
  return Array.from({ length: Math.max(1, Math.floor(layers / 2)) }, (_, j) => ({ pitch, shift: j }));
}

/** Generate the winding matrix and coil list from a winding specification. */
export function generateLayout(spec: WindingSpec): WindingLayout {
  const { slots: Q, poles, phases: m } = spec;
  const pitch = Math.max(1, Math.round(spec.coilPitch));

  if (spec.custom && spec.custom.length > 0 && spec.custom[0].length === Q) {
    return { matrix: spec.custom, coils: inferCoils(spec.custom, pitch), layers: spec.custom.length, kind: 'custom', notes: [] };
  }

  if (spec.layers <= 1) {
    const s = singleLayer(Q, poles, m, pitch);
    return { matrix: s.matrix, coils: s.coils, layers: 1, kind: 'single', notes: s.notes };
  }

  if (spec.layers === 2) {
    const d = doubleLayer(Q, poles, m, pitch, 0);
    return { matrix: [d.top, d.bottom], coils: d.coils, layers: 2, kind: 'double', notes: [] };
  }

  const nPairs = Math.floor(spec.layers / 2);
  const pairs = spec.pairs.length >= nPairs ? spec.pairs.slice(0, nPairs) : defaultPairs(spec.layers, pitch);
  const step = starStep(Q, poles);
  const matrix: WindingMatrix = [];
  const coils: Coil[] = [];
  pairs.forEach((pair, j) => {
    const d = doubleLayer(Q, poles, m, Math.max(1, Math.round(pair.pitch)), pair.shift * step, 2 * j);
    matrix.push(d.top, d.bottom);
    coils.push(...d.coils);
  });
  const notes = spec.layers % 2 === 1 ? [`Odd layer count: automatic layouts use ${2 * nPairs} layers; edit the matrix for custom layer counts.`] : [];
  return { matrix, coils, layers: matrix.length, kind: 'multi', notes };
}

/**
 * Infer coils for a user-edited matrix by greedily pairing each go side with the nearest
 * return side of the same phase, preferring a distance close to the nominal pitch.
 */
export function inferCoils(matrix: WindingMatrix, pitch: number): Coil[] {
  const L = matrix.length;
  const Q = matrix[0]?.length ?? 0;
  const used = matrix.map((row) => row.map(() => false));
  const coils: Coil[] = [];
  for (let l = 0; l < L; l++) {
    for (let k = 0; k < Q; k++) {
      const c = matrix[l][k];
      if (c.sign !== 1 || used[l][k]) continue;
      let best: { layer: number; slot: number; cost: number } | null = null;
      for (let l2 = 0; l2 < L; l2++) {
        for (let d = 1; d < Q; d++) {
          for (const dir of [1, -1]) {
            const k2 = mod(k + dir * d, Q);
            const c2 = matrix[l2][k2];
            if (used[l2][k2] || c2.sign !== -1 || c2.phase !== c.phase) continue;
            const cost = Math.abs(d - pitch) + (dir < 0 ? 0.5 : 0) + (l2 === l && L > 1 ? 0.25 : 0);
            if (!best || cost < best.cost) best = { layer: l2, slot: k2, cost };
          }
        }
      }
      if (best) {
        used[l][k] = true;
        used[best.layer][best.slot] = true;
        coils.push({ phase: c.phase, sign: 1, go: { layer: l, slot: k }, ret: { layer: best.layer, slot: best.slot } });
      }
    }
  }
  return coils;
}

/** Resize/clone a matrix (used when the user starts editing from an automatic layout). */
export function cloneMatrix(matrix: WindingMatrix): WindingMatrix {
  return matrix.map((row) => row.map((c) => ({ ...c })));
}

/** Cycle a cell through A+, A−, B+, B−, …, empty. */
export function cycleCell(cell: WindingCell, m: number): WindingCell {
  if (cell.sign === 0) return { phase: 0, sign: 1 };
  if (cell.sign === 1) return { phase: cell.phase, sign: -1 };
  if (cell.phase + 1 < m) return { phase: cell.phase + 1, sign: 1 };
  return { phase: 0, sign: 0 };
}
