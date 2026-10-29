import { arc, mirrorHalf, type Pt } from '../geometry';
import { maxDepth, widthAvail, type SlotShape } from '../types';
import { P, depthDim, fixed, radiusDim, widthDim } from './common';

/** Trapezoidal slot with a round bottom (pear shape). */
export const trapRound: SlotShape = {
  id: 'trap_round',
  name: 'Round-bottom trapezoidal (pear)',
  description: 'Trapezoidal body ending in a semicircular bottom. Better slot fill for round wire, lower stress concentration and good parallel-tooth behaviour.',
  usage: ['stator', 'rotorCage', 'rotorWound'],
  closed: false,
  params: [
    P.b0,
    P.h0,
    P.h1,
    { key: 'b1', label: 'Slot width at top', symbol: 'b₁', def: 6, min: 0.5, role: 'body' },
    { key: 'h2', label: 'Straight body height', symbol: 'h₂', def: 20, min: 0, role: 'body' },
    { key: 'r2', label: 'Bottom radius', symbol: 'r₂', def: 4.5, min: 0.3, role: 'body' },
  ],
  outline: (p) => {
    const c = p.h0 + p.h1 + p.h2;
    return mirrorHalf([[0, p.b0 / 2], [p.h0, p.b0 / 2], [p.h0 + p.h1, p.b1 / 2], ...arc(c, 0, p.r2, Math.PI / 2, 0)]);
  },
  conductors: (p) => {
    const u0 = p.h0 + p.h1;
    const c = u0 + p.h2;
    const half: Pt[] = [[u0, p.b1 / 2], ...arc(c, 0, p.r2, Math.PI / 2, 0)];
    return [mirrorHalf(half)];
  },
  conductorTop: (p) => p.h0 + p.h1,
  depth: (p) => p.h0 + p.h1 + p.h2 + p.r2,
  dimensions: (p) => {
    const c = p.h0 + p.h1 + p.h2;
    const vmax = Math.max(p.b1 / 2, p.r2);
    return [
      widthDim(-p.b0 / 2, p.b0 / 2, 0, -3, 'b₀'),
      widthDim(-p.b1 / 2, p.b1 / 2, p.h0 + p.h1, 0, 'b₁'),
      depthDim(0, p.h0, -vmax, -3, 'h₀'),
      depthDim(p.h0, p.h0 + p.h1, -vmax, -3, 'h₁'),
      depthDim(p.h0 + p.h1, c, vmax, 3, 'h₂'),
      radiusDim([c, 0], p.r2, Math.PI / 4, 'r₂'),
    ];
  },
  build(ctx, h) {
    const h0 = fixed(ctx, P.h0);
    const h1 = fixed(ctx, P.h1);
    const b1 = widthAvail(ctx, h0 + h1);
    const r2 = widthAvail(ctx, h0 + h1 + h) / 2;
    return { b0: Math.min(fixed(ctx, P.b0), b1), h0, h1, b1, h2: h, r2 };
  },
  bodyRange: (ctx) => [0, maxDepth(ctx)],
};
