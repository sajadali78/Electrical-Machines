import type { MachineSpec } from '../types';
import type { MainDimensions } from './result';

/** Phase voltage for star/delta connection of an m-phase machine. */
export function phaseVoltage(spec: MachineSpec): number {
  const m = spec.winding.phases;
  return spec.connection === 'star' ? spec.voltageV / (2 * Math.sin(Math.PI / m)) : spec.voltageV;
}

/** Line current from phase current. */
export function lineCurrent(spec: MachineSpec, Iph: number): number {
  const m = spec.winding.phases;
  return spec.connection === 'star' ? Iph : Iph * 2 * Math.sin(Math.PI / m);
}

/**
 * Empirical air-gap length [m].
 *  - Induction (Pyrhönen): δ = 0.2 + 0.01·P^0.4 mm (2 poles) or 0.18 + 0.006·P^0.4 mm.
 *  - PM: 0.5 + 0.005·P^0.4 mm (mechanical clearance dominated).
 *  - Wound field: δ = γ·τ·A / B̂δ with γ = 7e-7 (salient) or 4e-7 (cylindrical).
 */
export function autoAirgap(spec: MachineSpec, tau: number, ac: number, Bpeak: number): number {
  const P = spec.powerKw * 1000;
  switch (spec.topology) {
    case 'induction':
      return (spec.winding.poles === 2 ? 0.2 + 0.01 * P ** 0.4 : 0.18 + 0.006 * P ** 0.4) * 1e-3;
    case 'pmsm_spm':
    case 'pmsm_ipm':
      return (0.5 + 0.005 * P ** 0.4) * 1e-3;
    case 'wound_field': {
      const gamma = spec.woundField.poleType === 'salient' ? 7e-7 : 4e-7;
      return Math.max(0.5e-3, (gamma * tau * ac) / Bpeak);
    }
  }
}

/**
 * Classical output equation  S = C₀·D²·L·n_s  with  C₀ = 11·k_w·B_av·ac·10⁻³ [kVA·s/m³],
 * n_s in rev/s. D follows from the chosen L/τ ratio.
 */
export function mainDimensions(spec: MachineSpec, kw1: number): MainDimensions {
  const m = spec.winding.phases;
  const poles = spec.winding.poles;
  const p = poles / 2;
  const f = spec.frequencyHz;
  const nsRps = f / p;
  const Pout = spec.powerKw * 1000;
  const eta = Math.min(0.995, Math.max(0.3, spec.targetEfficiency / 100));
  const pf = Math.min(1, Math.max(0.3, spec.targetPowerFactor));
  const Sin = Pout / (eta * pf);
  const Vph = phaseVoltage(spec);
  const Iph = Sin / (m * Vph);
  const C0 = 11 * kw1 * spec.Bav * spec.ac * 1e-3;
  const D2L = Sin / 1000 / (C0 * nsRps);

  let D: number;
  let L: number;
  if (spec.sizingMode === 'manual') {
    D = spec.boreDiameterMm / 1000;
    L = spec.stackLengthMm / 1000;
  } else {
    const lam = Math.max(0.1, spec.aspectRatio);
    D = Math.cbrt((D2L * poles) / (Math.PI * lam));
    L = D2L / (D * D);
  }
  const tau = (Math.PI * D) / poles;
  const BpeakEst = (Math.PI / 2) * spec.Bav;
  const airgapAuto = !(spec.airgapMm > 0);
  const airgap = airgapAuto ? autoAirgap(spec, tau, spec.ac, BpeakEst) : spec.airgapMm / 1000;

  return {
    m,
    poles,
    p,
    f,
    nsRpm: nsRps * 60,
    nsRps,
    Pout,
    Sin,
    Vph,
    Iph,
    Iline: lineCurrent(spec, Iph),
    C0,
    D2L,
    D,
    L,
    tau,
    aspectRatio: L / tau,
    peripheralSpeed: Math.PI * D * nsRps,
    airgap,
    airgapAuto,
  };
}

/** Carter coefficient for slot opening b0 and slot pitch τs over an air gap g (all in m). */
export function carter(slotPitch: number, b0: number, g: number): number {
  if (b0 <= 0 || g <= 0) return 1;
  const r = b0 / g;
  const gamma = (r * r) / (5 + r);
  return slotPitch / (slotPitch - gamma * g);
}

/** Minimum solid shaft diameter for a torque T [N·m] at an allowable shear stress. */
export const shaftDiameter = (T: number, tauAllow = 35e6) => Math.cbrt((16 * Math.abs(T)) / (Math.PI * tauAllow));
