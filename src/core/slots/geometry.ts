/**
 * Planar geometry helpers for slot shapes. Slot coordinates are (u, v) in mm:
 * u = depth into the iron measured from the air-gap surface, v = tangential offset from the
 * slot centre line. Shapes are symmetric about v = 0.
 */
export type Pt = [number, number];

export function polygonArea(poly: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [u1, v1] = poly[i];
    const [u2, v2] = poly[(i + 1) % n];
    a += u1 * v2 - u2 * v1;
  }
  return Math.abs(a) / 2;
}

export const totalArea = (polys: readonly Pt[][]) => polys.reduce((s, p) => s + polygonArea(p), 0);

/** Sutherland–Hodgman clip against an axis-aligned half plane. */
export function clipHalfPlane(poly: readonly Pt[], axis: 0 | 1, value: number, keep: 'below' | 'above'): Pt[] {
  const inside = (p: Pt) => (keep === 'below' ? p[axis] <= value : p[axis] >= value);
  const out: Pt[] = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

export function clipBand(poly: readonly Pt[], axis: 0 | 1, lo: number, hi: number): Pt[] {
  return clipHalfPlane(clipHalfPlane(poly, axis, lo, 'above'), axis, hi, 'below');
}

export function bounds(polys: readonly Pt[][]) {
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const p of polys)
    for (const [u, v] of p) {
      uMin = Math.min(uMin, u);
      uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    }
  return { uMin, uMax, vMin, vMax };
}

/** Width (total chord length in v) of the polygons on the line u = const. */
export function widthAt(polys: readonly Pt[][], u: number): number {
  let w = 0;
  for (const poly of polys) {
    const xs: number[] = [];
    for (let i = 0, n = poly.length; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      if ((a[0] <= u && b[0] > u) || (b[0] <= u && a[0] > u)) {
        const t = (u - a[0]) / (b[0] - a[0]);
        xs.push(a[1] + t * (b[1] - a[1]));
      }
    }
    xs.sort((x, y) => x - y);
    for (let i = 0; i + 1 < xs.length; i += 2) w += xs[i + 1] - xs[i];
  }
  return w;
}

/** Points on a circular arc (angles measured in the (u, v) plane from +u towards +v). */
export function arc(cu: number, cv: number, r: number, a0: number, a1: number, n = 14): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]);
  }
  return pts;
}

/**
 * Build a full symmetric outline from its +v half, which must run from the air-gap side to the
 * slot bottom. The result runs down the −v side and back up the +v side.
 */
export function mirrorHalf(half: readonly Pt[]): Pt[] {
  const left = half.map(([u, v]) => [u, -v] as Pt);
  const right = [...half].reverse();
  const out: Pt[] = [...left];
  for (const p of right) {
    const last = out[out.length - 1];
    if (Math.abs(last[0] - p[0]) < 1e-9 && Math.abs(last[1] - p[1]) < 1e-9) continue;
    out.push(p);
  }
  // drop a duplicated closing point
  const f = out[0];
  const l = out[out.length - 1];
  if (out.length > 2 && Math.abs(f[0] - l[0]) < 1e-9 && Math.abs(f[1] - l[1]) < 1e-9) out.pop();
  return out;
}

/** Split a conductor region into `n` equal-area layers, ordered from the air gap outwards (radial) or left to right. */
export function splitEqualArea(poly: readonly Pt[], n: number, arrangement: 'radial' | 'tangential'): Pt[][] {
  return splitByWeights(poly, Array.from({ length: n }, () => 1), arrangement);
}

/** Split a conductor region into layers whose areas are proportional to `weights`. */
export function splitByWeights(poly: readonly Pt[], weights: readonly number[], arrangement: 'radial' | 'tangential'): Pt[][] {
  const n = weights.length;
  if (n <= 1) return [poly.slice()];
  const axis: 0 | 1 = arrangement === 'radial' ? 0 : 1;
  const b = bounds([poly as Pt[]]);
  const lo = axis === 0 ? b.uMin : b.vMin;
  const hi = axis === 0 ? b.uMax : b.vMax;
  const A = polygonArea(poly);
  const W = weights.reduce((s, w) => s + w, 0) || 1;
  const cuts = [lo];
  let acc = 0;
  for (let i = 1; i < n; i++) {
    acc += weights[i - 1];
    const target = (A * acc) / W;
    let a = lo;
    let c = hi;
    for (let it = 0; it < 60; it++) {
      const mid = 0.5 * (a + c);
      if (polygonArea(clipHalfPlane(poly, axis, mid, 'below')) < target) a = mid;
      else c = mid;
    }
    cuts.push(0.5 * (a + c));
  }
  cuts.push(hi);
  return Array.from({ length: n }, (_, i) => clipBand(poly, axis, cuts[i], cuts[i + 1]));
}

export function centroid(poly: readonly Pt[]): Pt {
  let a = 0;
  let cu = 0;
  let cv = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [u1, v1] = poly[i];
    const [u2, v2] = poly[(i + 1) % n];
    const cr = u1 * v2 - u2 * v1;
    a += cr;
    cu += (u1 + u2) * cr;
    cv += (v1 + v2) * cr;
  }
  if (Math.abs(a) < 1e-12) return poly[0] ?? [0, 0];
  return [cu / (3 * a), cv / (3 * a)];
}
