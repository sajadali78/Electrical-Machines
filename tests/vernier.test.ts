import { describe, expect, it } from 'vitest';
import { analyzeVernier, defaultVernier, polePairOptions, rotorPolePairs, slotOpeningSweep, slotPermeance } from '../src/core/vernier/vernier';

describe('surface-PM Vernier machine', () => {
  const v = defaultVernier();
  const r = analyzeVernier(v);

  it('pole-pair rule, gear ratio and electrical frequency', () => {
    expect(rotorPolePairs({ slots: 18, ps: 2, rule: 'minus' })).toBe(16);
    expect(rotorPolePairs({ slots: 18, ps: 2, rule: 'plus' })).toBe(20);
    expect(r.Pr).toBe(16);
    expect(r.G).toBe(8);
    expect(r.fe).toBeCloseTo((16 * 300) / 60, 9);
  });

  it('the first modulated order equals the winding pole pairs', () => {
    expect(r.spectrum.find((c) => c.j === -1)!.order).toBe(v.ps);
    expect(r.spectrum.find((c) => c.j === -1)!.role).toBe('working');
    expect(r.spectrum.find((c) => c.j === 0)!.order).toBe(r.Pr);
  });

  it('the direct order P_r = N_s − P_s is a slot harmonic with the same winding factor', () => {
    expect(r.kwPr).toBeCloseTo(r.kwPs, 9);
    expect(r.feasible).toBe(true);
  });

  it('relative permeance is continuous through the removable singularity', () => {
    const a = slotPermeance(0.6249, 0.02, 0.003).lambdas[0];
    const b = slotPermeance(0.625, 0.02, 0.003).lambdas[0];
    const c = slotPermeance(0.6251, 0.02, 0.003).lambdas[0];
    expect(Math.abs(a - b)).toBeLessThan(1e-3);
    expect(Math.abs(c - b)).toBeLessThan(1e-3);
    expect(slotPermeance(0.5, 0.02, 0.003).lambda0).toBeLessThan(1);
  });

  it('modulation peaks at an intermediate slot opening', () => {
    const sw = slotOpeningSweep(v);
    const best = sw.reduce((x, y) => (y.lambda1 > x.lambda1 ? y : x));
    expect(best.eps).toBeGreaterThan(0.3);
    expect(best.eps).toBeLessThan(0.75);
    expect(sw[sw.length - 1].kC).toBeGreaterThan(sw[0].kC);
  });

  it('torque from the output equation equals m·E·I / ω_m', () => {
    const omega = (2 * Math.PI * v.speedRpm) / 60;
    expect(r.torque).toBeCloseTo((v.phases * r.E * r.Iph) / omega, 6);
    expect(r.EPs + r.EPr).toBeCloseTo(r.E, 9);
    expect(r.EPs / r.EPr).toBeCloseTo((r.G * r.BPs) / r.BPr, 9);
    expect(r.powerFactor).toBeGreaterThan(0);
    expect(r.powerFactor).toBeLessThanOrEqual(1);
  });

  it('pole-pair options list balanced windings with gear ratios', () => {
    const o = polePairOptions(v);
    expect(o.find((x) => x.ps === 2)!.balanced).toBe(true);
    expect(o.find((x) => x.ps === 2)!.G).toBe(8);
  });
});
