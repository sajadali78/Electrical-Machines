import { useMemo } from 'react';
import { analyzeVernier, gapWaveform, polePairOptions, slotOpeningSweep } from '../../core/vernier/vernier';
import { useDesign } from '../../state/store';
import { fmt } from '../../ui/format';
import { BarChart } from '../charts/BarChart';
import { LineChart } from '../charts/LineChart';
import { Group } from '../inputs/Group';
import { NumberField, ReadField } from '../inputs/NumberField';
import { SelectField } from '../inputs/SelectField';
import { WindingMatrixTable } from '../winding/WindingMatrixTable';
import { VernierSection } from './VernierSection';

/** Surface-PM Vernier (flux-modulation) machine: inputs, modulation analysis and first-pass sizing. */
export function VernierTab() {
  const { spec, update } = useDesign();
  const v = spec.vernier;
  const set = (k: string) => (x: unknown) => update(`vernier.${k}`, x);
  const r = useMemo(() => analyzeVernier(v), [v]);
  const sweep = useMemo(() => slotOpeningSweep(v), [v]);
  const wave = useMemo(() => gapWaveform(v, 1440), [v]);
  const options = useMemo(() => polePairOptions(v), [v]);
  const bestEps = sweep.reduce((a, b) => (b.torque > a.torque ? b : a), sweep[0]);

  const kpis: [string, string, string][] = [
    ['Rotor pole pairs P_r', `${r.Pr}`, ''],
    ['Gear ratio G', fmt(r.G, 2), ''],
    ['Electrical frequency', fmt(r.fe, 1), 'Hz'],
    ['Torque', fmt(r.torque, 1), 'N·m'],
    ['Power', fmt(r.power / 1000, 2), 'kW'],
    ['Shear stress', fmt(r.shear / 1000, 1), 'kPa'],
    ['Power factor', fmt(r.powerFactor, 3), ''],
    ['B_eff = G·B_Ps + B_Pr', fmt(r.Beff, 3), 'T'],
  ];

  return (
    <div className="tab-body vernier-layout">
      <div className="panel vernier-inputs">
        <div className="panel-head">
          <h3>Vernier machine inputs</h3>
        </div>
        <div style={{ maxHeight: '78vh', overflowY: 'auto' }}>
          <Group title="Pole-pair combination">
            <NumberField label="Stator slots" symbol="N_s" integer value={v.slots} min={6} max={120} onChange={set('slots')} />
            <NumberField label="Winding pole pairs" symbol="P_s" integer value={v.ps} min={1} max={Math.floor(v.slots / 2)} onChange={set('ps')} />
            <SelectField
              label="Rotor rule"
              value={v.rule}
              options={[
                { value: 'minus', label: 'P_r = N_s − P_s' },
                { value: 'plus', label: 'P_r = N_s + P_s' },
              ]}
              onChange={set('rule')}
            />
            <ReadField label="Rotor pole pairs" symbol="P_r" value={`${r.Pr} (${2 * r.Pr} poles)`} />
            <NumberField label="Phases" symbol="m" integer value={v.phases} min={1} max={9} onChange={set('phases')} />
            <SelectField label="Layers" value={v.layers} options={[1, 2, 3, 4].map((n) => ({ value: n, label: `${n}` }))} onChange={set('layers')} />
            <NumberField label="Coil pitch" symbol="y" integer value={v.coilPitch} min={1} max={v.slots - 1} onChange={set('coilPitch')} />
            <NumberField label="Parallel paths" symbol="a" integer value={v.parallelPaths} min={1} onChange={set('parallelPaths')} />
          </Group>
          <Group title="Rating">
            <NumberField label="Rotor speed" symbol="n" unit="rpm" value={v.speedRpm} min={1} onChange={set('speedRpm')} />
            <NumberField label="Line voltage" symbol="V" unit="V" value={v.voltageV} min={1} onChange={set('voltageV')} />
            <SelectField
              label="Connection"
              value={v.connection}
              options={[
                { value: 'star', label: 'Star (Y)' },
                { value: 'delta', label: 'Delta (Δ)' },
              ]}
              onChange={set('connection')}
            />
            <NumberField label="EMF / phase voltage" symbol="E/V_ph" value={v.emfRatio} min={0.3} max={1.5} step={0.01} onChange={set('emfRatio')} />
            <NumberField label="Electric loading" symbol="A" unit="A/m" value={v.electricLoading} min={1000} slider={{ min: 5000, max: 60000, step: 500 }} onChange={set('electricLoading')} />
            <NumberField label="Current density" symbol="J" unit="A/mm²" value={v.currentDensity} min={0.5} step={0.1} onChange={set('currentDensity')} />
            <NumberField label="Slot fill factor" symbol="k_fill" value={v.fillFactor} min={0.1} max={0.8} step={0.01} onChange={set('fillFactor')} />
          </Group>
          <Group title="Geometry">
            <NumberField label="Air-gap diameter" symbol="D" unit="mm" value={v.boreDiameterMm} min={10} onChange={set('boreDiameterMm')} />
            <NumberField label="Stack length" symbol="L" unit="mm" value={v.stackLengthMm} min={1} onChange={set('stackLengthMm')} />
            <NumberField label="Air gap" symbol="g" unit="mm" value={v.airgapMm} min={0.05} step={0.05} onChange={set('airgapMm')} />
            <NumberField label="Slot-opening ratio" symbol="ε = b₀/τ_s" value={v.slotOpeningRatio} min={0.02} max={0.95} slider={{ min: 0.05, max: 0.85, step: 0.01 }} onChange={set('slotOpeningRatio')} />
          </Group>
          <Group title="Magnets">
            <NumberField label="Remanence" symbol="B_r" unit="T" value={v.remanence} min={0.2} max={1.6} step={0.01} onChange={set('remanence')} />
            <NumberField label="Recoil permeability" symbol="μ_r" value={v.relPermeability} min={1} max={1.5} step={0.01} onChange={set('relPermeability')} />
            <NumberField label="Magnet thickness" symbol="h_m" unit="mm" value={v.magnetThicknessMm} min={0.2} step={0.1} onChange={set('magnetThicknessMm')} />
            <NumberField label="Magnet arc / pole pitch" symbol="α_m" value={v.magnetArc} min={0.2} max={1} step={0.01} onChange={set('magnetArc')} />
            <NumberField label="Leakage factor" symbol="k_l" value={v.leakage} min={0.5} max={1} step={0.01} onChange={set('leakage')} />
          </Group>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        <div className="panel">
          <div className="panel-head">
            <h3>Surface-PM Vernier machine</h3>
            <span className="sub">
              {v.slots} slots · {2 * v.ps}-pole winding · {2 * r.Pr}-pole rotor · G = {fmt(r.G, 2)}
            </span>
            <div className="spacer" />
            <span className={`badge ${r.feasible ? 'ok' : 'error'}`}>{r.feasible ? '✓ balanced winding' : '✕ winding not balanced'}</span>
          </div>
          <div className="kpis">
            {kpis.map(([k, val, u]) => (
              <div className="kpi" key={k}>
                <div className="k" style={{ textTransform: 'none' }}>
                  {k}
                </div>
                <div className="v">
                  {val}
                  <small>{u}</small>
                </div>
              </div>
            ))}
          </div>
          {r.notes.length > 0 && (
            <ul className="checks">
              {r.notes.map((n) => (
                <li key={n} className="check warn">
                  <span className="icon">!</span>
                  <span>{n}</span>
                  <span />
                </li>
              ))}
            </ul>
          )}
          <p className="hint" style={{ padding: '0 16px 12px' }}>
            Analytical permeance model (Zhu–Howe relative permeance, first slot harmonic, slotless magnet field). Such models usually overestimate Vernier torque; confirm the final design with FEA.
          </p>
        </div>

        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h3>Cross-section</h3>
            </div>
            <div className="panel-body">
              <VernierSection v={v} r={r} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>Air-gap field components</h3>
              <span className="sub">|P_r + j·N_s|, no load</span>
            </div>
            <div className="panel-body">
              <BarChart
                bars={r.spectrum
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((c) => ({
                    x: c.order,
                    y: c.amplitude,
                    color: c.role === 'working' ? 'var(--series-2)' : c.role === 'direct' ? 'var(--series-1)' : 'var(--series-7)',
                    emphasis: c.role === 'working',
                    label: `Order ${c.order} (j = ${c.j}) — ${c.role === 'working' ? 'working (modulated)' : c.role}`,
                    detail: [['Permeance term', c.j === 0 ? 'λ₀' : `λ${Math.abs(c.j)}/2`] as [string, string]],
                  }))}
                xLabel="Pole-pair order"
                yLabel="Amplitude [T]"
                formatY={(x) => x.toFixed(2)}
                formatX={(x) => `${x}`}
                height={230}
              />
              <div className="legend" style={{ marginTop: 6 }}>
                <span>
                  <i style={{ background: 'var(--series-2)' }} />
                  working order P_s (modulated)
                </span>
                <span>
                  <i style={{ background: 'var(--series-1)' }} />
                  direct order P_r
                </span>
                <span>
                  <i style={{ background: 'var(--series-7)' }} />
                  side-bands
                </span>
              </div>
              <table className="data" style={{ marginTop: 10 }}>
                <tbody>
                  {(
                    [
                      ['Flat-top magnet field (slotless)', `${fmt(r.Bm, 3)} T`],
                      ['Rotor field fundamental B_r1', `${fmt(r.Br1, 3)} T`],
                      ['Relative permeance λ₀ / λ₁', `${fmt(r.lambda0, 3)} / ${fmt(r.lambda1, 3)}`],
                      ['Carter factor k_C', fmt(r.kC, 3)],
                      ['Direct B_Pr = B_r1·λ₀', `${fmt(r.BPr, 3)} T`],
                      ['Working B_Ps = B_r1·|λ₁|/2', `${fmt(r.BPs, 3)} T`],
                      ['EMF ratio E_Ps / E_Pr = G·B_Ps/B_Pr', fmt(r.EPs / Math.max(1e-9, r.EPr), 2)],
                    ] as [string, string][]
                  ).map(([k, val]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td className="num">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>No-load air-gap flux density</h3>
            <span className="sub">Magnet field × slot permeance; the {2 * v.ps}-pole working wave appears in the modulated field</span>
          </div>
          <div className="panel-body">
            <LineChart
              series={[
                { id: 'mag', name: 'Slotless magnet field', color: 'var(--series-7)', points: wave.map((p) => [p.deg, p.bMag]), width: 1 },
                { id: 'b', name: 'Modulated gap field', color: 'var(--series-1)', points: wave.map((p) => [p.deg, p.b]), width: 1.5 },
                { id: 'ps', name: `Working wave (order ${v.ps})`, color: 'var(--series-2)', points: wave.map((p) => [p.deg, r.BPs * Math.cos(v.ps * (p.deg * Math.PI) / 180)]), dash: '6 4' },
              ]}
              xLabel="Mechanical angle θ [deg]"
              yLabel="B [T]"
              xDomain={[0, 360]}
              xTicks={Array.from({ length: 9 }, (_, i) => i * 45)}
              zeroLine
              height={260}
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h3>Slot-opening ratio sweep</h3>
              <span className="sub">best torque at ε ≈ {fmt(bestEps.eps, 2)}</span>
            </div>
            <div className="panel-body">
              <LineChart
                series={[{ id: 't', name: 'Torque', color: 'var(--series-1)', points: sweep.map((p) => [p.eps, p.torque]) }]}
                xLabel="Slot-opening ratio ε = b₀/τ_s"
                yLabel="Torque [N·m]"
                markers={[{ x: v.slotOpeningRatio, y: r.torque, label: 'current', color: 'var(--copper)' }]}
                height={220}
                legend={false}
              />
              <LineChart
                series={[
                  { id: 'l1', name: '|λ₁| (modulation)', color: 'var(--series-2)', points: sweep.map((p) => [p.eps, p.lambda1]) },
                  { id: 'kc', name: '1/k_C (mean permeance)', color: 'var(--series-3)', points: sweep.map((p) => [p.eps, 1 / p.kC]) },
                ]}
                xLabel="Slot-opening ratio ε"
                yLabel="Relative value"
                height={200}
              />
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>Pole-pair options for {v.slots} slots</h3>
              <span className="sub">click Use to apply</span>
            </div>
            <div className="panel-body table-wrap" style={{ maxHeight: 470, overflowY: 'auto' }}>
              <table className="data">
                <thead style={{ textTransform: 'none' }}>
                  <tr>
                    <th className="num">P_s</th>
                    <th className="num">P_r</th>
                    <th className="num">G</th>
                    <th className="num">k_w1</th>
                    <th className="num">f_e [Hz]</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {options.map((o) => (
                    <tr key={o.ps} className={o.ps === v.ps ? 'hl' : ''}>
                      <td className="num">{o.ps}</td>
                      <td className="num">{o.Pr}</td>
                      <td className="num">{fmt(o.G, 2)}</td>
                      <td className="num">{o.balanced ? fmt(o.kwPs, 3) : '—'}</td>
                      <td className="num">{fmt(o.fe, 0)}</td>
                      <td>{o.balanced && o.ps !== v.ps ? <button type="button" className="btn small" onClick={() => update('vernier.ps', o.ps)}>Use</button> : o.ps === v.ps ? <span className="hint">current</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h3>Winding and electrical design</h3>
            </div>
            <div className="panel-body table-wrap">
              <table className="data">
                <tbody>
                  {(
                    [
                      ['Winding factor at P_s / at P_r', `${fmt(r.kwPs, 4)} / ${fmt(r.kwPr, 4)}`, ''],
                      ['Phase voltage', fmt(r.Vph, 1), 'V'],
                      ['Turns in series per phase', fmt(r.Nph, 1), ''],
                      ['Conductors per slot', `${r.Zs}`, ''],
                      ['Phase EMF (P_s + P_r share)', `${fmt(r.E, 1)} (${fmt(r.EPs, 1)} + ${fmt(r.EPr, 1)})`, 'V'],
                      ['Phase current', fmt(r.Iph, 2), 'A'],
                      ['PM flux linkage ψ_m (peak)', fmt(r.psiM, 4), 'Wb'],
                      ['Synchronous inductance L_s', fmt(r.Ls * 1000, 2), 'mH'],
                      ['Power factor (i_d = 0)', fmt(r.powerFactor, 3), ''],
                      ['Inverter rating m·V·I', fmt(r.inverterKVA, 2), 'kVA'],
                      ['Torque per rotor volume', fmt(r.trv / 1000, 1), 'kN·m/m³'],
                      ['Conductor area', fmt(r.conductorArea, 2), 'mm²'],
                      ['Required slot area', fmt(r.slotArea, 1), 'mm²'],
                      ['Tooth width / slot depth / yoke', `${fmt(r.toothWidth * 1000, 1)} / ${fmt(r.slotDepth * 1000, 1)} / ${fmt(r.yoke * 1000, 1)}`, 'mm'],
                      ['Phase resistance', fmt(r.Rph, 3), 'Ω'],
                      ['Copper loss', fmt(r.copperLoss, 0), 'W'],
                      ['Magnet mass', fmt(r.magnetMass, 3), 'kg'],
                    ] as [string, string, string][]
                  ).map(([k, val, u]) => (
                    <tr key={k}>
                      <td style={{ whiteSpace: 'normal' }}>{k}</td>
                      <td className="num">{val}</td>
                      <td>{u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>Armature winding ({2 * v.ps} poles)</h3>
              <span className="sub">q = {r.winding.qLabel} · σ_δ = {fmt(r.winding.sigmaDiff * 100, 2)} %</span>
            </div>
            <div className="panel-body">
              <WindingMatrixTable matrix={r.windingMatrix} />
              <p className="hint">
                The direct order P_r = N_s ∓ P_s is a slot harmonic of this winding, so it has the same winding factor as the working order P_s and both field components induce EMF at f_e = P_r·n/60.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
