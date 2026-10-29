import { CONDUCTORS, STEELS, resistivity, steelH } from '../../materials';
import { autoSizeSlot, fixedParams, shapeOf, slotMetrics } from '../../slots';
import type { MachineSpec } from '../../types';
import type { RotorMagnetic } from '../electrical';
import { carter, shaftDiameter } from '../main';
import type { MainDimensions, SlotResult, StatorResult, WoundFieldRotorResult } from '../result';

const POLE_LEAKAGE = 1.15;
const BRUSH_DROP = 2; // V

/** Salient-pole d/q magnetizing factors for pole embrace ψ (Pyrhönen/Vogt). */
export function salientFactors(psi: number) {
  const a = psi * Math.PI;
  return {
    kd: (a + Math.sin(a)) / Math.PI,
    kq: (a - Math.sin(a)) / Math.PI + (2 / (3 * Math.PI)) * Math.cos(a / 2),
  };
}

/**
 * Wound-field rotor. `fieldAT` is the rated field MMF per pole (A-turns) and `fluxScale` = E0/E
 * scales the pole flux at rated excitation. Called twice by the design flow (estimate, then final).
 */
export function designWoundFieldRotor(
  spec: MachineSpec,
  main: MainDimensions,
  st: StatorResult,
  torque: number,
  fieldAT: number,
  fluxScale: number, // resultant air-gap flux / no-load flux at rated voltage
  E0: number,
): { rotor: WoundFieldRotorResult; magnetic: RotorMagnetic } {
  const wf = spec.woundField;
  const steel = STEELS[spec.steel];
  const { D, airgap: g, L, poles, tau } = main;
  const kfe = spec.stackingFactor;
  const Dr = D - 2 * g;
  const Rr = Dr / 2;
  const tauR = (Math.PI * Dr) / poles;
  const psi = Math.min(0.9, Math.max(0.4, wf.poleArcRatio));
  const rho = resistivity('copper', spec.copperTempC);
  const shaftMin = shaftDiameter(torque);
  const Jf = wf.fieldCurrentDensity * 1e6;
  const kff = Math.max(0.2, wf.fieldFillFactor);
  const Vf = Math.max(1, wf.fieldVoltage);
  const phiPole = POLE_LEAKAGE * st.phi * fluxScale;

  if (wf.poleType === 'salient') {
    const bp = phiPole / (kfe * L * wf.poleFluxDensity);
    const shoe = Math.max(0.003, 0.12 * psi * tauR);
    const Acoil = fieldAT / (Jf * kff);
    // Coil sides fill the interpolar gap from under the pole shoe downwards; the usable width
    // per side shrinks with radius: w(r) = (2πr/2p − b_p)/2 − clearance.
    const clearance = 0.002;
    const rTop = Rr - shoe - 0.002;
    const wAt = (r: number) => ((2 * Math.PI * r) / poles - bp) / 2 - clearance;
    const rLimit = Math.max(bp / 2 + 0.002, (poles * (bp + 2 * clearance + 0.006)) / (2 * Math.PI));
    const areaTo = (rb: number) => {
      const n = 40;
      let a = 0;
      for (let i = 0; i < n; i++) {
        const r = rb + ((rTop - rb) * (i + 0.5)) / n;
        a += Math.max(0, wAt(r)) * ((rTop - rb) / n);
      }
      return a;
    };
    let limited = areaTo(rLimit) < Acoil;
    let rBot = rLimit;
    if (!limited) {
      let lo = rLimit;
      let hi = rTop;
      for (let i = 0; i < 60; i++) {
        const mid = 0.5 * (lo + hi);
        if (areaTo(mid) > Acoil) lo = mid;
        else hi = mid;
      }
      rBot = 0.5 * (lo + hi);
    }
    const hp = Rr - shoe - rBot + 0.004;
    const wc = Math.max(0.002, (wAt(rTop) + Math.max(0, wAt(rBot))) / 2);
    limited = limited || rBot - Math.max(shaftMin / 2, 0) < 0.01;
    const rHub = Math.max(Rr - shoe - hp, 0.5 * shaftMin + 0.002);
    const yokeReq = phiPole / (2 * kfe * L * spec.BrotorYokeMax);
    const Di = Math.max(shaftMin, 2 * (rHub - yokeReq));
    const yoke = Math.max(1e-4, rHub - Di / 2);
    const Byoke = phiPole / (2 * kfe * L * yoke);
    const lmtF = 2 * (L + bp) + Math.PI * (wc + 0.004);
    const af = (rho * poles * lmtF * fieldAT) / (0.95 * Vf - BRUSH_DROP);
    const If = Jf * af;
    const Tf = fieldAT / If;
    const Rf = (poles * rho * Tf * lmtF) / af;
    const fieldLoss = If * If * Rf + BRUSH_DROP * If;
    const fieldCopperMass = poles * Tf * lmtF * af * CONDUCTORS.copper.density;
    const { kd, kq } = salientFactors(psi);
    const Bp = phiPole / (kfe * L * bp);
    const poleArea = poles * (bp * hp + psi * tauR * shoe);
    const ironMass = (poleArea + (Math.PI / 4) * ((2 * rHub) ** 2 - Di * Di)) * L * kfe * steel.density;
    const rotor: WoundFieldRotorResult = {
      kind: 'wound_field',
      poleType: 'salient',
      poleArc: psi,
      Dr,
      Di,
      shaftMin,
      poleBodyWidth: bp,
      poleBodyHeight: hp,
      poleShoeHeight: shoe,
      coilWidth: wc,
      coilHeight: Acoil / wc,
      fieldATnoLoad: 0,
      fieldATrated: fieldAT,
      fieldTurnsPerPole: Tf,
      fieldCurrent: If,
      fieldConductorArea: af * 1e6,
      fieldResistance: Rf,
      fieldLoss,
      fieldCopperMass,
      E0,
      psiF: 0,
      Qr: 0,
      woundSlotsPerPole: 0,
      coreLimited: limited,
      slot: null,
      yoke,
      Byoke,
      ironMass,
    };
    return {
      rotor,
      magnetic: {
        carter: 1,
        toothDepth: 0,
        toothB: 0,
        yokeB: Byoke,
        yokeLen: Math.max(0, (Math.PI * (2 * rHub - yoke)) / poles),
        extraGap: 0,
        dAxisFactor: kd,
        qAxisFactor: kq,
        poleBodyMMF: steelH(steel, Bp) * (hp + shoe),
      },
    };
  }

  // Cylindrical (non-salient) rotor with distributed field winding in ~2/3 of each pole pitch.
  const Qr = spec.woundField.rotorSlots > 0 ? Math.round(wf.rotorSlots) : Math.max(3 * poles, poles * Math.round((0.75 * st.Q) / poles));
  const perPole = Qr / poles;
  const nw = Math.max(2, 2 * Math.round(((2 / 3) * perPole) / 2));
  const theta = (2 * fieldAT) / nw; // ampere-conductors per slot
  const slotPitch = (Math.PI * Dr) / Qr;
  const toothWidth = (st.BgPeak * slotPitch) / (kfe * spec.BtoothMax);
  const shape = shapeOf(wf.rotorSlot.shape);
  const target = (theta / (Jf * kff)) * 1e6; // mm²
  const ctx = { R: Rr * 1000, Q: Qr, side: 'rotor' as const, toothWidth: toothWidth * 1000, fixed: fixedParams(wf.rotorSlot) };
  let params = { ...wf.rotorSlot.params };
  let limited = false;
  if (wf.rotorSlot.autoSize) {
    const r = autoSizeSlot(shape, ctx, target);
    params = r.params;
    limited = r.limited;
  }
  const metrics = slotMetrics(shape, params, Rr * 1000, Qr, 'rotor');
  const slot: SlotResult = { shape: shape.id, params, metrics, targetArea: target, limited };
  const depth = metrics.depth / 1000;
  const yokeReq = phiPole / (2 * kfe * L * spec.BrotorYokeMax);
  const Di = Math.max(shaftMin, Dr - 2 * (depth + yokeReq));
  const yoke = Math.max(1e-4, (Dr - 2 * depth - Di) / 2);
  const Byoke = phiPole / (2 * kfe * L * yoke);
  const lmtF = 2 * L + 2.5 * (2 / 3) * tauR;
  const Qw = nw * poles;
  const af = (rho * lmtF * ((Qw * theta) / 2)) / (0.95 * Vf - BRUSH_DROP);
  const If = Jf * af;
  const Tf = fieldAT / If;
  const fieldLoss = Vf * 0.95 * If + BRUSH_DROP * If;
  const fieldCopperMass = ((Qw * theta) / 2 / If) * lmtF * af * CONDUCTORS.copper.density;
  const BtoothMean = (st.BgPeak * slotPitch) / (kfe * Math.max(1e-5, metrics.toothMean / 1000));
  const ironMass = ((Math.PI / 4) * (Dr * Dr - Di * Di) - (Qw * metrics.outlineArea) / 1e6) * L * kfe * steel.density;
  void tau;
  const rotor: WoundFieldRotorResult = {
    kind: 'wound_field',
    poleType: 'cylindrical',
    poleArc: psi,
    Dr,
    Di,
    shaftMin,
    poleBodyWidth: 0,
    poleBodyHeight: 0,
    poleShoeHeight: 0,
    coilWidth: 0,
    coilHeight: 0,
    fieldATnoLoad: 0,
    fieldATrated: fieldAT,
    fieldTurnsPerPole: Tf,
    fieldCurrent: If,
    fieldConductorArea: af * 1e6,
    fieldResistance: (0.95 * Vf - BRUSH_DROP) / If,
    fieldLoss,
    fieldCopperMass,
    E0,
    psiF: 0,
    Qr,
    woundSlotsPerPole: nw,
    coreLimited: limited,
    slot,
    yoke,
    Byoke,
    ironMass,
  };
  return {
    rotor,
    magnetic: {
      carter: carter(slotPitch, metrics.opening / 1000, g),
      toothDepth: depth,
      toothB: BtoothMean,
      yokeB: Byoke,
      yokeLen: (Math.PI * (Dr - 2 * depth - yoke)) / poles,
      extraGap: 0,
      dAxisFactor: 1,
      qAxisFactor: 0.9,
    },
  };
}
