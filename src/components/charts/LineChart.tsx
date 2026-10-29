import { useMemo, useState, type ReactNode } from 'react';
import { fmtTick, linear, niceDomain, niceTicks, useWidth } from './scales';

export interface LineSeries {
  id: string;
  name: string;
  color: string;
  points: [number, number][];
  step?: boolean; // step-after rendering (winding functions)
  dash?: string;
  width?: number;
  area?: boolean;
}

export interface Marker {
  x: number;
  y: number;
  label: string;
  color?: string;
}

interface Props {
  series: LineSeries[];
  xLabel: string;
  yLabel: string;
  height?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  xTicks?: number[];
  markers?: Marker[];
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  legend?: boolean;
  zeroLine?: boolean;
  children?: ReactNode;
  ariaLabel?: string;
}

const M = { l: 56, r: 16, t: 12, b: 40 };

/** Responsive SVG line chart with crosshair tooltip, legend and markers. */
export function LineChart({ series, xLabel, yLabel, height = 280, xDomain, yDomain, xTicks, markers = [], formatX = fmtTick, formatY = fmtTick, legend = true, zeroLine, ariaLabel }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hx, setHx] = useState<number | null>(null);

  const dom = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p[0]));
    const ys = series.flatMap((s) => s.points.map((p) => p[1])).filter(Number.isFinite);
    const xd: [number, number] = xDomain ?? [Math.min(...xs), Math.max(...xs)];
    let yd: [number, number] = yDomain ?? [Math.min(0, ...ys), Math.max(...ys)];
    if (!yDomain) yd = niceDomain(yd[0], yd[1], 5);
    return { xd, yd };
  }, [series, xDomain, yDomain]);

  const W = Math.max(280, width);
  const H = height;
  const x = linear(dom.xd[0], dom.xd[1], M.l, W - M.r);
  const y = linear(dom.yd[0], dom.yd[1], H - M.b, M.t);
  const xt = xTicks ?? niceTicks(dom.xd[0], dom.xd[1], Math.max(3, Math.floor(W / 90)));
  const yt = niceTicks(dom.yd[0], dom.yd[1], 5);

  const pathOf = (s: LineSeries) => {
    const pts = s.points.filter((p) => Number.isFinite(p[1]));
    if (!pts.length) return '';
    let d = `M${x(pts[0][0])} ${y(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) {
      if (s.step) d += `H${x(pts[i][0])}V${y(pts[i][1])}`;
      else d += `L${x(pts[i][0])} ${y(pts[i][1])}`;
    }
    return d;
  };

  const valueAt = (s: LineSeries, xv: number): number | null => {
    const pts = s.points;
    if (!pts.length) return null;
    if (s.step) {
      let v: number | null = null;
      for (const p of pts) if (p[0] <= xv + 1e-9) v = p[1];
      return v;
    }
    let best = pts[0];
    for (const p of pts) if (Math.abs(p[0] - xv) < Math.abs(best[0] - xv)) best = p;
    return best[1];
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {legend && series.length > 1 && (
        <div className="legend" style={{ marginBottom: 6 }}>
          {series.map((s) => (
            <span key={s.id}>
              <i style={{ background: s.color, height: 3, borderRadius: 2, verticalAlign: 3 }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg
        className="chart-svg"
        width={W}
        height={H}
        role="img"
        aria-label={ariaLabel ?? `${yLabel} versus ${xLabel}`}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - r.left;
          if (px < M.l || px > W - M.r) return setHx(null);
          setHx(dom.xd[0] + ((px - M.l) / (W - M.l - M.r)) * (dom.xd[1] - dom.xd[0]));
        }}
        onMouseLeave={() => setHx(null)}
      >
        <g className="grid">
          {yt.map((t) => (
            <line key={t} x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {zeroLine && dom.yd[0] < 0 && <line className="baseline" x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} />}
        <line className="baseline" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
        {yt.map((t) => (
          <text key={t} className="tick" x={M.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
            {formatY(t)}
          </text>
        ))}
        {xt.map((t) => (
          <text key={t} className="tick" x={x(t)} y={H - M.b + 15} textAnchor="middle">
            {formatX(t)}
          </text>
        ))}
        <text className="axis-label" x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">
          {xLabel}
        </text>
        <text className="axis-label" transform={`translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">
          {yLabel}
        </text>
        <g>
          {series.map((s) =>
            s.area ? (
              <path key={`${s.id}-a`} d={`${pathOf(s)}V${y(Math.max(dom.yd[0], 0))}H${x(s.points[0]?.[0] ?? 0)}Z`} fill={s.color} opacity={0.12} />
            ) : null,
          )}
          {series.map((s) => (
            <path key={s.id} d={pathOf(s)} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} strokeLinejoin="round" />
          ))}
        </g>
        {markers.map((m, i) => (
          <g key={i}>
            <circle cx={x(m.x)} cy={y(m.y)} r={5} fill={m.color ?? 'var(--ink)'} stroke="var(--surface)" strokeWidth={2} />
            <text x={x(m.x) + 8} y={y(m.y) - 8} fontSize={11} fill="var(--ink-2)" fontWeight={600}>
              {m.label}
            </text>
          </g>
        ))}
        {hx !== null && (
          <g pointerEvents="none">
            <line x1={x(hx)} x2={x(hx)} y1={M.t} y2={H - M.b} stroke="var(--ink-3)" strokeDasharray="3 3" />
            {series.map((s) => {
              const v = valueAt(s, hx);
              return v === null ? null : <circle key={s.id} cx={x(hx)} cy={y(v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />;
            })}
          </g>
        )}
      </svg>
      {hx !== null && (
        <div className="tooltip" style={{ left: Math.min(x(hx) + 12, W - 200), top: 8 }}>
          <h5>
            {xLabel.split('[')[0].trim()}: {formatX(hx)}
          </h5>
          <dl>
            {series.map((s) => {
              const v = valueAt(s, hx);
              return (
                <Row key={s.id} k={s.name} v={v === null ? '—' : formatY(v)} color={s.color} />
              );
            })}
          </dl>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, color }: { k: string; v: string; color: string }) {
  return (
    <>
      <dt>
        <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 5 }} />
        {k}
      </dt>
      <dd>{v}</dd>
    </>
  );
}
