import { TWO_PI, gcd, mod } from '../math';
import type { LayerDef, WindingCell, WindingMatrix, WindingSpec } from '../types';
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
  units: number; // turns units per slot (Σ layer turns; equals layers when all layers have equal turns)
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

/**
 * Smallest physical slot shift that rotates the winding by exactly one star-of-slots step
 * (2π·t/Q electrical) without relabelling phases: k·p ≡ t (mod Q).
 */
export function starStepShift(Q: number, poles: number): number {
  const p = poles / 2;
  const t = gcd(Q, p);
  for (let k = 1; k < Q; k++) if (mod(k * p, Q) === t % Q) return k;
  return 1;
}

/**
 * Default layer stack.
 *  - Even L: (go, return) pairs like a double layer with pitch y, each further pair rotated by one
 *    star step.
 *  - Odd L: the same pairs, closed by a three-layer group [b+ ×1, (b+y)− ×2, (b+2y)+ ×1]. Its
 *    middle layer is shared by the return sides of two double layers (pitches +y and −y) and holds
 *    double turns, so the winding closes into coils for every feasible slot/pole combination.
 */
export function defaultLayerDefs(layers: number, pitch: number, Q: number, poles: number): LayerDef[] {
  const L = Math.max(1, layers);
  const step = starStepShift(Q, poles);
  const defs: LayerDef[] = [];
  const pairs = L % 2 === 0 ? L / 2 : (L - 3) / 2;
  for (let j = 0; j < pairs; j++) {
    const base = mod(j * step, Q);
    defs.push({ shift: base, sign: 1 }, { shift: mod(base + pitch, Q), sign: -1 });
  }
  if (L % 2 === 1 && L >= 3) {
    const b = mod(pairs * step, Q);
    defs.push({ shift: b, sign: 1 }, { shift: mod(b + pitch, Q), sign: -1, turns: 2 }, { shift: mod(b + 2 * pitch, Q), sign: 1 });
  }
  return defs;
}

/** Base layer of the star of slots (the top layer of a double-layer winding). */
export function baseLayer(Q: number, poles: number, m: number): WindingCell[] {
  return starOfSlots(Q, poles, m).phasors.map((ph) => ({ phase: ph.phase, sign: ph.sign }));
}

export const layerTurns = (d: LayerDef) => Math.max(1, Math.round(d.turns ?? 1));

/** Layer `def` applied to the base layer: cell k takes the base cell k − shift with polarity `sign`. */
export function shiftedLayer(base: WindingCell[], def: LayerDef): WindingCell[] {
  const Q = base.length;
  const w = layerTurns(def);
  return base.map((_, k) => {
    const c = base[mod(k - Math.round(def.shift), Q)];
    if (c.sign === 0) return { ...c };
    const cell: WindingCell = { phase: c.phase, sign: (c.sign * def.sign) as 1 | -1 };
    if (w !== 1) cell.w = w;
    return cell;
  });
}

/** Turns of + and − coil sides per phase must match for the winding to close into coils. */
export function polarityBalance(matrix: WindingMatrix, m: number): boolean {
  const net = new Array<number>(m).fill(0);
  for (const row of matrix) for (const c of row) if (c.sign !== 0) net[c.phase] += c.sign * (c.w ?? 1);
  return net.every((v) => v === 0);
}

/** Relative turns of each layer (taken from its first occupied cell). */
export function layerWeights(matrix: WindingMatrix): number[] {
  return matrix.map((row) => row.find((c) => c.sign !== 0)?.w ?? 1);
}

/**
 * Build an L-layer winding (L ≥ 2) from a layer stack. Coils connect a + layer with a − layer
 * (the cell at slot k pairs with slot k + span, which by construction carries the same phase with
 * the opposite sign); layer turns act as capacities so a double-turn layer serves two partners.
 */
function stackedLayout(Q: number, poles: number, m: number, defs: LayerDef[], pitch: number) {
  const base = baseLayer(Q, poles, m);
  const matrix = defs.map((d) => shiftedLayer(base, d));
  const coils: Coil[] = [];
  const cap = defs.map(layerTurns);
  const pairing: { go: number; ret: number; span: number; turns: number }[] = [];
  for (let l = 0; l < defs.length; l++) {
    if (defs[l].sign !== 1) continue;
    while (cap[l] > 0) {
      // nearest return layer with free capacity, preferring the closest span to the coil pitch
      let best = -1;
      let bestCost = Infinity;
      for (let r = 0; r < defs.length; r++) {
        if (defs[r].sign !== -1 || cap[r] <= 0) continue;
        const span = mod(Math.round(defs[r].shift) - Math.round(defs[l].shift), Q);
        if (span === 0) continue;
        const d = Math.min(span, Q - span);
        const cost = Math.abs(d - pitch) + 0.01 * Math.abs(r - l);
        if (cost < bestCost) {
          bestCost = cost;
          best = r;
        }
      }
      if (best < 0) break;
      const t = Math.min(cap[l], cap[best]);
      pairing.push({ go: l, ret: best, span: mod(Math.round(defs[best].shift) - Math.round(defs[l].shift), Q), turns: t });
      cap[l] -= t;
      cap[best] -= t;
    }
  }
  for (const pr of pairing) {
    for (let k = 0; k < Q; k++) {
      const c = matrix[pr.go][k];
      if (c.sign === 0) continue;
      const other = { layer: pr.ret, slot: mod(k + pr.span, Q) };
      const here = { layer: pr.go, slot: k };
      for (let i = 0; i < pr.turns; i++) coils.push({ phase: c.phase, sign: 1, go: c.sign === 1 ? here : other, ret: c.sign === 1 ? other : here });
    }
  }
  if (cap.some((c) => c > 0)) {
    const rest = matrix.map((row, l) => (cap[l] > 0 ? row : row.map(() => ({ ...EMPTY }))));
    coils.push(...inferCoils(rest, pitch));
  }
  return { matrix, coils };
}

/** Generate the winding matrix and coil list from a winding specification. */
export function generateLayout(spec: WindingSpec): WindingLayout {
  const { slots: Q, poles, phases: m } = spec;
  const pitch = Math.max(1, Math.round(spec.coilPitch));

  if (spec.custom && spec.custom.length > 0 && spec.custom[0].length === Q) {
    const units = layerWeights(spec.custom).reduce((s, w) => s + w, 0);
    return { matrix: spec.custom, coils: inferCoils(spec.custom, pitch), layers: spec.custom.length, units, kind: 'custom', notes: [] };
  }

  if (spec.layers <= 1) {
    const s = singleLayer(Q, poles, m, pitch);
    return { matrix: s.matrix, coils: s.coils, layers: 1, units: 1, kind: 'single', notes: s.notes };
  }

  if (spec.layers === 2) {
    const d = doubleLayer(Q, poles, m, pitch, 0);
    return { matrix: [d.top, d.bottom], coils: d.coils, layers: 2, units: 2, kind: 'double', notes: [] };
  }

  const L = Math.min(8, Math.round(spec.layers));
  const defs = spec.layerDefs && spec.layerDefs.length >= L ? spec.layerDefs.slice(0, L) : defaultLayerDefs(L, pitch, Q, poles);
  const { matrix, coils } = stackedLayout(Q, poles, m, defs, pitch);
  const notes: string[] = [];
  if (!polarityBalance(matrix, m)) notes.push('The + and − coil-side turns of a phase are unequal, so the winding cannot be closed into coils. Give one layer double turns (e.g. the default stack) or change the polarities.');
  return { matrix, coils, layers: L, units: defs.reduce((s, d) => s + layerTurns(d), 0), kind: 'multi', notes };
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
