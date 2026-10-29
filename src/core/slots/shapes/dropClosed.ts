import { arc, mirrorHalf } from '../geometry';
import { maxDepth, widthAvail, type SlotShape } from '../types';
import { P, depthDim, fitCircle, fixed, radiusDim } from './common';

const geo = (p: Record<string, number>) => {
  const c1 = p.hb + p.r1;
  const c2 = c1 + p.h2;
  const nu = Math.max(-0.999, Math.min(0.999, (p.r1 - p.r2) / Math.max(p.h2, 1e-6)));
  return { c1, c2, at: Math.atan2(Math.sqrt(1 - nu * nu), nu) };
};

/** Closed teardrop bar. */
export const dropClosed: SlotShape = {
  id: 'drop_closed',
  name: 'Closed teardrop bar',
  description: 'Closed slot with large top radius tapering to a small bottom radius: the standard die-cast aluminium rotor bar for low-noise industrial motors.',
  usage: ['rotorCage'],
  closed: true,
  params: [
    P.hb,
    { key: 'r1', label: 'Top radius', symbol: 'r₁', def: 3.5, min: 0.3, role: 'body' },
    { key: 'r2', label: 'Bottom radius', symbol: 'r₂', def: 1.5, min: 0.3, role: 'body' },
    { key: 'h2', label: 'Distance between centres', symbol: 'h₂', def: 14, min: 0.1, role: 'body' },
  ],
  outline: (p) => {
    const { c1, c2, at } = geo(p);
    return mirrorHalf([...arc(c1, 0, p.r1, Math.PI, at), ...arc(c2, 0, p.r2, at, 0)]);
  },
  conductors: (p) => {
    const { c1, c2, at } = geo(p);
    return [mirrorHalf([...arc(c1, 0, p.r1, Math.PI, at), ...arc(c2, 0, p.r2, at, 0)])];
  },
  conductorTop: (p) => p.hb,
  depth: (p) => geo(p).c2 + p.r2,
  dimensions: (p) => {
    const { c1, c2 } = geo(p);
    const vmax = Math.max(p.r1, p.r2);
    return [
      depthDim(0, p.hb, -vmax, -3, 'h_b'),
      depthDim(c1, c2, vmax, 3, 'h₂'),
      radiusDim([c1, 0], p.r1, (-3 * Math.PI) / 4, 'r₁'),
      radiusDim([c2, 0], p.r2, Math.PI / 4, 'r₂'),
    ];
  },
  build(ctx, h) {
    const hb = fixed(ctx, P.hb);
    const w = (u: number) => widthAvail(ctx, u);
    const r1 = fitCircle(w, (r) => hb + r);
    const r2 = w(hb + r1 + h) / 2;
    return { hb, r1, r2, h2: Math.max(h, Math.abs(r1 - r2) + 0.05) };
  },
  bodyRange: (ctx) => [0.2, maxDepth(ctx)],
};
