import { useMemo } from 'react';
import { buildReport } from '../../export/reportModel';
import { useDesign } from '../../state/store';

/** The complete calculation sheet: every input and result with its symbol/formula and unit. */
export function SheetTab() {
  const { result: r } = useDesign();
  const sections = useMemo(() => (r ? buildReport(r) : []), [r]);
  if (!r) return null;
  return (
    <div className="tab-body">
      <div className="grid-2">
        {sections.map((s) => (
          <div className="panel sheet-section" key={s.id}>
            <div className="panel-head">
              <h3>{s.title}</h3>
            </div>
            <div className="panel-body table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Quantity</th>
                    <th>Symbol / formula</th>
                    <th className="num">Value</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((row, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'normal' }}>
                        {row.label}
                        {row.note && <div className="hint" style={{ margin: 0 }}>{row.note}</div>}
                      </td>
                      <td className="sym mono" style={{ color: 'var(--ink-3)', whiteSpace: 'normal' }}>
                        {row.symbol}
                      </td>
                      <td className="num">{row.value}</td>
                      <td>{row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
