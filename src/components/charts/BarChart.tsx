import { useState } from 'react';
import { fmtTick, linear, niceDomain, niceTicks, useWidth } from './scales';

export interface Bar {
  x: number; // category value (e.g. harmonic order)
  y: number;
  color?: string;
  label?: string; // tooltip title
  detail?: [string, string][];
  emphasis?: boolean;
}

interface Props {
  bars: Bar[];
  xLabel: string;
  yLabel: string;
  height?: number;
  formatY?: (v: number) => string;
  formatX?: (v: number) => string;
  yMax?: number;
  ariaLabel?: string;
}

const M = { l: 52, r: 12, t: 12, b: 40 };

/** Thin bar chart over numeric categories with per-bar hover tooltips. */
export function BarChart({ bars, xLabel, yLabel, height = 240, formatY = fmtTick, formatX = (v) => `${+v.toFixed(2)}`, yMax, ariaLabel }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(280, width);
  const H = height;
  const n = bars.length;
  const yd = niceDomain(0, yMax ?? Math.max(1e-9, ...bars.map((b) => b.y)), 5);
  const y = linear(yd[0], yd[1], H - M.b, M.t);
  const band = (W - M.l - M.r) / Math.max(1, n);
  const bw = Math.max(1.5, Math.min(18, band * 0.62));
  const yt = niceTicks(yd[0], yd[1], 5);
  const every = Math.max(1, Math.ceil(n / Math.max(4, Math.floor((W - M.l) / 34))));
  const hb = hover !== null ? bars[hover] : null;
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg className="chart-svg" width={W} height={H} role="img" aria-label={ariaLabel ?? `${yLabel} by ${xLabel}`} onMouseLeave={() => setHover(null)}>
        <g className="grid">
          {yt.map((t) => (
            <line key={t} x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {yt.map((t) => (
          <text key={t} className="tick" x={M.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
            {formatY(t)}
          </text>
        ))}
        {bars.map((b, i) => {
          const cx = M.l + band * (i + 0.5);
          const h = Math.max(0, y(0) - y(b.y));
          const r = Math.min(4, bw / 2, h);
          const x0 = cx - bw / 2;
          const top = y(b.y);
          const d = h <= 0 ? '' : `M${x0} ${y(0)}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x0 + bw - r}Q${x0 + bw} ${top} ${x0 + bw} ${top + r}V${y(0)}Z`;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={cx - band / 2} y={M.t} width={band} height={H - M.b - M.t} fill="transparent" />
              {d && <path d={d} fill={b.color ?? 'var(--accent)'} opacity={hover === null || hover === i ? 1 : 0.55} stroke={b.emphasis ? 'var(--ink)' : 'none'} strokeWidth={b.emphasis ? 1.2 : 0} />}
              {i % every === 0 && (
                <text className="tick" x={cx} y={H - M.b + 15} textAnchor="middle">
                  {formatX(b.x)}
                </text>
              )}
            </g>
          );
        })}
        <line className="baseline" x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} />
        <text className="axis-label" x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">
          {xLabel}
        </text>
        <text className="axis-label" transform={`translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">
          {yLabel}
        </text>
      </svg>
      {hb && hover !== null && (
        <div className="tooltip" style={{ left: Math.min(M.l + band * (hover + 0.5) + 10, W - 210), top: 6 }}>
          <h5>{hb.label ?? formatX(hb.x)}</h5>
          <dl>
            <dt>{yLabel.split('[')[0].trim()}</dt>
            <dd>{formatY(hb.y)}</dd>
            {hb.detail?.map(([k, v]) => (
              <FragRow key={k} k={k} v={v} />
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function FragRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}
