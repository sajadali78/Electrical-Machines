import { mirrorHalf } from '../geometry';
import { maxDepth, widthAvail, type SlotShape } from '../types';
import { P, depthDim, fixed, widthDim } from './common';

/** Closed rectangular (deep) bar under an iron bridge. */
export const rectClosed: SlotShape = {
  id: 'rect_closed',
  name: 'Closed rectangular bar',
  description: 'Deep rectangular bar fully enclosed by an iron bridge. Strong skin effect (high starting torque), smooth rotor surface, low noise; the saturated bridge adds leakage.',
  usage: ['rotorCage'],
  closed: true,
  params: [P.hb, { key: 'bs', label: 'Bar width', symbol: 'b_s', def: 4, min: 0.3, role: 'body' }, { key: 'hs', label: 'Bar height', symbol: 'h_s', def: 20, min: 0.5, role: 'body' }],
  outline: (p) => mirrorHalf([[p.hb, 0], [p.hb, p.bs / 2], [p.hb + p.hs, p.bs / 2], [p.hb + p.hs, 0]]),
  conductors: (p) => [mirrorHalf([[p.hb, 0], [p.hb, p.bs / 2], [p.hb + p.hs, p.bs / 2], [p.hb + p.hs, 0]])],
  conductorTop: (p) => p.hb,
  depth: (p) => p.hb + p.hs,
  dimensions: (p) => [
    depthDim(0, p.hb, -p.bs / 2, -3, 'h_b'),
    widthDim(-p.bs / 2, p.bs / 2, p.hb + p.hs, 3, 'b_s'),
    depthDim(p.hb, p.hb + p.hs, p.bs / 2, 3, 'h_s'),
  ],
  build(ctx, h) {
    const hb = fixed(ctx, P.hb);
    return { hb, bs: ctx.side === 'stator' ? widthAvail(ctx, hb) : widthAvail(ctx, hb + h), hs: h };
  },
  bodyRange: (ctx) => [0.5, maxDepth(ctx)],
};
