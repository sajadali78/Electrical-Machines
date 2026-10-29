import { gcd, lcm } from '../math';
import { analyzeWinding } from './analysis';
import { defaultPitch, generateLayout } from './layout';

export interface CombinationCell {
  Q: number;
  poles: number;
  q: number;
  feasible: boolean;
  kw1: number;
  pitch: number;
  lcm: number;
  gcd: number;
}

/**
 * Winding factor table over slot and pole counts (like the classic slot/pole charts).
 * Uses a double-layer winding with the default (nearest full) pitch, or single layer.
 */
export function combinationTable(slotList: number[], poleList: number[], m: number, layers: 1 | 2 = 2): CombinationCell[][] {
  return slotList.map((Q) =>
    poleList.map((poles) => {
      const p = poles / 2;
      const t = gcd(Q, p);
      const q = Q / (poles * m);
      const pitch = defaultPitch(Q, poles);
      const base = { Q, poles, q, pitch, lcm: lcm(Q, poles), gcd: gcd(Q, poles) };
      const symmetric = Q % (m * t) === 0 && q >= 0.25 && q <= 6;
      const singleOk = layers === 1 ? Q % 2 === 0 && (Q / t) % 2 === 0 : true;
      if (!symmetric || !singleOk || poles >= 2 * Q) return { ...base, feasible: false, kw1: 0 };
      const layout = generateLayout({
        slots: Q,
        poles,
        phases: m,
        layers,
        coilPitch: pitch,
        pairs: [],
        parallelPaths: 1,
        arrangement: 'radial',
        skewSlots: 0,
        custom: null,
      });
      const a = analyzeWinding(layout.matrix, poles, m, [], { maxOrder: p, fast: true });
      return { ...base, feasible: a.balanced, kw1: a.balanced ? a.kw1 : 0 };
    }),
  );
}
