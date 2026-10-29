import type { ConductorMetal, SteelGrade } from './types';

export interface SteelData {
  grade: SteelGrade;
  thicknessMm: number;
  density: number; // kg/m³
  /** Two-term loss model p = (ch·f + ce·f²)·B² [W/kg], B peak in T. */
  ch: number;
  ce: number;
  /** Magnetisation curve (B [T] → H [A/m]). */
  bh: { B: number[]; H: number[] };
  costPerKg: number;
}

const BH_STD = {
  B: [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.3],
  H: [0, 45, 65, 85, 110, 145, 175, 220, 300, 460, 850, 1800, 3800, 7600, 13000, 22000, 40000, 120000],
};

const scaleH = (k: number) => ({ B: BH_STD.B, H: BH_STD.H.map((h) => h * k) });

export const STEELS: Record<SteelGrade, SteelData> = {
  'M270-35A': { grade: 'M270-35A', thicknessMm: 0.35, density: 7650, ch: 0.0218, ce: 4.5e-5, bh: scaleH(1.1), costPerKg: 2.8 },
  'M330-50A': { grade: 'M330-50A', thicknessMm: 0.5, density: 7650, ch: 0.0242, ce: 1.02e-4, bh: scaleH(1.0), costPerKg: 2.4 },
  'M400-50A': { grade: 'M400-50A', thicknessMm: 0.5, density: 7700, ch: 0.026, ce: 1.3e-4, bh: scaleH(0.9), costPerKg: 2.1 },
  'M800-65A': { grade: 'M800-65A', thicknessMm: 0.65, density: 7800, ch: 0.053, ce: 3.6e-4, bh: scaleH(0.8), costPerKg: 1.6 },
  NO20: { grade: 'NO20', thicknessMm: 0.2, density: 7650, ch: 0.025, ce: 1.6e-5, bh: scaleH(1.2), costPerKg: 4.5 },
};

/** Specific core loss [W/kg] at peak flux density B [T] and frequency f [Hz]. */
export function coreLossDensity(steel: SteelData, B: number, f: number): number {
  return (steel.ch * f + steel.ce * f * f) * B * B;
}

/** Field strength H [A/m] for flux density B [T] (log-linear interpolation above the knee). */
export function steelH(steel: SteelData, B: number): number {
  const { B: bs, H: hs } = steel.bh;
  const b = Math.abs(B);
  if (b <= bs[0]) return 0;
  for (let i = 1; i < bs.length; i++) {
    if (b <= bs[i]) {
      const t = (b - bs[i - 1]) / (bs[i] - bs[i - 1]);
      if (hs[i - 1] <= 0) return t * hs[i];
      return Math.exp(Math.log(hs[i - 1]) + t * (Math.log(hs[i]) - Math.log(hs[i - 1])));
    }
  }
  // beyond the table: vacuum permeability slope
  const n = bs.length - 1;
  return hs[n] + (b - bs[n]) / (4e-7 * Math.PI);
}

export interface ConductorData {
  resistivity20: number; // Ω·m
  alpha: number; // 1/K
  density: number; // kg/m³
  costPerKg: number;
}

export const CONDUCTORS: Record<ConductorMetal, ConductorData> = {
  copper: { resistivity20: 1.72e-8, alpha: 0.00393, density: 8900, costPerKg: 10 },
  aluminum: { resistivity20: 3.0e-8, alpha: 0.0039, density: 2700, costPerKg: 3.5 }, // die-cast alloy
};

export const resistivity = (metal: ConductorMetal, tempC: number) =>
  CONDUCTORS[metal].resistivity20 * (1 + CONDUCTORS[metal].alpha * (tempC - 20));

export const MAGNET = { density: 7500, costPerKg: 80 };
