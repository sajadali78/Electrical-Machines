import { baseSpec, withSlotPole } from './defaults';
import { defaultSlotSpec } from './slots';
import type { MachineSpec } from './types';
import { defaultLayerDefs } from './winding/layout';

export interface Preset {
  id: string;
  label: string;
  description: string;
  build: () => MachineSpec;
}

export const PRESETS: Preset[] = [
  {
    id: 'im15',
    label: '15 kW IE4 induction (4p, 36/28)',
    description: '400 V Δ, 50 Hz, die-cast aluminium cage, double-layer 7/9 chorded winding.',
    build: baseSpec,
  },
  {
    id: 'im110-wound',
    label: '110 kW wound-rotor induction (6p)',
    description: '690 V, 50 Hz slip-ring motor with open slots and form-wound coils.',
    build: () => {
      const s = withSlotPole(baseSpec(), 54, 6);
      return {
        ...s,
        name: '110 kW wound-rotor induction motor',
        powerKw: 110,
        voltageV: 690,
        connection: 'star',
        targetEfficiency: 95,
        targetPowerFactor: 0.86,
        Bav: 0.5,
        ac: 36000,
        aspectRatio: 1.4,
        winding: { ...s.winding, coilPitch: 8 },
        statorSlot: { ...defaultSlotSpec('rect_open'), params: { bs: 10, hw: 4, hs: 40 } },
        currentDensity: 4.5,
        fillFactor: 0.5,
        maxStrandDiameterMm: 2.5,
        induction: { ...s.induction, rotorType: 'wound', rotorSlot: { ...defaultSlotSpec('trap_semi'), params: { b0: 4, h0: 1, h1: 2, b1: 9, b2: 7, h2: 30 } }, slipRingVoltage: 500, rotorFillFactor: 0.45 },
      };
    },
  },
  {
    id: 'ipm80',
    label: '80 kW EV traction IPM (8p, 48 slots)',
    description: 'V-shaped NdFeB magnets, hairpin-like open semi-closed slots, 4000 rpm base, 3× field weakening.',
    build: () => {
      const s = withSlotPole(baseSpec(), 48, 8);
      return {
        ...s,
        name: '80 kW EV traction IPM motor',
        topology: 'pmsm_ipm',
        powerKw: 80,
        voltageV: 400,
        frequencyHz: 266.67,
        connection: 'star',
        targetEfficiency: 96,
        targetPowerFactor: 0.88,
        maxSpeedRatio: 2.5,
        overloadRatio: 2.2,
        Bav: 0.6,
        ac: 45000,
        aspectRatio: 2.0,
        winding: { ...s.winding, coilPitch: 5, parallelPaths: 2, layerDefs: defaultLayerDefs(4, 5, 48, 8) },
        statorSlot: { ...defaultSlotSpec('rect_semi'), params: { b0: 2.5, h0: 1, h1: 1, bs: 5, hs: 20 } },
        currentDensity: 6.5,
        fillFactor: 0.5,
        maxStrandDiameterMm: 0.9,
        copperTempC: 140,
        steel: 'NO20',
        BtoothMax: 1.8,
        pm: { ...s.pm, remanence: 1.25, poleArcRatio: 0.78, ipmLayout: 'v', vAngleDeg: 125, bridgeMm: 1.2, saliency: 2.4, emfRatio: 0.85 },
      };
    },
  },
  {
    id: 'spm3',
    label: '3 kW servo SPM (12s/10p tooth coils)',
    description: 'Fractional-slot concentrated winding, q = 2/5, surface NdFeB magnets.',
    build: () => {
      const s = withSlotPole(baseSpec(), 12, 10);
      return {
        ...s,
        name: '3 kW servo SPM motor',
        topology: 'pmsm_spm',
        powerKw: 3,
        voltageV: 400,
        frequencyHz: 250,
        connection: 'star',
        targetEfficiency: 93,
        targetPowerFactor: 0.93,
        maxSpeedRatio: 1.5,
        Bav: 0.62,
        ac: 30000,
        aspectRatio: 2.4,
        winding: { ...s.winding, coilPitch: 1, arrangement: 'tangential' },
        statorSlot: { ...defaultSlotSpec('trap_semi'), params: { b0: 2, h0: 1, h1: 1.5, b1: 8, b2: 12, h2: 15 } },
        currentDensity: 6,
        fillFactor: 0.45,
        maxStrandDiameterMm: 1.0,
        pm: { ...s.pm, remanence: 1.2, poleArcRatio: 0.83, sleeveMm: 0, emfRatio: 0.92 },
      };
    },
  },
  {
    id: 'wf50',
    label: '50 kW salient-pole synchronous (8p)',
    description: 'Wound-field salient-pole machine, 400 V, 50 Hz, brush excitation at 110 V dc.',
    build: () => {
      const s = withSlotPole(baseSpec(), 72, 8);
      return {
        ...s,
        name: '50 kW salient-pole synchronous machine',
        topology: 'wound_field',
        powerKw: 50,
        voltageV: 400,
        connection: 'star',
        targetEfficiency: 94,
        targetPowerFactor: 0.95,
        maxSpeedRatio: 1.5,
        Bav: 0.58,
        ac: 32000,
        aspectRatio: 1.0,
        winding: { ...s.winding, coilPitch: 8 },
        statorSlot: { ...defaultSlotSpec('rect_semi'), params: { b0: 3, h0: 1, h1: 2, bs: 7, hs: 25 } },
      };
    },
  },
  {
    id: 'multi12-10',
    label: '12s/10p four-layer SPM (sub-harmonic reduction)',
    description: 'Two double-layer systems shifted by 5 slots (one star step); sub-harmonic MMF reduced ≈ 73 %.',
    build: () => {
      const b = PRESETS[3].build();
      return {
        ...b,
        name: '12s/10p four-layer winding demo',
        winding: {
          ...b.winding,
          layers: 4,
          arrangement: 'radial',
          layerDefs: [
            { shift: 0, sign: 1 },
            { shift: 1, sign: -1 },
            { shift: 5, sign: 1 },
            { shift: 6, sign: -1 },
          ],
        },
      };
    },
  },
];
