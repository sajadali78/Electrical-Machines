import { TWO_PI, gcd, mod } from '../math';
import { phaseBelt } from './phases';

export interface SlotPhasor {
  slot: number; // 0-based
  angle: number; // electrical angle [rad], in [0, 2π)
  phase: number;
  sign: 1 | -1;
}

export interface StarOfSlots {
  t: number; // machine periodicity gcd(Q, p)
  spokes: number; // distinct phasor directions Q/t
  slotAngleElec: number; // α_e = 2πp/Q
  phasors: SlotPhasor[];
}

/** Build the star of slots (Bianchi & Dai Prè) with phase-belt classification. */
export function starOfSlots(Q: number, poles: number, m: number, sectorOffset = 0): StarOfSlots {
  const p = poles / 2;
  const t = gcd(Q, p);
  const alpha = (TWO_PI * p) / Q;
  const phasors: SlotPhasor[] = [];
  for (let k = 0; k < Q; k++) {
    const angle = mod(k * alpha, TWO_PI);
    const belt = phaseBelt(angle - sectorOffset, m);
    phasors.push({ slot: k, angle, ...belt });
  }
  return { t, spokes: Q / t, slotAngleElec: alpha, phasors };
}
