import { defaultSlotSpec } from './slots';
import type { MachineSpec, MachineTopology } from './types';
import { defaultPairs, defaultPitch } from './winding/layout';

/** A complete default specification (15 kW, 4-pole, 400 V, 50 Hz induction motor). */
export function baseSpec(): MachineSpec {
  return {
    name: '15 kW IE4 industrial induction motor',
    topology: 'induction',
    powerKw: 15,
    voltageV: 400,
    frequencyHz: 50,
    connection: 'delta',
    targetEfficiency: 90.5,
    targetPowerFactor: 0.88,
    maxSpeedRatio: 2,
    overloadRatio: 1.5,
    Bav: 0.46,
    ac: 28000,
    aspectRatio: 1.25,
    sizingMode: 'd2l',
    boreDiameterMm: 170,
    stackLengthMm: 160,
    airgapMm: 0,
    stackingFactor: 0.96,
    winding: {
      slots: 36,
      poles: 4,
      phases: 3,
      layers: 2,
      coilPitch: 8,
      pairs: defaultPairs(4, 8),
      parallelPaths: 1,
      arrangement: 'radial',
      skewSlots: 0,
      custom: null,
    },
    statorSlot: { ...defaultSlotSpec('trap_round'), params: { b0: 3, h0: 1, h1: 1.5, b1: 6, h2: 18, r2: 4 } },
    currentDensity: 5,
    fillFactor: 0.42,
    maxStrandDiameterMm: 1.25,
    copperTempC: 115,
    BtoothMax: 1.75,
    ByokeMax: 1.5,
    BrotorYokeMax: 1.5,
    steel: 'M400-50A',
    induction: {
      rotorType: 'cage',
      rotorSlots: 0,
      barMaterial: 'aluminum',
      barCurrentDensity: 3.5,
      ringCurrentDensity: 3.0,
      rotorSlot: { ...defaultSlotSpec('round_both'), params: { b0: 1.5, h0: 0.8, r1: 3, r2: 1.5, h2: 15 } },
      slipRingVoltage: 300,
      rotorFillFactor: 0.4,
    },
    pm: {
      remanence: 1.2,
      relPermeability: 1.05,
      magnetThicknessMm: 0,
      poleArcRatio: 0.8,
      sleeveMm: 0,
      ipmLayout: 'v',
      vAngleDeg: 120,
      bridgeMm: 1.0,
      saliency: 2.2,
      emfRatio: 0.9,
    },
    woundField: {
      poleType: 'salient',
      poleArcRatio: 0.68,
      fieldVoltage: 110,
      fieldCurrentDensity: 3,
      fieldFillFactor: 0.6,
      poleFluxDensity: 1.5,
      rotorSlots: 0,
      rotorSlot: { ...defaultSlotSpec('rect_open'), params: { bs: 10, hw: 3, hs: 35 } },
    },
  };
}

/** Sensible loadings & slot choices when the user switches topology. */
export function topologyDefaults(spec: MachineSpec, topology: MachineTopology): MachineSpec {
  const s: MachineSpec = { ...spec, topology };
  switch (topology) {
    case 'induction':
      return { ...s, Bav: 0.46, ac: 28000, targetPowerFactor: 0.88, airgapMm: 0 };
    case 'pmsm_spm':
      return { ...s, Bav: 0.65, ac: 30000, targetPowerFactor: 0.92, airgapMm: 0 };
    case 'pmsm_ipm':
      return { ...s, Bav: 0.6, ac: 35000, targetPowerFactor: 0.88, airgapMm: 0 };
    case 'wound_field':
      return { ...s, Bav: 0.58, ac: 32000, targetPowerFactor: 0.95, airgapMm: 0 };
  }
}

export function withSlotPole(spec: MachineSpec, slots: number, poles: number): MachineSpec {
  const pitch = defaultPitch(slots, poles);
  return {
    ...spec,
    winding: { ...spec.winding, slots, poles, coilPitch: pitch, pairs: defaultPairs(Math.max(4, spec.winding.layers), pitch), custom: null },
  };
}
