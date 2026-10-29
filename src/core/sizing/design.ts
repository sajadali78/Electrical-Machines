import { STEELS, coreLossDensity } from '../materials';
import { cabs, carg, cmul, cpolar, csub, cx, type Complex } from '../math';
import { iecStrayFraction, windageFriction, type LossScaling } from '../performance/common';
import { imEnvelopeAndMap, imLineCurve, imRatedPoint, imSolve, slipAtMaxTorque, type ImCircuit } from '../performance/induction';
import { dqEnvelopeAndMap, dqRatedPoint, loadAngleCurve, type DqModel } from '../performance/synchronous';
import { analyzeWinding } from '../winding/analysis';
import { generateLayout, type WindingLayout } from '../winding/layout';
import { MAGNET, CONDUCTORS } from '../materials';
import type { MachineSpec } from '../types';
import { buildChecks } from './checks';
import { electricalParams, type RotorMagnetic } from './electrical';
import { carter, mainDimensions } from './main';
import type { DesignResult, LossBreakdown, Masses, Performance, RotorResult } from './result';
import { designInductionRotor } from './rotor/induction';
import { designPmRotor, pmMagnetics } from './rotor/pm';
import { designWoundFieldRotor } from './rotor/woundField';
import { designStator, type FluxInputs } from './stator';

export interface DesignOptions {
  lite?: boolean; // skip curves/maps (optimizer sweeps)
}

/** Single pitch of the layout, if all coils share it (for the kp/kd split). */
function layoutPitch(spec: MachineSpec, layout: WindingLayout): number | null {
  if (layout.kind === 'single' && spec.winding.slots % spec.winding.poles === 0) return spec.winding.slots / spec.winding.poles;
  if (layout.kind === 'single' || layout.kind === 'double') {
    const Q = spec.winding.slots;
    const c = layout.coils[0];
    if (!c) return null;
    const d = (c.ret.slot - c.go.slot + Q) % Q;
    return d;
  }
  if (layout.kind === 'multi') {
    const ps = new Set(spec.winding.pairs.slice(0, layout.layers / 2).map((p) => p.pitch));
    return ps.size === 1 ? [...ps][0] : null;
  }
  return null;
}

export function runDesign(spec: MachineSpec, opts: DesignOptions = {}): DesignResult {
  const w = spec.winding;
  const poles = w.poles;
  const m = w.phases;
  const p = poles / 2;
  const layout = generateLayout(w);
  const quick = analyzeWinding(layout.matrix, poles, m, [], { maxOrder: p, fast: true, skewSlots: w.skewSlots });
  const kw1 = Math.max(0.05, quick.kw1 * quick.ksk1);

  const main = mainDimensions(spec, kw1);
  const { D, L, tau, f, Pout, Vph } = main;
  const isIM = spec.topology === 'induction';
  const isPM = spec.topology === 'pmsm_spm' || spec.topology === 'pmsm_ipm';
  const isWF = spec.topology === 'wound_field';
  const speedEst = isIM ? main.nsRpm * 0.97 : main.nsRpm;
  const torqueEst = Pout / ((2 * Math.PI * speedEst) / 60);

  // ---- flux definition per topology
  let flux: FluxInputs;
  let pmMag: ReturnType<typeof pmMagnetics> | null = null;
  if (isPM) {
    const b0 = (spec.statorSlot.params.b0 ?? 3) / 1000;
    const kCest = carter((Math.PI * D) / w.slots, b0, main.airgap);
    pmMag = pmMagnetics(spec, main, kCest, torqueEst);
    flux = pmMag.flux;
  } else if (isWF && spec.woundField.poleType === 'salient') {
    const psi = spec.woundField.poleArcRatio;
    flux = {
      Bav: spec.Bav,
      phi1Factor: ((8 / (Math.PI * Math.PI)) * Math.sin((psi * Math.PI) / 2)) / psi,
      BgPeak: spec.Bav / psi,
      emfFactor: 1.0,
      fluxFixed: false,
      magneticGapExtra: 0,
    };
  } else {
    flux = {
      Bav: spec.Bav,
      phi1Factor: 1,
      BgPeak: (Math.PI / 2) * spec.Bav,
      emfFactor: isIM ? Math.min(0.97, 0.93 + 0.012 * Math.log10(Math.max(1, spec.powerKw))) : 1.0,
      fluxFixed: false,
      magneticGapExtra: 0,
    };
  }

  const st = designStator(spec, main, layout, kw1, flux);
  const windingInfo = { kw1, sigmaDiff: 0, layers: layout.layers, arrangement: w.arrangement };
  // σδ from the full analysis (independent of dimensions)
  const full = analyzeWinding(layout.matrix, poles, m, layout.coils, {
    pitch: layoutPitch(spec, layout),
    slotOpeningRad: st.slotOpening / (D / 2),
    skewSlots: w.skewSlots,
    maxOrder: opts.lite ? p : Math.max(3 * w.slots, 30 * p),
    fast: opts.lite,
  });
  windingInfo.sigmaDiff = opts.lite ? quick.sigmaDiff : full.sigmaDiff;

  // ---- rotor
  let rotor: RotorResult;
  let magnetic: RotorMagnetic;
  if (isIM) {
    ({ rotor, magnetic } = designInductionRotor(spec, main, st, kw1, torqueEst));
  } else if (isPM && pmMag) {
    ({ rotor, magnetic } = designPmRotor(spec, main, st, pmMag));
  } else {
    // two passes: estimate field MMF, then final with the excitation EMF from the phasor diagram
    let fieldAT = 2.2 * ((st.BgPeak * main.airgap) / (4e-7 * Math.PI));
    let r = designWoundFieldRotor(spec, main, st, torqueEst, fieldAT, 1, st.E);
    for (let pass = 0; pass < 3; pass++) {
      const el0 = electricalParams(spec, main, st, windingInfo, r.magnetic);
      const Xs = 2 * Math.PI * f;
      const { E0, Edelta } = excitationEmf(spec, main, el0.R1, Xs * el0.Ld, Xs * el0.Lq, Xs * el0.Lsigma);
      const at = el0.fieldAT;
      const ironAT = at.statorTeeth + at.rotorTeeth + at.statorYoke + at.rotorYoke + (r.magnetic.poleBodyMMF ?? 0);
      // gap MMF follows the (unsaturated) excitation EMF, iron MMF the resultant air-gap flux
      fieldAT = at.gap * (E0 / st.E) + ironAT * (Edelta / st.E);
      r = designWoundFieldRotor(spec, main, st, torqueEst, fieldAT, Edelta / st.E + 0.15 * (E0 / st.E - 1), E0);
      r.rotor.fieldATnoLoad = at.gap + ironAT;
      r.rotor.psiF = (Math.SQRT2 * E0) / (2 * Math.PI * f);
    }
    rotor = r.rotor;
    magnetic = r.magnetic;
  }
  const el = electricalParams(spec, main, st, windingInfo, magnetic);

  // ---- losses at rated (iron/mech/stray scaling bases)
  const steel = STEELS[spec.steel];
  const PfeTeeth = 1.8 * st.teethMass * coreLossDensity(steel, st.BtoothMean, f);
  const PfeYoke = 1.5 * st.yokeMass * coreLossDensity(steel, st.Byoke, f);
  const Pfe = PfeTeeth + PfeYoke;
  const nRatedEst = isIM ? main.nsRpm * 0.97 : main.nsRpm;
  const Pfw = windageFriction(D, L, tau, nRatedEst);
  const strayFrac = isIM ? iecStrayFraction(Pout) : 0.005;
  const PinEst = Pout / (spec.targetEfficiency / 100);
  const IratedEst = main.Iph;
  const ls: LossScaling = {
    PfeRated: Pfe,
    fRated: f,
    PfwRated: Pfw,
    nRated: nRatedEst,
    strayRated: strayFrac * PinEst,
    IRated: IratedEst,
  };
  const nMax = spec.maxSpeedRatio * main.nsRpm;

  let performance: Performance;
  let losses: LossBreakdown;
  if (isIM) {
    const circuit: ImCircuit = { m, p, f, V: Vph, R1: el.R1, X1: el.X1, R2: (rotor as { R2: number }).R2, X2: 2 * Math.PI * f * ((rotor as { L2: number }).L2 + (1 - quick.ksk1 ** 2) * el.Lm), Xm: el.Xm };
    const Erated = imSolve(circuit, 0.02).E;
    const r = imRatedPoint(circuit, Pout, ls, Erated);
    ls.nRated = r.op.speedRpm;
    ls.IRated = r.op.current;
    const rr = imRatedPoint(circuit, Pout, ls, Erated);
    const start = imSolve(circuit, 1);
    const sT = slipAtMaxTorque(circuit);
    const tmax = imSolve(circuit, sT);
    const env = opts.lite ? { envelope: [], map: null } : imEnvelopeAndMap(circuit, ls, Erated, rr.op.current, rr.op.speedRpm, nMax, true);
    performance = {
      rated: rr.op,
      startTorque: start.T,
      startCurrent: start.I1,
      maxTorque: tmax.T,
      maxTorqueSpeed: tmax.speedRpm,
      lineCurve: opts.lite ? null : imLineCurve(circuit, ls, Erated),
      envelope: env.envelope,
      map: env.map,
      baseSpeed: rr.op.speedRpm,
      maxSpeed: nMax,
      loadAngleCurve: null,
      notes: rr.feasible ? [] : ['Rated output exceeds the breakdown power of the equivalent circuit.'],
    };
    losses = {
      statorCopper: rr.losses.statorCopper,
      rotorCopper: rr.losses.rotorCopper,
      statorIronTeeth: rr.losses.iron * (PfeTeeth / Pfe),
      statorIronYoke: rr.losses.iron * (PfeYoke / Pfe),
      rotorIron: 0,
      mechanical: rr.losses.mech,
      stray: rr.losses.stray,
      total: rr.Pin - Pout,
      Pin: rr.Pin,
      Pout,
      efficiency: Pout / rr.Pin,
    };
  } else {
    const psiRated = isPM ? (rotor as { psiM: number }).psiM : (rotor as { psiF: number }).psiF;
    const Imax = Math.SQRT2 * main.Iph * 1.0;
    const mdl: DqModel = {
      m,
      p,
      R: el.R1,
      Ld: el.Ld,
      Lq: el.Lq,
      psiRated,
      psiVariable: isWF,
      Imax,
      Vmax: Math.SQRT2 * Vph,
      fieldLossRated: isWF ? (rotor as { fieldLoss: number }).fieldLoss : 0,
    };
    const psiAirRated = (Math.SQRT2 * st.E) / (2 * Math.PI * f);
    const r = dqRatedPoint(mdl, Pout, main.nsRpm, ls, psiAirRated);
    ls.IRated = r.op.current;
    const rr = dqRatedPoint(mdl, Pout, main.nsRpm, ls, psiAirRated);
    const env = opts.lite ? { envelope: [], map: null } : dqEnvelopeAndMap(mdl, ls, psiAirRated, nMax, true);
    const tmax = env.envelope.length ? Math.max(...env.envelope.map((e) => e.torque)) : rr.op.torque;
    const E0 = isPM ? st.E : (rotor as { E0: number }).E0;
    const wmR = (2 * Math.PI * main.nsRpm) / 60;
    const lac = opts.lite ? null : loadAngleCurve(m, wmR, Vph, E0, 2 * Math.PI * f * el.Ld, 2 * Math.PI * f * el.Lq);
    const pullOut = lac ? Math.max(...lac.map((x) => x.torque)) : tmax;
    const base = env.envelope.find((e, i) => i > 2 && e.torque < 0.97 * env.envelope[1].torque);
    performance = {
      rated: rr.op,
      startTorque: null,
      startCurrent: null,
      maxTorque: isWF ? pullOut : tmax,
      maxTorqueSpeed: main.nsRpm,
      lineCurve: null,
      envelope: env.envelope,
      map: env.map,
      baseSpeed: base ? base.speedRpm : main.nsRpm,
      maxSpeed: nMax,
      loadAngleCurve: lac,
      notes: rr.feasible ? [] : ['Rated torque cannot be reached within the current/voltage limits at rated speed.'],
    };
    losses = {
      statorCopper: rr.losses.copper,
      rotorCopper: rr.losses.field,
      statorIronTeeth: rr.losses.iron * (PfeTeeth / Pfe),
      statorIronYoke: rr.losses.iron * (PfeYoke / Pfe),
      rotorIron: 0,
      mechanical: rr.losses.mech,
      stray: rr.losses.stray,
      total: rr.Pin - Pout,
      Pin: rr.Pin,
      Pout,
      efficiency: Pout / rr.Pin,
    };
  }

  // ---- masses & cost
  const rotorIron =
    rotor.kind === 'induction' ? rotor.teethMass + rotor.yokeMass : rotor.ironMass;
  const rotorConductor =
    rotor.kind === 'induction' ? rotor.conductorMass : rotor.kind === 'wound_field' ? rotor.fieldCopperMass : 0;
  const magnet = rotor.kind === 'pm' ? rotor.magnetMass : 0;
  const statorIron = st.teethMass + st.yokeMass;
  const rotorMetal = rotor.kind === 'induction' && rotor.rotorType === 'cage' ? spec.induction.barMaterial : 'copper';
  const masses: Masses = {
    statorIron,
    rotorIron,
    statorCopper: st.copperMass,
    rotorConductor,
    magnet,
    total: statorIron + rotorIron + st.copperMass + rotorConductor + magnet,
    cost:
      (statorIron + rotorIron) * steel.costPerKg +
      st.copperMass * CONDUCTORS.copper.costPerKg +
      rotorConductor * CONDUCTORS[rotorMetal].costPerKg +
      magnet * MAGNET.costPerKg,
  };

  const torqueRated = performance.rated.torque;
  const shear = torqueRated / (2 * Math.PI * (D / 2) ** 2 * L);
  const trv = torqueRated / ((Math.PI / 4) * D * D * L);

  const result: DesignResult = {
    spec,
    main,
    layout,
    winding: full,
    stator: st,
    rotor,
    electrical: el,
    losses,
    performance,
    masses,
    checks: [],
    shear,
    trv,
    torqueRated,
    ratedSpeedRpm: performance.rated.speedRpm,
  };
  result.checks = buildChecks(result);
  return result;
}

/**
 * Excitation EMF of a wound-field machine from the two-reaction phasor diagram (motor convention),
 * V = E0 + R·I + jXd·Id + jXq·Iq, with the current leading V by acos(PF) (over-excited motor).
 */
export function excitationEmf(
  spec: MachineSpec,
  main: { Vph: number; Iph: number },
  R: number,
  Xd: number,
  Xq: number,
  Xsigma = 0,
): { E0: number; Edelta: number } {
  const phi = Math.acos(Math.min(1, Math.max(0.3, spec.targetPowerFactor)));
  const V: Complex = cx(main.Vph, 0);
  const I = cpolar(main.Iph, phi);
  const EQ = csub(csub(V, cmul(cx(R, 0), I)), cmul(cx(0, Xq), I));
  const delta = carg(EQ);
  const Id = cabs(I) * Math.cos(carg(I) - (delta - Math.PI / 2));
  const E0 = Math.max(0.1 * main.Vph, cabs(EQ) - (Xd - Xq) * Id);
  const Edelta = cabs(csub(V, cmul(cx(R, Xsigma), I)));
  return { E0, Edelta };
}
