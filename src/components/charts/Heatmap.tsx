import { useState } from 'react';
import type { CurvePoint, EfficiencyMap } from '../../core/sizing/result';
import { fmtTick, linear, niceTicks, rampColor, useWidth } from './scales';

const M = { l: 56, r: 70, t: 12, b: 40 };

/** Efficiency map: sequential (single-hue) cells, iso-efficiency contours, capability envelope. */
export function EfficiencyHeatmap({ map, envelope, rated, height = 340 }: { map: EfficiencyMap; envelope: CurvePoint[]; rated?: { x: number; y: number }; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const W = Math.max(320, width);
  const H = height;
  const { speeds, torques, eff } = map;
  const xd: [number, number] = [0, speeds[speeds.length - 1]];
  const yd: [number, number] = [0, torques[torques.length - 1] * 1.05];
  const x = linear(xd[0], xd[1], M.l, W - M.r);
  const y = linear(yd[0], yd[1], H - M.b, M.t);
  const vals = eff.flat().filter((v): v is number => v !== null);
  const vmax = Math.max(...vals, 0.5);
  // focus the colour range on the useful top of the map; lower values clamp to the lightest step
  const vmin = Math.max(Math.min(...vals), vmax - 0.15);
  const t = (v: number) => (v - vmin) / (vmax - vmin || 1);
  const dx = speeds.length > 1 ? speeds[1] - speeds[0] : 1;
  const dy = torques.length > 1 ? torques[1] - torques[0] : 1;

  // Contours by marching squares on the cell centres.
  const levels = niceTicks(vmin, vmax, 6).filter((l) => l > vmin && l < vmax);
  const segs: { l: number; d: string }[] = [];
  for (const lv of levels) {
    let d = '';
    for (let i = 0; i + 1 < torques.length; i++)
      for (let j = 0; j + 1 < speeds.length; j++) {
        const c = [eff[i][j], eff[i][j + 1], eff[i + 1][j + 1], eff[i + 1][j]];
        if (c.some((v) => v === null)) continue;
        const v = c as number[];
        const P = [
          [speeds[j], torques[i]],
          [speeds[j + 1], torques[i]],
          [speeds[j + 1], torques[i + 1]],
          [speeds[j], torques[i + 1]],
        ];
        const pts: [number, number][] = [];
        for (let e = 0; e < 4; e++) {
          const a = v[e];
          const b = v[(e + 1) % 4];
          if ((a - lv) * (b - lv) < 0) {
            const f = (lv - a) / (b - a);
            const pa = P[e];
            const pb = P[(e + 1) % 4];
            pts.push([pa[0] + f * (pb[0] - pa[0]), pa[1] + f * (pb[1] - pa[1])]);
          }
        }
        if (pts.length >= 2) d += `M${x(pts[0][0])} ${y(pts[0][1])}L${x(pts[1][0])} ${y(pts[1][1])}`;
        if (pts.length === 4) d += `M${x(pts[2][0])} ${y(pts[2][1])}L${x(pts[3][0])} ${y(pts[3][1])}`;
      }
    segs.push({ l: lv, d });
  }
  const env = envelope.length ? `M${envelope.map((p) => `${x(p.speedRpm)} ${y(p.torque)}`).join('L')}` : '';
  const hv = hover ? eff[hover.i][hover.j] : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg className="chart-svg" width={W} height={H} role="img" aria-label="Efficiency map over speed and torque" onMouseLeave={() => setHover(null)}>
        {eff.map((row, i) =>
          row.map((v, j) =>
            v === null ? null : (
              <rect
                key={`${i}-${j}`}
                x={x(speeds[j] - dx / 2)}
                y={y(torques[i] + dy / 2)}
                width={x(dx) - x(0) + 0.6}
                height={y(0) - y(dy) + 0.6}
                fill={rampColor(t(v))}
                onMouseEnter={() => setHover({ i, j })}
              />
            ),
          ),
        )}
        {segs.map((s) => (
          <path key={s.l} d={s.d} stroke="var(--surface)" strokeWidth={1.2} fill="none" opacity={0.9} pointerEvents="none" />
        ))}
        {env && <path d={env} fill="none" stroke="var(--ink)" strokeWidth={2} pointerEvents="none" />}
        {rated && <circle cx={x(rated.x)} cy={y(rated.y)} r={5} fill="var(--copper)" stroke="var(--surface)" strokeWidth={2} />}
        <line className="baseline" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
        {niceTicks(xd[0], xd[1], Math.floor(W / 90)).map((v) => (
          <text key={v} className="tick" x={x(v)} y={H - M.b + 15} textAnchor="middle">
            {fmtTick(v)}
          </text>
        ))}
        {niceTicks(yd[0], yd[1], 5).map((v) => (
          <text key={v} className="tick" x={M.l - 6} y={y(v)} dy="0.32em" textAnchor="end">
            {fmtTick(v)}
          </text>
        ))}
        <text className="axis-label" x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">
          Speed [rpm]
        </text>
        <text className="axis-label" transform={`translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">
          Shaft torque [N·m]
        </text>
        {/* colour bar */}
        {Array.from({ length: 40 }, (_, k) => (
          <rect key={k} x={W - M.r + 18} y={M.t + ((H - M.t - M.b) * (39 - k)) / 40} width={12} height={(H - M.t - M.b) / 40 + 0.5} fill={rampColor(k / 39)} />
        ))}
        {[0, 0.5, 1].map((f) => (
          <text key={f} className="tick" x={W - M.r + 34} y={M.t + (H - M.t - M.b) * (1 - f)} dy="0.32em">
            {((vmin + f * (vmax - vmin)) * 100).toFixed(1)}%
          </text>
        ))}
      </svg>
      {hover && hv !== null && (
        <div className="tooltip" style={{ left: Math.min(x(speeds[hover.j]) + 12, W - 200), top: Math.max(0, y(torques[hover.i]) - 70) }}>
          <h5>η = {(hv * 100).toFixed(2)} %</h5>
          <dl>
            <dt>Speed</dt>
            <dd>{speeds[hover.j].toFixed(0)} rpm</dd>
            <dt>Torque</dt>
            <dd>{torques[hover.i].toFixed(1)} N·m</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
