import { arc, mirrorHalf } from '../geometry';
import { maxDepth, widthAvail, type SlotShape } from '../types';
import { P, depthDim, fitCircle, fixed, neckAngle, radiusDim, widthDim } from './common';

const centres = (p: Record<string, number>) => {
  const c1 = p.h0 + Math.sqrt(Math.max(p.r1 * p.r1 - (p.b0 * p.b0) / 4, 0));
  const c2 = c1 + p.h2;
  const nu = Math.max(-0.999, Math.min(0.999, (p.r1 - p.r2) / Math.max(p.h2, 1e-6)));
  const at = Math.atan2(Math.sqrt(1 - nu * nu), nu);
  return { c1, c2, at, an: neckAngle(p.r1, p.b0 / 2) };
};

/** Semi-closed slot with round top and round bottom (drop / oval shape). */
export const roundBoth: SlotShape = {
  id: 'round_both',
  name: 'Semi-closed drop (round top & bottom)',
  description: 'Two arcs joined by tangent lines. Common for die-cast aluminium rotor bars and small random-wound stators; smooth contour, low leakage at the top when r₁ < r₂.',
  usage: ['stator', 'rotorCage'],
  closed: false,
  params: [
    P.b0,
    P.h0,
    { key: 'r1', label: 'Top radius', symbol: 'r₁', def: 3, min: 0.3, role: 'body' },
    { key: 'r2', label: 'Bottom radius', symbol: 'r₂', def: 2, min: 0.3, role: 'body' },
    { key: 'h2', label: 'Distance between centres', symbol: 'h₂', def: 15, min: 0.1, role: 'body' },
  ],
  outline: (p) => {
    const { c1, c2, at, an } = centres(p);
    return mirrorHalf([[0, p.b0 / 2], [p.h0, p.b0 / 2], ...arc(c1, 0, p.r1, an, at), ...arc(c2, 0, p.r2, at, 0)]);
  },
  conductors: (p) => {
    const { c1, c2, at, an } = centres(p);
    return [mirrorHalf([...arc(c1, 0, p.r1, an, at), ...arc(c2, 0, p.r2, at, 0)])];
  },
  conductorTop: (p) => p.h0,
  depth: (p) => centres(p).c2 + p.r2,
  dimensions: (p) => {
    const { c1, c2 } = centres(p);
    const vmax = Math.max(p.r1, p.r2);
    return [
      widthDim(-p.b0 / 2, p.b0 / 2, 0, -3, 'b₀'),
      depthDim(0, p.h0, -vmax, -3, 'h₀'),
      depthDim(c1, c2, vmax, 3, 'h₂'),
      radiusDim([c1, 0], p.r1, (-3 * Math.PI) / 4, 'r₁'),
      radiusDim([c2, 0], p.r2, Math.PI / 4, 'r₂'),
    ];
  },
  build(ctx, h) {
    const b0 = fixed(ctx, P.b0);
    const h0 = fixed(ctx, P.h0);
    const w = (u: number) => widthAvail(ctx, u);
    const r1 = Math.max(b0 / 2 + 0.2, fitCircle(w, (r) => h0 + Math.sqrt(Math.max(r * r - (b0 * b0) / 4, 0))));
    const c1 = h0 + Math.sqrt(Math.max(r1 * r1 - (b0 * b0) / 4, 0));
    const r2 = w(c1 + h) / 2;
    return { b0, h0, r1, r2, h2: Math.max(h, Math.abs(r1 - r2) + 0.05) };
  },
  bodyRange: (ctx) => [0.2, maxDepth(ctx)],
};
