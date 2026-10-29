import type { SlotShapeId } from '../types';
import type { Pt } from './geometry';

export type SlotUsage = 'stator' | 'rotorCage' | 'rotorWound';

export interface SlotParamDef {
  key: string;
  label: string;
  symbol: string;
  def: number; // default in mm (used when not auto-sized)
  min?: number;
  /** Fixed parameters (openings, wedges) are kept during auto-sizing; body parameters are computed. */
  role: 'fixed' | 'body';
}

/** Dimension annotation in slot coordinates (mm). */
export type SlotDimension =
  | { type: 'linear'; a: Pt; b: Pt; offset: Pt; label: string; value: number }
  | { type: 'radius'; c: Pt; r: number; angle: number; label: string; value: number };

/** Context passed to auto-sizing. */
export interface SlotSizingContext {
  R: number; // radius of the air-gap surface [mm]
  Q: number;
  side: 'stator' | 'rotor';
  toothWidth: number; // minimum tooth width to keep [mm]
  fixed: Record<string, number>; // fixed parameters (b0, h0, h1, hb ...)
}

export interface SlotShape {
  id: SlotShapeId;
  name: string;
  description: string;
  usage: SlotUsage[];
  closed: boolean;
  params: SlotParamDef[];
  /** Full outline polygon (air-gap side first). Open shapes start/end on the u = 0 surface. */
  outline(p: Record<string, number>): Pt[];
  /** Conductor (winding / bar) regions. */
  conductors(p: Record<string, number>): Pt[][];
  /** Depth of the region above the conductors (opening + wedge) [mm]. */
  conductorTop(p: Record<string, number>): number;
  depth(p: Record<string, number>): number;
  dimensions(p: Record<string, number>): SlotDimension[];
  /** Compute all parameters for a given body size `h` (monotonic in conductor area). */
  build(ctx: SlotSizingContext, h: number): Record<string, number>;
  bodyRange(ctx: SlotSizingContext): [number, number];
}

/** Slot pitch at depth u for a given side. */
export const pitchAt = (ctx: SlotSizingContext, u: number) =>
  (2 * Math.PI * (ctx.side === 'stator' ? ctx.R + u : ctx.R - u)) / ctx.Q;

/** Slot width available at depth u when keeping the minimum tooth width. */
export const widthAvail = (ctx: SlotSizingContext, u: number) => Math.max(0.3, pitchAt(ctx, u) - ctx.toothWidth);

export const maxDepth = (ctx: SlotSizingContext) => (ctx.side === 'stator' ? 0.8 * ctx.R : 0.55 * ctx.R);
