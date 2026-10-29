import { describe, expect, it } from 'vitest';
import { SLOT_SHAPES, autoSizeSlot, defaultParams, slotMetrics, splitEqualArea, polygonArea, totalArea } from '../src/core/slots';

describe('slot shapes', () => {
  it('rect_semi conductor area equals bs·hs and λ matches the analytic formula', () => {
    const s = SLOT_SHAPES.rect_semi;
    const p = { b0: 3, h0: 1, h1: 2, bs: 8, hs: 24 };
    const m = slotMetrics(s, p, 100, 36, 'stator');
    expect(m.conductorArea).toBeCloseTo(8 * 24, 6);
    // λ = hs/(3 bs) + h0/b0 + h1·ln(bs/b0)/(bs-b0)   (tapered wedge region)
    const analytic = 24 / (3 * 8) + 1 / 3 + (2 * Math.log(8 / 3)) / (8 - 3);
    expect(m.permeance).toBeCloseTo(analytic, 2);
  });

  it('every shape produces a valid outline and positive conductor area with defaults', () => {
    for (const s of Object.values(SLOT_SHAPES)) {
      const p = defaultParams(s.id);
      expect(polygonArea(s.outline(p)), s.id).toBeGreaterThan(0);
      expect(totalArea(s.conductors(p)), s.id).toBeGreaterThan(0);
      expect(s.depth(p), s.id).toBeGreaterThan(0);
    }
  });

  it('auto-sizing hits the requested conductor area and keeps the tooth width (parallel teeth)', () => {
    for (const id of ['trap_semi', 'trap_round', 'rect_semi', 'round_both'] as const) {
      const s = SLOT_SHAPES[id];
      const ctx = { R: 90, Q: 36, side: 'stator' as const, toothWidth: 7, fixed: { b0: 3, h0: 1, h1: 1.5 } };
      const r = autoSizeSlot(s, ctx, 180);
      expect(r.limited, id).toBe(false);
      expect(r.conductorArea, id).toBeCloseTo(180, 0);
      const m = slotMetrics(s, r.params, 90, 36, 'stator');
      expect(m.toothMin, id).toBeGreaterThan(6.5);
    }
  });

  it('rotor shapes auto-size inward', () => {
    for (const id of ['round', 'drop_closed', 'rect_closed', 'double_cage', 'round_both'] as const) {
      const s = SLOT_SHAPES[id];
      const r = autoSizeSlot(s, { R: 80, Q: 28, side: 'rotor', toothWidth: 7, fixed: {} }, 80);
      expect(r.conductorArea, id).toBeCloseTo(80, -1);
    }
  });

  it('equal-area layer split', () => {
    const poly = SLOT_SHAPES.trap_semi.conductors(defaultParams('trap_semi'))[0];
    for (const arr of ['radial', 'tangential'] as const) {
      const layers = splitEqualArea(poly, 4, arr);
      const A = polygonArea(poly);
      for (const l of layers) expect(polygonArea(l)).toBeCloseTo(A / 4, 3);
    }
  });
});
