import { useMemo, useState } from 'react';
import { combinationTable } from '../../core/winding/combinations';
import { useDesign } from '../../state/store';
import { fmt } from '../../ui/format';
import { rampColor } from '../charts/scales';
import { Segmented } from '../inputs/SelectField';

/** Winding-factor chart over slot and pole numbers; click a cell to use that combination. */
export function CombinationTab() {
  const { spec, update, notify } = useDesign();
  const [layers, setLayers] = useState<'1' | '2'>('2');
  const [qMax, setQMax] = useState(72);
  const [pMax, setPMax] = useState(24);
  const m = spec.winding.phases;
  const slots = useMemo(() => Array.from({ length: Math.floor(qMax / m) }, (_, i) => (i + 1) * m).filter((q) => q >= 3), [qMax, m]);
  const poles = useMemo(() => Array.from({ length: pMax / 2 }, (_, i) => 2 * (i + 1)), [pMax]);
  const table = useMemo(() => combinationTable(slots, poles, m, layers === '1' ? 1 : 2), [slots, poles, m, layers]);
  return (
    <div className="tab-body">
      <div className="panel">
        <div className="panel-head">
          <h3>Slot / pole combinations</h3>
          <span className="sub">Fundamental winding factor of the default {layers === '1' ? 'single' : 'double'}-layer winding · blank = not feasible/balanced</span>
          <div className="spacer" />
          <Segmented
            label="Layers"
            value={layers}
            options={[
              { value: '1', label: 'Single layer' },
              { value: '2', label: 'Double layer' },
            ]}
            onChange={setLayers}
          />
          <label className="check-inline">
            Q ≤
            <input className="input num" style={{ width: 64 }} type="number" min={6} max={144} value={qMax} onChange={(e) => setQMax(Math.max(6, Math.min(144, +e.target.value || 72)))} />
          </label>
          <label className="check-inline">
            2p ≤
            <input className="input num" style={{ width: 64 }} type="number" min={2} step={2} max={60} value={pMax} onChange={(e) => setPMax(Math.max(2, Math.min(60, 2 * Math.round((+e.target.value || 24) / 2))))} />
          </label>
        </div>
        <div className="panel-body table-wrap">
          <table className="matrix" style={{ borderSpacing: 1 }}>
            <thead>
              <tr>
                <th>Q \ 2p</th>
                {poles.map((p) => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={slots[i]}>
                  <th style={{ textAlign: 'right', paddingRight: 6 }}>{slots[i]}</th>
                  {row.map((c) => {
                    const cur = c.Q === spec.winding.slots && c.poles === spec.winding.poles;
                    return (
                      <td
                        key={c.poles}
                        className={c.feasible ? 'edit' : 'empty'}
                        style={c.feasible ? { background: rampColor((c.kw1 - 0.5) / 0.5), color: c.kw1 > 0.82 ? '#fff' : '#0b0b0b', outline: cur ? '2px solid var(--copper)' : undefined, minWidth: 40 } : { minWidth: 40 }}
                        title={c.feasible ? `Q=${c.Q}, 2p=${c.poles}, q=${fmt(c.q, 3)}, kw1=${fmt(c.kw1, 4)}, LCM=${c.lcm}, GCD=${c.gcd}` : 'not feasible'}
                        onClick={
                          c.feasible
                            ? () => {
                                update('winding.slots', c.Q);
                                update('winding.poles', c.poles);
                                notify(`Using Q = ${c.Q}, 2p = ${c.poles}`);
                              }
                            : undefined
                        }
                      >
                        {c.feasible ? c.kw1.toFixed(3) : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
