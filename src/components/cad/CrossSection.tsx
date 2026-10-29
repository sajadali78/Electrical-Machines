import { useMemo, useRef, useState, type MouseEvent } from 'react';
import type { DesignResult } from '../../core/sizing/result';
import { phaseName } from '../../core/winding/phases';
import { fmt, phaseColor } from '../../ui/format';
import { Dimension, Leader } from './Dimension';
import { barPaths, circlePath, cylindricalWound, laminationPath, magnetShapes, salientPoles, slotTheta, windingCells } from './geometry';
import { classify, inspect } from './inspect';
import { useZoomPan } from './useZoomPan';

export interface CrossSectionOptions {
  dims: boolean;
  labels: boolean;
  housing: boolean;
}

/** Interactive radial cross-section of the complete machine. */
export function CrossSection({ r, opts, svgId }: { r: DesignResult; opts: CrossSectionOptions; svgId?: string }) {
  const mm = 1000;
  const st = r.stator;
  const rot = r.rotor;
  const Ro = (st.Do / 2) * mm;
  const Rs = (r.main.D / 2) * mm;
  const Rr = (rot.Dr / 2) * mm;
  const Rsh = (rot.Di / 2) * mm;
  const housingT = opts.housing ? Math.max(4, Ro * 0.07) : 0;
  const pad = Ro * (opts.dims ? 0.46 : 0.06) + housingT;
  const base = { x: -Ro - pad, y: -Ro - pad, w: 2 * (Ro + pad), h: 2 * (Ro + pad) };
  const zp = useZoomPan(base);
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const sw = Ro / 500;
  const fsDim = Ro * 0.045;

  const geo = useMemo(() => {
    const statorLam = laminationPath(st.slot, Rs, st.Q, 'stator', Ro);
    const cells = windingCells(st.slot, Rs, st.Q, 'stator', r.layout.matrix, r.spec.winding.arrangement);
    let rotorLam = '';
    let rotorCells: ReturnType<typeof windingCells> = [];
    let bars: ReturnType<typeof barPaths> = [];
    let fieldSlots: (ReturnType<typeof barPaths>[number] & { sign: 1 | -1 })[] = [];
    if (rot.kind === 'induction') {
      rotorLam = laminationPath(rot.slot, Rr, rot.Qr, 'rotor', Rsh);
      if (rot.rotorType === 'wound' && rot.rotorLayout) rotorCells = windingCells(rot.slot, Rr, rot.Qr, 'rotor', rot.rotorLayout, 'radial');
      else bars = barPaths(rot.slot, Rr, rot.Qr, 'rotor');
    } else if (rot.kind === 'pm') {
      const coreR = rot.layout === 'spm' ? rot.coreOuterR * mm : Rr;
      rotorLam = circlePath(coreR) + circlePath(Rsh);
    } else if (rot.poleType === 'cylindrical' && rot.slot) {
      const cw = cylindricalWound(r);
      // only wound slots are machined; build lamination with those cut-outs
      rotorLam = circlePath(Rr) + circlePath(Rsh);
      fieldSlots = barPaths(rot.slot, Rr, rot.Qr, 'rotor', 0, cw.filter).map((b) => ({ ...b, sign: cw.sign(b.slot) }));
    }
    return { statorLam, cells, rotorLam, rotorCells, bars, fieldSlots, magnets: magnetShapes(r), salient: salientPoles(r) };
  }, [r]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    if (zp.panning) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = zp.vb.x + ((e.clientX - rect.left) / rect.width) * zp.vb.w;
    const y = zp.vb.y + ((e.clientY - rect.top) / rect.height) * zp.vb.h;
    const t = (e.target as Element).closest('[data-h]');
    const key = t?.getAttribute('data-h') ?? classify(r, x, y);
    const wr = wrap.current?.getBoundingClientRect();
    if (!key || !wr) return setHover(null);
    setHover({ key, x: e.clientX - wr.left, y: e.clientY - wr.top });
  };

  const info = hover ? inspect(r, hover.key) : null;
  const hl = hover?.key;
  const labelSize = Math.min((Math.PI * 2 * Rs) / st.Q / Math.max(2.2, r.layout.layers === 1 ? 2.2 : 2.6), 0.07 * Ro);
  const showLabels = opts.labels && st.Q * r.layout.layers <= 400;

  const slotDepth = st.slot.metrics.depth;
  const dimRows = [
    { R: Ro, label: `Ø D_o = ${fmt(Ro * 2, 1)}` },
    { R: Rs, label: `Ø D = ${fmt(Rs * 2, 1)}` },
    { R: Rr, label: `Ø D_r = ${fmt(Rr * 2, 1)}` },
    { R: Rsh, label: `Ø D_sh = ${fmt(Rsh * 2, 1)}` },
  ];

  return (
    <div className="cad-wrap" ref={wrap}>
      <svg
        id={svgId}
        ref={zp.svgRef}
        className={`cad-svg pannable${zp.panning ? ' panning' : ''}`}
        viewBox={zp.viewBox}
        role="img"
        aria-label={`Radial cross-section: ${st.Q} slots, ${r.main.poles} poles`}
        {...zp.handlers}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ aspectRatio: '1 / 1', maxHeight: '78vh' }}
      >
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width={Ro / 90} height={Ro / 90} patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={Ro / 90} stroke="#ffffff" strokeWidth={Ro / 260} strokeOpacity="0.55" />
          </pattern>
        </defs>
        {opts.housing && <path d={circlePath(Ro + housingT) + circlePath(Ro)} fill="var(--housing)" fillRule="evenodd" stroke="var(--steel-edge)" strokeWidth={sw} />}
        {/* air gap */}
        <path d={circlePath(Rs) + circlePath(Rr)} fillRule="evenodd" fill="var(--airgap)" opacity={hl === 'airgap' ? 1 : 0.85} />
        {/* stator */}
        <path d={geo.statorLam} fill="var(--steel)" fillRule="evenodd" stroke="var(--steel-edge)" strokeWidth={sw} opacity={hl?.startsWith('stator-t') || hl === 'stator-yoke' ? 0.85 : 1} />
        <g>
          {geo.cells.map((c) => (
            <g key={`${c.slot}-${c.layer}`} data-h={`stator-slot:${c.slot}`}>
              <path d={c.d} fill={c.sign ? phaseColor(c.phase) : 'var(--surface-2)'} stroke="var(--surface)" strokeWidth={sw * 0.8} opacity={hl === `stator-slot:${c.slot}` ? 0.75 : 1} />
              {c.sign < 0 && <path d={c.d} fill="url(#hatch)" pointerEvents="none" />}
              {showLabels && c.sign !== 0 && (
                <text x={c.cx} y={c.cy} dy={Math.min(labelSize, c.label) * 0.35} fontSize={Math.min(labelSize, c.label)} textAnchor="middle" fill={c.phase === 2 ? '#0b0b0b' : '#ffffff'} fontWeight={700} pointerEvents="none">
                  {phaseName(c.phase)}
                  {c.sign > 0 ? '+' : '−'}
                </text>
              )}
            </g>
          ))}
        </g>
        {/* rotor */}
        {geo.rotorLam && <path d={geo.rotorLam} fill="var(--steel-rotor)" fillRule="evenodd" stroke="var(--steel-edge)" strokeWidth={sw} />}
        {geo.bars.map((b) => (
          <path key={b.slot} d={b.d} data-h={`rotor-bar:${b.slot}`} fill={r.spec.induction.barMaterial === 'copper' ? 'var(--copper-fill)' : 'var(--aluminum)'} stroke="var(--steel-edge)" strokeWidth={sw * 0.6} opacity={hl === `rotor-bar:${b.slot}` ? 0.7 : 1} />
        ))}
        {geo.rotorCells.map((c) => (
          <g key={`r${c.slot}-${c.layer}`} data-h={`rotor-bar:${c.slot}`}>
            <path d={c.d} fill={c.sign ? phaseColor(c.phase) : 'var(--surface-2)'} stroke="var(--surface)" strokeWidth={sw * 0.6} />
            {c.sign < 0 && <path d={c.d} fill="url(#hatch)" pointerEvents="none" />}
          </g>
        ))}
        {geo.fieldSlots.map((b) => (
          <g key={`f${b.slot}`} data-h="field-coil">
            <path d={b.d} fill="var(--copper-fill)" stroke="var(--steel-edge)" strokeWidth={sw * 0.6} />
            <CurrentMark x={b.cx} y={b.cy} s={Math.min(Rr * 0.03, (Math.PI * Rr) / (rot.kind === 'wound_field' ? rot.Qr : 30) / 3)} sign={b.sign} />
          </g>
        ))}
        {rot.kind === 'wound_field' && rot.poleType === 'salient' && (
          <g>
            <path d={circlePath(geo.salient.hubR) + circlePath(Rsh)} fill="var(--steel-rotor)" fillRule="evenodd" stroke="var(--steel-edge)" strokeWidth={sw} data-h="rotor-hub" />
            {geo.salient.poles.map((p) => (
              <g key={p.pole}>
                <path d={p.d} fill="var(--steel-rotor)" stroke="var(--steel-edge)" strokeWidth={sw} data-h={`pole:${p.pole}`} opacity={hl === `pole:${p.pole}` ? 0.8 : 1} />
                {p.coils.map((c, i) => (
                  <g key={i} data-h="field-coil">
                    <path d={c.d} fill="var(--copper-fill)" stroke="var(--steel-edge)" strokeWidth={sw * 0.6} />
                    <CurrentMark x={c.cx} y={c.cy} s={Math.min(Rr * 0.025, rot.coilWidth * 250)} sign={c.sign} />
                  </g>
                ))}
              </g>
            ))}
          </g>
        )}
        {rot.kind === 'pm' && rot.layout === 'spm' && rot.sleeve > 0 && <path d={circlePath(Rr) + circlePath(Rr - rot.sleeve * mm)} fillRule="evenodd" fill="var(--shaft)" opacity={0.5} />}
        {geo.magnets.map((m, i) => (
          <g key={i} data-h={`magnet:${m.pole}`}>
            <path d={m.d} fill={m.north ? 'var(--magnet-n)' : 'var(--magnet-s)'} stroke="var(--steel-edge)" strokeWidth={sw * 0.6} opacity={hl === `magnet:${m.pole}` ? 0.75 : 1} />
            <Arrow from={m.arrow[0]} to={m.arrow[1]} w={sw * 2.2} />
          </g>
        ))}
        {(() => {
          // the rotor core bore may be larger than the torque-limited shaft: show a hub/spider ring
          const rShaft = Math.min(Rsh, Math.max((rot.shaftMin / 2) * mm * 1.25, Rsh * 0.45));
          return (
            <>
              {rShaft < Rsh - 0.5 && <path d={circlePath(Rsh) + circlePath(rShaft)} fillRule="evenodd" fill="var(--surface-3)" stroke="var(--steel-edge)" strokeWidth={sw} data-h="shaft" />}
              <path d={circlePath(rShaft)} fill="var(--shaft)" stroke="var(--steel-edge)" strokeWidth={sw} data-h="shaft" />
              <circle r={rShaft * 0.18} fill="var(--steel-edge)" pointerEvents="none" />
            </>
          );
        })()}

        {opts.dims && (
          <g>
            <Dimension x1={-Ro} y1={Ro + housingT + Ro * 0.1} x2={Ro} y2={Ro + housingT + Ro * 0.1} label={`Ø D_o = ${fmt(Ro * 2, 1)}`} size={fsDim} ext1={[-Ro, 0]} ext2={[Ro, 0]} />
            {(() => {
              // radial dims beside the slot closest to 3 o'clock: slot depth and yoke depth
              const k = Math.round(st.Q / 4) % st.Q;
              const th = slotTheta(k, st.Q);
              const ux = Math.cos(th);
              const uy = -Math.sin(th);
              const off = (Math.PI * Rs) / st.Q + Ro * 0.015;
              const p = (rr: number): [number, number] => [ux * rr - uy * off, uy * rr + ux * off];
              const a = p(Rs);
              const b = p(Rs + slotDepth);
              const c = p(Ro);
              return (
                <>
                  <Dimension x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} label={`h_s ${fmt(slotDepth, 1)}`} size={fsDim * 0.8} />
                  <Dimension x1={b[0]} y1={b[1]} x2={c[0]} y2={c[1]} label={`h_ys ${fmt(st.yoke * mm, 1)}`} size={fsDim * 0.8} below />
                </>
              );
            })()}
            {dimRows.slice(1).map((d, i) => {
              const a = (Math.PI * (200 + i * 18)) / 180;
              const x = d.R * Math.cos(a);
              const y = -d.R * Math.sin(a);
              return <Leader key={d.label} x={x} y={y} tx={-Ro * 1.04} ty={Ro * (0.55 + i * 0.16)} label={d.label} size={fsDim} />;
            })}
            <Leader x={((Rs + Rr) / 2) * Math.cos(Math.PI / 4)} y={-((Rs + Rr) / 2) * Math.sin(Math.PI / 4)} tx={Ro * 0.98} ty={-Ro * 1.1} label={`g = ${fmt(r.main.airgap * mm, 2)} mm`} size={fsDim} />
          </g>
        )}
      </svg>
      <div className="cad-toolbar">
        <button type="button" className="btn small" onClick={() => zp.zoom(0.7)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="btn small" onClick={() => zp.zoom(1 / 0.7)} aria-label="Zoom out">
          −
        </button>
        <button
          type="button"
          className="btn small"
          onClick={() => {
            const s = Rs * 0.32;
            zp.focus({ x: -s, y: -Rs - s * 0.6, w: 2 * s, h: 2 * s });
          }}
        >
          Slot
        </button>
        <button type="button" className="btn small" onClick={zp.reset}>
          Fit
        </button>
      </div>
      {info && hover && (
        <div className="tooltip" style={{ left: Math.min(hover.x + 14, (wrap.current?.clientWidth ?? 600) - 290), top: hover.y + 14 }}>
          <h5>{info.title}</h5>
          <dl>
            {info.rows.map(([k, v]) => (
              <FragmentRow key={k} k={k} v={v} />
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

function CurrentMark({ x, y, s, sign }: { x: number; y: number; s: number; sign: 1 | -1 }) {
  return (
    <g pointerEvents="none" stroke="#3b2205" strokeWidth={s * 0.18} fill="none">
      <circle cx={x} cy={y} r={s} fill="#fde7c7" />
      {sign > 0 ? (
        <circle cx={x} cy={y} r={s * 0.28} fill="#3b2205" stroke="none" />
      ) : (
        <path d={`M${x - s * 0.6} ${y - s * 0.6}L${x + s * 0.6} ${y + s * 0.6}M${x + s * 0.6} ${y - s * 0.6}L${x - s * 0.6} ${y + s * 0.6}`} />
      )}
    </g>
  );
}

function Arrow({ from, to, w }: { from: [number, number]; to: [number, number]; w: number }) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const a = w * 2.6;
  const p1 = [to[0] - a * Math.cos(ang - 0.45), to[1] - a * Math.sin(ang - 0.45)];
  const p2 = [to[0] - a * Math.cos(ang + 0.45), to[1] - a * Math.sin(ang + 0.45)];
  return (
    <g pointerEvents="none" fill="#ffffff" stroke="#ffffff">
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} strokeWidth={w} />
      <path d={`M${to[0]} ${to[1]}L${p1[0]} ${p1[1]}L${p2[0]} ${p2[1]}Z`} stroke="none" />
    </g>
  );
}
