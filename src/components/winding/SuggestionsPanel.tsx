import { useEffect, useMemo, useState } from 'react';
import { alternativeSlots, suggestWindings, type SuggestionResult, type WindingSuggestion } from '../../core/winding/suggest';
import { useDesign } from '../../state/store';
import { fmt } from '../../ui/format';
import { stackLabel } from './LayerControls';

type SortKey = 'kw1' | 'thd' | 'sigma' | 'subharmonics' | 'layers' | 'span';

/**
 * Winding configuration suggestions for the current slots / poles / phases: feasibility, coil
 * spans for single- and double-layer windings and optimised 3…N-layer stacks, plus alternative
 * slot numbers for the same pole count.
 */
export function SuggestionsPanel() {
  const { spec, patchWinding, update, notify } = useDesign();
  const w = spec.winding;
  const [maxLayers, setMaxLayers] = useState(4);
  const [sort, setSort] = useState<SortKey>('kw1');
  const [res, setRes] = useState<SuggestionResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(true);
    const id = window.setTimeout(() => {
      setRes(suggestWindings(w.slots, w.poles, w.phases, maxLayers));
      setBusy(false);
    }, 30);
    return () => window.clearTimeout(id);
  }, [w.slots, w.poles, w.phases, maxLayers]);

  const alts = useMemo(() => alternativeSlots(w.poles, w.phases, w.slots), [w.poles, w.phases, w.slots]);

  const rows = useMemo(() => {
    const list = [...(res?.suggestions ?? [])];
    const key: Record<SortKey, (s: WindingSuggestion) => number> = {
      kw1: (s) => -s.kw1,
      thd: (s) => s.thd,
      sigma: (s) => s.sigma,
      subharmonics: (s) => s.subharmonics,
      layers: (s) => s.layers + s.coilPitch / 1000,
      span: (s) => s.avgSpan,
    };
    return list.sort((a, b) => key[sort](a) - key[sort](b) || b.kw1 - a.kw1);
  }, [res, sort]);

  const isCurrent = (s: WindingSuggestion) =>
    !w.custom && s.layers === w.layers && s.coilPitch === w.coilPitch && (s.layers < 3 || stackLabel(s.layerDefs ?? []) === stackLabel(w.layerDefs.slice(0, w.layers)));

  const apply = (s: WindingSuggestion) => {
    patchWinding({ layers: s.layers, coilPitch: s.coilPitch, ...(s.layerDefs ? { layerDefs: s.layerDefs } : {}) });
    notify(`Applied ${s.layers}-layer winding, coil span ${s.coilPitch}`);
  };

  const th = (k: SortKey, label: string, num = true) => (
    <th className={num ? 'num' : undefined} aria-sort={sort === k ? 'ascending' : 'none'} style={{ textTransform: 'none' }}>
      <button type="button" className="btn ghost small" style={{ padding: 0, height: 'auto', textTransform: 'inherit', font: 'inherit', color: sort === k ? 'var(--accent)' : 'inherit' }} onClick={() => setSort(k)}>
        {label}
        {sort === k ? ' ▾' : ''}
      </button>
    </th>
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="field-row" style={{ justifyContent: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <span>
          Q = <b className="num">{w.slots}</b>, 2p = <b className="num">{w.poles}</b>, m = <b className="num">{w.phases}</b>
          {res && (
            <>
              {' '}· q = <span className="num">{fmt(res.q, 3)}</span> · t = <span className="num">{res.t}</span>
            </>
          )}
        </span>
        <label className="check-inline">
          Up to
          <select className="select" value={maxLayers} onChange={(e) => setMaxLayers(+e.target.value)}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} layers
              </option>
            ))}
          </select>
        </label>
        {busy && <span className="hint">Computing suggestions…</span>}
      </div>
      {res && !res.feasible && <p className="hint" style={{ color: 'var(--err)' }}>{res.reason}</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {th('layers', 'Layers', false)}
                <th className="num" style={{ textTransform: 'none' }}>Coil span</th>
                <th style={{ textTransform: 'none' }}>Layer stack</th>
                {th('kw1', 'k_w1')}
                {th('thd', 'MMF THD')}
                {th('sigma', 'σ_δ')}
                {th('subharmonics', 'Sub-harm.')}
                {th('span', 'Avg. span')}
                <th className="num" style={{ textTransform: 'none' }}>a_max</th>
                <th style={{ textTransform: 'none' }}>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={isCurrent(s) ? 'hl' : ''}>
                  <td>{s.layers === 1 ? 'Single' : s.layers === 2 ? 'Double' : `${s.layers} layers`}</td>
                  <td className="num">{s.coilPitch}</td>
                  <td className="mono">{s.layerDefs ? stackLabel(s.layerDefs) : s.layers === 2 ? `0+ · ${s.coilPitch}−` : '—'}</td>
                  <td className="num">{fmt(s.kw1, 4)}</td>
                  <td className="num">{fmt(s.thd * 100, 1)} %</td>
                  <td className="num">{fmt(s.sigma * 100, 2)} %</td>
                  <td className="num">{fmt(s.subharmonics * 100, 1)} %</td>
                  <td className="num">{fmt(s.avgSpan, 2)}</td>
                  <td className="num">{s.maxParallelPaths}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 140 }}>
                    {s.tags.map((t) => (
                      <span key={t} className={`badge ${t.startsWith('highest') || t.startsWith('lowest') ? 'ok' : ''}`} style={{ marginRight: 4, background: t.startsWith('highest') || t.startsWith('lowest') ? undefined : 'var(--surface-2)', color: t.startsWith('highest') || t.startsWith('lowest') ? undefined : 'var(--ink-2)' }}>
                        {t}
                      </span>
                    ))}
                  </td>
                  <td>
                    {isCurrent(s) ? (
                      <span className="hint">current</span>
                    ) : (
                      <button type="button" className="btn small" onClick={() => apply(s)}>
                        Apply
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {alts.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Alternative slot numbers for 2p = {w.poles}</summary>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="data" style={{ width: 'auto' }}>
              <thead>
                <tr>
                  <th className="num">Q</th>
                  <th className="num">q</th>
                  <th className="num">Best k_w1 (double layer)</th>
                  <th className="num">Coil span</th>
                  <th className="num">LCM(Q,2p)</th>
                  <th className="num">GCD(Q,2p)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {alts.map((a) => (
                  <tr key={a.Q}>
                    <td className="num">{a.Q}</td>
                    <td className="num">{fmt(a.q, 3)}</td>
                    <td className="num">{fmt(a.kw1, 4)}</td>
                    <td className="num">{a.pitch}</td>
                    <td className="num">{a.lcm}</td>
                    <td className="num">
                      {a.gcd}
                      {a.gcd === 1 ? ' (UMP)' : ''}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          update('winding.slots', a.Q);
                          notify(`Using Q = ${a.Q}`);
                        }}
                      >
                        Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">Higher LCM(Q, 2p) means lower cogging torque; GCD(Q, 2p) = 1 gives unbalanced magnetic pull.</p>
        </details>
      )}
    </div>
  );
}
