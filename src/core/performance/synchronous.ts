import type { CurvePoint, EfficiencyMap, OperatingPoint } from '../sizing/result';
import { ironLoss, linspace, mechLoss, strayLoss, type LossScaling } from './common';

/** dq model of a synchronous machine (PM or wound field), amplitude-invariant peak quantities. */
export interface DqModel {
  m: number;
  p: number;
  R: number;
  Ld: number;
  Lq: number;
  psiRated: number; // PM or rated field flux linkage [Wb peak]
  psiVariable: boolean; // wound field: flux adjustable 0..psiRated (×1.1 overexcitation)
  Imax: number; // peak current limit
  Vmax: number; // peak phase voltage limit
  fieldLossRated: number; // W at psiRated (wound field)
}

interface DqPoint {
  id: number;
  iq: number;
  psi: number;
  T: number;
  v: number;
  pf: number;
}

export function dqTorque(mdl: DqModel, id: number, iq: number, psi: number) {
  return (mdl.m / 2) * mdl.p * (psi * iq + (mdl.Ld - mdl.Lq) * id * iq);
}

export function dqVoltage(mdl: DqModel, id: number, iq: number, psi: number, we: number) {
  const vd = mdl.R * id - we * mdl.Lq * iq;
  const vq = mdl.R * iq + we * (mdl.Ld * id + psi);
  const v = Math.hypot(vd, vq);
  const phi = Math.atan2(vq, vd) - Math.atan2(iq, id);
  return { v, pf: Math.abs(Math.cos(phi)) };
}

const BETAS = linspace(0, (88 * Math.PI) / 180, 89);

function psiLevels(mdl: DqModel) {
  return mdl.psiVariable ? linspace(0.1 * mdl.psiRated, 1.1 * mdl.psiRated, 11) : [mdl.psiRated];
}

/** Minimum-current solution delivering torque T at electrical speed we within the voltage limit. */
export function dqMinCurrent(mdl: DqModel, T: number, we: number, vLimit = mdl.Vmax): DqPoint | null {
  const k = (mdl.m / 2) * mdl.p;
  let best: DqPoint | null = null;
  let bestI = Infinity;
  for (const psi of psiLevels(mdl)) {
    for (const b of BETAS) {
      // T/k = psi·i·cosβ + (Lq−Ld)·i²·sinβ·cosβ
      const a = (mdl.Lq - mdl.Ld) * Math.sin(b) * Math.cos(b);
      const bb = psi * Math.cos(b);
      const c = -T / k;
      let i: number;
      if (Math.abs(a) < 1e-15) i = bb > 0 ? -c / bb : Infinity;
      else {
        const disc = bb * bb - 4 * a * c;
        if (disc < 0) continue;
        i = (-bb + Math.sqrt(disc)) / (2 * a);
        if (i < 0) continue;
      }
      if (!Number.isFinite(i) || i > mdl.Imax * 1.0001) continue;
      const id = -i * Math.sin(b);
      const iq = i * Math.cos(b);
      const { v, pf } = dqVoltage(mdl, id, iq, psi, we);
      if (v > vLimit * 1.0001) continue;
      // wound field: weigh field loss so the search prefers efficient excitation
      const cost = i + (mdl.psiVariable ? 0.15 * mdl.Imax * (psi / mdl.psiRated) ** 2 : 0);
      if (cost < bestI) {
        bestI = cost;
        best = { id, iq, psi, T, v, pf };
      }
    }
  }
  return best;
}

/** Maximum torque at electrical speed we (current and voltage limits). */
export function dqMaxTorque(mdl: DqModel, we: number): DqPoint | null {
  let best: DqPoint | null = null;
  for (const psi of psiLevels(mdl)) {
    for (const frac of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]) {
      const i = frac * mdl.Imax;
      for (const b of BETAS) {
        const id = -i * Math.sin(b);
        const iq = i * Math.cos(b);
        const { v, pf } = dqVoltage(mdl, id, iq, psi, we);
        if (v > mdl.Vmax * 1.0001) continue;
        const T = dqTorque(mdl, id, iq, psi);
        if (!best || T > best.T) best = { id, iq, psi, T, v, pf };
      }
    }
  }
  return best;
}

export interface DqLosses {
  copper: number;
  iron: number;
  mech: number;
  stray: number;
  field: number;
}

export function dqLosses(mdl: DqModel, pt: DqPoint, we: number, ls: LossScaling, psiAirRated: number): DqLosses {
  const i = Math.hypot(pt.id, pt.iq);
  const f = we / (2 * Math.PI);
  const n = (60 * f) / mdl.p;
  const psiAir = Math.hypot(mdl.Ld * pt.id + pt.psi, mdl.Lq * pt.iq);
  return {
    copper: (mdl.m / 2) * mdl.R * i * i,
    iron: ironLoss(ls, f, psiAir / psiAirRated),
    mech: mechLoss(ls, n),
    stray: strayLoss(ls, i / Math.SQRT2, f),
    field: mdl.psiVariable ? mdl.fieldLossRated * (pt.psi / mdl.psiRated) ** 2 : 0,
  };
}

const sumLosses = (l: DqLosses) => l.copper + l.iron + l.mech + l.stray + l.field;

export function dqRatedPoint(mdl: DqModel, Pout: number, nRpm: number, ls: LossScaling, psiAirRated: number) {
  const we = (2 * Math.PI * nRpm * mdl.p) / 60;
  const wm = (2 * Math.PI * nRpm) / 60;
  // electromagnetic torque must also cover mechanical and stray losses (iterate twice)
  let Te = Pout / wm;
  let pt: DqPoint | null = null;
  let feasible = true;
  for (let it = 0; it < 3; it++) {
    pt = dqMinCurrent(mdl, Te, we, mdl.Vmax) ?? dqMinCurrent(mdl, Te, we, Infinity);
    if (!pt) break;
    const l = dqLosses(mdl, pt, we, ls, psiAirRated);
    Te = (Pout + l.mech + l.stray) / wm;
  }
  if (!pt) {
    feasible = false;
    const k = (mdl.m / 2) * mdl.p;
    pt = { id: 0, iq: Te / (k * mdl.psiRated), psi: mdl.psiRated, T: Te, v: 0, pf: 1 };
    const vv = dqVoltage(mdl, 0, pt.iq, mdl.psiRated, we);
    pt.v = vv.v;
    pt.pf = vv.pf;
  }
  if (pt.v > mdl.Vmax * 1.0001 || Math.hypot(pt.id, pt.iq) > mdl.Imax * 1.0001) feasible = false;
  const l = dqLosses(mdl, pt, we, ls, psiAirRated);
  const Pin = Pout + sumLosses(l);
  const op: OperatingPoint = {
    speedRpm: nRpm,
    slip: null,
    torque: Pout / wm,
    current: Math.hypot(pt.id, pt.iq) / Math.SQRT2,
    powerFactor: pt.pf,
    efficiency: Pout / Pin,
    Pout,
    voltage: pt.v / Math.SQRT2,
    id: pt.id,
    iq: pt.iq,
  };
  return { op, losses: l, Pin, feasible, point: pt };
}

export function dqEnvelopeAndMap(
  mdl: DqModel,
  ls: LossScaling,
  psiAirRated: number,
  nMax: number,
  withMap: boolean,
): { envelope: CurvePoint[]; map: EfficiencyMap | null } {
  const speeds = linspace(Math.max(10, nMax * 0.01), nMax, 60);
  const envelope: CurvePoint[] = speeds.map((n) => {
    const we = (2 * Math.PI * n * mdl.p) / 60;
    const pt = dqMaxTorque(mdl, we);
    if (!pt || pt.T <= 0) return { speedRpm: n, torque: 0, power: 0, current: 0, efficiency: 0, powerFactor: 0 };
    const l = dqLosses(mdl, pt, we, ls, psiAirRated);
    const wm = (2 * Math.PI * n) / 60;
    const Tshaft = Math.max(0, pt.T - (l.mech + l.stray) / wm);
    const Pout = Tshaft * wm;
    return {
      speedRpm: n,
      torque: Tshaft,
      power: Pout,
      current: Math.hypot(pt.id, pt.iq) / Math.SQRT2,
      efficiency: Pout / (Pout + sumLosses(l)),
      powerFactor: pt.pf,
    };
  });
  if (!withMap) return { envelope, map: null };
  const Tmax = Math.max(...envelope.map((e) => e.torque));
  const mapSpeeds = linspace(nMax * 0.04, nMax, 28);
  const torques = linspace(Tmax * 0.04, Tmax, 24);
  const eff = torques.map((T) =>
    mapSpeeds.map((n) => {
      const we = (2 * Math.PI * n * mdl.p) / 60;
      const wm = (2 * Math.PI * n) / 60;
      const pt = dqMinCurrent(mdl, T, we);
      if (!pt) return null;
      const l = dqLosses(mdl, pt, we, ls, psiAirRated);
      const Pout = (T - (l.mech + l.stray) / wm) * wm;
      if (Pout <= 0) return null;
      return Pout / (Pout + sumLosses(l));
    }),
  );
  return { envelope, map: { speeds: mapSpeeds, torques, eff } };
}

/** Torque vs load angle at fixed V and f (cylindrical + reluctance terms, R neglected). */
export function loadAngleCurve(m: number, wm: number, V: number, E0: number, Xd: number, Xq: number) {
  return linspace(0, 180, 91).map((deltaDeg) => {
    const d = (deltaDeg * Math.PI) / 180;
    const T = (m / wm) * ((V * E0 * Math.sin(d)) / Xd + ((V * V) / 2) * (1 / Xq - 1 / Xd) * Math.sin(2 * d));
    return { deltaDeg, torque: T };
  });
}
