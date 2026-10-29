import { bisect } from '../math';
import type { SlotShapeId, SlotSpec } from '../types';
import { clipHalfPlane, polygonArea, totalArea, widthAt, type Pt } from './geometry';
import { doubleCage } from './shapes/doubleCage';
import { dropClosed } from './shapes/dropClosed';
import { rectClosed } from './shapes/rectClosed';
import { rectOpen } from './shapes/rectOpen';
import { rectSemi } from './shapes/rectSemi';
import { round } from './shapes/round';
import { roundBoth } from './shapes/roundBoth';
import { trapRound } from './shapes/trapRound';
import { trapSemi } from './shapes/trapSemi';
import { pitchAt, type SlotShape, type SlotSizingContext, type SlotUsage } from './types';

export * from './geometry';
export * from './types';

export const SLOT_SHAPES: Record<SlotShapeId, SlotShape> = {
  rect_open: rectOpen,
  rect_semi: rectSemi,
  trap_semi: trapSemi,
  trap_round: trapRound,
  round_both: roundBoth,
  round,
  rect_closed: rectClosed,
  drop_closed: dropClosed,
  double_cage: doubleCage,
};

export const shapeOf = (id: SlotShapeId): SlotShape => SLOT_SHAPES[id] ?? trapSemi;

export const shapesFor = (usage: SlotUsage) => Object.values(SLOT_SHAPES).filter((s) => s.usage.includes(usage));

export function defaultParams(id: SlotShapeId): Record<string, number> {
  return Object.fromEntries(shapeOf(id).params.map((p) => [p.key, p.def]));
}

export function defaultSlotSpec(id: SlotShapeId): SlotSpec {
  return { shape: id, autoSize: true, params: defaultParams(id) };
}

/** Extract the user's fixed parameters (openings, wedges, bridges) from a slot spec. */
export function fixedParams(spec: SlotSpec): Record<string, number> {
  const shape = shapeOf(spec.shape);
  const out: Record<string, number> = {};
  for (const p of shape.params) if (p.role === 'fixed') out[p.key] = spec.params[p.key] ?? p.def;
  return out;
}

export interface AutoSizeResult {
  params: Record<string, number>;
  conductorArea: number;
  limited: boolean; // target area could not be reached within geometric limits
}

/** Size the body of a slot so that its conductor area equals `targetArea` (mm²). */
export function autoSizeSlot(shape: SlotShape, ctx: SlotSizingContext, targetArea: number): AutoSizeResult {
  const [lo, hiRange] = shape.bodyRange(ctx);
  const area = (h: number) => totalArea(shape.conductors(shape.build(ctx, h)));
  // Area can peak and then fall (rotor slots narrowing towards the shaft): bracket the rising part.
  let hi = hiRange;
  let best = -Infinity;
  for (let i = 0; i <= 40; i++) {
    const x = lo + ((hiRange - lo) * i) / 40;
    const a = area(x);
    if (a > best) {
      best = a;
      hi = x;
    }
  }
  const h = bisect((x) => area(x) - targetArea, lo, hi, 1e-4);
  const params = shape.build(ctx, h);
  const a = totalArea(shape.conductors(params));
  return { params, conductorArea: a, limited: Math.abs(a - targetArea) > 0.02 * targetArea };
}

export interface SlotMetrics {
  outlineArea: number; // mm², full slot (air) area
  conductorArea: number; // mm²
  depth: number; // mm
  opening: number; // mm (0 for closed slots)
  permeance: number; // slot leakage permeance factor λ (dimensionless)
  permeanceConductor: number; // part of λ from the conductor region
  permeanceTop: number; // part of λ from the opening / wedge / bridge region
  toothMin: number; // mm
  toothMax: number; // mm
  toothMean: number; // mm, averaged over the slot body
  toothProfile: { u: number; width: number }[];
}

/**
 * Geometric metrics of a slot on a lamination with air-gap radius R (mm) and Q slots.
 * The leakage permeance is integrated numerically from the actual contour:
 *   λ = ∫ (A_below(u)/A)² / b(u) du  (conductor region)  +  ∫ du / b(u)  (opening/wedge region).
 */
export function slotMetrics(shape: SlotShape, params: Record<string, number>, R: number, Q: number, side: 'stator' | 'rotor'): SlotMetrics {
  const outline = shape.outline(params);
  const conductors = shape.conductors(params);
  const A = totalArea(conductors);
  const depth = shape.depth(params);
  const top = shape.conductorTop(params);
  const ctx = { R, Q, side, toothWidth: 0, fixed: {} } as SlotSizingContext;
  const N = 160;

  let lamCond = 0;
  const du = (depth - top) / N;
  for (let i = 0; i < N; i++) {
    const u = top + (i + 0.5) * du;
    const b = widthAt([outline], u);
    if (b <= 1e-6) continue;
    const below = A - conductors.reduce((s, poly) => s + polygonArea(clipHalfPlane(poly, 0, u, 'below')), 0);
    lamCond += ((below / A) ** 2 / b) * du;
  }
  let lamTop = 0;
  if (shape.closed) {
    lamTop = 0.5; // saturated iron bridge (empirical, typical 0.3 … 1)
  } else if (top > 0) {
    const n2 = 60;
    const d2 = top / n2;
    for (let i = 0; i < n2; i++) {
      const b = widthAt([outline], (i + 0.5) * d2);
      if (b > 1e-6) lamTop += d2 / b;
    }
  }

  const profile: { u: number; width: number }[] = [];
  const start = shape.closed ? 0 : top;
  for (let i = 0; i <= 40; i++) {
    const u = start + ((depth - start) * i) / 40;
    const uu = Math.min(Math.max(u, 1e-6), depth - 1e-6);
    profile.push({ u, width: pitchAt(ctx, uu) - widthAt([outline], uu) });
  }
  const widths = profile.map((p) => p.width);
  return {
    outlineArea: polygonArea(outline),
    conductorArea: A,
    depth,
    opening: shape.closed ? 0 : widthAt([outline], 1e-6),
    permeance: lamCond + lamTop,
    permeanceConductor: lamCond,
    permeanceTop: lamTop,
    toothMin: Math.min(...widths),
    toothMax: Math.max(...widths),
    toothMean: widths.reduce((s, w) => s + w, 0) / widths.length,
    toothProfile: profile,
  };
}

export type { Pt };
