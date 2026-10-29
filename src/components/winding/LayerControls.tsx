import { useState } from 'react';
import type { LayerDef } from '../../core/types';
import { defaultLayerDefs } from '../../core/winding/layout';
import { optimizeLayerStack, type LayerCandidate, type LayerObjective } from '../../core/winding/optimizeLayers';
import { useDesign } from '../../state/store';
import { fmt } from '../../ui/format';

export const stackLabel = (defs: LayerDef[]) => defs.map((d) => `${d.shift}${d.sign > 0 ? '+' : '−'}`).join(' · ');

/** Editor for the layer stack of a winding with three or more layers. */
export function LayerStackEditor() {
  const { spec, update } = useDesign();
  const w = spec.winding;
  const L = w.layers;
  const defs: LayerDef[] = w.layerDefs.length >= L ? w.layerDefs.slice(0, L) : defaultLayerDefs(L, w.coilPitch, w.slots, w.poles);
  const alphaE = (360 * w.poles) / 2 / w.slots;
  const setDef = (l: number, patch: Partial<LayerDef>) => update('winding.layerDefs', defs.map((d, i) => (i === l ? { ...d, ...patch } : d)));
  return (
    <div className="table-wrap">
      <table className="data" style={{ width: 'auto' }}>
        <thead>
          <tr>
            <th>Layer</th>
            <th className="num">Slot shift d</th>
            <th>Polarity</th>
            <th className="num">Electrical shift d·α_e</th>
          </tr>
        </thead>
        <tbody>
          {defs.map((d, l) => (
            <tr key={l}>
              <td>{l + 1}{l === 0 ? ' (reference)' : ''}</td>
              <td className="num">
                <input className="input num" style={{ width: 70 }} type="number" min={0} max={w.slots - 1} value={d.shift} disabled={l === 0} onChange={(e) => setDef(l, { shift: ((Math.round(+e.target.value || 0) % w.slots) + w.slots) % w.slots })} />
              </td>
              <td>
                <select className="select" value={d.sign} disabled={l === 0} onChange={(e) => setDef(l, { sign: +e.target.value > 0 ? 1 : -1 })}>
                  <option value={1}>+ (go)</option>
                  <option value={-1}>− (return)</option>
                </select>
              </td>
              <td className="num">{fmt(((d.shift * alphaE) % 360 + 360) % 360, 1)}°</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="field-row" style={{ justifyContent: 'flex-start', gap: 8 }}>
        <button type="button" className="btn small" onClick={() => update('winding.layerDefs', defaultLayerDefs(L, w.coilPitch, w.slots, w.poles))}>
          Reset to default stack
        </button>
      </div>
      <p className="hint">
        Every layer is the star-of-slots base layer shifted by <i>d</i> slots with the chosen polarity. The standard double layer is <span className="mono">0+ · y−</span>; extra layers add shifted
        copies that cancel selected MMF harmonics. Odd layer counts are possible when each phase keeps equal numbers of + and − coil sides.
      </p>
    </div>
  );
}

export function LayerOptimizer() {
  const { spec, update, notify } = useDesign();
  const w = spec.winding;
  const [objective, setObjective] = useState<LayerObjective>('thd');
  const [minKw, setMinKw] = useState(0.85);
  const [res, setRes] = useState<LayerCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    window.setTimeout(() => {
      setRes(optimizeLayerStack(w.slots, w.poles, w.phases, w.layers, w.coilPitch, objective, minKw));
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
            <option value="kw1">Maximum k_w1</option>
          </select>
        </label>
        <label className="check-inline">
          k_w1 ≥
          <input className="input num" style={{ width: 70 }} type="number" step={0.01} min={0.3} max={1} value={minKw} onChange={(e) => setMinKw(+e.target.value || 0.85)} />
        </label>
        <button type="button" className="btn primary small" onClick={run} disabled={busy}>
          {busy ? 'Searching…' : `Search ${w.layers}-layer stacks`}
        </button>
      </div>
      {res && (
        <div className="table-wrap">
          {res.length === 0 ? (
            <p className="hint">No balanced, closable stack meets the winding-factor limit.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Layer stack (shift, polarity)</th>
                  <th className="num">k_w1</th>
                  <th className="num">MMF THD</th>
                  <th className="num">σ_δ</th>
                  <th className="num">Sub-harmonics</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {res.map((c, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="mono">{stackLabel(c.defs)}</td>
                    <td className="num">{fmt(c.kw1, 4)}</td>
                    <td className="num">{fmt(c.thd * 100, 1)} %</td>
                    <td className="num">{fmt(c.sigma * 100, 2)} %</td>
                    <td className="num">{fmt(c.subharmonics * 100, 1)} %</td>
                    <td>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          update('winding.layerDefs', c.defs);
                          notify('Applied layer stack');
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
