import { MAGNET, STEELS } from '../../materials';
import { bisect } from '../../math';
import type { MachineSpec } from '../../types';
import type { RotorMagnetic } from '../electrical';
import { shaftDiameter } from '../main';
import type { MainDimensions, PmRotorResult, StatorResult } from '../result';
import type { FluxInputs } from '../stator';

const K_LEAK_SPM = 0.95;
const K_LEAK_IPM = 0.9;
const B_SAT_BRIDGE = 2.0;

/** Geometry of one V (or bar) magnet pole, in pole-local coordinates (x radial, y tangential), metres. */
export interface IpmPoleGeometry {
  feasible: boolean;
  apexX: number;
  magnets: [number, number][][]; // rectangles (4 corners each)
  innerRadius: number; // smallest radius of any magnet corner
}

export function ipmPoleGeometry(
  layout: 'v' | 'bar',
  Rr: number,
  hm: number,
  wm: number,
  vAngle: number,
  bridge: number,
  rMin: number,
  poles: number,
): IpmPoleGeometry {
  const halfPitch = Math.PI / poles;
  const build = (xa: number): [number, number][][] => {
    if (layout === 'bar') {
      return [
        [
          [xa, -wm / 2],
          [xa, wm / 2],
          [xa - hm, wm / 2],
          [xa - hm, -wm / 2],
        ],
      ];
    }
    const c = Math.cos(vAngle / 2);
    const s = Math.sin(vAngle / 2);
    const rect = (sgn: 1 | -1): [number, number][] => {
      const S: [number, number] = [xa, sgn * bridge * 0.5];
      const d: [number, number] = [c, sgn * s];
      const n: [number, number] = [s, -sgn * c]; // towards the inside of the V
      return [
        S,
        [S[0] + wm * d[0], S[1] + wm * d[1]],
        [S[0] + wm * d[0] - hm * n[0], S[1] + wm * d[1] - hm * n[1]],
        [S[0] - hm * n[0], S[1] - hm * n[1]],
      ];
    };
    return [rect(1), rect(-1)];
  };
  const outerOK = (xa: number) => {
    const mags = build(xa);
    let rMax = 0;
    let angMax = 0;
    for (const r of mags)
      for (const [x, y] of r) {
        rMax = Math.max(rMax, Math.hypot(x, y));
        angMax = Math.max(angMax, Math.abs(Math.atan2(y, x)) + bridge / Math.max(1e-6, Math.hypot(x, y)));
      }
    return { rMax, angMax };
  };
  const xa = bisect((x) => outerOK(x).rMax - (Rr - bridge), rMin, Rr, 1e-7);
  const mags = build(xa);
  let innerRadius = Infinity;
  for (const r of mags) for (const [x, y] of r) innerRadius = Math.min(innerRadius, Math.hypot(x, y));
  const { rMax, angMax } = outerOK(xa);
  const feasible = rMax <= Rr - bridge + 1e-6 && angMax <= halfPitch && innerRadius >= rMin - 1e-6;
  return { feasible, apexX: xa, magnets: mags, innerRadius };
}

export interface PmMagnetics {
  flux: FluxInputs;
  hm: number;
  hmAuto: boolean;
  wm: number;
  Bg: number;
  B1: number;
  Bm: number;
  geometryLimited: boolean;
  rMin: number;
  shaftMin: number;
  geometry: IpmPoleGeometry | null;
}

/** Magnet sizing before the stator is designed (sets the air-gap flux density). */
export function pmMagnetics(spec: MachineSpec, main: MainDimensions, kCest: number, torque: number): PmMagnetics {
  const pm = spec.pm;
  const { D, airgap: g, poles, tau, L } = main;
  const Br = pm.remanence;
  const mur = pm.relPermeability;
  const alpha = Math.min(0.98, Math.max(0.3, pm.poleArcRatio));
  const hmAuto = !(pm.magnetThicknessMm > 0);
  const BgTarget = spec.Bav / alpha;
  const shaftMin = shaftDiameter(torque);
  const kfe = spec.stackingFactor;
  const phiEst = spec.Bav * tau * L;
  const yokeR = phiEst / (2 * kfe * L * spec.BrotorYokeMax);
  const rMin = shaftMin / 2 + yokeR;

  if (spec.topology === 'pmsm_spm') {
    const sleeve = pm.sleeveMm / 1000;
    const gm = kCest * (g + sleeve);
    let hm: number;
    let Bg: number;
    let limited = false;
    if (hmAuto) {
      const denom = K_LEAK_SPM * Br - BgTarget;
      if (denom <= 0.02) {
        hm = 20 * gm * mur;
        limited = true;
      } else hm = (mur * gm * BgTarget) / denom;
      hm = Math.max(1e-3, hm);
    } else hm = pm.magnetThicknessMm / 1000;
    Bg = (K_LEAK_SPM * Br * (hm / mur)) / (hm / mur + gm);
    const B1 = (4 / Math.PI) * Bg * Math.sin((alpha * Math.PI) / 2);
    const BavAct = alpha * Bg;
    const wm = (alpha * Math.PI * (D - 2 * g - 2 * sleeve - hm)) / poles;
    return {
      flux: {
        Bav: BavAct,
        phi1Factor: ((8 / (Math.PI * Math.PI)) * Math.sin((alpha * Math.PI) / 2)) / alpha,
        BgPeak: Bg,
        emfFactor: pm.emfRatio,
        fluxFixed: true,
        magneticGapExtra: sleeve + hm / mur,
      },
      hm,
      hmAuto,
      wm,
      Bg,
      B1,
      Bm: Bg / K_LEAK_SPM,
      geometryLimited: limited,
      rMin,
      shaftMin,
      geometry: null,
    };
  }

  // IPM: flux concentration with V or bar magnets, magnet width solved for the target Bg.
  const layout = pm.ipmLayout;
  const Rr = D / 2 - g;
  const hm = hmAuto ? Math.max(2.5e-3, 6 * g) : pm.magnetThicknessMm / 1000;
  const bridge = pm.bridgeMm / 1000;
  const vAngle = (Math.min(178, Math.max(40, pm.vAngleDeg)) * Math.PI) / 180;
  const nMag = layout === 'v' ? 2 : 1;
  const Ag = alpha * ((Math.PI * 2 * Rr) / poles); // per unit length
  const nBridges = layout === 'v' ? 2 : 1;
  const BgOf = (wm: number) => {
    const Am = nMag * wm;
    const leak = B_SAT_BRIDGE * bridge * nBridges;
    return Math.max(0, (K_LEAK_IPM * Br * Am - leak) / Ag) / (1 + mur * (Am / Ag) * ((kCest * g) / hm));
  };
  const feasibleW = (wm: number) => ipmPoleGeometry(layout, Rr, hm, wm, vAngle, bridge, rMin, poles).feasible;
  let wMax = 1e-3;
  for (let w = 1e-3; w < Rr; w += 0.5e-3) {
    if (!feasibleW(w)) break;
    wMax = w;
  }
  let wm = bisect((w) => BgOf(w) - BgTarget, 1e-3, wMax, 1e-6);
  let limited = BgOf(wm) < 0.97 * BgTarget;
  if (wm > wMax) {
    wm = wMax;
    limited = true;
  }
  const Bg = BgOf(wm);
  const B1 = (4 / Math.PI) * Bg * Math.sin((alpha * Math.PI) / 2);
  const geometry = ipmPoleGeometry(layout, Rr, hm, wm, vAngle, bridge, rMin, poles);
  const Am = nMag * wm;
  return {
    flux: {
      Bav: alpha * Bg,
      phi1Factor: ((8 / (Math.PI * Math.PI)) * Math.sin((alpha * Math.PI) / 2)) / alpha,
      BgPeak: Bg,
      emfFactor: pm.emfRatio,
      fluxFixed: true,
      magneticGapExtra: 0,
    },
    hm,
    hmAuto,
    wm,
    Bg,
    B1,
    Bm: (Bg * Ag + B_SAT_BRIDGE * bridge * nBridges) / Am,
    geometryLimited: limited || !geometry.feasible,
    rMin,
    shaftMin,
    geometry,
  };
}

export function designPmRotor(
  spec: MachineSpec,
  main: MainDimensions,
  st: StatorResult,
  mag: PmMagnetics,
): { rotor: PmRotorResult; magnetic: RotorMagnetic } {
  const pm = spec.pm;
  const steel = STEELS[spec.steel];
  const { D, airgap: g, L, poles, f } = main;
  const kfe = spec.stackingFactor;
  const Dr = D - 2 * g;
  const spm = spec.topology === 'pmsm_spm';
  const sleeve = spm ? pm.sleeveMm / 1000 : 0;
  const alpha = pm.poleArcRatio;
  const yokeReq = st.phi / (2 * kfe * L * spec.BrotorYokeMax);
  let coreOuterR: number;
  let innerIron: number;
  let magnetVolume: number;
  if (spm) {
    coreOuterR = Dr / 2 - sleeve - mag.hm;
    innerIron = coreOuterR;
    magnetVolume = alpha * Math.PI * ((coreOuterR + mag.hm) ** 2 - coreOuterR ** 2) * L;
  } else {
    coreOuterR = Dr / 2;
    innerIron = mag.geometry ? mag.geometry.innerRadius : Dr / 4;
    magnetVolume = poles * (pm.ipmLayout === 'v' ? 2 : 1) * mag.wm * mag.hm * L;
  }
  const Di = Math.max(mag.shaftMin, 2 * (innerIron - yokeReq));
  const yoke = Math.max(1e-4, innerIron - Di / 2);
  const Byoke = st.phi / (2 * kfe * L * yoke);
  const psiM = (Math.sqrt(2) * st.E) / (2 * Math.PI * f);
  const ironMass = Math.max(0, (Math.PI / 4) * ((2 * coreOuterR) ** 2 - Di * Di) * L * kfe - (spm ? 0 : magnetVolume)) * steel.density;
  const vAngle = (pm.vAngleDeg * Math.PI) / 180;
  const layout = spm ? 'spm' : pm.ipmLayout === 'v' ? 'ipm-v' : 'ipm-bar';

  const rotor: PmRotorResult = {
    kind: 'pm',
    layout,
    hm: mag.hm,
    hmAuto: mag.hmAuto,
    wm: mag.wm,
    magnetsPerPole: layout === 'ipm-v' ? 2 : 1,
    poleArc: alpha,
    sleeve,
    Bg: mag.Bg,
    B1: mag.B1,
    Bm: mag.Bm,
    demagMargin: (mag.Bm - 0.1 * pm.remanence) / pm.remanence,
    Dr,
    coreOuterR,
    Di,
    shaftMin: mag.shaftMin,
    apexDepth: mag.geometry ? Dr / 2 - mag.geometry.apexX : 0,
    vAngle,
    bridge: pm.bridgeMm / 1000,
    geometryLimited: mag.geometryLimited,
    yoke,
    Byoke,
    psiM,
    E0: st.E,
    magnetVolume,
    magnetMass: magnetVolume * MAGNET.density,
    ironMass,
  };
  const magnetic: RotorMagnetic = {
    carter: 1,
    toothDepth: 0,
    toothB: 0,
    yokeB: Byoke,
    yokeLen: (Math.PI * (2 * innerIron - yoke)) / poles,
    extraGap: spm ? sleeve + mag.hm / pm.relPermeability : (mag.hm / pm.relPermeability) * (alpha * Math.PI * Dr / poles) / Math.max(1e-4, rotor.magnetsPerPole * mag.wm),
    dAxisFactor: 1,
    qAxisFactor: 1,
    saliency: spm ? undefined : Math.max(1, pm.saliency),
  };
  return { rotor, magnetic };
}
