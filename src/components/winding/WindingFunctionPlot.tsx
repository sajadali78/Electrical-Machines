import { useMemo, useState } from 'react';
import type { WindingAnalysis } from '../../core/winding/analysis';
import { phaseAxis, phaseName } from '../../core/winding/phases';
import { phaseColor } from '../../ui/format';
import { LineChart, type LineSeries } from '../charts/LineChart';

/** Step plot of a stepped function defined on the teeth after each slot, over 0…360° mechanical. */
function stepSeries(values: number[], scale = 1): [number, number][] {
  const Q = values.length;
  const pts: [number, number][] = [[0, values[Q - 1] * scale]];
  for (let k = 0; k < Q; k++) pts.push([(360 * k) / Q, values[k] * scale]);
  pts.push([360, values[Q - 1] * scale]);
  return pts;
}

export function WindingFunctionPlot({ a, turnsScale, unitLabel }: { a: WindingAnalysis; turnsScale: number; unitLabel: string }) {
  const [shown, setShown] = useState<boolean[]>(() => Array.from({ length: a.m }, (_, j) => j === 0));
  const series: LineSeries[] = a.windingFunction
    .map((wf, j) => ({ id: `ph${j}`, name: `M_${phaseName(j)}(θ)`, color: phaseColor(j), points: stepSeries(wf, turnsScale), step: true }))
    .filter((_, j) => shown[j]);
  const xt = Array.from({ length: 9 }, (_, i) => i * 45);
  return (
    <div>
      <div className="legend" style={{ marginBottom: 8 }}>
        {Array.from({ length: a.m }, (_, j) => (
          <label key={j} className="check-inline">
            <input type="checkbox" checked={shown[j] ?? false} onChange={(e) => setShown((s) => s.map((v, i) => (i === j ? e.target.checked : v)))} />
            <i style={{ background: phaseColor(j) }} />
            Phase {phaseName(j)}
          </label>
        ))}
      </div>
      <LineChart series={series} xLabel="Mechanical angle θ [deg]" yLabel={`Winding function [${unitLabel}]`} xDomain={[0, 360]} xTicks={xt} zeroLine height={260} legend={false} />
    </div>
  );
}

/** Resultant m-phase MMF with a time slider; the travelling wave moves as ωt changes. */
export function MmfPlot({ a, ampTurnsScale }: { a: WindingAnalysis; ampTurnsScale: number }) {
  const [wt, setWt] = useState(0);
  const pts = useMemo(() => {
    const Q = a.Q;
    const vals = new Array<number>(Q).fill(0);
    for (let j = 0; j < a.m; j++) {
      const i = Math.cos((wt * Math.PI) / 180 - phaseAxis(j, a.m));
      for (let k = 0; k < Q; k++) vals[k] += a.windingFunction[j][k] * i;
    }
    return stepSeries(vals, ampTurnsScale);
  }, [a, wt, ampTurnsScale]);
  // fundamental (working harmonic) overlay
  const fund = useMemo(() => {
    const h = a.harmonics[a.p - 1];
    if (!h) return [];
    // phase from a discrete Fourier projection of the step waveform
    let re = 0;
    let im = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const th = (pts[k][0] * Math.PI) / 180;
      re += pts[k][1] * Math.cos(a.p * th);
      im += pts[k][1] * Math.sin(a.p * th);
    }
    const n = pts.length - 1;
    const amp = (2 / n) * Math.hypot(re, im);
    const ph = Math.atan2(im, re);
    return Array.from({ length: 361 }, (_, d) => [d, amp * Math.cos(a.p * (d * Math.PI) / 180 - ph)] as [number, number]);
  }, [pts, a]);
  return (
    <div>
      <div className="field-row" style={{ justifyContent: 'flex-start', gap: 12 }}>
        <label htmlFor="wt-slider" style={{ whiteSpace: 'nowrap' }}>
          Time instant ωt = <span className="num">{wt.toFixed(0)}°</span>
        </label>
        <input id="wt-slider" type="range" min={0} max={360} step={1} value={wt} onChange={(e) => setWt(+e.target.value)} style={{ flex: 1, accentColor: 'var(--accent)' }} />
      </div>
      <LineChart
        series={[
          { id: 'mmf', name: 'Resultant MMF', color: 'var(--series-1)', points: pts, step: true },
          { id: 'f1', name: `Working harmonic (ν = ${a.p})`, color: 'var(--series-2)', points: fund, dash: '5 4' },
        ]}
        xLabel="Mechanical angle θ [deg]"
        yLabel="MMF [A·turns]"
        xDomain={[0, 360]}
        xTicks={Array.from({ length: 9 }, (_, i) => i * 45)}
        zeroLine
        height={260}
      />
    </div>
  );
}
