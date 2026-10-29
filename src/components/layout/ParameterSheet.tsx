import { STEELS } from '../../core/materials';
import type { SteelGrade } from '../../core/types';
import { useDesign } from '../../state/store';
import { fmt, mm } from '../../ui/format';
import { Group } from '../inputs/Group';
import { NumberField, ReadField } from '../inputs/NumberField';
import { SelectField } from '../inputs/SelectField';
import { SlotEditor } from '../inputs/SlotEditor';

export function ParameterSheet() {
  const { spec, update, result } = useDesign();
  const w = spec.winding;
  const r = result;
  const set = (path: string) => (v: unknown) => update(path, v);

  return (
    <div>
      <Group title="Rating">
        <NumberField label="Rated output power" symbol="Pₙ" unit="kW" value={spec.powerKw} min={0.01} onChange={set('powerKw')} />
        <NumberField label="Rated line voltage" symbol="Vₙ" unit="V" value={spec.voltageV} min={1} onChange={set('voltageV')} />
        <NumberField label="Supply frequency" symbol="f" unit="Hz" value={spec.frequencyHz} min={0.1} onChange={set('frequencyHz')} />
        <SelectField
          label="Connection"
          value={spec.connection}
          options={[
            { value: 'star', label: 'Star (Y)' },
            { value: 'delta', label: 'Delta (Δ)' },
          ]}
          onChange={set('connection')}
        />
        <NumberField label="Assumed efficiency" symbol="η" unit="%" value={spec.targetEfficiency} min={30} max={99.9} onChange={set('targetEfficiency')} />
        <NumberField label="Assumed power factor" symbol="cos φ" unit="" value={spec.targetPowerFactor} min={0.3} max={1} step={0.01} onChange={set('targetPowerFactor')} />
        <NumberField label="Max speed / rated speed" symbol="n_max/nₙ" unit="×" value={spec.maxSpeedRatio} min={1} max={6} step={0.1} onChange={set('maxSpeedRatio')} />
        <NumberField label="Peak / rated current" symbol="I_max/Iₙ" unit="×" value={spec.overloadRatio} min={1} max={5} step={0.1} onChange={set('overloadRatio')} />
        {r && <ReadField label="Synchronous speed" symbol="n_s = 60f/p" value={fmt(r.main.nsRpm, 0)} unit="rpm" />}
      </Group>

      <Group title="Loadings & main dimensions">
        <NumberField label="Specific magnetic loading" symbol="B_av" unit="T" value={spec.Bav} min={0.1} max={1.2} slider={{ min: 0.3, max: 0.9, step: 0.005 }} onChange={set('Bav')} />
        <NumberField label="Specific electric loading" symbol="ac" unit="A/m" value={spec.ac} min={1000} slider={{ min: 10000, max: 70000, step: 500 }} onChange={set('ac')} />
        <SelectField
          label="Sizing mode"
          value={spec.sizingMode}
          options={[
            { value: 'd2l', label: 'D²L output equation' },
            { value: 'manual', label: 'Manual D and L' },
          ]}
          onChange={set('sizingMode')}
        />
        {spec.sizingMode === 'd2l' ? (
          <NumberField label="Aspect ratio" symbol="λ = L/τ" unit="" value={spec.aspectRatio} min={0.1} slider={{ min: 0.4, max: 3.5, step: 0.01 }} onChange={set('aspectRatio')} />
        ) : (
          <>
            <NumberField label="Bore diameter" symbol="D" unit="mm" value={spec.boreDiameterMm} min={5} onChange={set('boreDiameterMm')} />
            <NumberField label="Stack length" symbol="L" unit="mm" value={spec.stackLengthMm} min={1} onChange={set('stackLengthMm')} />
          </>
        )}
        <NumberField label="Air gap (0 = empirical)" symbol="g" unit="mm" value={spec.airgapMm} min={0} step={0.05} onChange={set('airgapMm')} />
        <NumberField label="Stacking factor" symbol="k_fe" unit="" value={spec.stackingFactor} min={0.8} max={1} step={0.01} onChange={set('stackingFactor')} />
        {r && (
          <>
            <ReadField label="Output coefficient" symbol="C₀" value={fmt(r.main.C0, 1)} unit="kVA·s/m³" />
            <ReadField label="D²L" symbol="D²L" value={fmt(r.main.D2L * 1e3, 3)} unit="dm³" />
            <ReadField label="Bore diameter × length" symbol="D × L" value={`${mm(r.main.D)} × ${mm(r.main.L)}`} unit="mm" />
            <ReadField label="Air gap" symbol={r.main.airgapAuto ? 'g (auto)' : 'g'} value={fmt(r.main.airgap * 1000, 2)} unit="mm" />
          </>
        )}
      </Group>

      <Group title="Stator winding">
        <NumberField label="Stator slots" symbol="Q" unit="" integer value={w.slots} min={3} max={240} onChange={set('winding.slots')} />
        <NumberField label="Poles" symbol="2p" unit="" integer value={w.poles} min={2} max={200} step={2} onChange={set('winding.poles')} />
        <NumberField label="Phases" symbol="m" unit="" integer value={w.phases} min={1} max={9} onChange={set('winding.phases')} />
        <SelectField
          label="Layers"
          value={w.layers}
          options={[1, 2, 4, 6, 8].map((n) => ({ value: n, label: n === 1 ? 'Single layer' : n === 2 ? 'Double layer' : `${n} layers` }))}
          onChange={set('winding.layers')}
        />
        <NumberField label="Coil pitch" symbol="y (slots)" unit="" integer value={w.coilPitch} min={1} max={w.slots - 1} onChange={set('winding.coilPitch')} />
        <NumberField label="Parallel paths" symbol="a" unit="" integer value={w.parallelPaths} min={1} onChange={set('winding.parallelPaths')} />
        <SelectField
          label="Layer arrangement"
          value={w.arrangement}
          options={[
            { value: 'radial', label: 'Stacked (radial)' },
            { value: 'tangential', label: 'Side by side' },
          ]}
          onChange={set('winding.arrangement')}
        />
        <NumberField label="Skew" symbol="slot pitches" unit="" value={w.skewSlots} min={0} max={3} step={0.1} onChange={set('winding.skewSlots')} />
        {r && (
          <>
            <ReadField label="Slots per pole per phase" symbol="q" value={r.winding.qLabel} />
            <ReadField label="Winding factor (fund.)" symbol="k_w1" value={fmt(r.winding.kw1 * r.winding.ksk1, 4)} />
            <ReadField label="Turns / phase · conductors / slot" symbol="N_ph · Z_s" value={`${fmt(r.stator.Nph, 1)} · ${r.stator.Zs}`} />
          </>
        )}
      </Group>

      <Group title="Stator slot & conductors">
        <SlotEditor path="statorSlot" slot={spec.statorSlot} usage="stator" computed={r?.stator.slot.params} />
        <NumberField label="Current density" symbol="J" unit="A/mm²" value={spec.currentDensity} min={0.5} slider={{ min: 2, max: 12, step: 0.1 }} onChange={set('currentDensity')} />
        <NumberField label="Slot fill factor" symbol="k_fill" unit="" value={spec.fillFactor} min={0.1} max={0.8} step={0.01} onChange={set('fillFactor')} />
        <NumberField label="Max strand diameter" symbol="d_max" unit="mm" value={spec.maxStrandDiameterMm} min={0.1} step={0.05} onChange={set('maxStrandDiameterMm')} />
        <NumberField label="Winding temperature" symbol="T_cu" unit="°C" value={spec.copperTempC} min={-40} max={250} onChange={set('copperTempC')} />
      </Group>

      <RotorGroup />

      <Group title="Steel & magnetic limits" open={false}>
        <SelectField label="Lamination steel" value={spec.steel} options={(Object.keys(STEELS) as SteelGrade[]).map((g) => ({ value: g, label: `${g} (${STEELS[g].thicknessMm} mm)` }))} onChange={set('steel')} />
        <NumberField label="Max tooth flux density" symbol="B_t,max" unit="T" value={spec.BtoothMax} min={0.5} max={2.3} step={0.05} onChange={set('BtoothMax')} />
        <NumberField label="Max stator yoke flux density" symbol="B_ys,max" unit="T" value={spec.ByokeMax} min={0.5} max={2.2} step={0.05} onChange={set('ByokeMax')} />
        <NumberField label="Max rotor yoke flux density" symbol="B_yr,max" unit="T" value={spec.BrotorYokeMax} min={0.5} max={2.2} step={0.05} onChange={set('BrotorYokeMax')} />
      </Group>
    </div>
  );
}

function RotorGroup() {
  const { spec, update, result } = useDesign();
  const set = (path: string) => (v: unknown) => update(path, v);
  const rr = result?.rotor;
  if (spec.topology === 'induction') {
    const im = spec.induction;
    return (
      <Group title="Rotor — induction">
        <SelectField
          label="Rotor type"
          value={im.rotorType}
          options={[
            { value: 'cage', label: 'Squirrel cage' },
            { value: 'wound', label: 'Wound (slip rings)' },
          ]}
          onChange={(v) => update('induction', { ...im, rotorType: v, rotorSlot: v === 'wound' ? { shape: 'trap_semi', autoSize: true, params: { b0: 3, h0: 1, h1: 1.5, b1: 8, b2: 6, h2: 25 } } : { shape: 'round_both', autoSize: true, params: { b0: 1.5, h0: 0.8, r1: 3, r2: 1.5, h2: 15 } } })}
        />
        <NumberField label="Rotor slots (0 = auto)" symbol="Q_r" unit="" integer value={im.rotorSlots} min={0} onChange={set('induction.rotorSlots')} />
        {rr?.kind === 'induction' && <ReadField label="Rotor slots used" symbol="Q_r" value={`${rr.Qr}${rr.QrAuto ? ' (auto)' : ''}`} />}
        {im.rotorType === 'cage' ? (
          <>
            <SelectField
              label="Bar & ring material"
              value={im.barMaterial}
              options={[
                { value: 'aluminum', label: 'Die-cast aluminium' },
                { value: 'copper', label: 'Copper' },
              ]}
              onChange={set('induction.barMaterial')}
            />
            <NumberField label="Bar current density" symbol="J_b" unit="A/mm²" value={im.barCurrentDensity} min={0.5} step={0.1} onChange={set('induction.barCurrentDensity')} />
            <NumberField label="End-ring current density" symbol="J_e" unit="A/mm²" value={im.ringCurrentDensity} min={0.5} step={0.1} onChange={set('induction.ringCurrentDensity')} />
            <SlotEditor path="induction.rotorSlot" slot={im.rotorSlot} usage="rotorCage" computed={rr?.kind === 'induction' ? rr.slot.params : undefined} />
          </>
        ) : (
          <>
            <NumberField label="Slip-ring voltage (standstill)" symbol="E₂,line" unit="V" value={im.slipRingVoltage} min={10} onChange={set('induction.slipRingVoltage')} />
            <NumberField label="Rotor slot fill factor" symbol="k_fill,r" unit="" value={im.rotorFillFactor} min={0.1} max={0.8} step={0.01} onChange={set('induction.rotorFillFactor')} />
            <SlotEditor path="induction.rotorSlot" slot={im.rotorSlot} usage="rotorWound" computed={rr?.kind === 'induction' ? rr.slot.params : undefined} />
          </>
        )}
      </Group>
    );
  }
  if (spec.topology === 'pmsm_spm' || spec.topology === 'pmsm_ipm') {
    const pm = spec.pm;
    const ipm = spec.topology === 'pmsm_ipm';
    return (
      <Group title={ipm ? 'Rotor — interior PM' : 'Rotor — surface PM'}>
        <NumberField label="Magnet remanence" symbol="B_r" unit="T" value={pm.remanence} min={0.2} max={1.6} step={0.01} onChange={set('pm.remanence')} />
        <NumberField label="Recoil permeability" symbol="μ_r" unit="" value={pm.relPermeability} min={1} max={1.5} step={0.01} onChange={set('pm.relPermeability')} />
        <NumberField label="Magnet thickness (0 = auto)" symbol="h_m" unit="mm" value={pm.magnetThicknessMm} min={0} step={0.1} onChange={set('pm.magnetThicknessMm')} />
        {rr?.kind === 'pm' && <ReadField label="Magnet thickness used" symbol="h_m" value={fmt(rr.hm * 1000, 2)} unit="mm" />}
        <NumberField label={ipm ? 'Pole embrace' : 'Magnet pole-arc ratio'} symbol="α_p" unit="" value={pm.poleArcRatio} min={0.3} max={0.98} step={0.01} onChange={set('pm.poleArcRatio')} />
        <NumberField label="Back-EMF / phase voltage" symbol="E₀/V_ph" unit="" value={pm.emfRatio} min={0.3} max={1.5} step={0.01} onChange={set('pm.emfRatio')} />
        {!ipm && <NumberField label="Retaining sleeve" symbol="t_sl" unit="mm" value={pm.sleeveMm} min={0} step={0.1} onChange={set('pm.sleeveMm')} />}
        {ipm && (
          <>
            <SelectField
              label="Magnet layout"
              value={pm.ipmLayout}
              options={[
                { value: 'v', label: 'V-shape (2 per pole)' },
                { value: 'bar', label: 'Single bar per pole' },
              ]}
              onChange={set('pm.ipmLayout')}
            />
            {pm.ipmLayout === 'v' && <NumberField label="V included angle" symbol="θ_V" unit="°" value={pm.vAngleDeg} min={40} max={178} onChange={set('pm.vAngleDeg')} />}
            <NumberField label="Bridge / rib thickness" symbol="t_b" unit="mm" value={pm.bridgeMm} min={0.2} step={0.1} onChange={set('pm.bridgeMm')} />
            <NumberField label="Saliency ratio" symbol="ξ = L_q/L_d" unit="" value={pm.saliency} min={1} max={6} step={0.05} onChange={set('pm.saliency')} />
            {rr?.kind === 'pm' && <ReadField label="Magnet width per piece" symbol="w_m" value={fmt(rr.wm * 1000, 2)} unit="mm" />}
          </>
        )}
      </Group>
    );
  }
  const wf = spec.woundField;
  return (
    <Group title="Rotor — wound field">
      <SelectField
        label="Pole type"
        value={wf.poleType}
        options={[
          { value: 'salient', label: 'Salient poles' },
          { value: 'cylindrical', label: 'Cylindrical (non-salient)' },
        ]}
        onChange={set('woundField.poleType')}
      />
      <NumberField label="Pole arc ratio" symbol="ψ" unit="" value={wf.poleArcRatio} min={0.4} max={0.9} step={0.01} onChange={set('woundField.poleArcRatio')} />
      <NumberField label="Field supply voltage" symbol="V_f" unit="V" value={wf.fieldVoltage} min={5} onChange={set('woundField.fieldVoltage')} />
      <NumberField label="Field current density" symbol="J_f" unit="A/mm²" value={wf.fieldCurrentDensity} min={0.5} step={0.1} onChange={set('woundField.fieldCurrentDensity')} />
      <NumberField label="Field coil fill factor" symbol="k_ff" unit="" value={wf.fieldFillFactor} min={0.2} max={0.9} step={0.01} onChange={set('woundField.fieldFillFactor')} />
      {wf.poleType === 'salient' ? (
        <NumberField label="Pole body flux density" symbol="B_p" unit="T" value={wf.poleFluxDensity} min={0.8} max={2} step={0.05} onChange={set('woundField.poleFluxDensity')} />
      ) : (
        <>
          <NumberField label="Rotor slots (0 = auto)" symbol="Q_r" unit="" integer value={wf.rotorSlots} min={0} onChange={set('woundField.rotorSlots')} />
          <SlotEditor path="woundField.rotorSlot" slot={wf.rotorSlot} usage="rotorWound" computed={rr?.kind === 'wound_field' && rr.slot ? rr.slot.params : undefined} />
        </>
      )}
    </Group>
  );
}
