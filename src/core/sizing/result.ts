import type { SlotMetrics } from '../slots';
import type { MachineSpec, SlotShapeId, WindingMatrix } from '../types';
import type { WindingAnalysis } from '../winding/analysis';
import type { WindingLayout } from '../winding/layout';

export interface MainDimensions {
  m: number;
  poles: number;
  p: number;
  f: number;
  nsRpm: number;
  nsRps: number;
  Pout: number; // W
  Sin: number; // VA
  Vph: number;
  Iph: number; // design phase current (from assumed η, cosφ)
  Iline: number;
  C0: number; // kVA·s/m³ (output coefficient per rps)
  D2L: number; // m³
  D: number; // bore diameter
  L: number; // stack length
  tau: number; // pole pitch at the bore
  aspectRatio: number; // L/τ actual
  peripheralSpeed: number; // m/s at synchronous speed
  airgap: number; // m
  airgapAuto: boolean;
}

export interface SlotResult {
  shape: SlotShapeId;
  params: Record<string, number>; // mm
  metrics: SlotMetrics;
  targetArea: number; // mm²
  limited: boolean;
}

export interface StatorResult {
  Q: number;
  slotPitch: number; // m at bore
  Nph: number; // series turns per phase
  NphTarget: number;
  Zs: number; // conductors per slot
  zLayer: number; // conductors (turns) per coil side per layer
  a: number;
  Bav: number; // actual
  ac: number; // actual A/m
  phi: number; // average flux per pole [Wb]
  phi1: number; // fundamental flux per pole [Wb]
  BgPeak: number; // design peak air-gap flux density for tooth sizing
  E: number; // induced phase EMF at rated speed [V rms]
  conductorArea: number; // mm² per conductor
  strands: number;
  strandDiameter: number; // mm
  copperPerSlot: number; // mm²
  slot: SlotResult;
  fill: number; // actual copper fill of the conductor region
  toothWidth: number; // m (target)
  Btooth: number; // peak at minimum width
  BtoothMean: number;
  yoke: number; // m
  Byoke: number;
  Do: number; // m
  carter: number;
  slotOpening: number; // m
  avgCoilSpan: number; // slots
  endWinding: number; // m, per end (conductor length)
  overhang: number; // m, axial end-winding extension
  lmt: number; // mean turn length [m]
  Rph: number; // Ω at operating temperature
  copperMass: number;
  teethMass: number;
  yokeMass: number;
}

export interface InductionRotorResult {
  kind: 'induction';
  rotorType: 'cage' | 'wound';
  Qr: number;
  QrAuto: boolean;
  comboWarnings: string[];
  Dr: number; // rotor outer diameter
  Di: number; // rotor core inner diameter (= shaft)
  shaftMin: number;
  barCurrent: number; // A (cage) / rotor phase current (wound)
  barArea: number; // mm² required
  ringCurrent: number;
  ringArea: number; // mm²
  ringHeight: number; // m radial
  ringWidth: number; // m axial
  ringMeanD: number;
  slot: SlotResult;
  toothWidth: number;
  Btooth: number;
  yoke: number;
  Byoke: number;
  carter: number;
  R2: number; // referred rotor resistance per phase [Ω]
  L2: number; // referred rotor leakage inductance [H]
  conductorMass: number;
  teethMass: number;
  yokeMass: number;
  // wound rotor
  N2?: number;
  kw2?: number;
  rotorLayout?: WindingMatrix;
}

export interface PmRotorResult {
  kind: 'pm';
  layout: 'spm' | 'ipm-v' | 'ipm-bar';
  hm: number; // m
  hmAuto: boolean;
  wm: number; // magnet width per piece [m] (arc length for SPM)
  magnetsPerPole: number;
  poleArc: number;
  sleeve: number;
  Bg: number; // flat-top gap flux density
  B1: number; // fundamental peak
  Bm: number; // magnet working point
  demagMargin: number; // (Bm - Bknee)/Br, knee ≈ 0.1 T assumed
  Dr: number; // rotor outer diameter (incl. magnets/sleeve)
  coreOuterR: number; // radius of the iron under SPM magnets
  Di: number;
  shaftMin: number;
  apexDepth: number; // IPM: radial depth of the V apex below the rotor surface [m]
  vAngle: number; // rad
  bridge: number; // m
  geometryLimited: boolean;
  yoke: number;
  Byoke: number;
  psiM: number; // peak flux linkage [Wb]
  E0: number; // rms back EMF at rated speed
  magnetVolume: number;
  magnetMass: number;
  ironMass: number;
}

export interface WoundFieldRotorResult {
  kind: 'wound_field';
  poleType: 'salient' | 'cylindrical';
  poleArc: number;
  Dr: number;
  Di: number;
  shaftMin: number;
  poleBodyWidth: number;
  poleBodyHeight: number;
  poleShoeHeight: number;
  coilWidth: number;
  coilHeight: number;
  fieldATnoLoad: number;
  fieldATrated: number;
  fieldTurnsPerPole: number;
  fieldCurrent: number;
  fieldConductorArea: number; // mm²
  fieldResistance: number;
  fieldLoss: number;
  fieldCopperMass: number;
  E0: number;
  psiF: number; // peak flux linkage at rated field
  Qr: number; // cylindrical: rotor slot count (virtual pitch incl. unwound)
  woundSlotsPerPole: number;
  coreLimited: boolean;
  slot: SlotResult | null; // cylindrical rotor slot
  yoke: number;
  Byoke: number;
  ironMass: number;
}

export type RotorResult = InductionRotorResult | PmRotorResult | WoundFieldRotorResult;

export interface ElectricalParams {
  R1: number;
  Lm: number; // saturated magnetizing (d-axis for synchronous)
  ksat: number;
  carterTotal: number;
  airgapEff: number;
  Lslot: number;
  Lend: number;
  Ldiff: number;
  Lsigma: number;
  Ld: number;
  Lq: number;
  X1: number;
  Xm: number;
  slotPermeance: number;
  fieldAT: { gap: number; statorTeeth: number; rotorTeeth: number; statorYoke: number; rotorYoke: number };
}

export interface LossBreakdown {
  statorCopper: number;
  rotorCopper: number; // rotor bars/winding or field winding
  statorIronTeeth: number;
  statorIronYoke: number;
  rotorIron: number;
  mechanical: number;
  stray: number;
  total: number;
  Pin: number;
  Pout: number;
  efficiency: number; // 0..1
}

export interface OperatingPoint {
  speedRpm: number;
  slip: number | null;
  torque: number;
  current: number; // phase rms
  powerFactor: number;
  efficiency: number;
  Pout: number;
  voltage: number; // phase rms
  id?: number; // peak d current
  iq?: number;
}

export interface CurvePoint {
  speedRpm: number;
  torque: number;
  power: number;
  current: number;
  efficiency: number;
  powerFactor: number;
}

export interface EfficiencyMap {
  speeds: number[]; // rpm
  torques: number[]; // N·m
  eff: (number | null)[][]; // [torque][speed]
}

export interface Performance {
  rated: OperatingPoint;
  startTorque: number | null;
  startCurrent: number | null;
  maxTorque: number;
  maxTorqueSpeed: number;
  lineCurve: CurvePoint[] | null; // fixed-frequency (IM / synchronous load angle) curve
  envelope: CurvePoint[]; // inverter-fed capability
  map: EfficiencyMap | null;
  baseSpeed: number;
  maxSpeed: number;
  loadAngleCurve: { deltaDeg: number; torque: number }[] | null; // synchronous machines at rated V, f
  notes: string[];
}

export interface Masses {
  statorIron: number;
  rotorIron: number;
  statorCopper: number;
  rotorConductor: number;
  magnet: number;
  total: number;
  cost: number;
}

export type CheckStatus = 'ok' | 'warn' | 'error';

export interface DesignCheck {
  id: string;
  label: string;
  status: CheckStatus;
  value: string;
  limit: string;
  hint?: string;
}

export interface DesignResult {
  spec: MachineSpec;
  main: MainDimensions;
  layout: WindingLayout;
  winding: WindingAnalysis;
  stator: StatorResult;
  rotor: RotorResult;
  electrical: ElectricalParams;
  losses: LossBreakdown;
  performance: Performance;
  masses: Masses;
  checks: DesignCheck[];
  shear: number; // tangential stress at rated torque [Pa]
  trv: number; // torque per rotor volume [N·m/m³]
  torqueRated: number; // required at rated speed
  ratedSpeedRpm: number;
}
