/**
 * Surface-PM Vernier (flux-modulation) machine: single slotted stator, surface-magnet rotor.
 *
 * The slotted stator modulates the rotor's P_r pole-pair field with the slot permeance
 * Λ(θ) = Λ0 + Σ Λn cos(n N_s θ). Choosing P_r = N_s ∓ P_s makes the first modulated
 * component |P_r − N_s| equal to the winding's pole-pair number P_s, so a P_s-pole winding sees the
 * rotor geared up by G = P_r / P_s. Relative permeance coefficients follow Zhu & Howe (IEEE
 * Trans. Magn. 1993, "Instantaneous magnetic field distribution ... Part III: effect of stator
 * slotting"); output equation and EMF from standard harmonic winding theory.
 */
import { MU0, gcd } from '../math';
import { carter } from '../sizing/main';
import type { WindingCell } from '../types';
import { analyzeWinding, type WindingAnalysis } from '../winding/analysis';
import { defaultPitch, generateLayout } from '../winding/layout';

export interface VernierSpec {
  slots: number; // N_s
  ps: number; // armature winding pole pairs P_s
  rule: 'minus' | 'plus'; // P_r = N_s − P_s (counter-rotating field) or N_s + P_s
  phases: number;
  layers: number;
  coilPitch: number;
  parallelPaths: number;
  speedRpm: number;
  voltageV: number; // line rms
  connection: 'star' | 'delta';
  emfRatio: number; // E / V_ph target
  boreDiameterMm: number; // air-gap (stator bore) diameter
  stackLengthMm: number;
  airgapMm: number;
  slotOpeningRatio: number; // ε = b0 / τ_s
  magnetThicknessMm: number;
  magnetArc: number; // magnet arc / rotor pole pitch
  remanence: number;
  relPermeability: number;
  leakage: number; // magnet leakage factor k_l (many poles → lower)
  electricLoading: number; // A/m rms
  currentDensity: number; // A/mm²
  fillFactor: number;
  copperTempC: number;
}

export function defaultVernier(): VernierSpec {
  return {
    slots: 18,
    ps: 2,
    rule: 'minus',
    phases: 3,
    layers: 2,
    coilPitch: 4,
    parallelPaths: 1,
    speedRpm: 300,
    voltageV: 400,
    connection: 'star',
    emfRatio: 0.9,
    boreDiameterMm: 150,
    stackLengthMm: 80,
    airgapMm: 0.5,
    slotOpeningRatio: 0.5,
    magnetThicknessMm: 3,
    magnetArc: 0.85,
    remanence: 1.25,
    relPermeability: 1.05,
    leakage: 0.9,
    electricLoading: 25000,
    currentDensity: 5,
    fillFactor: 0.45,
    copperTempC: 100,
  };
}

/** Rotor pole pairs for the chosen rule. */
export const rotorPolePairs = (v: Pick<VernierSpec, 'slots' | 'ps' | 'rule'>) => (v.rule === 'minus' ? v.slots - v.ps : v.slots + v.ps);

/**
 * Zhu–Howe relative permeance of a slotted surface: λ(θ) = λ0 + Σ λn cos(n N_s θ), normalised to
 * μ0/g'. g' is the magnetic gap seen by the slots (air gap plus magnet thickness / μr).
 */
export function slotPermeance(eps: number, slotPitch: number, gEff: number, harmonics = 3) {
  const b0 = Math.max(1e-9, eps * slotPitch);
  const beta = 0.5 - 1 / (2 * Math.sqrt(1 + (b0 / (2 * gEff)) ** 2));
  const kC = carter(slotPitch, b0, gEff);
  const lambda0 = (1 / kC) * (1 - 1.6 * beta * eps);
  const lambdas: number[] = [];
  for (let n = 1; n <= harmonics; n++) {
    const x = n * eps;
    const den = 0.78125 - 2 * x * x;
    // removable singularity at x = 0.625 (sin term vanishes too): use the limit
    const f = Math.abs(den) < 1e-6 ? (1.6 * Math.PI * Math.cos(1.6 * Math.PI * 0.625)) / (-4 * 0.625) : Math.sin(1.6 * Math.PI * x) / den;
    lambdas.push(-(4 / (n * Math.PI)) * beta * 0.78125 * f);
  }
  return { beta, kC, lambda0, lambdas };
}

export interface GapComponent {
  order: number; // mechanical pole-pair order |P_r + j N_s|
  j: number;
  amplitude: number; // T (peak)
  role: 'direct' | 'working' | 'sideband';
}

export interface VernierResult {
  Pr: number;
  G: number;
  fe: number; // electrical frequency [Hz]
  feasible: boolean;
  notes: string[];
  slotPitch: number; // m
  b0: number; // m
  kC: number;
  lambda0: number;
  lambda1: number;
  Bm: number; // flat-top magnet gap density (slotless) [T]
  Br1: number; // fundamental of the rotor field at order P_r (slotless) [T]
  BPr: number; // direct component [T]
  BPs: number; // modulated (working) component [T]
  Beff: number; // G·B_Ps + B_Pr [T]
  spectrum: GapComponent[];
  winding: WindingAnalysis;
  windingMatrix: WindingCell[][];
  kwPs: number;
  kwPr: number;
  Vph: number;
  Nph: number;
  Zs: number;
  E: number; // phase EMF (rms) at rated speed
  EPs: number; // share from the working component
  EPr: number; // share from the direct component
  Iph: number; // rms
  torque: number;
  power: number;
  shear: number; // Pa
  trv: number; // N·m/m³
  Ls: number; // synchronous inductance [H]
  psiM: number; // peak PM flux linkage [Wb]
  powerFactor: number;
  inverterKVA: number;
  conductorArea: number; // mm²
  slotArea: number; // mm² required winding area
  slotDepth: number; // m (body, rectangular estimate)
  toothWidth: number; // m
  yoke: number; // m
  Rph: number;
  copperLoss: number;
  magnetMass: number;
}

const RHO_CU20 = 1.72e-8;

export function analyzeVernier(v: VernierSpec): VernierResult {
  const notes: string[] = [];
  const Ns = Math.max(3, Math.round(v.slots));
  const Ps = Math.max(1, Math.round(v.ps));
  const m = Math.max(1, Math.round(v.phases));
  const Pr = rotorPolePairs({ slots: Ns, ps: Ps, rule: v.rule });
  const G = Pr / Ps;
  const fe = (Pr * v.speedRpm) / 60;
  const D = v.boreDiameterMm / 1000;
  const L = v.stackLengthMm / 1000;
  const g = v.airgapMm / 1000;
  const hm = v.magnetThicknessMm / 1000;
  const mur = v.relPermeability;
  const slotPitch = (Math.PI * D) / Ns;
  const eps = Math.min(0.95, Math.max(0.01, v.slotOpeningRatio));
  const gEff = g + hm / mur;

  // winding for P_s pole pairs on N_s slots
  const pitch = Math.max(1, Math.round(v.coilPitch || defaultPitch(Ns, 2 * Ps)));
  const layout = generateLayout({ slots: Ns, poles: 2 * Ps, phases: m, layers: v.layers, coilPitch: pitch, layerDefs: [], parallelPaths: 1, arrangement: 'radial', skewSlots: 0, custom: null });
  const winding = analyzeWinding(layout.matrix, 2 * Ps, m, layout.coils, { maxOrder: Math.max(Pr, 3 * Ns), slotOpeningRad: (eps * slotPitch) / (D / 2) });
  const kwPs = winding.harmonics[Ps - 1]?.kw ?? 0;
  const kwPr = winding.harmonics[Pr - 1]?.kw ?? 0;
  const feasible = winding.balanced && Ns % (m * gcd(Ns, Ps)) === 0;
  if (!feasible) notes.push(`The ${2 * Ps}-pole, ${m}-phase winding on ${Ns} slots is not balanced.`);
  if (gcd(Ns, Pr) === 1 && Pr > 1) notes.push('GCD(N_s, P_r) = 1: the rotor magnetic pull is unbalanced.');
  if (fe > 400) notes.push(`f_e = ${fe.toFixed(0)} Hz: use thin laminations (≤ 0.2–0.35 mm) and check iron loss.`);

  // slot permeance and rotor field
  const perm = slotPermeance(eps, slotPitch, gEff, 3);
  const lambda1 = perm.lambdas[0];
  const Bm = (v.leakage * v.remanence * (hm / mur)) / (hm / mur + g);
  const Br1 = (4 / Math.PI) * Bm * Math.sin((Math.min(1, v.magnetArc) * Math.PI) / 2);
  const BPr = Br1 * perm.lambda0;
  const BPs = 0.5 * Br1 * Math.abs(lambda1);
  const Beff = G * BPs + BPr;
  const spectrum: GapComponent[] = [];
  for (let j = -2; j <= 2; j++) {
    const order = Math.abs(Pr + j * Ns);
    const lam = j === 0 ? perm.lambda0 : 0.5 * Math.abs(perm.lambdas[Math.abs(j) - 1] ?? 0);
    spectrum.push({ order, j, amplitude: Br1 * lam, role: j === 0 ? 'direct' : order === Ps ? 'working' : 'sideband' });
  }

  // turns from the EMF target: E = √2·π·f_e·N·D·L·(k_w,Ps·B_Ps/P_s + k_w,Pr·B_Pr/P_r)
  const Vph = v.connection === 'star' ? v.voltageV / (2 * Math.sin(Math.PI / m)) : v.voltageV;
  const a = Math.max(1, Math.round(v.parallelPaths));
  const S = (kwPs * BPs) / Ps + (kwPr * BPr) / Pr;
  const perTurn = Math.SQRT2 * Math.PI * fe * D * L * S;
  const NTarget = perTurn > 0 ? (v.emfRatio * Vph) / perTurn : 0;
  const units = Math.max(1, layout.units);
  const zl = Math.max(1, Math.round((2 * m * NTarget * a) / Ns / units));
  const Zs = zl * units;
  const Nph = (Ns * Zs) / (2 * m * a);
  const E = perTurn * Nph;
  const EPs = Math.SQRT2 * Math.PI * fe * D * L * Nph * (kwPs * BPs) / Ps;
  const EPr = Math.SQRT2 * Math.PI * fe * D * L * Nph * (kwPr * BPr) / Pr;

  // current from the electric loading, torque from the output equation
  const Iph = (v.electricLoading * Math.PI * D) / (2 * m * Nph);
  const torque = (Math.PI / 4) * D * D * L * Math.SQRT2 * v.electricLoading * (kwPs * G * BPs + kwPr * BPr);
  const omegaM = (2 * Math.PI * v.speedRpm) / 60;
  const power = torque * omegaM;
  const shear = torque / (2 * Math.PI * (D / 2) ** 2 * L);
  const trv = torque / ((Math.PI / 4) * D * D * L);

  // synchronous inductance: magnetising (P_s wave, large effective gap) + slot/end/differential leakage
  const deltaEff = perm.kC * g + hm / mur;
  const kwN = kwPs * Nph;
  const Lm = (m * MU0 * kwN * kwN * D * L) / (Math.PI * Ps * Ps * deltaEff);
  const lamSlot = 1.2 + 1 / Math.max(0.05, eps); // slot body + wide opening (estimate)
  const Lslot = ((4 * m) / Ns) * MU0 * L * Nph * Nph * Math.min(lamSlot, 3);
  const Ldiff = winding.sigmaDiff * Lm;
  const Ls = Lm + Lslot + Ldiff;
  const omegaE = 2 * Math.PI * fe;
  const psiM = (Math.SQRT2 * E) / omegaE;
  const Ipk = Math.SQRT2 * Iph;
  const powerFactor = psiM / Math.hypot(psiM, Ls * Ipk);
  const inverterKVA = (m * Vph * Iph) / 1000;

  // slots, teeth, yoke, copper
  const conductorArea = Iph / (a * v.currentDensity);
  const slotArea = (Zs * conductorArea) / Math.max(0.1, v.fillFactor);
  // tooth width for a peak tooth density of 1.7 T, driven conservatively by the flat-top magnet field
  const toothWidth = Math.max(0.15 * slotPitch, (Math.max(BPr + BPs, Bm) * slotPitch) / (0.95 * 1.7));
  const bs = Math.max(0.2 * slotPitch, slotPitch - toothWidth);
  const slotDepth = slotArea / 1e6 / bs;
  const phiPs = (BPs * D * L) / Ps;
  const phiPr = (BPr * D * L) / Pr;
  const yoke = Math.max(0.003, Math.max(phiPs, phiPr) / (2 * 0.95 * L * 1.4));
  const yFull = Ns / (2 * Ps);
  const span = Math.max(1, Math.min(pitch, yFull)) * ((Math.PI * (D + slotDepth)) / Ns);
  const lmt = 2 * (L + (Math.PI * span) / 2 + 0.02);
  const Rph = (RHO_CU20 * (1 + 0.00393 * (v.copperTempC - 20)) * Nph * lmt) / (a * conductorArea * 1e-6);
  const copperLoss = m * Iph * Iph * Rph;
  const magnetMass = Math.min(1, v.magnetArc) * Math.PI * ((D / 2 - g) ** 2 - (D / 2 - g - hm) ** 2) * L * 7500;

  if (powerFactor < 0.6) notes.push(`Power factor ${powerFactor.toFixed(2)}: typical for high gear ratios; size the inverter for S = P/(PF·η).`);
  if (eps < 0.3) notes.push('Small slot opening: weak modulation (λ1 small). Vernier machines usually use ε ≈ 0.4–0.6.');

  return {
    Pr,
    G,
    fe,
    feasible,
    notes,
    slotPitch,
    b0: eps * slotPitch,
    kC: perm.kC,
    lambda0: perm.lambda0,
    lambda1,
    Bm,
    Br1,
    BPr,
    BPs,
    Beff,
    spectrum,
    winding,
    windingMatrix: layout.matrix,
    kwPs,
    kwPr,
    Vph,
    Nph,
    Zs,
    E,
    EPs,
    EPr,
    Iph,
    torque,
    power,
    shear,
    trv,
    Ls,
    psiM,
    powerFactor,
    inverterKVA,
    conductorArea,
    slotArea,
    slotDepth,
    toothWidth,
    yoke,
    Rph,
    copperLoss,
    magnetMass,
  };
}

/** Sweep of the slot-opening ratio (modulation vs Carter penalty). */
export function slotOpeningSweep(v: VernierSpec, n = 40) {
  const out: { eps: number; lambda1: number; kC: number; Beff: number; torque: number }[] = [];
  for (let i = 0; i < n; i++) {
    const eps = 0.05 + (0.8 * i) / (n - 1);
    const r = analyzeVernier({ ...v, slotOpeningRatio: eps });
    out.push({ eps, lambda1: Math.abs(r.lambda1), kC: r.kC, Beff: r.Beff, torque: r.torque });
  }
  return out;
}

export interface PolePairOption {
  ps: number;
  Pr: number;
  G: number;
  kwPs: number;
  fe: number;
  balanced: boolean;
}

/** Candidate winding pole pairs for a slot number (both rules), with gear ratio and k_w. */
export function polePairOptions(v: VernierSpec): PolePairOption[] {
  const out: PolePairOption[] = [];
  for (let ps = 1; ps <= Math.floor(v.slots / 2) - 1; ps++) {
    const Pr = rotorPolePairs({ slots: v.slots, ps, rule: v.rule });
    if (Pr <= 0) continue;
    const layout = generateLayout({ slots: v.slots, poles: 2 * ps, phases: v.phases, layers: 2, coilPitch: defaultPitch(v.slots, 2 * ps), layerDefs: [], parallelPaths: 1, arrangement: 'radial', skewSlots: 0, custom: null });
    const a = analyzeWinding(layout.matrix, 2 * ps, v.phases, [], { maxOrder: ps, fast: true });
    out.push({ ps, Pr, G: Pr / ps, kwPs: a.balanced ? a.kw1 : 0, fe: (Pr * v.speedRpm) / 60, balanced: a.balanced });
  }
  return out;
}

/** Radial air-gap flux density B(θ) = B_mag(θ)·λ(θ) over a mechanical angle range (no-load). */
export function gapWaveform(v: VernierSpec, points = 720) {
  const r = analyzeVernier(v);
  const perm = slotPermeance(Math.min(0.95, Math.max(0.01, v.slotOpeningRatio)), r.slotPitch, v.airgapMm / 1000 + v.magnetThicknessMm / 1000 / v.relPermeability, 3);
  const Ns = v.slots;
  const arc = Math.min(1, v.magnetArc);
  const out: { deg: number; b: number; bMag: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const th = (2 * Math.PI * i) / points;
    // square-wave magnets of arc ratio α_m on P_r pole pairs
    const x = ((th * r.Pr) / Math.PI) % 2; // position in pole pairs (0..2)
    const inPole = (x % 1) > (1 - arc) / 2 && (x % 1) < 1 - (1 - arc) / 2;
    const bMag = inPole ? (x < 1 ? 1 : -1) * r.Bm : 0;
    let lam = perm.lambda0;
    perm.lambdas.forEach((ln, k) => (lam += ln * Math.cos((k + 1) * Ns * th)));
    out.push({ deg: (th * 180) / Math.PI, b: bMag * lam, bMag });
  }
  return out;
}
