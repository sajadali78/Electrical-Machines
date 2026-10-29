import { arc, mirrorHalf } from '../geometry';
import { maxDepth, type SlotShape } from '../types';
import { P, depthDim, fixed, neckAngle, radiusDim, widthDim } from './common';

const centre = (p: Record<string, number>) => p.h0 + Math.sqrt(Math.max(p.r * p.r - (p.b0 * p.b0) / 4, 0));

/** Round semi-closed slot (small rotor bars, high-speed rotors). */
export const round: SlotShape = {
  id: 'round',
  name: 'Round semi-closed',
  description: 'Circular bar slot with a small opening. Low starting torque, low leakage; used in small motors and high-speed rotors. The radius is sized for the bar area; the tooth width follows.',
  usage: ['rotorCage'],
  closed: false,
  params: [{ ...P.b0, def: 1.5 }, { ...P.h0, def: 0.8 }, { key: 'r', label: 'Bar radius', symbol: 'r', def: 4, min: 0.3, role: 'body' }],
  outline: (p) => mirrorHalf([[0, p.b0 / 2], [p.h0, p.b0 / 2], ...arc(centre(p), 0, p.r, neckAngle(p.r, p.b0 / 2), 0, 20)]),
  conductors: (p) => [mirrorHalf(arc(centre(p), 0, p.r, neckAngle(p.r, p.b0 / 2), 0, 20))],
  conductorTop: (p) => p.h0,
  depth: (p) => centre(p) + p.r,
  dimensions: (p) => [
    widthDim(-p.b0 / 2, p.b0 / 2, 0, -3, 'b₀'),
    depthDim(0, p.h0, -p.r, -3, 'h₀'),
    radiusDim([centre(p), 0], p.r, Math.PI / 4, 'r'),
  ],
  build: (ctx, h) => ({ b0: Math.min(fixed(ctx, P.b0), 1.6 * h), h0: fixed(ctx, P.h0), r: h }),
  bodyRange: (ctx) => [0.3, maxDepth(ctx) / 2],
};
