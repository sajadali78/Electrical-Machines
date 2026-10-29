import { mirrorHalf, type Pt } from '../geometry';
import { maxDepth, widthAvail, type SlotShape } from '../types';
import { P, depthDim, fixed, widthDim } from './common';

/** Semi-closed trapezoidal slot giving parallel-sided teeth. */
export const trapSemi: SlotShape = {
  id: 'trap_semi',
  name: 'Semi-closed trapezoidal',
  description: 'Trapezoidal slot whose sides follow the radial lines so that the teeth have parallel sides (constant tooth flux density). The standard choice for random-wound low-voltage machines.',
  usage: ['stator', 'rotorCage', 'rotorWound'],
  closed: false,
  params: [
    P.b0,
    P.h0,
    P.h1,
    { key: 'b1', label: 'Slot width at top', symbol: 'b₁', def: 6, min: 0.5, role: 'body' },
    { key: 'b2', label: 'Slot width at bottom', symbol: 'b₂', def: 9, min: 0.3, role: 'body' },
    { key: 'h2', label: 'Slot body height', symbol: 'h₂', def: 22, min: 1, role: 'body' },
  ],
  outline: (p) =>
    mirrorHalf([
      [0, p.b0 / 2],
      [p.h0, p.b0 / 2],
      [p.h0 + p.h1, p.b1 / 2],
      [p.h0 + p.h1 + p.h2, p.b2 / 2],
      [p.h0 + p.h1 + p.h2, 0],
    ]),
  conductors: (p) => {
    const u0 = p.h0 + p.h1;
    const u1 = u0 + p.h2;
    return [[[u0, -p.b1 / 2], [u1, -p.b2 / 2], [u1, p.b2 / 2], [u0, p.b1 / 2]] as Pt[]];
  },
  conductorTop: (p) => p.h0 + p.h1,
  depth: (p) => p.h0 + p.h1 + p.h2,
  dimensions: (p) => {
    const d = p.h0 + p.h1 + p.h2;
    const vmax = Math.max(p.b1, p.b2) / 2;
    return [
      widthDim(-p.b0 / 2, p.b0 / 2, 0, -3, 'b₀'),
      widthDim(-p.b1 / 2, p.b1 / 2, p.h0 + p.h1, 0, 'b₁'),
      widthDim(-p.b2 / 2, p.b2 / 2, d, 3, 'b₂'),
      depthDim(0, p.h0, -vmax, -3, 'h₀'),
      depthDim(p.h0, p.h0 + p.h1, -vmax, -3, 'h₁'),
      depthDim(p.h0 + p.h1, d, vmax, 3, 'h₂'),
    ];
  },
  build(ctx, h) {
    const h0 = fixed(ctx, P.h0);
    const h1 = fixed(ctx, P.h1);
    const b1 = widthAvail(ctx, h0 + h1);
    return { b0: Math.min(fixed(ctx, P.b0), b1), h0, h1, b1, b2: widthAvail(ctx, h0 + h1 + h), h2: h };
  },
  bodyRange: (ctx) => [0.5, maxDepth(ctx)],
};
