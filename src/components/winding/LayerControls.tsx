import { useState } from 'react';
import type { LayerPair } from '../../core/types';
import { optimizeLayerPairs, type LayerCandidate, type LayerObjective } from '../../core/winding/optimizeLayers';
import { starStep } from '../../core/winding/layout';
import { useDesign } from '../../state/store';
import { fmt } from '../../ui/format';

/** Editor for the double-layer sub-windings of a multi-layer winding, plus a search for good shifts. */
export function LayerPairsEditor() {
  const { spec, update } = useDesign();
  const w = spec.winding;
  const n = Math.floor(w.layers / 2);
  const pairs: LayerPair[] = Array.from({ length: n }, (_, j) => w.pairs[j] ?? { pitch: w.coilPitch, shift: j });
  const step = (starStep(w.slots, w.poles) * 180) / Math.PI;
  const setPair = (j: number, patch: Partial<LayerPair>) => update('winding.pairs', pairs.map((p, i) => (i === j ? { ...p, ...patch } : p)));
  return (
    <div className="table-wrap">
      <table className="data" style={{ width: 'auto' }}>
        <thead>
          <tr>
            <th>Sub-winding</th>
            <th>Layers</th>
            <th className="num">Coil pitch y</th>
            <th className="num">Sector shift [steps]</th>
            <th className="num">Electrical shift</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, j) => (
            <tr key={j}>
              <td>#{j + 1}</td>
              <td>
                {2 * j + 1} & {2 * j + 2}
              </td>
              <td className="num">
                <input className="input num" style={{ width: 70 }} type="number" min={1} max={w.slots - 1} value={p.pitch} onChange={(e) => setPair(j, { pitch: Math.max(1, Math.round(+e.target.value || 1)) })} />
              </td>
              <td className="num">
                <input className="input num" style={{ width: 70 }} type="number" value={p.shift} onChange={(e) => setPair(j, { shift: Math.round(+e.target.value || 0) })} />
              </td>
              <td className="num">{fmt(p.shift * step, 2)}°</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Each sub-winding is a double-layer winding built from the star of slots; its phase belts are rotated by <i>shift × {fmt(step, 2)}°</i> (one star step). Shifting sub-windings
        against each other cancels selected MMF harmonics (e.g. the sub-harmonic of 12-slot/10-pole windings) at the cost of a slightly lower k_w1.
      </p>
    </div>
  );
}

export function LayerOptimizer() {
  const { spec, update, notify } = useDesign();
  const [objective, setObjective] = useState<LayerObjective>('thd');
  const [minKw, setMinKw] = useState(0.85);
  const [res, setRes] = useState<LayerCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    window.setTimeout(() => {
      setRes(optimizeLayerPairs(spec.winding, objective, minKw));
      setBusy(false);
    }, 20);
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="field-row" style={{ justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <label className="check-inline">
          Objective
          <select className="select" value={objective} onChange={(e) => setObjective(e.target.value as LayerObjective)}>
            <option value="thd">Minimum MMF THD</option>
            <option value="sigma">Minimum differential leakage</option>
            <option value="subharmonics">Minimum sub-harmonics</option>
          </select>
        </label>
        <label className="check-inline">
          k_w1 ≥
          <input className="input num" style={{ width: 70 }} type="number" step={0.01} min={0.3} max={1} value={minKw} onChange={(e) => setMinKw(+e.target.value || 0.85)} />
        </label>
        <button type="button" className="btn primary small" onClick={run} disabled={busy}>
          {busy ? 'Searching…' : 'Search shifts & pitches'}
        </button>
      </div>
      {res && (
        <div className="table-wrap">
          {res.length === 0 ? (
            <p className="hint">No balanced layout meets the winding-factor limit.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sub-windings (pitch / shift)</th>
                  <th className="num">k_w1</th>
                  <th className="num">MMF THD</th>
                  <th className="num">Score</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {res.map((c, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="mono">{c.pairs.map((p) => `y=${p.pitch}/s=${p.shift}`).join('  ')}</td>
                    <td className="num">{fmt(c.kw1, 4)}</td>
                    <td className="num">{fmt(c.thd * 100, 1)} %</td>
                    <td className="num">{fmt(c.score, 4)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          update('winding.pairs', c.pairs);
                          notify('Applied multi-layer configuration');
                        }}
                      >
                        Apply
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
