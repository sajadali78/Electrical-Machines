import { useState } from 'react';
import type { WindingAnalysis } from '../../core/winding/analysis';
import { fmt } from '../../ui/format';
import { BarChart } from '../charts/BarChart';
import { Segmented } from '../inputs/SelectField';

export function HarmonicsPanel({ a }: { a: WindingAnalysis }) {
  const [what, setWhat] = useState<'mmf' | 'kw'>('mmf');
  const [axis, setAxis] = useState<'mech' | 'elec'>('mech');
  const [maxN, setMaxN] = useState(Math.min(a.harmonics.length, Math.max(4 * a.p * 3, 2 * a.Q)));
  const [nonzero, setNonzero] = useState(true);
  const rows = a.harmonics.slice(0, maxN);
  const bars = rows
    .filter((h) => (axis === 'elec' ? Math.abs(h.elecOrder - Math.round(h.elecOrder)) < 1e-9 : true))
    .map((h) => ({
      x: axis === 'mech' ? h.order : h.elecOrder,
      y: what === 'mmf' ? h.mmfRel * 100 : h.kw * h.ksk,
      color: h.order === a.p ? 'var(--series-2)' : h.order < a.p ? 'var(--series-7)' : 'var(--series-1)',
      emphasis: h.order === a.p,
      label: `ν = ${h.order} (mech) · ${fmt(h.elecOrder, 2)} (elec)`,
      detail: [
        ['k_w', fmt(h.kw, 4)],
        ['MMF', `${fmt(h.mmfRel * 100, 2)} %`],
        ['Direction', h.direction === 'fwd' ? 'forward' : h.direction === 'bwd' ? 'backward' : '—'],
      ] as [string, string][],
    }));
  const tableRows = rows.filter((h) => !nonzero || h.kw > 1e-6 || h.mmf > 1e-9);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="field-row" style={{ justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <Segmented
          label="Quantity"
          value={what}
          options={[
            { value: 'mmf', label: 'MMF spectrum' },
            { value: 'kw', label: 'Winding factors' },
          ]}
          onChange={setWhat}
        />
        <Segmented
          label="Harmonic order axis"
          value={axis}
          options={[
            { value: 'mech', label: 'Mechanical ν' },
            { value: 'elec', label: 'Electrical ν/p' },
          ]}
          onChange={setAxis}
        />
        <label className="check-inline">
          Up to ν =
          <input className="input num" type="number" style={{ width: 70 }} min={a.p} max={a.harmonics.length} value={maxN} onChange={(e) => setMaxN(Math.max(a.p, Math.min(a.harmonics.length, +e.target.value || a.p)))} />
        </label>
        <span className="legend">
          <span>
            <i style={{ background: 'var(--series-2)' }} />
            working wave
          </span>
          <span>
            <i style={{ background: 'var(--series-7)' }} />
            sub-harmonics
          </span>
          <span>
            <i style={{ background: 'var(--series-1)' }} />
            higher harmonics
          </span>
        </span>
      </div>
      <BarChart bars={bars} xLabel={axis === 'mech' ? 'Harmonic order ν (mechanical)' : 'Harmonic order ν/p (electrical)'} yLabel={what === 'mmf' ? 'MMF amplitude [% of working]' : 'Winding factor k_w·k_sk'} formatY={(v) => (what === 'mmf' ? `${+v.toFixed(1)}` : v.toFixed(2))} formatX={(v) => `${+v.toFixed(2)}`} height={250} />
      <div className="field-row" style={{ justifyContent: 'flex-start' }}>
        <label className="check-inline">
          <input type="checkbox" checked={nonzero} onChange={(e) => setNonzero(e.target.checked)} /> Hide zero harmonics
        </label>
      </div>
      <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              <th className="num">ν mech</th>
              <th className="num">ν/p elec</th>
              <th className="num">k_d</th>
              <th className="num">k_p</th>
              <th className="num">k_w</th>
              <th className="num">k_sk</th>
              <th className="num">k_so</th>
              <th className="num">MMF [%]</th>
              <th>Rotation</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((h) => (
              <tr key={h.order} className={h.order === a.p ? 'hl' : ''}>
                <td className="num">{h.order}</td>
                <td className="num">{fmt(h.elecOrder, 3)}</td>
                <td className="num">{h.kd === null ? '—' : fmt(h.kd, 4)}</td>
                <td className="num">{h.kp === null ? '—' : fmt(h.kp, 4)}</td>
                <td className="num">{fmt(h.kw, 4)}</td>
                <td className="num">{fmt(h.ksk, 4)}</td>
                <td className="num">{fmt(h.kso, 4)}</td>
                <td className="num">{fmt(h.mmfRel * 100, 2)}</td>
                <td>{h.direction === 'fwd' ? 'forward' : h.direction === 'bwd' ? 'backward' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
