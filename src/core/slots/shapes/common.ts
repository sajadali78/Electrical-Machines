import type { Pt } from '../geometry';
import type { SlotDimension, SlotParamDef, SlotSizingContext } from '../types';

/** Depth dimension between u1 and u2 drawn at tangential position v, shifted by `off` (mm, along v). */
export const depthDim = (u1: number, u2: number, v: number, off: number, label: string): SlotDimension => ({
  type: 'linear',
  a: [u1, v],
  b: [u2, v],
  offset: [0, off],
  label,
  value: Math.abs(u2 - u1),
});

/** Width dimension between v1 and v2 at depth u, shifted by `off` (mm, along u). */
export const widthDim = (v1: number, v2: number, u: number, off: number, label: string): SlotDimension => ({
  type: 'linear',
  a: [u, v1],
  b: [u, v2],
  offset: [off, 0],
  label,
  value: Math.abs(v2 - v1),
});

export const radiusDim = (c: Pt, r: number, angle: number, label: string): SlotDimension => ({
  type: 'radius',
  c,
  r,
  angle,
  label,
  value: r,
});

export const P = {
  b0: { key: 'b0', label: 'Slot opening width', symbol: 'b₀', def: 3, min: 0.5, role: 'fixed' } as SlotParamDef,
  h0: { key: 'h0', label: 'Tooth-tip (lip) height', symbol: 'h₀', def: 1, min: 0.2, role: 'fixed' } as SlotParamDef,
  h1: { key: 'h1', label: 'Wedge / taper height', symbol: 'h₁', def: 2, min: 0, role: 'fixed' } as SlotParamDef,
  hb: { key: 'hb', label: 'Bridge thickness', symbol: 'h_b', def: 0.6, min: 0.2, role: 'fixed' } as SlotParamDef,
};

/** Read a fixed parameter from the context with a fallback default. */
export const fixed = (ctx: SlotSizingContext, def: SlotParamDef) => ctx.fixed[def.key] ?? def.def;

/** Iterate r = w(c(r))/2 where the circle centre depends on r. */
export function fitCircle(width: (u: number) => number, centre: (r: number) => number, r0 = 2): number {
  let r = r0;
  for (let i = 0; i < 12; i++) r = Math.max(0.3, width(centre(r)) / 2);
  return r;
}

/** Angle (in the u–v plane) of the point where a neck of half-width hw meets a circle of radius r. */
export const neckAngle = (r: number, hw: number) => Math.PI - Math.asin(Math.min(1, hw / r));
