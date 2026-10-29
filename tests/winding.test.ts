import { describe, expect, it } from 'vitest';
import { analyzeWinding, defaultPitch, generateLayout, optimizeLayerPairs } from '../src/core/winding';
import type { WindingSpec } from '../src/core/types';

const spec = (Q: number, poles: number, layers: number, pitch?: number, extra: Partial<WindingSpec> = {}): WindingSpec => ({
  slots: Q,
  poles,
  phases: 3,
  layers,
  coilPitch: pitch ?? defaultPitch(Q, poles),
  pairs: [],
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

describe('multi-layer windings', () => {
  it('4-layer 12/10 with one-step shift suppresses the sub-harmonic', () => {
    const dl = kw1(spec(12, 10, 2, 1));
    const ml = kw1(spec(12, 10, 4, 1, { pairs: [{ pitch: 1, shift: 0 }, { pitch: 1, shift: 1 }] }));
    expect(ml.balanced).toBe(true);
    expect(ml.layers).toBe(4);
    expect(ml.kw1).toBeCloseTo(0.933 * Math.cos(Math.PI / 12), 3);
    expect(ml.harmonics[0].mmfRel).toBeLessThan(0.3 * dl.harmonics[0].mmfRel);
  });
  it('optimizer returns balanced candidates sorted by score', () => {
    const c = optimizeLayerPairs(spec(12, 10, 4, 1), 'subharmonics', 0.85);
    expect(c.length).toBeGreaterThan(0);
    for (let i = 1; i < c.length; i++) expect(c[i].score).toBeGreaterThanOrEqual(c[i - 1].score);
  });
});
