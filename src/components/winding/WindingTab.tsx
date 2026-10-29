import { useState } from 'react';
import { cloneMatrix, cycleCell, emptyMatrix } from '../../core/winding/layout';
import { phaseName } from '../../core/winding/phases';
import { useDesign } from '../../state/store';
import { fmt, phaseColor } from '../../ui/format';
import { Segmented } from '../inputs/SelectField';
import { HarmonicsPanel } from './HarmonicsPanel';
import { LayerOptimizer, LayerPairsEditor } from './LayerControls';
import { StarOfSlots } from './StarOfSlots';
import { WindingDiagram } from './WindingDiagram';
import { MmfPlot, WindingFunctionPlot } from './WindingFunctionPlot';
import { WindingMatrixTable } from './WindingMatrixTable';

export function WindingTab() {
  const { result: r, spec, update } = useDesign();
  const [visible, setVisible] = useState<boolean[]>(() => Array(9).fill(true));
  if (!r) return null;
  const a = r.winding;
  const w = spec.winding;
  const custom = !!w.custom;
  const st = r.stator;
  const turnsScale = st.zLayer / st.a;
  const ampTurns = turnsScale * Math.SQRT2 * r.performance.rated.current;

  const chips: [string, string, string?][] = [
    ['q = Q/(2pm)', a.qLabel],
    ['Periodicity t = gcd(Q,p)', `${a.t}${a.antiperiodic ? ' (anti-periodic)' : ''}`],
    ['Slot angle α_e', `${fmt(a.slotAngleElecDeg, 2)}°`],
    ['k_w1 (layout)', fmt(a.kw1, 4)],
    ['k_d1 · k_p1', a.kd1 !== null && a.kp1 !== null ? `${fmt(a.kd1, 4)} · ${fmt(a.kp1, 4)}` : '—'],
    ['Skew factor k_sk1', fmt(a.ksk1, 4)],
    ['Slot-opening factor k_so1', fmt(a.kso1, 4)],
    ['MMF THD', `${fmt(a.thdMmf * 100, 2)} %`],
    ['Differential leakage σ_δ', `${fmt(a.sigmaDiff * 100, 3)} %`],
    ['Cogging order LCM(Q,2p)', `${a.lcmQ2p}`],
    ['Radial-force order GCD(Q,2p)', `${a.gcdQ2p}${a.gcdQ2p === 1 ? ' (UMP!)' : ''}`],
    ['Max parallel paths', `${a.maxParallelPaths}`],
    ['Coil sides / phase', `${a.coilSidesPerPhase[0] ?? 0}`],
    ['Balanced', a.balanced ? 'yes' : 'no'],
  ];

  const onCell = (l: number, k: number) => {
    if (!w.custom) return;
    const next = cloneMatrix(w.custom);
    next[l][k] = cycleCell(next[l][k], w.phases);
    update('winding.custom', next);
  };

  return (
    <div className="tab-body">
      <div className="panel">
        <div className="panel-head">
          <h3>Winding summary</h3>
          <span className="sub">
            {w.slots} slots · {w.poles} poles · {w.phases} phases · {r.layout.layers} layer{r.layout.layers > 1 ? 's' : ''} · {r.layout.kind}
          </span>
          <div className="spacer" />
          <span className={`badge ${a.balanced ? 'ok' : 'error'}`}>{a.balanced ? '✓ balanced' : '✕ unbalanced'}</span>
        </div>
        <div className="kpis">
          {chips.map(([k, v]) => (
            <div className="kpi" key={k}>
              <div className="k" style={{ textTransform: 'none' }}>
                {k}
              </div>
              <div className="v" style={{ fontSize: 15 }}>
                {v}
              </div>
            </div>
          ))}
        </div>
        {a.balanceNotes.length > 0 && <p className="hint" style={{ padding: '0 16px 10px' }}>{a.balanceNotes.join(' ')}</p>}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Winding layout</h3>
          <span className="sub">{custom ? 'Click a cell to cycle A+ → A− → B+ … → empty' : 'Generated from the star of slots'}</span>
          <div className="spacer" />
          {!custom && (
            <Segmented
              label="Layers"
              value={String(w.layers)}
              options={['1', '2', '4', '6', '8'].map((v) => ({ value: v, label: `${v}L` }))}
              onChange={(v) => update('winding.layers', +v)}
            />
          )}
          {custom ? (
            <>
              <button type="button" className="btn small" onClick={() => update('winding.custom', [...w.custom!, ...emptyMatrix(1, w.slots)])} disabled={w.custom!.length >= 8}>
                + Layer
              </button>
              <button type="button" className="btn small" onClick={() => update('winding.custom', w.custom!.slice(0, -1))} disabled={w.custom!.length <= 1}>
                − Layer
              </button>
              <button type="button" className="btn small" onClick={() => update('winding.custom', null)}>
                Reset to automatic
              </button>
            </>
          ) : (
            <button type="button" className="btn small" onClick={() => update('winding.custom', cloneMatrix(r.layout.matrix))}>
              Edit matrix
            </button>
          )}
        </div>
        <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
          <WindingMatrixTable matrix={r.layout.matrix} onCell={custom ? onCell : undefined} />
          {r.layout.notes.map((n) => (
            <p key={n} className="hint">
              {n}
            </p>
          ))}
          {!custom && w.layers >= 4 && <LayerPairsEditor />}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Developed winding diagram</h3>
          <div className="spacer" />
          <div className="legend">
            {Array.from({ length: w.phases }, (_, j) => (
              <label key={j} className="check-inline">
                <input type="checkbox" checked={visible[j]} onChange={(e) => setVisible((v) => v.map((x, i) => (i === j ? e.target.checked : x)))} />
                <i style={{ background: phaseColor(j) }} />
                {phaseName(j)}
              </label>
            ))}
          </div>
        </div>
        <div className="panel-body">
          <WindingDiagram matrix={r.layout.matrix} coils={r.layout.coils} phases={w.phases} visible={visible} />
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h3>Star of slots</h3>
            <span className="sub">EMF phasors of the slots (working harmonic)</span>
          </div>
          <div className="panel-body" style={{ display: 'grid', placeItems: 'center' }}>
            <StarOfSlots Q={w.slots} poles={w.poles} m={w.phases} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>Winding function</h3>
            <span className="sub">M(θ) = n(θ) − ⟨n⟩, turns per phase</span>
          </div>
          <div className="panel-body">
            <WindingFunctionPlot a={a} turnsScale={turnsScale} unitLabel="turns" />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Air-gap MMF at rated current</h3>
          <span className="sub">F(θ, t) = Σ M_j(θ)·√2·I·cos(ωt − θ_j)</span>
        </div>
        <div className="panel-body">
          <MmfPlot a={a} ampTurnsScale={ampTurns} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Harmonic analysis</h3>
          <span className="sub">Winding factors k_w = |Σ c_k e^(−jνθ_k)| / Σ|c_k| and rotating MMF waves</span>
        </div>
        <div className="panel-body">
          <HarmonicsPanel a={a} />
        </div>
      </div>

      {!custom && w.layers >= 4 && (
        <div className="panel">
          <div className="panel-head">
            <h3>Multi-layer optimiser</h3>
            <span className="sub">Exhaustive search over sub-winding pitches and sector shifts</span>
          </div>
          <div className="panel-body">
            <LayerOptimizer />
          </div>
        </div>
      )}
    </div>
  );
}
