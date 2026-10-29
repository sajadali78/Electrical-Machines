import { describe, expect, it } from 'vitest';
import { PRESETS, runDesign } from '../src/core';

describe('design presets produce plausible machines', () => {
  for (const preset of PRESETS) {
    it(preset.label, () => {
      const t0 = performance.now();
      const r = runDesign(preset.build());
      const ms = performance.now() - t0;
      const eta = r.losses.efficiency;
      const summary = {
        D: +(r.main.D * 1000).toFixed(1),
        L: +(r.main.L * 1000).toFixed(1),
        Do: +(r.stator.Do * 1000).toFixed(1),
        g: +(r.main.airgap * 1000).toFixed(2),
        Nph: r.stator.Nph,
        Zs: r.stator.Zs,
        fill: +r.stator.fill.toFixed(3),
        Bt: +r.stator.Btooth.toFixed(2),
        eta: +(eta * 100).toFixed(2),
        pf: +r.performance.rated.powerFactor.toFixed(3),
        n: +r.performance.rated.speedRpm.toFixed(0),
        T: +r.torqueRated.toFixed(1),
        Tmax: +r.performance.maxTorque.toFixed(1),
        I: +r.performance.rated.current.toFixed(1),
        loss: Object.fromEntries(Object.entries(r.losses).map(([k, v]) => [k, +v.toFixed(0)])),
        mass: +r.masses.total.toFixed(1),
        ms: +ms.toFixed(0),
        errors: r.checks.filter((c) => c.status !== 'ok').map((c) => `${c.status}:${c.id}=${c.value}`),
      };
      console.log(preset.id, JSON.stringify(summary));
      expect(eta).toBeGreaterThan(0.8);
      expect(eta).toBeLessThan(0.995);
      expect(r.stator.Do).toBeGreaterThan(r.main.D);
      expect(r.winding.balanced).toBe(true);
      expect(Number.isFinite(r.performance.rated.torque)).toBe(true);
    });
  }
});
