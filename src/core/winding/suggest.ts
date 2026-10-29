import { gcd, lcm } from '../math';
import type { LayerDef, WindingSpec } from '../types';
import { analyzeWinding } from './analysis';
import { defaultLayerDefs, defaultPitch, generateLayout } from './layout';
import { baseSpectrum, hasDuplicateLayers, optimizeLayerStack, type LayerObjective } from './optimizeLayers';

export interface WindingSuggestion {
  id: string;
  layers: number;
  coilPitch: number;
  layerDefs: LayerDef[] | null; // for layer stacks (≥ 3 layers)
  kw1: number;
  thd: number;
  sigma: number;
  subharmonics: number; // Σ relative MMF amplitude of orders below the working wave
  maxParallelPaths: number;
  avgSpan: number; // average coil span in slots (end-winding length indicator)
  tags: string[];
}

export interface SuggestionResult {
  feasible: boolean;
  reason: string | null;
  q: number;
  t: number;
  suggestions: WindingSuggestion[];
}

const baseSpec = (Q: number, poles: number, m: number): WindingSpec => ({
  slots: Q,
  poles,
  phases: m,
  layers: 2,
  coilPitch: defaultPitch(Q, poles),
  layerDefs: [],
  parallelPaths: 1,
  arrangement: 'radial',
  skewSlots: 0,
  custom: null,
});

function evaluate(spec: WindingSpec, id: string, tags: string[]): WindingSuggestion | null {
  const layout = generateLayout(spec);
  const p = spec.poles / 2;
  const a = analyzeWinding(layout.matrix, spec.poles, spec.phases, layout.coils, {
    maxOrder: Math.min(Math.max(6 * spec.slots, 60 * p), 720),
    fast: true,
  });
  if (!a.balanced || layout.notes.some((n) => n.includes('unequal'))) return null;
  const sub = a.harmonics.filter((h) => h.order < p).reduce((s, h) => s + h.mmfRel, 0);
  const avgSpan = layout.coils.length
    ? layout.coils.reduce((s, c) => {
        const d = Math.abs(c.ret.slot - c.go.slot);
        return s + Math.min(d, spec.slots - d);
      }, 0) / layout.coils.length
    : 0;
  return {
    id,
    layers: layout.layers,
    coilPitch: spec.coilPitch,
    layerDefs: spec.layers >= 3 ? (spec.layerDefs.length ? spec.layerDefs : null) : null,
    kw1: a.kw1,
    thd: a.thdMmf,
    sigma: a.sigmaDiff,
    subharmonics: sub,
    maxParallelPaths: a.maxParallelPaths,
    avgSpan,
    tags,
  };
}

/**
 * Winding configuration suggestions for a slot/pole/phase combination (in the spirit of the
 * classic online winding calculators): feasibility from the star of slots, every sensible coil
 * span for single- and double-layer windings, and optimised layer stacks for 3…maxLayers layers.
 */
export function suggestWindings(Q: number, poles: number, m: number, maxLayers = 4, objective: LayerObjective = 'thd'): SuggestionResult {
  const p = poles / 2;
  const t = gcd(Q, p);
  const q = Q / (poles * m);
  if (Q % (m * t) !== 0) {
    return { feasible: false, reason: `Not feasible: Q/(m·t) = ${Q}/(${m}·${t}) must be an integer for a balanced ${m}-phase winding.`, q, t, suggestions: [] };
  }
  if (poles >= 2 * Q) return { feasible: false, reason: 'Too many poles for the number of slots.', q, t, suggestions: [] };

  const out: WindingSuggestion[] = [];
  const yFull = Q / poles;

  // single layer
  if (Q % poles === 0) {
    const s = evaluate({ ...baseSpec(Q, poles, m), layers: 1, coilPitch: Q / poles }, 'L1-full', ['full pitch']);
    if (s) out.push(s);
  } else if (Q % 2 === 0 && (Q / t) % 2 === 0) {
    const odd = new Set<number>();
    for (let y = Math.max(1, Math.floor(yFull) - 2); y <= Math.ceil(yFull) + 2; y++) if (y % 2 === 1 && y < Q) odd.add(y);
    for (const y of odd) {
      const s = evaluate({ ...baseSpec(Q, poles, m), layers: 1, coilPitch: y }, `L1-y${y}`, y === 1 ? ['tooth coils', 'alternate teeth'] : []);
      if (s) out.push(s);
    }
  }

  // double layer, every coil span from about 0.6 of full pitch to full pitch (+1)
  const yMin = Math.max(1, Math.round(0.6 * yFull));
  const yMax = Math.min(Q - 1, Math.max(1, Math.ceil(yFull)));
  for (let y = yMin; y <= yMax; y++) {
    const tags: string[] = [];
    if (y === 1) tags.push('tooth coils');
    if (Math.abs(y - yFull) < 1e-9) tags.push('full pitch');
    else if (y < yFull) tags.push(`short pitch ${y}/${+yFull.toFixed(3)}`);
    const s = evaluate({ ...baseSpec(Q, poles, m), layers: 2, coilPitch: y }, `L2-y${y}`, tags);
    if (s) out.push(s);
  }

  // layer stacks (3…maxLayers): best coil span of the double layer as starting point
  const best2 = out.filter((s) => s.layers === 2).sort((a, b) => b.kw1 - a.kw1)[0];
  const pitch = best2?.coilPitch ?? defaultPitch(Q, poles);
  const kwRef = best2?.kw1 ?? 0.9;
  const bs = baseSpectrum(Q, poles, m, p);
  for (let L = 3; L <= Math.min(8, maxLayers); L++) {
    // every layer count must be offered: relax the k_w1 floor, finally fall back to the default stack
    let cands = optimizeLayerStack(Q, poles, m, L, pitch, objective, 0.9 * kwRef, 3);
    if (!cands.length) cands = optimizeLayerStack(Q, poles, m, L, pitch, objective, 0.3, 3);
    if (!cands.length) cands = [{ defs: defaultLayerDefs(L, pitch, Q, poles), kw1: 0, thd: 0, sigma: 0, subharmonics: 0, score: 0 }];
    cands.forEach((c, i) => {
      const tags = [`optimised (${objective === 'thd' ? 'min THD' : objective})`];
      if (c.defs.some((d) => (d.turns ?? 1) > 1)) tags.push('double-turn layer');
      if (hasDuplicateLayers(bs, c.defs)) tags.push('layers coincide (unequal turns)');
      const s = evaluate({ ...baseSpec(Q, poles, m), layers: L, coilPitch: pitch, layerDefs: c.defs }, `L${L}-${i}`, tags);
      if (s) out.push(s);
    });
  }

  // drop weak options and stacks that behave exactly like a configuration with fewer layers
  const kept: WindingSuggestion[] = [];
  for (const s of out.sort((a, b) => a.layers - b.layers || b.kw1 - a.kw1)) {
    const firstOfCount = !kept.some((k) => k.layers === s.layers);
    if (s.kw1 < 0.5 && !(firstOfCount && s.layers >= 3)) continue;
    const twin = kept.find((k) => k.layers < s.layers && Math.abs(k.kw1 - s.kw1) < 1e-6 && Math.abs(k.thd - s.thd) < 1e-6);
    if (twin) {
      if (!firstOfCount) continue;
      s.tags.push(`same harmonics as ${twin.layers === 1 ? 'single' : twin.layers === 2 ? 'double' : `${twin.layers}-layer`} winding`);
    }
    kept.push(s);
  }
  out.length = 0;
  out.push(...kept);

  if (out.length) {
    const top = out.reduce((a, b) => (b.kw1 > a.kw1 + 1e-9 || (Math.abs(b.kw1 - a.kw1) < 1e-9 && b.thd < a.thd) ? b : a));
    top.tags.unshift('highest k_w1');
    const quiet = out.reduce((a, b) => (b.thd < a.thd ? b : a));
    if (quiet !== top) quiet.tags.unshift('lowest MMF THD');
  }
  return { feasible: out.length > 0, reason: out.length ? null : 'No balanced winding found for this combination.', q, t, suggestions: out };
}

export interface SlotAlternative {
  Q: number;
  q: number;
  kw1: number;
  pitch: number;
  layers: number;
  lcm: number;
  gcd: number;
}

/** Alternative slot numbers for the given pole count, ranked by the best double/single-layer k_w1. */
export function alternativeSlots(poles: number, m: number, Qcur: number, count = 8): SlotAlternative[] {
  const p = poles / 2;
  const lo = Math.max(m, Math.round(0.5 * Qcur));
  const hi = Math.max(lo + m, Math.round(2 * Qcur));
  const out: SlotAlternative[] = [];
  for (let Q = lo; Q <= hi; Q++) {
    if (Q % m !== 0 || Q === Qcur || poles >= 2 * Q) continue;
    const t = gcd(Q, p);
    if (Q % (m * t) !== 0) continue;
    let best: SlotAlternative | null = null;
    const yFull = Q / poles;
    for (let y = Math.max(1, Math.round(0.7 * yFull)); y <= Math.max(1, Math.ceil(yFull)); y++) {
      const layout = generateLayout({ ...baseSpec(Q, poles, m), coilPitch: y });
      const a = analyzeWinding(layout.matrix, poles, m, [], { maxOrder: p, fast: true });
      if (!a.balanced) continue;
      if (!best || a.kw1 > best.kw1) best = { Q, q: Q / (poles * m), kw1: a.kw1, pitch: y, layers: 2, lcm: lcm(Q, poles), gcd: gcd(Q, poles) };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.kw1 - a.kw1 || b.lcm - a.lcm).slice(0, count);
}
