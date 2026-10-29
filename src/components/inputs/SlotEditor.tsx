import { defaultParams, shapeOf, shapesFor, type SlotUsage } from '../../core/slots';
import type { SlotShapeId, SlotSpec } from '../../core/types';
import { useDesign } from '../../state/store';
import { fmt } from '../../ui/format';
import { NumberField, ReadField } from './NumberField';
import { SelectField } from './SelectField';

interface Props {
  path: string; // e.g. 'statorSlot'
  slot: SlotSpec;
  usage: SlotUsage;
  computed?: Record<string, number>;
}

/** Slot shape picker with fixed (opening) parameters and auto-sized or manual body parameters. */
export function SlotEditor({ path, slot, usage, computed }: Props) {
  const { update } = useDesign();
  const shape = shapeOf(slot.shape);
  const options = shapesFor(usage).map((s) => ({ value: s.id, label: s.name }));
  return (
    <>
      <SelectField
        label="Slot shape"
        value={slot.shape}
        options={options}
        onChange={(v: SlotShapeId) => update(path, { shape: v, autoSize: slot.autoSize, params: defaultParams(v) })}
      />
      <div className="field-row">
        <label className="check-inline">
          <input type="checkbox" checked={slot.autoSize} onChange={(e) => update(`${path}.autoSize`, e.target.checked)} />
          Auto-size slot body from loading
        </label>
        {slot.autoSize && computed && (
          <button type="button" className="btn small ghost" title="Copy the computed dimensions into manual mode" onClick={() => update(path, { ...slot, autoSize: false, params: { ...computed } })}>
            Freeze
          </button>
        )}
      </div>
      {shape.params.map((p) => {
        const editable = p.role === 'fixed' || !slot.autoSize;
        const v = (slot.autoSize && computed ? computed[p.key] : slot.params[p.key]) ?? p.def;
        return editable ? (
          <NumberField
            key={p.key}
            label={p.label}
            symbol={p.symbol}
            unit="mm"
            value={slot.params[p.key] ?? p.def}
            min={p.min ?? 0}
            onChange={(x) => update(`${path}.params`, { ...slot.params, [p.key]: x })}
          />
        ) : (
          <ReadField key={p.key} label={p.label} symbol={p.symbol} value={fmt(v, 2)} unit="mm" />
        );
      })}
    </>
  );
}
