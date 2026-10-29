import { STEELS, steelH } from '../materials';
import { MU0 } from '../math';
import type { MachineSpec } from '../types';
import type { ElectricalParams, MainDimensions, StatorResult } from './result';

/** Rotor-side data needed for the magnetic circuit and inductances. */
export interface RotorMagnetic {
  carter: number;
  toothDepth: number; // m
  toothB: number; // T
  yokeB: number; // T
  yokeLen: number; // m, yoke path per pole pitch
  extraGap: number; // m of non-ferrous gap in series (magnet/μr, sleeve)
  dAxisFactor: number; // Lmd / Lm
  qAxisFactor: number; // Lmq / Lm
  saliency?: number; // if set: Lq = ξ·Ld (IPM)
  poleBodyMMF?: number; // A-turns per pole (salient poles)
}

export interface WindingInfo {
  kw1: number;
  sigmaDiff: number;
  layers: number;
  arrangement: 'radial' | 'tangential';
}

export function electricalParams(spec: MachineSpec, main: MainDimensions, st: StatorResult, w: WindingInfo, rm: RotorMagnetic): ElectricalParams {
  const steel = STEELS[spec.steel];
  const { m, p, poles, tau, L, airgap: g, f, D } = main;
  const Q = st.Q;
  const omega = 2 * Math.PI * f;

  // Magnetic circuit per pole (A-turns)
  const kC = st.carter * rm.carter;
  const gap = (st.BgPeak * (kC * g + rm.extraGap)) / MU0;
  const statorTeeth = steelH(steel, st.BtoothMean) * (st.slot.metrics.depth / 1000);
  const rotorTeeth = steelH(steel, rm.toothB) * rm.toothDepth;
  const statorYoke = (steelH(steel, st.Byoke) * ((Math.PI * (st.Do - st.yoke)) / poles)) / 3;
  const rotorYoke = (steelH(steel, rm.yokeB) * rm.yokeLen) / 3;
  const ironAT = statorTeeth + rotorTeeth + statorYoke + rotorYoke + (rm.poleBodyMMF ?? 0);
  const gapIron = (st.BgPeak * kC * g) / MU0;
  const ksat = gapIron > 0 ? Math.min(10, 1 + Math.max(0, ironAT) / gapIron) : 1;
  const airgapEff = kC * g * ksat + rm.extraGap;

  const kwN = w.kw1 * st.Nph;
  const Lm = ((m / 2) * 4 * MU0 * kwN * kwN * tau * L) / (Math.PI * Math.PI * p * airgapEff);

  // Slot leakage with short-pitch corrections (Pyrhönen): ε = 1 − W/τp
  const yFull = Q / poles;
  const eps = Math.min(2 / 3, Math.abs(1 - st.avgCoilSpan / yFull));
  let k1 = 1;
  let k2 = 1;
  if (w.layers >= 2) {
    if (w.arrangement === 'tangential') {
      k1 = 0.75;
      k2 = 0.75;
    } else {
      k1 = 1 - (9 * eps) / 16;
      k2 = 1 - (3 * eps) / 4;
    }
  }
  const met = st.slot.metrics;
  const b0 = met.opening / 1000;
  const lamTT = b0 > 0 ? (k2 * 5 * (g / b0)) / (5 + 4 * (g / b0)) : 0;
  const slotPermeance = k1 * met.permeanceConductor + k2 * met.permeanceTop + lamTT;
  const N2 = st.Nph * st.Nph;
  const Lslot = ((4 * m) / Q) * MU0 * L * N2 * slotPermeance;
  const q = Q / (poles * m);
  const Lend = ((4 * m) / Q) * q * N2 * MU0 * (2 * st.endWinding) * (w.layers <= 1 ? 0.35 : 0.3);
  const Ldiff = w.sigmaDiff * Lm;
  const Lsigma = Lslot + Lend + Ldiff;

  const Ld = rm.dAxisFactor * Lm + Lsigma;
  const Lq = rm.saliency ? rm.saliency * Ld : rm.qAxisFactor * Lm + Lsigma;
  void D;

  return {
    R1: st.Rph,
    Lm: rm.dAxisFactor * Lm,
    ksat,
    carterTotal: kC,
    airgapEff,
    Lslot,
    Lend,
    Ldiff,
    Lsigma,
    Ld,
    Lq,
    X1: omega * Lsigma,
    Xm: omega * rm.dAxisFactor * Lm,
    slotPermeance,
    fieldAT: { gap, statorTeeth, rotorTeeth, statorYoke, rotorYoke },
  };
}
