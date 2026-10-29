import { arc, mirrorHalf, type Pt } from '../geometry';
import { maxDepth, widthAvail, type SlotShape } from '../types';
import { P, depthDim, fitCircle, fixed, neckAngle, radiusDim, widthDim } from './common';

const geo = (p: Record<string, number>) => {
  const c1 = p.h0 + Math.sqrt(Math.max(p.r1 * p.r1 - (p.b0 * p.b0) / 4, 0));
  const ab = Math.asin(Math.min(1, p.bn / (2 * p.r1)));
  const un1 = c1 + p.r1 * Math.cos(ab);
  const un2 = un1 + p.hn;
  return { c1, ab, an: neckAngle(p.r1, p.b0 / 2), un1, un2 };
};

/** Double-cage slot: small upper (starting) bar and large lower (running) bar joined by a leakage neck. */
export const doubleCage: SlotShape = {
  id: 'double_cage',
  name: 'Double cage',
  description: 'Upper round bar (high resistance, low leakage: starting cage) and lower rectangular bar (low resistance, high leakage: running cage) separated by a narrow neck. Gives high starting torque with good running efficiency.',
  usage: ['rotorCage'],
  closed: false,
  params: [
    { ...P.b0, def: 1.5 },
    { ...P.h0, def: 0.8 },
    { key: 'r1', label: 'Upper bar radius', symbol: 'r₁', def: 2.5, min: 0.3, role: 'body' },
    { key: 'bn', label: 'Neck width', symbol: 'b_n', def: 1.2, min: 0.3, role: 'fixed' },
    { key: 'hn', label: 'Neck height', symbol: 'h_n', def: 4, min: 0.3, role: 'fixed' },
    { key: 'b2', label: 'Lower bar width', symbol: 'b₂', def: 5, min: 0.3, role: 'body' },
    { key: 'h2', label: 'Lower bar height', symbol: 'h₂', def: 14, min: 0.5, role: 'body' },
  ],
  outline: (p) => {
    const g = geo(p);
    return mirrorHalf([
      [0, p.b0 / 2],
      [p.h0, p.b0 / 2],
      ...arc(g.c1, 0, p.r1, g.an, g.ab),
      [g.un2, p.bn / 2],
      [g.un2, p.b2 / 2],
      [g.un2 + p.h2, p.b2 / 2],
      [g.un2 + p.h2, 0],
    ]);
  },
  conductors: (p) => {
    const g = geo(p);
    return [
      mirrorHalf(arc(g.c1, 0, p.r1, g.an, 0, 18)),
      [[g.un2, -p.b2 / 2], [g.un2 + p.h2, -p.b2 / 2], [g.un2 + p.h2, p.b2 / 2], [g.un2, p.b2 / 2]] as Pt[],
    ];
  },
  conductorTop: (p) => p.h0,
  depth: (p) => geo(p).un2 + p.h2,
  dimensions: (p) => {
    const g = geo(p);
    const vmax = Math.max(p.r1, p.b2 / 2);
    return [
      widthDim(-p.b0 / 2, p.b0 / 2, 0, -3, 'b₀'),
      depthDim(0, p.h0, -vmax, -3, 'h₀'),
      radiusDim([g.c1, 0], p.r1, (-3 * Math.PI) / 4, 'r₁'),
      depthDim(g.un1, g.un2, -vmax, -3, 'h_n'),
      widthDim(-p.bn / 2, p.bn / 2, (g.un1 + g.un2) / 2, 0, 'b_n'),
      widthDim(-p.b2 / 2, p.b2 / 2, g.un2 + p.h2, 3, 'b₂'),
      depthDim(g.un2, g.un2 + p.h2, vmax, 3, 'h₂'),
    ];
  },
  build(ctx, h) {
    const b0 = fixed(ctx, { ...P.b0, def: 1.5 });
    const h0 = fixed(ctx, { ...P.h0, def: 0.8 });
    const bn = ctx.fixed.bn ?? 1.2;
    const hn = ctx.fixed.hn ?? 4;
    const w = (u: number) => widthAvail(ctx, u);
    const r1 = Math.max(b0 / 2 + 0.2, 0.75 * fitCircle(w, (r) => h0 + r));
    const g = geo({ b0, h0, r1, bn, hn, b2: 0, h2: 0 });
    const b2 = ctx.side === 'stator' ? w(g.un2) : w(g.un2 + h);
    return { b0, h0, r1, bn: Math.min(bn, 2 * r1 - 0.1), hn, b2, h2: h };
  },
  bodyRange: (ctx) => [0.5, maxDepth(ctx)],
};
