/** Loss model used for efficiency at arbitrary operating points (scaled from rated values). */
export interface LossScaling {
  PfeRated: number; // W at rated frequency and flux
  fRated: number;
  PfwRated: number; // W at rated speed
  nRated: number; // rpm
  strayRated: number; // W at rated current
  IRated: number; // rms
}

/** Iron loss scaled with frequency (f^1.5 mix of hysteresis/eddy) and flux squared. */
export const ironLoss = (s: LossScaling, f: number, fluxRatio: number) =>
  s.PfeRated * Math.pow(Math.abs(f) / s.fRated, 1.5) * fluxRatio * fluxRatio;

export const mechLoss = (s: LossScaling, n: number) => s.PfwRated * (n / s.nRated) ** 2;

export const strayLoss = (s: LossScaling, I: number, f: number) => s.strayRated * (I / s.IRated) ** 2 * Math.pow(Math.abs(f) / s.fRated, 1.5);

/** IEC 60034-2-1 assigned additional-load-loss fraction of input power. */
export function iecStrayFraction(PoutW: number): number {
  const kW = PoutW / 1000;
  if (kW <= 1) return 0.025;
  if (kW >= 10000) return 0.005;
  return 0.025 - 0.005 * Math.log10(kW);
}

/** Windage & friction estimate P = k·D·(L + 0.6τ)·v² (Pyrhönen), k ≈ 10 W·s²/m⁴. */
export const windageFriction = (D: number, L: number, tau: number, speedRpm: number) => {
  const v = (Math.PI * D * speedRpm) / 60;
  return 10 * D * (L + 0.6 * tau) * v * v;
};

export const linspace = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
