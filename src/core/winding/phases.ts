import { TWO_PI, mod } from '../math';

export const PHASE_LETTERS = 'ABCDEFGHIJKLMNOP';

export function phaseName(phase: number): string {
  return PHASE_LETTERS[phase] ?? `P${phase + 1}`;
}

/**
 * Electrical angle of the magnetic axis of a phase (also the time phase of its current).
 * Odd m: phases spaced 2π/m. Even m: phases spaced π/m (half-plane, e.g. 2-phase at 90°,
 * 6-phase at 30° as an asymmetrical dual three-phase system).
 */
export function phaseAxis(phase: number, m: number): number {
  return m % 2 === 1 ? (phase * TWO_PI) / m : (phase * Math.PI) / m;
}

/**
 * Classify an EMF phasor angle into one of 2m phase belts of width π/m, starting at 0 rad.
 * Returns the phase index and polarity of the belt.
 */
export function phaseBelt(angle: number, m: number): { phase: number; sign: 1 | -1 } {
  const width = Math.PI / m;
  const s = Math.floor(mod(angle, TWO_PI) / width + 1e-9) % (2 * m);
  if (m % 2 === 1) {
    // even sectors are positive belts of phase s/2, odd sectors are negative belts
    if (s % 2 === 0) return { phase: s / 2, sign: 1 };
    return { phase: mod((s - m) / 2, m), sign: -1 };
  }
  return s < m ? { phase: s, sign: 1 } : { phase: s - m, sign: -1 };
}
