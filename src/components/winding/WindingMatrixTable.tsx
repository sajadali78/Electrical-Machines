import type { WindingMatrix } from '../../core/types';
import { phaseName } from '../../core/winding/phases';
import { phaseColor } from '../../ui/format';

/** Slot × layer table of the winding; cells are clickable in edit mode (cycle A+, A−, B+ … empty). */
export function WindingMatrixTable({ matrix, onCell, label = 'Layer' }: { matrix: WindingMatrix; onCell?: (layer: number, slot: number) => void; label?: string }) {
  const Q = matrix[0]?.length ?? 0;
  return (
    <div className="table-wrap">
      <table className="matrix" aria-label="Winding layout matrix">
        <thead>
          <tr>
            <th scope="col">Slot</th>
            {Array.from({ length: Q }, (_, k) => (
              <th key={k} scope="col">
                {k + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, l) => (
            <tr key={l}>
              <th scope="row" style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                {label} {l + 1}
              </th>
              {row.map((c, k) => (
                <td
                  key={k}
                  className={`${c.sign === 0 ? 'empty' : ''}${onCell ? ' edit' : ''}`}
                  style={c.sign !== 0 ? { background: phaseColor(c.phase), color: c.phase === 2 ? '#0b0b0b' : '#fff', backgroundImage: c.sign < 0 ? 'repeating-linear-gradient(45deg, rgb(255 255 255 / .28) 0 3px, transparent 3px 7px)' : undefined } : undefined}
                  onClick={onCell ? () => onCell(l, k) : undefined}
                  title={`Slot ${k + 1}, ${label.toLowerCase()} ${l + 1}`}
                >
                  {c.sign === 0 ? '·' : `${phaseName(c.phase)}${c.sign > 0 ? '+' : '−'}`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
