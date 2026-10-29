import { bisect, cabs, carg, cdiv, cmul, cx, cadd, type Complex } from '../math';
import type { CurvePoint, EfficiencyMap, OperatingPoint } from '../sizing/result';
import { ironLoss, linspace, mechLoss, strayLoss, type LossScaling } from './common';

export interface ImCircuit {
  m: number;
  p: number;
  f: number; // rated frequency
  V: number; // rated phase voltage
  R1: number;
  X1: number;
  R2: number;
  X2: number;
  Xm: number;
  boost?: number; // V, low-frequency IR compensation added as (1 − f/fₙ)·boost
}

export interface ImState {
  I1: number;
  I2: number;
  T: number;
  Pag: number;
  Pmech: number;
  pf: number;
  E: number;
  speedRpm: number;
  f: number;
  V: number;
}

/** Steady-state T-equivalent circuit at slip s and frequency f (constant V/f below rated f). */
export function imSolve(c: ImCircuit, s: number, f = c.f): ImState {
  const k = f / c.f;
  const V = Math.min(c.V, c.V * k + (c.boost ?? 0) * Math.max(0, 1 - k));
  const s1 = Math.max(1e-7, s);
  const Z2: Complex = cx(c.R2 / s1, c.X2 * k);
  const Zm: Complex = cx(0, c.Xm * k);
  const Zp = cdiv(cmul(Z2, Zm), cadd(Z2, Zm));
  const Z = cadd(cx(c.R1, c.X1 * k), Zp);
  const I1 = cdiv(cx(V), Z);
  const E = cmul(I1, Zp);
  const I2 = cabs(cdiv(E, Z2));
  const Pag = c.m * I2 * I2 * (c.R2 / s1);
  const ws = (2 * Math.PI * f) / c.p;
  return {
    I1: cabs(I1),
    I2,
    T: Pag / ws,
    Pag,
    Pmech: Pag * (1 - s1),
    pf: Math.cos(carg(Z)),
    E: cabs(E),
    speedRpm: ((60 * f) / c.p) * (1 - s1),
    f,
    V,
  };
}

/** Slip of maximum torque at frequency f (golden-section search on log slip). */
export function slipAtMaxTorque(c: ImCircuit, f = c.f): number {
  let a = Math.log(1e-4);
  let b = Math.log(1);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 80; i++) {
    const x1 = b - g * (b - a);
    const x2 = a + g * (b - a);
    if (imSolve(c, Math.exp(x1), f).T > imSolve(c, Math.exp(x2), f).T) b = x2;
    else a = x1;
  }
  return Math.exp((a + b) / 2);
}

export interface ImLossBreakdown {
  statorCopper: number;
  rotorCopper: number;
  iron: number;
  mech: number;
  stray: number;
}

export function imLosses(c: ImCircuit, st: ImState, ls: LossScaling, Erated: number): ImLossBreakdown {
  const fluxRatio = st.E / (Erated * (st.f / c.f));
  return {
    statorCopper: c.m * st.I1 * st.I1 * c.R1,
    rotorCopper: c.m * st.I2 * st.I2 * c.R2,
    iron: ironLoss(ls, st.f, fluxRatio),
    mech: mechLoss(ls, st.speedRpm),
    stray: strayLoss(ls, st.I1, st.f),
  };
}

/** Rated operating point: slip such that the shaft delivers Pout. */
export function imRatedPoint(c: ImCircuit, Pout: number, ls: LossScaling, Erated: number) {
  const sMax = slipAtMaxTorque(c);
  const shaft = (s: number) => {
    const st = imSolve(c, s);
    const l = imLosses(c, st, ls, Erated);
    return st.Pmech - l.mech - l.stray - Pout;
  };
  const s = bisect(shaft, 1e-6, sMax, 1e-9);
  const st = imSolve(c, s);
  const l = imLosses(c, st, ls, Erated);
  const Pin = Pout + l.statorCopper + l.rotorCopper + l.iron + l.mech + l.stray;
  const op: OperatingPoint = {
    speedRpm: st.speedRpm,
    slip: s,
    torque: Pout / ((2 * Math.PI * st.speedRpm) / 60),
    current: st.I1,
    powerFactor: st.pf,
    efficiency: Pout / Pin,
    Pout,
    voltage: c.V,
  };
  return { op, state: st, losses: l, Pin, feasible: shaft(sMax) >= 0 };
}

export function imLineCurve(c: ImCircuit, ls: LossScaling, Erated: number): CurvePoint[] {
  const pts: CurvePoint[] = [];
  for (const sp of linspace(0, 0.999, 120)) {
    const s = 1 - sp;
    const st = imSolve(c, s);
    const l = imLosses(c, st, ls, Erated);
    const Pout = Math.max(0, st.Pmech - l.mech - l.stray);
    const Pin = c.m * c.V * st.I1 * st.pf + l.iron;
    pts.push({ speedRpm: st.speedRpm, torque: st.T, power: Pout, current: st.I1, efficiency: Pin > 0 ? Pout / Pin : 0, powerFactor: st.pf });
  }
  return pts;
}

/** Find the slip giving torque T at shaft speed n (frequency adapts: f = n·p/60/(1−s)). */
function slipForTorque(c: ImCircuit, nRpm: number, T: number): { s: number; st: ImState } | null {
  const fOf = (s: number) => (nRpm * c.p) / 60 / (1 - s);
  const tOf = (s: number) => imSolve(c, s, Math.max(0.2, fOf(s))).T;
  // torque rises with slip up to breakdown; scan for the bracket
  let sHi = 1e-4;
  let tPrev = tOf(sHi);
  for (let i = 0; i < 60 && tPrev < T; i++) {
    const sN = Math.min(0.9, sHi * 1.25);
    const tN = tOf(sN);
    if (tN < tPrev) return null; // past breakdown
    sHi = sN;
    tPrev = tN;
    if (sHi >= 0.9) break;
  }
  if (tPrev < T) return null;
  const s = bisect((x) => tOf(x) - T, 1e-7, sHi, 1e-10);
  return { s, st: imSolve(c, s, Math.max(0.2, fOf(s))) };
}

/** Inverter-fed capability (rated current) and efficiency map with V/f control and field weakening. */
export function imEnvelopeAndMap(
  c: ImCircuit,
  ls: LossScaling,
  Erated: number,
  Irated: number,
  nRated: number,
  nMax: number,
  withMap: boolean,
): { envelope: CurvePoint[]; map: EfficiencyMap | null } {
  c = { ...c, boost: c.R1 * Irated };
  const speeds = linspace(Math.max(10, nMax * 0.01), nMax, 60);
  const envelope: CurvePoint[] = [];
  const slips = Array.from({ length: 160 }, (_, i) => Math.exp(Math.log(1e-4) + ((Math.log(0.6) - Math.log(1e-4)) * i) / 159));
  for (const n of speeds) {
    let best: { st: ImState; s: number } | null = null;
    for (const s of slips) {
      const f = (n * c.p) / 60 / (1 - s);
      const st = imSolve(c, s, f);
      if (st.I1 > Irated * 1.0001) break;
      if (!best || st.T > best.st.T) best = { st, s };
    }
    if (!best) {
      envelope.push({ speedRpm: n, torque: 0, power: 0, current: 0, efficiency: 0, powerFactor: 0 });
      continue;
    }
    const l = imLosses(c, best.st, ls, Erated);
    const Pout = Math.max(0, best.st.Pmech - l.mech - l.stray);
    const Pin = Pout + l.statorCopper + l.rotorCopper + l.iron + l.mech + l.stray;
    envelope.push({
      speedRpm: n,
      torque: Pout / ((2 * Math.PI * n) / 60),
      power: Pout,
      current: best.st.I1,
      efficiency: Pin > 0 ? Pout / Pin : 0,
      powerFactor: best.st.pf,
    });
  }
  if (!withMap) return { envelope, map: null };
  const Tmax = Math.max(...envelope.map((e) => e.torque));
  const mapSpeeds = linspace(nMax * 0.04, nMax, 28);
  const torques = linspace(Tmax * 0.04, Tmax, 24);
  const eff = torques.map((T) =>
    mapSpeeds.map((n) => {
      const env = interpEnvelope(envelope, n);
      if (T > env * 1.001) return null;
      const r = slipForTorque(c, n, T * 1.0);
      if (!r) return null;
      const l = imLosses(c, r.st, ls, Erated);
      const Pout = T * ((2 * Math.PI * n) / 60);
      const Pin = Pout + l.statorCopper + l.rotorCopper + l.iron + l.mech + l.stray;
      return Pout / Pin;
    }),
  );
  void nRated;
  return { envelope, map: { speeds: mapSpeeds, torques, eff } };
}

export function interpEnvelope(env: CurvePoint[], n: number): number {
  if (!env.length) return 0;
  if (n <= env[0].speedRpm) return env[0].torque;
  for (let i = 1; i < env.length; i++) {
    if (n <= env[i].speedRpm) {
      const t = (n - env[i - 1].speedRpm) / (env[i].speedRpm - env[i - 1].speedRpm);
      return env[i - 1].torque + t * (env[i].torque - env[i - 1].torque);
    }
  }
  return env[env.length - 1].torque;
}
