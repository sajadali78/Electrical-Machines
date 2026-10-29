import { useState } from 'react';
import { starOfSlots } from '../../core/winding/starOfSlots';
import { phaseBelt, phaseName } from '../../core/winding/phases';
import { phaseColor } from '../../ui/format';

/** Star of slots: EMF phasors of every slot, phase belts shaded, slot numbers at the tips. */
export function StarOfSlots({ Q, poles, m, size = 360 }: { Q: number; poles: number; m: number; size?: number }) {
  const star = starOfSlots(Q, poles, m);
  const [hover, setHover] = useState<number | null>(null);
  const c = size / 2;
  const R = size * 0.36;
  const groups = new Map<string, typeof star.phasors>();
  for (const ph of star.phasors) {
    const key = ph.angle.toFixed(6);
    groups.set(key, [...(groups.get(key) ?? []), ph]);
  }
  const belt = Math.PI / m;
  const sectors = Array.from({ length: 2 * m }, (_, s) => {
    const a0 = s * belt;
    const a1 = (s + 1) * belt;
    const p = (a: number, r: number) => `${c + r * Math.cos(a)} ${c - r * Math.sin(a)}`;
    return { a0, a1, d: `M${c} ${c}L${p(a0, R * 1.32)}A${R * 1.32} ${R * 1.32} 0 0 0 ${p(a1, R * 1.32)}Z` };
  });
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }} role="img" aria-label={`Star of slots for ${Q} slots and ${poles} poles`}>
      {sectors.map((s, i) => {
        const info = phaseBelt((s.a0 + s.a1) / 2, m);
        return <path key={i} d={s.d} fill={phaseColor(info.phase)} opacity={info.sign > 0 ? 0.16 : 0.07} />;
      })}
      <circle cx={c} cy={c} r={R} fill="none" stroke="var(--line-strong)" strokeDasharray="3 4" />
      {[...groups.values()].map((g) =>
        g.map((ph, i) => {
          const len = R;
          const x = c + len * Math.cos(ph.angle);
          const y = c - len * Math.sin(ph.angle);
          const lr = R + 14 + i * 13;
          const lx = c + lr * Math.cos(ph.angle);
          const ly = c - lr * Math.sin(ph.angle);
          const on = hover === null || hover === ph.slot;
          return (
            <g key={ph.slot} onMouseEnter={() => setHover(ph.slot)} onMouseLeave={() => setHover(null)} opacity={on ? 1 : 0.35}>
              {i === 0 && <line x1={c} y1={c} x2={x} y2={y} stroke={phaseColor(ph.phase)} strokeWidth={2} />}
              {i === 0 && <circle cx={x} cy={y} r={3} fill={phaseColor(ph.phase)} />}
              <text x={lx} y={ly} dy="0.33em" textAnchor="middle" fontSize={10.5} fontFamily="var(--font-mono)" fill="var(--ink)" fontWeight={600}>
                {ph.slot + 1}
                <tspan fill="var(--ink-3)" fontSize={9}>
                  {phaseName(ph.phase)}
                  {ph.sign > 0 ? '+' : '−'}
                </tspan>
              </text>
            </g>
          );
        }),
      )}
      <circle cx={c} cy={c} r={3} fill="var(--ink)" />
      <text x={8} y={size - 10} fontSize={11} fill="var(--ink-3)">
        α_e = {(star.slotAngleElec * 180 / Math.PI).toFixed(2)}° · t = {star.t} · {star.spokes} spokes
      </text>
    </svg>
  );
}
