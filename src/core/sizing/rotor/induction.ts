import { CONDUCTORS, STEELS, resistivity } from '../../materials';
import { MU0 } from '../../math';
import { autoSizeSlot, fixedParams, shapeOf, slotMetrics } from '../../slots';
import type { MachineSpec } from '../../types';
import { analyzeWinding } from '../../winding/analysis';
import { generateLayout } from '../../winding/layout';
import type { RotorMagnetic } from '../electrical';
import { carter, shaftDiameter } from '../main';
import type { InductionRotorResult, MainDimensions, StatorResult } from '../result';

/** Rules for cage slot combinations (Richter, Sawhney): returns human-readable warnings. */
export function slotComboWarnings(Qs: number, Qr: number, p: number): string[] {
  const w: string[] = [];
  const d = Qs - Qr;
  if (Qr === Qs) w.push('Qr = Qs: cogging at standstill (rotor may lock).');
  for (const k of [1, 2, 3, 5]) if (Math.abs(d) === k * p * 2 || Math.abs(d) === k * p) w.push(`Qs − Qr = ${d}: synchronous torque cusps (±${k}p / ±${2 * k}p).`);
  for (const k of [1, 2, p - 1, p + 1, p - 2, p + 2]) if (k > 0 && Math.abs(d) === k) w.push(`Qs − Qr = ${d}: magnetic noise / vibration risk.`);
  if (Qr % (6 * p) === 0) w.push('Qr multiple of 6p: crawling (asynchronous cusps) risk.');
  return [...new Set(w)];
}

/** Pick a rotor slot number close to 0.83·Qs that passes the combination rules. */
export function chooseRotorSlots(Qs: number, poles: number): number {
  const p = poles / 2;
  let best = Qs - 2;
  let bestCost = Infinity;
  for (let Qr = Math.max(8, Math.round(0.55 * Qs)); Qr <= Math.round(1.35 * Qs); Qr++) {
    if (Qr % 2 !== 0 && Qr % poles !== 0) continue;
    const warn = slotComboWarnings(Qs, Qr, p).length;
    const cost = warn * 100 + Math.abs(Qr - 0.83 * Qs) + (Qr > Qs ? 3 : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = Qr;
    }
  }
  return best;
}

export function designInductionRotor(
  spec: MachineSpec,
  main: MainDimensions,
  st: StatorResult,
  kw1: number,
  torque: number,
): { rotor: InductionRotorResult; magnetic: RotorMagnetic } {
  const im = spec.induction;
  const steel = STEELS[spec.steel];
  const { m, p, poles, L, D, airgap: g, f } = main;
  const kfe = spec.stackingFactor;
  const QrAuto = !(im.rotorSlots > 0);
  const wound = im.rotorType === 'wound';
  let Qr = QrAuto ? chooseRotorSlots(st.Q, poles) : Math.round(im.rotorSlots);
  if (wound && QrAuto) {
    const qs = st.Q / (poles * m);
    const qr = Math.max(2, Math.round(qs) - 1);
    Qr = poles * m * qr;
  }
  const Dr = D - 2 * g;
  const slotPitch = (Math.PI * Dr) / Qr;
  const cosphi = spec.targetPowerFactor;
  const metal = wound ? 'copper' : im.barMaterial;
  const rho = resistivity(metal, spec.copperTempC);

  // Currents
  let barCurrent: number;
  let barArea: number;
  let condTarget: number;
  let N2: number | undefined;
  let kw2: number | undefined;
  let rotorLayout;
  let zs2 = 1;
  if (!wound) {
    barCurrent = (2 * m * kw1 * st.Nph * main.Iph * cosphi) / Qr;
    barArea = barCurrent / im.barCurrentDensity;
    condTarget = barArea;
  } else {
    const layout = generateLayout({
      slots: Qr,
      poles,
      phases: m,
      layers: 2,
      coilPitch: Math.max(1, Math.round((Qr / poles) * 0.85)),
      layerDefs: [],
      parallelPaths: 1,
      arrangement: 'radial',
      skewSlots: 0,
      custom: null,
    });
    rotorLayout = layout.matrix;
    kw2 = analyzeWinding(layout.matrix, poles, m, [], { maxOrder: p, fast: true, pitch: null }).kw1;
    const E2ph = im.slipRingVoltage / Math.sqrt(3);
    const N2t = E2ph / (4.44 * f * st.phi1 * kw2);
    zs2 = Math.max(2, 2 * Math.round((2 * m * N2t) / Qr / 2));
    N2 = (Qr * zs2) / (2 * m);
    barCurrent = (kw1 * st.Nph * main.Iph * cosphi) / (kw2 * N2);
    barArea = barCurrent / spec.currentDensity;
    condTarget = (zs2 * barArea) / Math.max(0.1, im.rotorFillFactor);
  }

  // Rotor slot & teeth
  const toothWidth = (st.BgPeak * slotPitch) / (kfe * spec.BtoothMax);
  const shape = shapeOf(im.rotorSlot.shape);
  const ctx = { R: (Dr / 2) * 1000, Q: Qr, side: 'rotor' as const, toothWidth: toothWidth * 1000, fixed: fixedParams(im.rotorSlot) };
  let params = { ...im.rotorSlot.params };
  let limited = false;
  if (im.rotorSlot.autoSize) {
    const r = autoSizeSlot(shape, ctx, condTarget);
    params = r.params;
    limited = r.limited;
  }
  const metrics = slotMetrics(shape, params, (Dr / 2) * 1000, Qr, 'rotor');
  const depth = metrics.depth / 1000;
  const Btooth = (st.BgPeak * slotPitch) / (kfe * Math.max(1e-5, metrics.toothMin / 1000));
  const BtoothMean = (st.BgPeak * slotPitch) / (kfe * Math.max(1e-5, metrics.toothMean / 1000));
  const kCr = carter(slotPitch, metrics.opening / 1000, g);
  const condArea = wound ? (metrics.conductorArea * im.rotorFillFactor) / zs2 : metrics.conductorArea;

  // Yoke & shaft
  const yokeReq = st.phi / (2 * kfe * L * spec.BrotorYokeMax);
  const shaftMin = shaftDiameter(torque);
  const DiMax = Dr - 2 * (depth + yokeReq);
  const Di = Math.max(shaftMin, DiMax);
  const yoke = (Dr - 2 * depth - Di) / 2;
  const Byoke = st.phi / (2 * kfe * L * Math.max(1e-4, yoke));

  // Rings and parameters referred to the stator
  const sinA = Math.sin((Math.PI * p) / Qr);
  let ringCurrent = 0;
  let ringArea = 0;
  let ringHeight = 0;
  let ringWidth = 0;
  let ringMeanD = Dr - depth;
  let R2: number;
  let L2: number;
  let conductorMass: number;
  const lamR = metrics.permeance;
  const ratioSq = (4 * m * (kw1 * st.Nph) ** 2) / Qr;
  if (!wound) {
    ringCurrent = barCurrent / (2 * sinA);
    ringArea = ringCurrent / im.ringCurrentDensity;
    ringHeight = Math.max(depth * 1.1, 0.004);
    ringWidth = (ringArea * 1e-6) / ringHeight;
    ringMeanD = Dr - ringHeight;
    const skewArc = (spec.winding.skewSlots * Math.PI * Dr) / Qr;
    const lBar = Math.hypot(L, skewArc) + 0.01;
    const Rb = (rho * lBar) / (condArea * 1e-6);
    const ReSeg = (rho * Math.PI * ringMeanD) / (Qr * ringArea * 1e-6);
    const Rbe = Rb + ReSeg / (2 * sinA * sinA);
    R2 = ratioSq * Rbe;
    const ringEquivLen = (0.25 * ((Math.PI * ringMeanD) / Qr)) / (2 * sinA * sinA);
    L2 = ratioSq * MU0 * (L * lamR + ringEquivLen);
    const dens = CONDUCTORS[metal].density;
    conductorMass = (Qr * condArea * 1e-6 * lBar + 2 * ringArea * 1e-6 * Math.PI * ringMeanD) * dens;
  } else {
    const k = (kw1 * st.Nph) / ((kw2 ?? 1) * (N2 ?? 1));
    const span = Qr / poles;
    const lmt2 = 2 * (L + (Math.PI * span * ((Math.PI * (Dr - depth)) / Qr)) / 2 + 0.03);
    const R2own = (rho * (N2 ?? 1) * lmt2) / (condArea * 1e-6);
    R2 = R2own * k * k;
    const L2own = ((4 * m) / Qr) * MU0 * L * (N2 ?? 1) ** 2 * lamR * 1.3;
    L2 = L2own * k * k;
    conductorMass = m * (N2 ?? 1) * lmt2 * condArea * 1e-6 * CONDUCTORS.copper.density;
  }

  const teethMass = ((Math.PI / 4) * (Dr * Dr - (Dr - 2 * depth) ** 2) - (Qr * metrics.outlineArea) / 1e6) * L * kfe * steel.density;
  const yokeMass = (Math.PI / 4) * ((Dr - 2 * depth) ** 2 - Di * Di) * L * kfe * steel.density;

  const rotor: InductionRotorResult = {
    kind: 'induction',
    rotorType: im.rotorType,
    Qr,
    QrAuto,
    comboWarnings: wound ? [] : slotComboWarnings(st.Q, Qr, p),
    Dr,
    Di,
    shaftMin,
    barCurrent,
    barArea,
    ringCurrent,
    ringArea,
    ringHeight,
    ringWidth,
    ringMeanD,
    slot: { shape: shape.id, params, metrics, targetArea: condTarget, limited },
    toothWidth,
    Btooth,
    yoke,
    Byoke,
    carter: kCr,
    R2,
    L2,
    conductorMass,
    teethMass,
    yokeMass,
    N2,
    kw2,
    rotorLayout,
  };
  const magnetic: RotorMagnetic = {
    carter: kCr,
    toothDepth: depth,
    toothB: BtoothMean,
    yokeB: Byoke,
    yokeLen: (Math.PI * (Dr - 2 * depth - yoke)) / poles,
    extraGap: 0,
    dAxisFactor: 1,
    qAxisFactor: 1,
  };
  return { rotor, magnetic };
}
