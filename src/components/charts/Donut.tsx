import { useState } from 'react';
import { seriesColor } from './scales';

export interface Slice {
  label: string;
  value: number;
}

/** Part-to-whole donut with a legend table (values + shares); 2px surface gaps between slices. */
export function Donut({ slices, unit, size = 200, centerLabel }: { slices: Slice[]; unit: string; size?: number; centerLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  const R = size / 2;
  const r = R * 0.62;
  let a = -Math.PI / 2;
  const arcs = slices.map((s, i) => {
    const frac = Math.max(0, s.value) / total;
    const a0 = a;
    const a1 = a + frac * 2 * Math.PI;
    a = a1;
    if (frac <= 0) return null;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, ang: number) => `${R + rad * Math.cos(ang)} ${R + rad * Math.sin(ang)}`;
    const d = frac >= 0.9999 ? `M${p(R, 0)}A${R} ${R} 0 1 1 ${p(R, Math.PI)}A${R} ${R} 0 1 1 ${p(R, 0)}M${p(r, 0)}A${r} ${r} 0 1 0 ${p(r, Math.PI)}A${r} ${r} 0 1 0 ${p(r, 0)}Z` : `M${p(R, a0)}A${R} ${R} 0 ${large} 1 ${p(R, a1)}L${p(r, a1)}A${r} ${r} 0 ${large} 0 ${p(r, a0)}Z`;
    return <path key={i} d={d} fill={seriesColor(i)} stroke="var(--surface)" strokeWidth={2} opacity={hover === null || hover === i ? 1 : 0.45} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
  });
  const hs = hover !== null ? slices[hover] : null;
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} role="img" aria-label="Loss breakdown donut">
        {arcs}
        <text x={R} y={R - 4} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
          {hs ? hs.label : centerLabel ?? 'Total'}
        </text>
        <text x={R} y={R + 14} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--ink)">
          {(hs ? hs.value : total).toFixed(0)} {unit}
        </text>
      </svg>
      <table className="data" style={{ width: 'auto', minWidth: 220 }}>
        <tbody>
          {slices.map((s, i) => (
            <tr key={s.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? 'hl' : ''}>
              <td>
                <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: seriesColor(i), marginRight: 6 }} />
                {s.label}
              </td>
              <td className="num">
                {s.value.toFixed(0)} {unit}
              </td>
              <td className="num">{((Math.max(0, s.value) / total) * 100).toFixed(1)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
