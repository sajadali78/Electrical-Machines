import { defaultParams, SLOT_SHAPES, shapeOf, slotMetrics, type SlotShape } from '../../core/slots';
import type { SlotResult } from '../../core/sizing/result';
import { useDesign } from '../../state/store';
import { fmt } from '../../ui/format';
import { SlotDetail } from '../cad/SlotDetail';
import { LineChart } from '../charts/LineChart';

function SlotTable({ slot, extra }: { slot: SlotResult; extra: [string, string, string][] }) {
  const shape = shapeOf(slot.shape);
  const mt = slot.metrics;
  return (
    <div className="table-wrap">
    <table className="data">
      <tbody>
        {shape.params.map((p) => (
          <tr key={p.key}>
            <td style={{ whiteSpace: 'normal' }}>
              {p.label} <span className="sym">{p.symbol}</span>
            </td>
            <td className="num">{fmt(slot.params[p.key] ?? 0, 3)}</td>
            <td>mm</td>
          </tr>
        ))}
        {(
          [
            ['Total slot depth', fmt(mt.depth, 2), 'mm'],
            ['Opening width', fmt(mt.opening, 2), 'mm'],
            ['Slot (air) area', fmt(mt.outlineArea, 2), 'mm²'],
            ['Conductor area', fmt(mt.conductorArea, 2), 'mm²'],
            ['Required area', fmt(slot.targetArea, 2), 'mm²'],
            ['Tooth width min / mean / max', `${fmt(mt.toothMin, 2)} / ${fmt(mt.toothMean, 2)} / ${fmt(mt.toothMax, 2)}`, 'mm'],
            ['Leakage permeance λ (conductor + top)', `${fmt(mt.permeanceConductor, 3)} + ${fmt(mt.permeanceTop, 3)}`, ''],
            ...extra,
          ] as [string, string, string][]
        ).map(([k, v, u]) => (
          <tr key={k}>
            <td style={{ whiteSpace: 'normal' }}>{k}</td>
            <td className="num">{v}</td>
            <td>{u}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function ToothProfile({ slot, label }: { slot: SlotResult; label: string }) {
  return (
    <LineChart
      series={[{ id: 't', name: label, color: 'var(--series-1)', points: slot.metrics.toothProfile.map((p) => [p.u, p.width]) }]}
      xLabel="Depth from air gap [mm]"
      yLabel="Tooth width [mm]"
      height={180}
      legend={false}
    />
  );
}

/** Gallery of every slot shape (thumbnail with default proportions); click to use it. */
function Gallery({ usage, current, onPick }: { usage: SlotShape['usage'][number]; current: string; onPick: (id: SlotShape['id']) => void }) {
  return (
    <div className="slot-gallery">
      {Object.values(SLOT_SHAPES)
        .filter((s) => s.usage.includes(usage))
        .map((s) => {
          const params = defaultParams(s.id);
          const R = usage === 'stator' ? 80 : 60;
          const metrics = slotMetrics(s, params, R, 36, usage === 'stator' ? 'stator' : 'rotor');
          return (
            <button key={s.id} type="button" className="slot-card" aria-pressed={current === s.id} onClick={() => onPick(s.id)}>
              <SlotDetail slot={{ shape: s.id, params, metrics, targetArea: metrics.conductorArea, limited: false }} R={R} Q={36} side={usage === 'stator' ? 'stator' : 'rotor'} compact />
              <h5>{s.name}</h5>
              <p>{s.description}</p>
            </button>
          );
        })}
    </div>
  );
}

export function SlotsTab() {
  const { result: r, spec, update } = useDesign();
  if (!r) return null;
  const st = r.stator;
  const rot = r.rotor;
  const cells = r.layout.matrix.map((row) => row[0]);
  const rotorSlot = rot.kind === 'induction' ? rot.slot : rot.kind === 'wound_field' ? rot.slot : null;
  const rotorQ = rot.kind === 'induction' ? rot.Qr : rot.kind === 'wound_field' ? rot.Qr : 0;
  const rotorUsage = rot.kind === 'induction' ? (rot.rotorType === 'cage' ? 'rotorCage' : 'rotorWound') : 'rotorWound';
  const rotorPath = rot.kind === 'induction' ? 'induction.rotorSlot' : 'woundField.rotorSlot';
  return (
    <div className="tab-body">
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h3>Stator slot — {shapeOf(st.slot.shape).name}</h3>
            <span className="sub">{spec.statorSlot.autoSize ? 'auto-sized' : 'manual'}</span>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
            <SlotDetail slot={st.slot} R={(r.main.D / 2) * 1000} Q={st.Q} side="stator" cells={cells} arrangement={spec.winding.arrangement} svgId="slot-stator" />
            <SlotTable
              slot={st.slot}
              extra={[
                ['Conductors per slot', `${st.Zs}`, ''],
                ['Strands × diameter', `${st.strands} × ${fmt(st.strandDiameter, 3)}`, 'mm'],
                ['Copper fill factor', fmt(st.fill, 3), ''],
                ['Tooth flux density (peak)', fmt(st.Btooth, 3), 'T'],
              ]}
            />
            <ToothProfile slot={st.slot} label="Stator tooth" />
          </div>
        </div>
        {rotorSlot && (
          <div className="panel">
            <div className="panel-head">
              <h3>Rotor slot — {shapeOf(rotorSlot.shape).name}</h3>
            </div>
            <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
              <SlotDetail
                slot={rotorSlot}
                R={(rot.Dr / 2) * 1000}
                Q={rotorQ}
                side="rotor"
                cells={rot.kind === 'induction' && rot.rotorLayout ? rot.rotorLayout.map((row) => row[0]) : undefined}
                barFill={rot.kind === 'induction' && spec.induction.barMaterial === 'aluminum' && rot.rotorType === 'cage' ? 'var(--aluminum)' : 'var(--copper-fill)'}
                svgId="slot-rotor"
              />
              <SlotTable slot={rotorSlot} extra={rot.kind === 'induction' ? [['Rotor tooth flux density', fmt(rot.Btooth, 3), 'T']] : []} />
              <ToothProfile slot={rotorSlot} label="Rotor tooth" />
            </div>
          </div>
        )}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Stator slot library</h3>
          <span className="sub">Click a shape to use it for the stator</span>
        </div>
        <div className="panel-body">
          <Gallery usage="stator" current={spec.statorSlot.shape} onPick={(id) => update('statorSlot', { shape: id, autoSize: true, params: defaultParams(id) })} />
        </div>
      </div>
      {rotorSlot && (
        <div className="panel">
          <div className="panel-head">
            <h3>Rotor slot library</h3>
            <span className="sub">Click a shape to use it for the rotor</span>
          </div>
          <div className="panel-body">
            <Gallery usage={rotorUsage} current={rotorSlot.shape} onPick={(id) => update(rotorPath, { shape: id, autoSize: true, params: defaultParams(id) })} />
          </div>
        </div>
      )}
    </div>
  );
}
