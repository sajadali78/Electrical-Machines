import type { LayerPair, WindingSpec } from '../types';
import { analyzeWinding } from './analysis';
import { generateLayout } from './layout';

export type LayerObjective = 'thd' | 'sigma' | 'subharmonics';

export interface LayerCandidate {
  pairs: LayerPair[];
  kw1: number;
  thd: number;
  score: number;
}

/**
 * Exhaustive search over pitches and sector shifts of a multi-layer winding. The first pair is
 * fixed at shift 0; the others are searched. Candidates with kw1 below `minKw1` are rejected.
 */
export function optimizeLayerPairs(
  spec: WindingSpec,
  objective: LayerObjective = 'thd',
  minKw1 = 0.85,
  limit = 12,
): LayerCandidate[] {
  const nPairs = Math.max(1, Math.floor(spec.layers / 2));
  const Q = spec.slots;
  const p = spec.poles / 2;
  const yFull = Q / spec.poles;
  const pitches = [...new Set([Math.floor(yFull), Math.ceil(yFull), Math.floor(yFull) - 1, Math.ceil(yFull) + 1])].filter(
    (y) => y >= 1 && y < Q,
  );
  const shifts = Array.from({ length: Math.min(Q, 12) }, (_, i) => i);
  const maxOrder = Math.min(4 * Q, 60 * p);
  const results: LayerCandidate[] = [];
  const budget = 4000;
  let evaluated = 0;

  const evaluate = (pairs: LayerPair[]) => {
    evaluated++;
    const layout = generateLayout({ ...spec, layers: 2 * nPairs, pairs, custom: null });
    const a = analyzeWinding(layout.matrix, spec.poles, spec.phases, [], { maxOrder, fast: true });
    if (!a.balanced || a.kw1 < minKw1) return;
    let score = a.thdMmf;
    if (objective === 'sigma') score = a.harmonics.reduce((s, h) => (h.order === p ? s : s + h.mmfRel ** 2), 0);
    if (objective === 'subharmonics') score = a.harmonics.filter((h) => h.order < p).reduce((s, h) => s + h.mmfRel, 0) + 0.1 * a.thdMmf;
    results.push({ pairs: pairs.map((x) => ({ ...x })), kw1: a.kw1, thd: a.thdMmf, score });
  };

  const rec = (j: number, acc: LayerPair[]) => {
    if (evaluated >= budget) return;
    if (j === nPairs) return evaluate(acc);
    for (const y of pitches) {
      for (const s of j === 0 ? [0] : shifts) {
        acc.push({ pitch: y, shift: s });
        rec(j + 1, acc);
        acc.pop();
      }
    }
  };
  rec(0, []);

  results.sort((a, b) => a.score - b.score || b.kw1 - a.kw1);
  const unique: LayerCandidate[] = [];
  for (const r of results) {
    if (unique.some((u) => Math.abs(u.score - r.score) < 1e-9 && Math.abs(u.kw1 - r.kw1) < 1e-9)) continue;
    unique.push(r);
    if (unique.length >= limit) break;
  }
  return unique;
}
