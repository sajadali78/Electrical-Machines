import { TWO_PI, gcd } from '../math';
import type { LayerDef, WindingCell } from '../types';
import { slotAngle } from './analysis';
import { baseLayer, defaultLayerDefs, layerTurns } from './layout';
import { phaseAxis } from './phases';

export type LayerObjective = 'thd' | 'sigma' | 'subharmonics' | 'kw1';

/**
 * Harmonic spectrum of the base layer, per mechanical order ν = 1…N. Because every layer of a
 * stack is the base layer shifted by d_l slots with polarity s_l, the spectrum of the whole
 * winding is the base spectrum times the layer factor F_ν = Σ_l s_l·e^(−jν·2π·d_l/Q).
 */
export interface BaseSpectrum {
  Q: number;
  p: number;
  m: number;
  orders: number;
  kw: Float64Array; // base-layer winding factor per order (index ν)
  amp: Float64Array; // base-layer rotating MMF amplitude per order (max of fwd/bwd)
  netPolarity: number; // Σ(+) − Σ(−) coil sides of phase A in the base layer
  balanced: boolean;
  period: number; // slots after which the base layer repeats (Q/t)
  antiperiodic: boolean; // base layer shifted by period/2 is the negated base layer
}

export function baseSpectrum(Q: number, poles: number, m: number, orders: number): BaseSpectrum {
  const p = poles / 2;
  const base: WindingCell[] = baseLayer(Q, poles, m);
  const kw = new Float64Array(orders + 1);
  const amp = new Float64Array(orders + 1);
  const sidesA = base.filter((c) => c.phase === 0 && c.sign !== 0).length || 1;
  const axes = Array.from({ length: m }, (_, j) => phaseAxis(j, m));
  let net = 0;
  for (const c of base) if (c.phase === 0) net += c.sign;
  const phA = { re: 0, im: 0 };
  const phMag: number[] = [];
  for (let nu = 1; nu <= orders; nu++) {
    let fRe = 0;
    let fIm = 0;
    let bRe = 0;
    let bIm = 0;
    for (let j = 0; j < m; j++) {
      let re = 0;
      let im = 0;
      base.forEach((c, k) => {
        if (c.phase !== j || c.sign === 0) return;
        const a = nu * slotAngle(k, Q);
        re += c.sign * Math.cos(a);
        im -= c.sign * Math.sin(a);
      });
      if (j === 0) kw[nu] = Math.hypot(re, im) / sidesA;
      if (nu === p) {
        phMag.push(Math.hypot(re, im));
        if (j === 0) Object.assign(phA, { re, im });
      }
      const ca = Math.cos(axes[j]);
      const sa = Math.sin(axes[j]);
      fRe += re * ca - im * sa;
      fIm += re * sa + im * ca;
      bRe += re * ca + im * sa;
      bIm += im * ca - re * sa;
    }
    amp[nu] = Math.max(Math.hypot(fRe, fIm), Math.hypot(bRe, bIm)) / (2 * Math.PI * nu);
  }
  const t = gcd(Q, p);
  const period = Q / t;
  const same = (shift: number, neg: boolean) =>
    base.every((c, k) => {
      const o = base[(k + shift) % Q];
      return c.sign === 0 ? o.sign === 0 : o.phase === c.phase && o.sign === (neg ? -c.sign : c.sign);
    });
  const antiperiodic = period % 2 === 0 && same(period / 2, true);
  void same(period, false);
  const balanced = phMag.length === m && phMag[0] > 1e-9 && phMag.every((v) => Math.abs(v - phMag[0]) < 1e-6 * phMag[0]) && Q % (m * gcd(Q, p)) === 0;
  return { Q, p, m, orders, kw, amp, netPolarity: net, balanced, period, antiperiodic };
}

const trigCache = new Map<number, { cos: Float64Array; sin: Float64Array }>();
function trig(Q: number) {
  let t = trigCache.get(Q);
  if (!t) {
    t = { cos: new Float64Array(Q), sin: new Float64Array(Q) };
    for (let k = 0; k < Q; k++) {
      t.cos[k] = Math.cos((TWO_PI * k) / Q);
      t.sin[k] = Math.sin((TWO_PI * k) / Q);
    }
    trigCache.set(Q, t);
  }
  return t;
}

export interface StackMetrics {
  kw1: number;
  thd: number;
  sigma: number;
  subharmonics: number; // Σ relative MMF of orders below the working wave
  closable: boolean; // + and − coil sides can be paired into coils
}

/**
 * Canonical form of a layer: shifts by the periodicity are identities, and in anti-periodic
 * windings a shift by half the periodicity only flips the polarity.
 */
export function canonicalLayer(bs: BaseSpectrum, d: LayerDef): string {
  const P = bs.antiperiodic ? bs.period / 2 : bs.period;
  const s = ((Math.round(d.shift) % bs.Q) + bs.Q) % bs.Q;
  const flips = Math.floor(s / P);
  const sign = bs.antiperiodic && flips % 2 === 1 ? -d.sign : d.sign;
  return `${s % P}${sign > 0 ? '+' : '-'}${layerTurns(d) > 1 ? `x${layerTurns(d)}` : ''}`;
}

/** True when two layers coincide electrically: the slot then holds the same coil side twice (unequal turns per layer). */
export function hasDuplicateLayers(bs: BaseSpectrum, defs: LayerDef[]): boolean {
  const keys = defs.map((d) => canonicalLayer(bs, d));
  return new Set(keys).size < keys.length;
}

function hasDuplicateLayersIgnoringTurns(bs: BaseSpectrum, defs: LayerDef[]): boolean {
  const keys = defs.map((d) => canonicalLayer(bs, { shift: d.shift, sign: d.sign }));
  return new Set(keys).size < keys.length;
}

/** Metrics of a layer stack from the base spectrum (no matrix needed). */
export function stackMetrics(bs: BaseSpectrum, defs: LayerDef[]): StackMetrics {
  const L = defs.length;
  const Q = bs.Q;
  const { cos, sin } = trig(Q);
  const shifts = defs.map((d) => ((Math.round(d.shift) % Q) + Q) % Q);
  const wts = defs.map((d) => d.sign * layerTurns(d));
  const units = defs.reduce((s, d) => s + layerTurns(d), 0);
  // e^(−jν·2πd/Q) depends only on (ν·d) mod Q, so a Q-entry table suffices
  const F = (nu: number) => {
    let re = 0;
    let im = 0;
    for (let l = 0; l < L; l++) {
      const k = (nu * shifts[l]) % Q;
      re += wts[l] * cos[k];
      im -= wts[l] * sin[k];
    }
    return Math.hypot(re, im);
  };
  const Fp = F(bs.p);
  const work = bs.amp[bs.p] * Fp;
  let thd2 = 0;
  let sub = 0;
  for (let nu = 1; nu <= bs.orders; nu++) {
    if (nu === bs.p) continue;
    const a = bs.amp[nu] * F(nu);
    thd2 += a * a;
    if (nu < bs.p && work > 0) sub += a / work;
  }
  const netTurns = wts.reduce((s, w) => s + w, 0);
  void L;
  return {
    kw1: (bs.kw[bs.p] * Fp) / units,
    thd: work > 0 ? Math.sqrt(thd2) / work : Infinity,
    sigma: work > 0 ? thd2 / (work * work) : Infinity,
    subharmonics: sub,
    closable: bs.netPolarity === 0 || netTurns === 0,
  };
}

export interface LayerCandidate {
  defs: LayerDef[];
  kw1: number;
  thd: number;
  sigma: number;
  subharmonics: number;
  score: number;
}

const scoreOf = (m: StackMetrics, objective: LayerObjective) =>
  objective === 'kw1' ? -m.kw1 + 0.02 * m.thd : objective === 'sigma' ? m.sigma : objective === 'subharmonics' ? m.subharmonics + 0.1 * m.thd : m.thd;

/**
 * Search the layer stack (shift and polarity of layers 2…L; layer 1 is the reference) for the best
 * objective under a minimum fundamental winding factor. Exhaustive for small spaces, otherwise a
 * multi-start coordinate descent.
 */
export function optimizeLayerStack(
  Q: number,
  poles: number,
  m: number,
  layers: number,
  pitch: number,
  objective: LayerObjective = 'thd',
  minKw1 = 0.85,
  limit = 12,
): LayerCandidate[] {
  const p = poles / 2;
  const L = Math.max(2, Math.min(8, Math.round(layers)));
  const bs = baseSpectrum(Q, poles, m, Math.min(Math.max(3 * Q, 30 * p), 360));
  if (!bs.balanced) return [];
  const found = new Map<string, LayerCandidate>();
  const consider = (defs: LayerDef[]) => {
    // layers that coincide electrically are just one layer with more turns, which the turns option covers
    if (hasDuplicateLayersIgnoringTurns(bs, defs)) return Infinity;
    const met = stackMetrics(bs, defs);
    if (!met.closable || met.kw1 < minKw1 || !Number.isFinite(met.thd)) return Infinity;
    const score = scoreOf(met, objective);
    // canonical key: sorted layers (layer order does not change the winding's harmonics)
    const key = defs.map((d) => canonicalLayer(bs, d)).sort().join(',');
    const prev = found.get(key);
    if (!prev || score < prev.score) found.set(key, { defs: defs.map((d) => ({ ...d })), ...met, score });
    return score;
  };

  // per-layer options: shift, polarity and turns (1 or 2; a double-turn layer is how odd layer
  // counts close for every slot/pole combination)
  const options: LayerDef[] = [];
  for (let d = 0; d < Q; d++) for (const sign of [1, -1] as const) for (const turns of [1, 2]) options.push(turns === 1 ? { shift: d, sign } : { shift: d, sign, turns });
  consider(defaultLayerDefs(L, pitch, Q, poles));
  const space = options.length ** (L - 1);
  if (space <= 40000) {
    const defs: LayerDef[] = [{ shift: 0, sign: 1 }];
    const rec = (l: number) => {
      if (l === L) return void consider(defs);
      for (const o of options) {
        defs[l] = o;
        rec(l + 1);
      }
    };
    rec(1);
  } else {
    // deterministic pseudo-random restarts + coordinate descent
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const starts: LayerDef[][] = [defaultLayerDefs(L, pitch, Q, poles)];
    for (let r = 0; r < 12; r++) starts.push([{ shift: 0, sign: 1 }, ...Array.from({ length: L - 1 }, () => options[Math.floor(rnd() * options.length)])]);
    for (const start of starts) {
      const cur = start.map((d) => ({ ...d }));
      let best = consider(cur);
      for (let sweep = 0; sweep < 6; sweep++) {
        let improved = false;
        for (let l = 1; l < L; l++) {
          const keep = cur[l];
          let bestHere = keep;
          for (const o of options) {
            cur[l] = o;
            const s = consider(cur);
            if (s < best - 1e-12) {
              best = s;
              bestHere = o;
              improved = true;
            }
          }
          cur[l] = bestHere;
        }
        if (!improved) break;
      }
    }
  }
  const list = [...found.values()].sort((a, b) => a.score - b.score || b.kw1 - a.kw1);
  const out: LayerCandidate[] = [];
  for (const c of list) {
    if (out.some((o) => Math.abs(o.score - c.score) < 1e-9 && Math.abs(o.kw1 - c.kw1) < 1e-9)) continue;
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}
