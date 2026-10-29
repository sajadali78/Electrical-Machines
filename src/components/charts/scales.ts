import { useEffect, useRef, useState } from 'react';

/** "Nice" tick values covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 6): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi === lo) {
    hi = lo + 1;
    lo = lo - 1;
  }
  const span = hi - lo;
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const start = Math.ceil(lo / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

export function niceDomain(lo: number, hi: number, count = 6): [number, number] {
  const t = niceTicks(lo, hi, count);
  if (t.length < 2) return [lo, hi];
  const step = t[1] - t[0];
  return [Math.min(t[0], Math.floor(lo / step) * step), Math.max(t[t.length - 1], Math.ceil(hi / step) * step)];
}

export const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

export function fmtTick(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e4) return `${+(v / 1000).toFixed(1)}k`;
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return (+v.toFixed(1)).toString();
  return (+v.toPrecision(3)).toString();
}

/** Track an element's content width for responsive SVG charts. */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && Math.abs(cw - w) > 1) setW(Math.floor(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, w] as const;
}

/** Categorical slots for chart series (validated order, see docs). */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const seriesColor = (i: number) => `var(--series-${(i % 8) + 1}, ${SERIES[i % 8]})`;

/** Sequential blue ramp (light → dark) for magnitude encodings. */
export const BLUE_RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];

export function rampColor(t: number, ramp = BLUE_RAMP): string {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  if (i >= ramp.length - 1) return ramp[ramp.length - 1];
  const a = hex(ramp[i]);
  const b = hex(ramp[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
