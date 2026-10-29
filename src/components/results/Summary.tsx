import { useDesign } from '../../state/store';
import { fmt, mm } from '../../ui/format';

export function Summary() {
  const { result: r, adoptCalculated, stale } = useDesign();
  if (!r) return null;
  const errs = r.checks.filter((c) => c.status === 'error').length;
  const warns = r.checks.filter((c) => c.status === 'warn').length;
  const kpis: [string, string, string][] = [
    ['Bore D', mm(r.main.D), 'mm'],
    ['Stack L', mm(r.main.L), 'mm'],
    ['Outer Dₒ', mm(r.stator.Do), 'mm'],
    ['Efficiency', fmt(r.losses.efficiency * 100, 2), '%'],
    ['Power factor', fmt(r.performance.rated.powerFactor, 3), ''],
    ['Rated torque', fmt(r.torqueRated, 1), 'N·m'],
    ['Rated speed', fmt(r.ratedSpeedRpm, 0), 'rpm'],
    ['Phase current', fmt(r.performance.rated.current, 1), 'A'],
    ['Active mass', fmt(r.masses.total, 1), 'kg'],
    ['Shear stress', fmt(r.shear / 1000, 1), 'kPa'],
  ];
  return (
    <section aria-label="Design summary" style={{ opacity: stale ? 0.7 : 1, transition: 'opacity .2s' }}>
      <div className="kpis">
        {kpis.map(([k, v, u]) => (
          <div className="kpi" key={k}>
            <div className="k">{k}</div>
            <div className="v">
              {v}
              <small>{u}</small>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 16px 4px', flexWrap: 'wrap' }}>
        <span className={`badge ${errs ? 'error' : warns ? 'warn' : 'ok'}`}>
          {errs ? `✕ ${errs} error${errs > 1 ? 's' : ''}` : warns ? `! ${warns} warning${warns > 1 ? 's' : ''}` : '✓ all checks pass'}
        </span>
        <button type="button" className="btn small" onClick={adoptCalculated} title="Set the assumed efficiency and power factor to the calculated values and re-size">
          Adopt calculated η / PF
        </button>
      </div>
    </section>
  );
}

export function ChecksList() {
  const { result: r } = useDesign();
  if (!r) return null;
  const order = { error: 0, warn: 1, ok: 2 } as const;
  const checks = [...r.checks].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <ul className="checks" aria-label="Design rule checks">
      {checks.map((c) => (
        <li key={c.id + c.label} className={`check ${c.status}`}>
          <span className="icon" aria-label={c.status}>
            {c.status === 'ok' ? '✓' : c.status === 'warn' ? '!' : '✕'}
          </span>
          <span>
            {c.label}
            {c.hint && c.status !== 'ok' && <div className="sub">{c.hint}</div>}
          </span>
          <span className="val">
            {c.value}
            <div className="sub">{c.limit}</div>
          </span>
        </li>
      ))}
    </ul>
  );
}
