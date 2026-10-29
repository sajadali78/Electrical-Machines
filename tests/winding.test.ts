import { describe, expect, it } from 'vitest';
import { alternativeSlots, analyzeWinding, baseSpectrum, hasDuplicateLayers, defaultLayerDefs, defaultPitch, generateLayout, optimizeLayerStack, polarityBalance, suggestWindings } from '../src/core/winding';
import type { WindingSpec } from '../src/core/types';

const spec = (Q: number, poles: number, layers: number, pitch?: number, extra: Partial<WindingSpec> = {}): WindingSpec => ({
  slots: Q,
  poles,
  phases: 3,
  layers,
  coilPitch: pitch ?? defaultPitch(Q, poles),
  layerDefs: [],
  parallelPaths: 1,
  arrangement: 'radial',
  skewSlots: 0,
  custom: null,
  ...extra,
});

const kw1 = (s: WindingSpec) => {
  const l = generateLayout(s);
  return analyzeWinding(l.matrix, s.poles, s.phases, l.coils, { pitch: s.coilPitch });
};

describe('winding factors (known textbook values)', () => {
  it('36 slots / 4 poles full pitch double layer: kw1 = kd = 0.9598', () => {
    const a = kw1(spec(36, 4, 2, 9));
    expect(a.kw1).toBeCloseTo(0.9598, 3);
    expect(a.balanced).toBe(true);
    expect(a.maxParallelPaths).toBe(4);
  });
  it('24/4 with 5/6 pitch: kw1 = 0.9330', () => {
    expect(kw1(spec(24, 4, 2, 5)).kw1).toBeCloseTo(0.933, 3);
  });
  it('12/10 double layer tooth coils: kw1 = 0.9330', () => {
    const a = kw1(spec(12, 10, 2, 1));
    expect(a.kw1).toBeCloseTo(0.933, 3);
    expect(a.balanced).toBe(true);
  });
  it('12/10 single layer alternate teeth: kw1 = 0.9659', () => {
    const a = kw1(spec(12, 10, 1, 1));
    expect(a.kw1).toBeCloseTo(0.9659, 3);
    expect(a.balanced).toBe(true);
    expect(a.maxParallelPaths).toBe(2);
  });
  it('9/8: kw1 = 0.9452', () => {
    expect(kw1(spec(9, 8, 2, 1)).kw1).toBeCloseTo(0.9452, 3);
  });
  it('12/8 (q = 1/2): kw1 = 0.8660', () => {
    expect(kw1(spec(12, 8, 2, 1)).kw1).toBeCloseTo(0.866, 3);
  });
  it('24/4 single layer integer slot: kw1 = 0.9659', () => {
    const a = kw1(spec(24, 4, 1, 6));
    expect(a.kw1).toBeCloseTo(0.9659, 3);
    expect(a.maxParallelPaths).toBe(2);
  });
  it('flags infeasible combinations', () => {
    expect(kw1(spec(12, 12, 2, 1)).balanced).toBe(false);
  });
});

describe('MMF harmonics', () => {
  it('integer-slot windings have no even or triplen MMF harmonics', () => {
    const a = kw1(spec(36, 4, 2, 9));
    const h = (nu: number) => a.harmonics[nu - 1];
    expect(h(2).mmfRel).toBeCloseTo(1, 6); // ν = p is the working wave
    expect(h(6).mmf).toBeLessThan(1e-9); // 3rd electrical
    expect(h(4).mmf).toBeLessThan(1e-9); // 2nd electrical
    expect(h(10).direction).toBe('bwd'); // 5th electrical travels backwards
    expect(h(14).direction).toBe('fwd'); // 7th forwards
  });
  it('differential leakage of a full-pitch q=3 winding ≈ 0.0141', () => {
    // Classical value for q = 3, full pitch (Richter/Pyrhönen tables).
    expect(kw1(spec(36, 4, 2, 9)).sigmaDiff).toBeCloseTo(0.0141, 3);
  });
});

describe('multi-layer windings (layer stacks)', () => {
  const stack = (...d: [number, 1 | -1][]) => d.map(([shift, sign]) => ({ shift, sign }));

  it('36/4 double layer with 7/9 pitch (k_w1 = 0.9019) and a 3-entry stack builds 3 layers', () => {
    const dl = kw1(spec(36, 4, 2, 7));
    const st = generateLayout(spec(36, 4, 3, 7, { layerDefs: stack([0, 1], [7, -1], [0, 1]) }));
    expect(st.layers).toBe(3);
    expect(dl.kw1).toBeCloseTo(0.9019, 3);
  });

  it('4-layer 12/10 with sub-windings 5 slots apart (one star step) suppresses the sub-harmonic', () => {
    const dl = kw1(spec(12, 10, 2, 1));
    const ml = kw1(spec(12, 10, 4, 1, { layerDefs: stack([0, 1], [1, -1], [5, 1], [6, -1]) }));
    expect(ml.balanced).toBe(true);
    expect(ml.layers).toBe(4);
    expect(ml.kw1).toBeCloseTo(0.933 * Math.cos(Math.PI / 12), 3);
    expect(ml.harmonics[0].mmfRel).toBeLessThan(0.3 * dl.harmonics[0].mmfRel);
  });

  it('default stacks: even counts equal the shifted double layers, odd counts end with a go layer', () => {
    expect(defaultLayerDefs(4, 1, 12, 10)).toEqual(stack([0, 1], [1, -1], [5, 1], [6, -1]));
    expect(defaultLayerDefs(3, 8, 36, 4)).toEqual(stack([0, 1], [8, -1], [1, 1]));
  });

  it('3-layer 12/10 winding [0+, 1−, 2+] is balanced and closable', () => {
    const s = spec(12, 10, 3, 1, { layerDefs: stack([0, 1], [1, -1], [2, 1]) });
    const l = generateLayout(s);
    const a = analyzeWinding(l.matrix, 10, 3, l.coils, {});
    expect(a.balanced).toBe(true);
    expect(polarityBalance(l.matrix, 3)).toBe(true);
    // |1 − e^{−j150°} + e^{−j300°}| / 3 × k_w,base(=0.9659)
    expect(a.kw1).toBeCloseTo(0.9659 * (Math.hypot(1 + 0.866 + 0.5, 0.5 + 0.866) / 3), 3);
    expect(l.coils.length).toBe((3 * 12) / 2);
  });

  it('detects coinciding layers (12/10 is anti-periodic: a 6-slot shift negates the base layer)', () => {
    const bs = baseSpectrum(12, 10, 3, 5);
    expect(bs.antiperiodic).toBe(true);
    expect(hasDuplicateLayers(bs, stack([0, 1], [1, -1], [5, 1], [6, -1]))).toBe(true);
    expect(hasDuplicateLayers(bs, stack([0, 1], [1, -1], [2, 1]))).toBe(false);
  });

  it('odd layer counts are flagged when the base layer itself is not polarity-balanced (9/8)', () => {
    const l = generateLayout(spec(9, 8, 3, 1));
    expect(l.notes.join(' ')).toMatch(/unequal/);
  });

  it('stack optimiser: candidates sorted by score and consistent with the full analysis', () => {
    for (const L of [3, 4]) {
      const c = optimizeLayerStack(12, 10, 3, L, 1, 'subharmonics', 0.85);
      expect(c.length).toBeGreaterThan(0);
      for (let i = 1; i < c.length; i++) expect(c[i].score).toBeGreaterThanOrEqual(c[i - 1].score);
      const best = c[0];
      const a = kw1(spec(12, 10, L, 1, { layerDefs: best.defs }));
      expect(a.kw1).toBeCloseTo(best.kw1, 6);
    }
  });
});

describe('winding suggestions', () => {
  it('suggests single, double and 3/4-layer configurations for 12/10', () => {
    const r = suggestWindings(12, 10, 3, 4);
    expect(r.feasible).toBe(true);
    const layers = new Set(r.suggestions.map((s) => s.layers));
    for (const L of [1, 2, 3, 4]) expect(layers.has(L)).toBe(true);
    const top = r.suggestions.find((s) => s.tags.includes('highest k_w1'))!;
    expect(top.kw1).toBeCloseTo(0.9659, 3); // single-layer alternate teeth
  });
  it('rejects infeasible combinations', () => {
    expect(suggestWindings(12, 12, 3).feasible).toBe(false);
  });
  it('alternative slot numbers are feasible and sorted by k_w1', () => {
    const alt = alternativeSlots(10, 3, 12);
    expect(alt.length).toBeGreaterThan(2);
    for (let i = 1; i < alt.length; i++) expect(alt[i].kw1).toBeLessThanOrEqual(alt[i - 1].kw1);
  });
});
