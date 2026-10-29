import type { Coil } from '../../core/winding/layout';
import { phaseName } from '../../core/winding/phases';
import type { WindingMatrix } from '../../core/types';
import { phaseColor } from '../../ui/format';
import { useWidth } from '../charts/scales';

/**
 * Developed (linear) winding diagram: coil sides in the slots, end connections above (front) and
 * below (back). Lower layers are dashed. Coils that wrap around are split at the edges.
 */
export function WindingDiagram({ matrix, coils, phases, visible }: { matrix: WindingMatrix; coils: Coil[]; phases: number; visible: boolean[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const Q = matrix[0]?.length ?? 0;
  const L = matrix.length;
  const minPitch = 18;
  const W = Math.max(width, Q * minPitch + 40);
  const pitch = (W - 40) / Q;
  const x0 = 20;
  const top = 70;
  const bot = 190;
  const H = 260;
  const sideX = (slot: number, layer: number) => x0 + pitch * (slot + 0.5) + (L > 1 ? (layer - (L - 1) / 2) * Math.min(5, (pitch * 0.5) / L) : 0);
  const endH = (span: number) => Math.min(55, 10 + span * pitch * 0.18);

  const coilPaths = coils
    .filter((c) => visible[c.phase] !== false)
    .map((c, i) => {
      const xg = sideX(c.go.slot, c.go.layer);
      let xr = sideX(c.ret.slot, c.ret.layer);
      let fwd = c.ret.slot - c.go.slot;
      if (fwd < 0) fwd += Q;
      const back = Q - fwd;
      const forward = fwd <= back;
      const span = forward ? fwd : back;
      const dir = forward ? 1 : -1;
      if (forward && c.ret.slot < c.go.slot) xr += Q * pitch;
      if (!forward && c.ret.slot > c.go.slot) xr -= Q * pitch;
      const h = endH(span);
      const mid = (xg + xr) / 2;
      void dir;
      const d = `M${xg} ${bot}L${xg} ${top}L${mid} ${top - h}L${xr} ${top}L${xr} ${bot}L${mid} ${bot + h * 0.7}Z`;
      const dash = c.go.layer > 0 || c.ret.layer > 0;
      const wraps = xr > x0 + Q * pitch || xr < x0;
      return { d, color: phaseColor(c.phase), key: i, wraps, shift: xr > x0 + Q * pitch ? -Q * pitch : Q * pitch, dash };
    });

  return (
    <div ref={ref} className="table-wrap">
      <svg width={W} height={H} role="img" aria-label="Developed winding diagram">
        <defs>
          <clipPath id="wd-clip">
            <rect x={x0} y={0} width={Q * pitch} height={H} />
          </clipPath>
        </defs>
        {/* stator core strip */}
        <rect x={x0} y={top} width={Q * pitch} height={bot - top} fill="var(--surface-2)" />
        {Array.from({ length: Q }, (_, k) => (
          <g key={k}>
            <rect x={x0 + pitch * k + pitch * 0.18} y={top} width={pitch * 0.64} height={bot - top} fill="var(--surface)" stroke="var(--line-strong)" />
            <text x={x0 + pitch * (k + 0.5)} y={H - 8} textAnchor="middle" fontSize={Math.min(11, pitch * 0.6)} fill="var(--ink-3)" fontFamily="var(--font-mono)">
              {k + 1}
            </text>
          </g>
        ))}
        <g clipPath="url(#wd-clip)" fill="none" strokeWidth={1.8} strokeLinejoin="round">
          {coilPaths.map((p) => (
            <g key={p.key}>
              <path d={p.d} stroke={p.color} strokeDasharray={p.dash ? '5 3' : undefined} />
              {p.wraps && <path d={p.d} stroke={p.color} strokeDasharray={p.dash ? '5 3' : undefined} transform={`translate(${p.shift} 0)`} />}
            </g>
          ))}
        </g>
        {/* phase labels in the slots */}
        {matrix.map((row, l) =>
          row.map((c, k) =>
            c.sign !== 0 && visible[c.phase] !== false ? (
              <text key={`${l}-${k}`} x={sideX(k, l)} y={top + 14 + l * 13} textAnchor="middle" fontSize={Math.min(10, pitch * 0.45)} fontWeight={700} fill={phaseColor(c.phase)} fontFamily="var(--font-mono)">
                {phaseName(c.phase)}
                {c.sign > 0 ? '+' : '−'}
              </text>
            ) : null,
          ),
        )}
        <text x={x0} y={14} fontSize={11} fill="var(--ink-3)">
          Front end connections (solid = layer 1, dashed = lower layers) · {phases} phases
        </text>
      </svg>
    </div>
  );
}
