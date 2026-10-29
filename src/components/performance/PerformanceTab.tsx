import { useDesign } from '../../state/store';
import { fmt } from '../../ui/format';
import { Donut } from '../charts/Donut';
import { EfficiencyHeatmap } from '../charts/Heatmap';
import { LineChart, type LineSeries } from '../charts/LineChart';

export function PerformanceTab() {
  const { result: r } = useDesign();
  if (!r) return null;
  const P = r.performance;
  const L = r.losses;
  const env = P.envelope;
  const torqueSeries: LineSeries[] = [];
  if (env.length) torqueSeries.push({ id: 'env', name: `Capability (inverter, ${r.spec.overloadRatio.toFixed(1)}× rated current)`, color: 'var(--series-1)', points: env.map((p) => [p.speedRpm, p.torque]) });
  if (P.lineCurve) torqueSeries.push({ id: 'line', name: 'Direct-on-line (rated V, f)', color: 'var(--series-2)', points: P.lineCurve.map((p) => [p.speedRpm, p.torque]), dash: '6 4' });
  const rated = { x: P.rated.speedRpm, y: P.rated.torque };
  const rotorLossLabel = r.rotor.kind === 'wound_field' ? 'Field winding' : 'Rotor conductors';
  const slices = [
    { label: 'Stator copper', value: L.statorCopper },
    { label: rotorLossLabel, value: L.rotorCopper },
    { label: 'Iron — teeth', value: L.statorIronTeeth },
    { label: 'Iron — yoke', value: L.statorIronYoke },
    { label: 'Friction & windage', value: L.mechanical },
    { label: 'Stray load', value: L.stray },
  ].filter((s) => s.value > 0.05);
  const e = r.electrical;
  return (
    <div className="tab-body">
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h3>Torque–speed</h3>
            <span className="sub">Rated point at {fmt(rated.x, 0)} rpm, {fmt(rated.y, 1)} N·m</span>
          </div>
          <div className="panel-body">
            <LineChart series={torqueSeries} xLabel="Speed [rpm]" yLabel="Torque [N·m]" markers={[{ ...rated, label: 'Rated', color: 'var(--copper)' }]} height={300} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>Output power along the capability curve</h3>
          </div>
          <div className="panel-body">
            <LineChart series={[{ id: 'p', name: 'Shaft power', color: 'var(--series-3)', points: env.map((p) => [p.speedRpm, p.power / 1000]), area: true }]} xLabel="Speed [rpm]" yLabel="Power [kW]" markers={[{ x: rated.x, y: r.losses.Pout / 1000, label: 'Rated', color: 'var(--copper)' }]} height={300} legend={false} />
          </div>
        </div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h3>Efficiency map</h3>
            <span className="sub">Minimum-loss control within current and voltage limits</span>
          </div>
          <div className="panel-body">{P.map ? <EfficiencyHeatmap map={P.map} envelope={env} rated={rated} /> : <p className="empty-note">No map</p>}</div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>Loss breakdown at rated load</h3>
            <span className="sub">η = {fmt(L.efficiency * 100, 2)} %</span>
          </div>
          <div className="panel-body">
            <Donut slices={slices} unit="W" centerLabel="Total losses" />
          </div>
        </div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h3>Efficiency & power factor along the capability curve</h3>
          </div>
          <div className="panel-body">
            <LineChart
              series={[
                { id: 'eta', name: 'Efficiency [%]', color: 'var(--series-1)', points: env.filter((p) => p.power > 0).map((p) => [p.speedRpm, p.efficiency * 100]) },
                { id: 'pf', name: 'Power factor [%]', color: 'var(--series-2)', points: env.filter((p) => p.power > 0).map((p) => [p.speedRpm, p.powerFactor * 100]) },
              ]}
              xLabel="Speed [rpm]"
              yLabel="Percent [%]"
              yDomain={[0, 100]}
              height={260}
            />
          </div>
        </div>
        {P.loadAngleCurve ? (
          <div className="panel">
            <div className="panel-head">
              <h3>Torque vs load angle</h3>
              <span className="sub">Rated voltage & frequency, excitation at rated point</span>
            </div>
            <div className="panel-body">
              <LineChart series={[{ id: 'la', name: 'Torque', color: 'var(--series-1)', points: P.loadAngleCurve.map((p) => [p.deltaDeg, p.torque]) }]} xLabel="Load angle δ [deg]" yLabel="Torque [N·m]" xDomain={[0, 180]} height={260} legend={false} />
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="panel-head">
              <h3>Direct-on-line current</h3>
            </div>
            <div className="panel-body">
              {P.lineCurve && <LineChart series={[{ id: 'i', name: 'Phase current', color: 'var(--series-1)', points: P.lineCurve.map((p) => [p.speedRpm, p.current]) }]} xLabel="Speed [rpm]" yLabel="Phase current [A]" height={260} legend={false} />}
            </div>
          </div>
        )}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Per-phase equivalent circuit</h3>
        </div>
        <div className="panel-body table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="num">R₁ [Ω]</th>
                <th className="num">X₁ [Ω]</th>
                <th className="num">X_m [Ω]</th>
                {r.rotor.kind === 'induction' && <th className="num">R₂' [Ω]</th>}
                {r.rotor.kind === 'induction' && <th className="num">X₂' [Ω]</th>}
                <th className="num">L_d [mH]</th>
                <th className="num">L_q [mH]</th>
                <th className="num">k_sat</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="num">{e.R1.toPrecision(4)}</td>
                <td className="num">{e.X1.toPrecision(4)}</td>
                <td className="num">{e.Xm.toPrecision(4)}</td>
                {r.rotor.kind === 'induction' && <td className="num">{r.rotor.R2.toPrecision(4)}</td>}
                {r.rotor.kind === 'induction' && <td className="num">{(2 * Math.PI * r.main.f * r.rotor.L2).toPrecision(4)}</td>}
                <td className="num">{(e.Ld * 1000).toPrecision(4)}</td>
                <td className="num">{(e.Lq * 1000).toPrecision(4)}</td>
                <td className="num">{e.ksat.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
