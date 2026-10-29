import { mirrorHalf, type Pt } from '../geometry';
import { maxDepth, widthAvail, type SlotShape } from '../types';
import { depthDim, widthDim } from './common';

/** Open rectangular slot for form-wound coils, closed by a wedge. */
export const rectOpen: SlotShape = {
  id: 'rect_open',
  name: 'Open rectangular',
  description: 'Parallel-sided open slot for pre-formed (form-wound) coils held by a magnetic or non-magnetic wedge. Typical for HV machines and wound rotors.',
  usage: ['stator', 'rotorWound'],
  closed: false,
  params: [
    { key: 'bs', label: 'Slot width', symbol: 'b_s', def: 8, min: 1, role: 'body' },
    { key: 'hw', label: 'Wedge depth', symbol: 'h_w', def: 3, min: 0, role: 'fixed' },
    { key: 'hs', label: 'Total slot depth', symbol: 'h_s', def: 30, min: 2, role: 'body' },
  ],
  outline: (p) => mirrorHalf([[0, p.bs / 2], [p.hs, p.bs / 2], [p.hs, 0]]),
  conductors: (p) => [
    [
      [p.hw, -p.bs / 2],
      [p.hs, -p.bs / 2],
      [p.hs, p.bs / 2],
      [p.hw, p.bs / 2],
    ] as Pt[],
  ],
  conductorTop: (p) => p.hw,
  depth: (p) => p.hs,
  dimensions: (p) => [
    widthDim(-p.bs / 2, p.bs / 2, p.hs, 3, 'b_s'),
    depthDim(0, p.hw, -p.bs / 2, -3, 'h_w'),
    depthDim(0, p.hs, p.bs / 2, 4, 'h_s'),
  ],
  build(ctx, h) {
    const hw = ctx.fixed.hw ?? 3;
    const bs = ctx.side === 'stator' ? widthAvail(ctx, 0) : widthAvail(ctx, hw + h);
    return { bs, hw, hs: hw + h };
  },
  bodyRange: (ctx) => [0.5, maxDepth(ctx)],
};
