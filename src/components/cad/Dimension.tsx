/** Engineering dimension line with arrowheads, extension lines and a haloed label (mm units). */
export function Dimension({
  x1,
  y1,
  x2,
  y2,
  label,
  size,
  ext1,
  ext2,
  below,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  size: number; // reference text size in user units
  ext1?: [number, number];
  ext2?: [number, number];
  below?: boolean; // put the label on the other side of the line
}) {
  const sw = size * 0.09;
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const flip = ang > 90 || ang < -90;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const a = size * 0.55;
  const head = (x: number, y: number, dir: number) => {
    const t = (Math.atan2(y2 - y1, x2 - x1) + (dir < 0 ? Math.PI : 0)) as number;
    const p1 = [x - a * Math.cos(t - 0.35), y - a * Math.sin(t - 0.35)];
    const p2 = [x - a * Math.cos(t + 0.35), y - a * Math.sin(t + 0.35)];
    return `M${x} ${y}L${p1[0]} ${p1[1]}L${p2[0]} ${p2[1]}Z`;
  };
  return (
    <g className="dim" style={{ color: 'var(--dim)' }} pointerEvents="none">
      {ext1 && <line x1={ext1[0]} y1={ext1[1]} x2={x1} y2={y1} stroke="currentColor" strokeWidth={sw * 0.6} opacity={0.55} />}
      {ext2 && <line x1={ext2[0]} y1={ext2[1]} x2={x2} y2={y2} stroke="currentColor" strokeWidth={sw * 0.6} opacity={0.55} />}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={sw} />
      <path d={head(x2, y2, 1)} fill="currentColor" />
      <path d={head(x1, y1, -1)} fill="currentColor" />
      <text
        x={mx}
        y={my}
        dy={below ? size * 1.05 : -size * 0.35}
        fontSize={size}
        textAnchor="middle"
        fill="currentColor"
        stroke="var(--surface)"
        strokeWidth={size * 0.28}
        paintOrder="stroke"
        fontFamily="var(--font-mono)"
        transform={`rotate(${flip ? ang + 180 : ang} ${mx} ${my})`}
      >
        {label}
      </text>
    </g>
  );
}

export function Leader({ x, y, tx, ty, label, size }: { x: number; y: number; tx: number; ty: number; label: string; size: number }) {
  return (
    <g style={{ color: 'var(--dim)' }} pointerEvents="none">
      <circle cx={x} cy={y} r={size * 0.18} fill="currentColor" />
      <polyline points={`${x},${y} ${tx},${ty} ${tx + (tx >= x ? 1 : -1) * size * 0.8},${ty}`} fill="none" stroke="currentColor" strokeWidth={size * 0.08} />
      <text x={tx + (tx >= x ? 1 : -1) * size * 1.0} y={ty} dy={size * 0.35} fontSize={size} textAnchor={tx >= x ? 'start' : 'end'} fill="currentColor" stroke="var(--surface)" strokeWidth={size * 0.28} paintOrder="stroke" fontFamily="var(--font-mono)">
        {label}
      </text>
    </g>
  );
}
