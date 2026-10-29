import { useState } from 'react';
import { fmtTick, linear, niceDomain, niceTicks, useWidth } from './scales';

export interface ScatterPoint {
  x: number;
  y: number;
  group: number; // series slot index
  label: string;
  detail: [string, string][];
  onClick?: () => void;
}

const M = { l: 60, r: 16, t: 12, b: 40 };

export function Scatter({ points, groups, xLabel, yLabel, height = 320, colors }: { points: ScatterPoint[]; groups: string[]; colors: string[]; xLabel: string; yLabel: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(300, width);
  const H = height;
  if (!points.length) return <div ref={ref} className="empty-note">No points</div>;
  const xd = niceDomain(Math.min(...points.map((p) => p.x)), Math.max(...points.map((p) => p.x)), 5);
  const yd = niceDomain(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)), 5);
  const x = linear(xd[0], xd[1], M.l, W - M.r);
  const y = linear(yd[0], yd[1], H - M.b, M.t);
  const hp = hover !== null ? points[hover] : null;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="legend" style={{ marginBottom: 6 }}>
        {groups.map((g, i) => (
          <span key={g}>
            <i style={{ background: colors[i], borderRadius: 99 }} />
            {g}
          </span>
        ))}
      </div>
      <svg className="chart-svg" width={W} height={H} role="img" aria-label={`${yLabel} versus ${xLabel}`}>
        <g className="grid">
          {niceTicks(yd[0], yd[1], 5).map((t) => (
            <line key={t} x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {niceTicks(yd[0], yd[1], 5).map((t) => (
          <text key={t} className="tick" x={M.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
            {fmtTick(t)}
          </text>
        ))}
        {niceTicks(xd[0], xd[1], 6).map((t) => (
          <text key={t} className="tick" x={x(t)} y={H - M.b + 15} textAnchor="middle">
            {fmtTick(t)}
          </text>
        ))}
        <line className="baseline" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(p.x)}
            cy={y(p.y)}
            r={p.group === 0 ? 6 : 4.5}
            fill={colors[p.group]}
            stroke="var(--surface)"
            strokeWidth={2}
            opacity={hover === null || hover === i ? 1 : 0.6}
            style={{ cursor: p.onClick ? 'pointer' : 'default' }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={p.onClick}
          />
        ))}
        <text className="axis-label" x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">
          {xLabel}
        </text>
        <text className="axis-label" transform={`translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">
          {yLabel}
        </text>
      </svg>
      {hp && (
        <div className="tooltip" style={{ left: Math.min(x(hp.x) + 12, W - 220), top: Math.max(0, y(hp.y) - 90) }}>
          <h5>{hp.label}</h5>
          <dl>
            {hp.detail.map(([k, v]) => (
              <Frag key={k} k={k} v={v} />
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function Frag({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}
