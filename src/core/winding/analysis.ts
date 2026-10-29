import { TWO_PI, cabs, carg, cpolar, fraction, fractionLabel, gcd, lcm, sinc, type Complex } from '../math';
import type { WindingMatrix } from '../types';
import type { Coil } from './layout';
import { phaseAxis } from './phases';

export interface HarmonicRow {
  order: number; // mechanical order ν
  elecOrder: number; // ν / p
  kw: number; // layout winding factor (distribution × pitch)
  kp: number | null; // pitch factor (single-pitch layouts only)
  kd: number | null; // distribution factor (= kw / kp)
  kso: number; // slot-opening factor
  ksk: number; // skew factor
  mmf: number; // rotating MMF amplitude per unit conductor & unit peak current (incl. kso)
  mmfRel: number; // relative to the working harmonic
  direction: 'fwd' | 'bwd' | '-';
}

export interface WindingAnalysisOptions {
  pitch?: number | null; // for the pitch/distribution factor split
  slotOpeningRad?: number; // mechanical angle of the slot opening
  skewSlots?: number;
  maxOrder?: number; // highest mechanical order kept in `harmonics`
  fast?: boolean; // skip the long σδ series (used by optimizers)
}

export interface WindingAnalysis {
  Q: number;
  poles: number;
  p: number;
  m: number;
  layers: number;
  qLabel: string;
  q: number;
  t: number; // gcd(Q, p)
  antiperiodic: boolean;
  slotAngleElecDeg: number;
  coilSidesPerPhase: number[];
  conductors: number[][]; // [phase][slot] net conductors (layer units)
  windingFunction: number[][]; // [phase][slot] value on the tooth after slot k
  mmf: number[]; // total MMF at ωt = 0 on the tooth after slot k (unit current)
  harmonics: HarmonicRow[];
  kw1: number;
  kd1: number | null;
  kp1: number | null;
  ksk1: number;
  kso1: number;
  thdMmf: number; // up to maxOrder
  sigmaDiff: number; // differential (harmonic) leakage coefficient σδ
  balanced: boolean;
  balanceNotes: string[];
  phasePhasors: { mag: number; angleDeg: number }[];
  lcmQ2p: number; // cogging fundamental order
  gcdQ2p: number; // lowest radial force order (1 → unbalanced magnetic pull)
  maxParallelPaths: number;
}

/** Slot centre mechanical angle. */
export const slotAngle = (k: number, Q: number) => (TWO_PI * k) / Q;

function phaseConductors(matrix: WindingMatrix, m: number) {
  const Q = matrix[0].length;
  const cond = Array.from({ length: m }, () => new Array<number>(Q).fill(0));
  const sides = new Array<number>(m).fill(0);
  for (const row of matrix) {
    row.forEach((c, k) => {
      if (c.sign === 0 || c.phase >= m) return;
      const w = c.w ?? 1;
      cond[c.phase][k] += c.sign * w;
      sides[c.phase] += w;
    });
  }
  return { cond, sides };
}

/** Σ_k c_k e^{-jνθ_k} for one phase. */
function spatialSum(cond: readonly number[], nu: number): Complex {
  const Q = cond.length;
  let re = 0;
  let im = 0;
  for (let k = 0; k < Q; k++) {
    const c = cond[k];
    if (!c) continue;
    const a = nu * slotAngle(k, Q);
    re += c * Math.cos(a);
    im -= c * Math.sin(a);
  }
  return { re, im };
}

function maxParallelPaths(coils: Coil[], m: number, Q: number, p: number): number {
  if (!coils.length) return 1;
  let best = 1;
  for (let phase = 0; phase < m; phase++) {
    const pc = coils.filter((c) => c.phase === phase);
    const n = pc.length;
    let phaseBest = 1;
    for (let a = n; a >= 2; a--) {
      if (n % a !== 0 || Q % a !== 0) continue;
      const groups = Array.from({ length: a }, () => ({ n: 0, re: 0, im: 0 }));
      for (const c of pc) {
        const g = Math.floor((c.go.slot * a) / Q);
        const e1 = cpolar(1, -p * slotAngle(c.go.slot, Q));
        const e2 = cpolar(1, -p * slotAngle(c.ret.slot, Q));
        groups[g].n += 1;
        groups[g].re += c.sign * (e1.re - e2.re);
        groups[g].im += c.sign * (e1.im - e2.im);
      }
      const ok = groups.every(
        (gr) => gr.n === n / a && Math.abs(gr.re - groups[0].re) < 1e-6 && Math.abs(gr.im - groups[0].im) < 1e-6,
      );
      if (ok) {
        phaseBest = a;
        break;
      }
    }
    best = phase === 0 ? phaseBest : gcd(best, phaseBest);
  }
  return Math.max(1, best);
}

export function analyzeWinding(
  matrix: WindingMatrix,
  poles: number,
  m: number,
  coils: Coil[] = [],
  opts: WindingAnalysisOptions = {},
): WindingAnalysis {
  const Q = matrix[0]?.length ?? 0;
  const p = poles / 2;
  const t = gcd(Q, p);
  const { cond, sides } = phaseConductors(matrix, m);
  const beta = opts.slotOpeningRad ?? 0;
  const gamma = ((opts.skewSlots ?? 0) * TWO_PI) / Q;
  const pitch = opts.pitch ?? null;
  const maxOrder = Math.max(opts.maxOrder ?? Math.max(3 * Q, 30 * p), p);

  // Winding function: cumulative conductor count, mean removed.
  const windingFunction = cond.map((c) => {
    const n: number[] = [];
    let acc = 0;
    for (let k = 0; k < Q; k++) {
      acc += c[k];
      n.push(acc);
    }
    const mean = n.reduce((s, x) => s + x, 0) / Q;
    return n.map((x) => x - mean);
  });

  const axes = Array.from({ length: m }, (_, j) => phaseAxis(j, m));
  const mmf = new Array<number>(Q).fill(0);
  for (let j = 0; j < m; j++) {
    const ij = Math.cos(axes[j]);
    for (let k = 0; k < Q; k++) mmf[k] += windingFunction[j][k] * ij;
  }

  // Harmonic analysis. σδ needs many orders to converge (∝ 1/ν²).
  const sigmaOrders = opts.fast ? maxOrder : Math.max(maxOrder, 120 * Q, 400 * p);
  const totalSides = sides[0] || 1;
  const harmonics: HarmonicRow[] = [];
  const amp: number[] = new Array(sigmaOrders + 1).fill(0);
  let workAmp = 0;
  for (let nu = 1; nu <= sigmaOrders; nu++) {
    let fRe = 0;
    let fIm = 0;
    let bRe = 0;
    let bIm = 0;
    let cA: Complex = { re: 0, im: 0 };
    for (let j = 0; j < m; j++) {
      const C = spatialSum(cond[j], nu);
      if (j === 0) cA = C;
      // amplitude of M_j harmonic is |C|/(πν); split into forward/backward travelling parts
      const ca = Math.cos(axes[j]);
      const sa = Math.sin(axes[j]);
      fRe += C.re * ca - C.im * sa;
      fIm += C.re * sa + C.im * ca;
      bRe += C.re * ca + C.im * sa;
      bIm += C.im * ca - C.re * sa;
    }
    const scale = 1 / (2 * Math.PI * nu);
    const fwd = Math.hypot(fRe, fIm) * scale;
    const bwd = Math.hypot(bRe, bIm) * scale;
    const a = Math.max(fwd, bwd);
    amp[nu] = a;
    if (nu === p) workAmp = a;
    if (nu <= maxOrder) {
      const kw = cabs(cA) / totalSides;
      const kp = pitch ? Math.abs(Math.sin((nu * pitch * Math.PI) / Q)) : null;
      const kso = sinc((nu * beta) / 2);
      harmonics.push({
        order: nu,
        elecOrder: nu / p,
        kw,
        kp,
        kd: kp && kp > 1e-9 ? Math.min(1, kw / kp) : null,
        kso,
        ksk: Math.abs(sinc((nu * gamma) / 2)),
        mmf: a * Math.abs(kso),
        mmfRel: 0,
        direction: a < 1e-9 ? '-' : fwd >= bwd ? 'fwd' : 'bwd',
      });
    }
  }
  const workRow = harmonics[p - 1];
  for (const h of harmonics) h.mmfRel = workRow && workRow.mmf > 0 ? h.mmf / workRow.mmf : 0;

  let thdSq = 0;
  for (const h of harmonics) if (h.order !== p) thdSq += h.mmf * h.mmf;
  const thdMmf = workRow && workRow.mmf > 0 ? Math.sqrt(thdSq) / workRow.mmf : 0;
  let sig = 0;
  for (let nu = 1; nu <= sigmaOrders; nu++) if (nu !== p) sig += amp[nu] * amp[nu];
  const sigmaDiff = workAmp > 0 ? sig / (workAmp * workAmp) : 0;

  // Balance check on the working-harmonic EMF phasors.
  const phasors = cond.map((c) => spatialSum(c, p));
  const phasePhasors = phasors.map((c) => ({ mag: cabs(c), angleDeg: (carg(c) * 180) / Math.PI }));
  const notes: string[] = [];
  const mag0 = phasePhasors[0]?.mag ?? 0;
  let balanced = mag0 > 1e-9;
  if (!balanced) notes.push('Phase A has no fundamental EMF for this slot/pole combination.');
  for (let j = 1; j < m && balanced; j++) {
    if (Math.abs(phasePhasors[j].mag - mag0) > 1e-6 * Math.max(1, mag0)) {
      balanced = false;
      notes.push(`Phase ${j + 1} EMF magnitude differs from phase 1.`);
      break;
    }
    if (sides[j] !== sides[0]) {
      balanced = false;
      notes.push('Phases have different numbers of coil sides.');
      break;
    }
    const d = carg(phasors[j]) - carg(phasors[0]);
    const err1 = Math.abs(Math.sin((d + axes[j]) / 2));
    const err2 = Math.abs(Math.sin((d - axes[j]) / 2));
    if (Math.min(err1, err2) > 1e-6) {
      balanced = false;
      notes.push(`Phase ${j + 1} is not displaced by the expected angle.`);
    }
  }
  if (balanced && Q % (m * t) !== 0) notes.push(`Q/(m·t) = ${Q}/(${m}·${t}) is not an integer.`);

  const [qn, qd] = fraction(Q, 2 * p * m);
  const kw1 = workRow?.kw ?? 0;
  const halfShift = Q / (2 * t);
  let antiperiodic = false;
  if (Number.isInteger(halfShift)) {
    antiperiodic = matrix.every((row) =>
      row.every((c, k) => {
        const o = row[(k + halfShift) % Q];
        return c.sign === 0 ? o.sign === 0 : o.phase === c.phase && o.sign === -c.sign;
      }),
    );
  }

  return {
    Q,
    poles,
    p,
    m,
    layers: matrix.length,
    qLabel: fractionLabel(qn, qd),
    q: Q / (2 * p * m),
    t,
    antiperiodic,
    slotAngleElecDeg: (360 * p) / Q,
    coilSidesPerPhase: sides,
    conductors: cond,
    windingFunction,
    mmf,
    harmonics,
    kw1,
    kd1: workRow?.kd ?? null,
    kp1: workRow?.kp ?? null,
    ksk1: workRow?.ksk ?? 1,
    kso1: workRow?.kso ?? 1,
    thdMmf,
    sigmaDiff,
    balanced,
    balanceNotes: notes,
    phasePhasors,
    lcmQ2p: lcm(Q, poles),
    gcdQ2p: gcd(Q, poles),
    maxParallelPaths: maxParallelPaths(coils, m, Q, p),
  };
}
