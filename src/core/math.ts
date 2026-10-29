/** Small numeric helpers shared by all engines (no DOM, no React). */

export const MU0 = 4e-7 * Math.PI;
export const TWO_PI = 2 * Math.PI;

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: number, b: number): number {
  return a && b ? Math.abs(a * b) / gcd(a, b) : 0;
}

/** Positive modulo. */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function linspace(a: number, b: number, n: number): number[] {
  if (n < 2) return [a];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

/** sin(x)/x with the removable singularity handled. */
export function sinc(x: number): number {
  return Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x;
}

/**
 * Bisection root finder for a monotonic (or at least sign-changing) function.
 * Returns the bracket end with the smaller |f| if no sign change exists.
 */
export function bisect(f: (x: number) => number, lo: number, hi: number, tol = 1e-9, maxIter = 200): number {
  let flo = f(lo);
  const fhi = f(hi);
  if (flo * fhi > 0) return Math.abs(flo) < Math.abs(fhi) ? lo : hi;
  for (let i = 0; i < maxIter && hi - lo > tol; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (fm === 0) return mid;
    if (fm * flo < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return 0.5 * (lo + hi);
}

/** Linear interpolation in a monotonically increasing table. */
export function interp(x: number, xs: readonly number[], ys: readonly number[]): number {
  if (x <= xs[0]) return ys[0];
  const n = xs.length;
  if (x >= xs[n - 1]) {
    // linear extrapolation using the last segment
    const k = (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]);
    return ys[n - 1] + k * (x - xs[n - 1]);
  }
  let i = 1;
  while (xs[i] < x) i++;
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + t * (ys[i] - ys[i - 1]);
}

/** Simple complex number as a tuple-like object. */
export interface Complex {
  re: number;
  im: number;
}

export const cx = (re: number, im = 0): Complex => ({ re, im });
export const cpolar = (r: number, phi: number): Complex => ({ re: r * Math.cos(phi), im: r * Math.sin(phi) });
export const cadd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const cmul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cdiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
export const cabs = (a: Complex): number => Math.hypot(a.re, a.im);
export const carg = (a: Complex): number => Math.atan2(a.im, a.re);

/** Reduce a fraction n/d; returns [num, den]. */
export function fraction(n: number, d: number): [number, number] {
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}

export function fractionLabel(n: number, d: number): string {
  const [a, b] = fraction(n, d);
  return b === 1 ? `${a}` : `${a}/${b}`;
}

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (degrees: number) => (degrees * Math.PI) / 180;
export const csub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
