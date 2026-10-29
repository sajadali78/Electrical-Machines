import { mirrorHalf, type Pt } from '../geometry';
import { maxDepth, widthAvail, type SlotShape } from '../types';
import { P, depthDim, fixed, widthDim } from './common';

/** Semi-closed slot with parallel sides (tapered teeth); also a deep-bar rotor slot. */
export const rectSemi: SlotShape = {
  id: 'rect_semi',
  name: 'Semi-closed parallel slot',
  description: 'Rectangular slot body with a narrow opening and tapered wedge region. Teeth taper towards the air gap. Also used as a deep-bar rotor slot.',
  usage: ['stator', 'rotorCage', 'rotorWound'],
  closed: false,
  params: [P.b0, P.h0, P.h1, { key: 'bs', label: 'Slot body width', symbol: 'b_s', def: 7, min: 0.5, role: 'body' }, { key: 'hs', label: 'Slot body height', symbol: 'h_s', def: 25, min: 1, role: 'body' }],
  outline: (p) =>
    mirrorHalf([
      [0, p.b0 / 2],
      [p.h0, p.b0 / 2],
      [p.h0 + p.h1, p.bs / 2],
      [p.h0 + p.h1 + p.hs, p.bs / 2],
      [p.h0 + p.h1 + p.hs, 0],
    ]),
  conductors: (p) => {
    const u0 = p.h0 + p.h1;
    return [[[u0, -p.bs / 2], [u0 + p.hs, -p.bs / 2], [u0 + p.hs, p.bs / 2], [u0, p.bs / 2]] as Pt[]];
  },
  conductorTop: (p) => p.h0 + p.h1,
  depth: (p) => p.h0 + p.h1 + p.hs,
  dimensions: (p) => {
    const d = p.h0 + p.h1 + p.hs;
    return [
      widthDim(-p.b0 / 2, p.b0 / 2, 0, -3, 'b₀'),
      widthDim(-p.bs / 2, p.bs / 2, d, 3, 'b_s'),
      depthDim(0, p.h0, -p.bs / 2, -3, 'h₀'),
      depthDim(p.h0, p.h0 + p.h1, -p.bs / 2, -3, 'h₁'),
      depthDim(p.h0 + p.h1, d, p.bs / 2, 3, 'h_s'),
    ];
  },
  build(ctx, h) {
    const b0 = fixed(ctx, P.b0);
    const h0 = fixed(ctx, P.h0);
    const h1 = fixed(ctx, P.h1);
    const bs = ctx.side === 'stator' ? widthAvail(ctx, h0 + h1) : widthAvail(ctx, h0 + h1 + h);
    return { b0: Math.min(b0, bs), h0, h1, bs, hs: h };
  },
  bodyRange: (ctx) => [0.5, maxDepth(ctx)],
};
