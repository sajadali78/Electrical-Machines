import { useState } from 'react';
import { optimizeDesign, type ParetoPoint } from '../../core/optimize/pareto';
import { useDesign } from '../../state/store';
import { fmt } from '../../ui/format';
import { Scatter } from '../charts/Scatter';

const COLORS = ['var(--series-2)', 'var(--series-1)', '#9ca3af'];

export function OptimizerTab() {
  const { spec, update, notify } = useDesign();
  const [pts, setPts] = useState<ParetoPoint[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [ar, setAr] = useState<[number, number]>([0.6, 2.8]);
  const [J, setJ] = useState<[number, number]>([3, 8]);
  const run = () => {
    setBusy(true);
    window.setTimeout(() => {
      setPts(optimizeDesign(spec, ar, J, 9));
      setBusy(false);
    }, 30);
  };
  const apply = (p: ParetoPoint) => {
    update('sizingMode', 'd2l');
    update('aspectRatio', +p.aspectRatio.toFixed(3));
    update('currentDensity', +p.currentDensity.toFixed(2));
    notify(`Applied L/τ = ${p.aspectRatio.toFixed(2)}, J = ${p.currentDensity.toFixed(2)} A/mm²`);
  };
  const pareto = (pts ?? []).filter((p) => p.pareto).sort((a, b) => a.activeMass - b.activeMass);
  return (
    <div className="tab-body">
      <div className="panel">
        <div className="panel-head">
          <h3>Loss / mass trade-off</h3>
          <span className="sub">Sweeps aspect ratio L/τ and current density J (slot depth) with the full analytical model</span>
          <div className="spacer" />
          <label className="check-inline">
            L/τ
            <input className="input num" style={{ width: 60 }} type="number" step={0.1} value={ar[0]} onChange={(e) => setAr([+e.target.value || 0.5, ar[1]])} />–
            <input className="input num" style={{ width: 60 }} type="number" step={0.1} value={ar[1]} onChange={(e) => setAr([ar[0], +e.target.value || 3])} />
          </label>
          <label className="check-inline">
            J
            <input className="input num" style={{ width: 60 }} type="number" step={0.5} value={J[0]} onChange={(e) => setJ([+e.target.value || 3, J[1]])} />–
            <input className="input num" style={{ width: 60 }} type="number" step={0.5} value={J[1]} onChange={(e) => setJ([J[0], +e.target.value || 8])} />
            A/mm²
          </label>
          <button type="button" className="btn primary" onClick={run} disabled={busy}>
            {busy ? 'Running 81 designs…' : 'Run sweep'}
          </button>
        </div>
        <div className="panel-body">
          {!pts ? (
            <p className="empty-note">Run the sweep to map total loss against active mass. Pareto-optimal designs are highlighted; click a point to apply it.</p>
          ) : (
            <>
            {!pts.some((p) => p.feasible) && <p className="hint">No swept design passes every check; the front below is computed over all designs. Review the failing checks first.</p>}
            <Scatter
              groups={['Pareto-optimal', 'Feasible', 'Violates a design check']}
              colors={COLORS}
              xLabel="Active mass [kg]"
              yLabel="Total loss at rated load [W]"
              points={pts.map((p) => ({
                x: p.activeMass,
                y: p.totalLoss,
                group: p.pareto ? 0 : p.feasible ? 1 : 2,
                label: `L/τ = ${fmt(p.aspectRatio, 2)} · J = ${fmt(p.currentDensity, 2)} A/mm²`,
                detail: [
                  ['Efficiency', `${fmt(p.efficiency * 100, 2)} %`],
                  ['D × L', `${fmt(p.D * 1000, 1)} × ${fmt(p.L * 1000, 1)} mm`],
                  ['Outer Ø', `${fmt(p.Do * 1000, 1)} mm`],
                  ['Material cost', `${fmt(p.cost, 0)} USD`],
                ],
                onClick: () => apply(p),
              }))}
            />
            </>
          )}
        </div>
      </div>
      {pareto.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h3>Pareto-optimal designs</h3>
          </div>
          <div className="panel-body table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="num">L/τ</th>
                  <th className="num">J [A/mm²]</th>
                  <th className="num">D [mm]</th>
                  <th className="num">L [mm]</th>
                  <th className="num">Dₒ [mm]</th>
                  <th className="num">Loss [W]</th>
                  <th className="num">η [%]</th>
                  <th className="num">Mass [kg]</th>
                  <th className="num">Cost [USD]</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pareto.map((p, i) => (
                  <tr key={i}>
                    <td className="num">{fmt(p.aspectRatio, 2)}</td>
                    <td className="num">{fmt(p.currentDensity, 2)}</td>
                    <td className="num">{fmt(p.D * 1000, 1)}</td>
                    <td className="num">{fmt(p.L * 1000, 1)}</td>
                    <td className="num">{fmt(p.Do * 1000, 1)}</td>
                    <td className="num">{fmt(p.totalLoss, 0)}</td>
                    <td className="num">{fmt(p.efficiency * 100, 2)}</td>
                    <td className="num">{fmt(p.activeMass, 1)}</td>
                    <td className="num">{fmt(p.cost, 0)}</td>
                    <td>
                      <button type="button" className="btn small" onClick={() => apply(p)}>
                        Apply
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
