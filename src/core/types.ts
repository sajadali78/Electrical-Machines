/**
 * Core data model. All engine outputs are in SI units (m, T, A, V, W, N·m, H, Ω)
 * unless a field name carries an explicit unit suffix (e.g. `...Mm`, `...Deg`).
 * Slot shape parameters are the exception: they are entered and stored in mm.
 */

export type MachineTopology = 'induction' | 'pmsm_spm' | 'pmsm_ipm' | 'wound_field';
export type Connection = 'star' | 'delta';
export type LayerArrangement = 'radial' | 'tangential';

/** One cell of the winding matrix: which phase occupies a layer of a slot, and its direction. */
export interface WindingCell {
  phase: number; // 0-based phase index (A=0, B=1, ...)
  sign: 1 | -1 | 0; // +1 go, -1 return, 0 empty
}

/** A matrix of cells, indexed [layer][slot]; layer 0 is closest to the air gap. */
export type WindingMatrix = WindingCell[][];

/** Parameters of one double-layer sub-winding in a multi-layer winding. */
export interface LayerPair {
  pitch: number; // coil pitch in slots
  shift: number; // star-of-slots sector offset, in phasor steps (2π·t/Q electrical each)
}

export interface WindingSpec {
  slots: number; // Q
  poles: number; // 2p
  phases: number; // m
  layers: number; // 1, 2, 4, 6, 8 for automatic layouts; any 1..8 for custom
  coilPitch: number; // y in slots (used by 1- and 2-layer windings and as default for pairs)
  pairs: LayerPair[]; // only used when layers >= 4 (length = layers / 2)
  parallelPaths: number; // a
  arrangement: LayerArrangement;
  skewSlots: number; // rotor/stator skew in slot pitches
  custom: WindingMatrix | null; // user-edited matrix overrides the generator when set
}

export type SlotShapeId =
  | 'rect_open'
  | 'rect_semi'
  | 'trap_semi'
  | 'trap_round'
  | 'round_both'
  | 'round'
  | 'rect_closed'
  | 'drop_closed'
  | 'double_cage';

export interface SlotSpec {
  shape: SlotShapeId;
  autoSize: boolean; // let the sizing engine compute the body dimensions
  params: Record<string, number>; // mm
}

export type SteelGrade = 'M270-35A' | 'M330-50A' | 'M400-50A' | 'M800-65A' | 'NO20';
export type ConductorMetal = 'copper' | 'aluminum';

export interface InductionSpec {
  rotorType: 'cage' | 'wound';
  rotorSlots: number; // 0 => automatic choice
  barMaterial: ConductorMetal;
  barCurrentDensity: number; // A/mm²
  ringCurrentDensity: number; // A/mm²
  rotorSlot: SlotSpec;
  slipRingVoltage: number; // V line, wound rotor only
  rotorFillFactor: number; // wound rotor only
}

export interface PmSpec {
  remanence: number; // Br [T]
  relPermeability: number; // μr
  magnetThicknessMm: number; // hm, 0 => automatic
  poleArcRatio: number; // αp (SPM) / pole embrace (IPM)
  sleeveMm: number; // retaining sleeve thickness (SPM)
  ipmLayout: 'v' | 'bar';
  vAngleDeg: number; // included angle between the two magnets of a V
  bridgeMm: number; // iron bridge thickness
  saliency: number; // ξ = Lq/Ld (IPM)
  emfRatio: number; // E0 / Vph target at rated speed
}

export interface WoundFieldSpec {
  poleType: 'salient' | 'cylindrical';
  poleArcRatio: number; // ψ
  fieldVoltage: number; // V dc
  fieldCurrentDensity: number; // A/mm²
  fieldFillFactor: number;
  poleFluxDensity: number; // T in the pole body
  rotorSlots: number; // cylindrical rotor only, 0 => auto
  rotorSlot: SlotSpec; // cylindrical rotor only
}

export interface MachineSpec {
  name: string;
  topology: MachineTopology;

  // Primary rating
  powerKw: number;
  voltageV: number; // line rms
  frequencyHz: number;
  connection: Connection;
  targetEfficiency: number; // %
  targetPowerFactor: number;
  maxSpeedRatio: number; // n_max / n_rated for torque–speed curves
  overloadRatio: number; // peak / rated current for the capability envelope and efficiency map

  // Specific loadings & main dimensions
  Bav: number; // T
  ac: number; // A/m
  aspectRatio: number; // L / τ
  sizingMode: 'd2l' | 'manual';
  boreDiameterMm: number; // manual mode
  stackLengthMm: number; // manual mode
  airgapMm: number; // 0 => automatic
  stackingFactor: number;

  // Stator winding & slot
  winding: WindingSpec;
  statorSlot: SlotSpec;
  currentDensity: number; // A/mm²
  fillFactor: number; // copper / slot winding area
  maxStrandDiameterMm: number;
  copperTempC: number;

  // Magnetic limits
  BtoothMax: number;
  ByokeMax: number;
  BrotorYokeMax: number;

  steel: SteelGrade;

  induction: InductionSpec;
  pm: PmSpec;
  woundField: WoundFieldSpec;
}
