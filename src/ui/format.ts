/** Number formatting helpers for engineering display. */
export function fmt(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Significant-figure formatting (keeps small and large values readable). */
export function sig(x: number | null | undefined, n = 4): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e5 || a < 1e-3) return x.toExponential(n - 1);
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(a)));
  return x.toLocaleString('en-US', { minimumFractionDigits: Math.min(d, 6), maximumFractionDigits: Math.min(d, 6) });
}

export const mm = (m: number, d = 1) => fmt(m * 1000, d);
export const pct = (x: number, d = 1) => fmt(x * 100, d);

export const PHASE_VARS = ['--ph-0', '--ph-1', '--ph-2', '--ph-3', '--ph-4', '--ph-5', '--ph-6', '--ph-7'];
export const phaseColor = (phase: number) => `var(${PHASE_VARS[phase % PHASE_VARS.length]})`;

/** Resolve a CSS custom property to a concrete colour (needed for PDF/canvas export). */
export function cssVar(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}
