import { CONDUCTORS, STEELS, resistivity } from '../materials';
import { autoSizeSlot, fixedParams, shapeOf, slotMetrics } from '../slots';
import type { MachineSpec } from '../types';
import type { WindingLayout } from '../winding/layout';
import { carter } from './main';
import type { MainDimensions, StatorResult } from './result';

export interface FluxInputs {
  Bav: number; // average gap flux density (design)
  phi1Factor: number; // Φ1 / (Bav·τ·L)
  BgPeak: number; // peak gap flux density used for tooth sizing
  emfFactor: number; // E / Vph target
  fluxFixed: boolean; // PM machines: flux set by magnets (turns adapt EMF), else voltage sets flux
  magneticGapExtra: number; // m, added to the gap for Carter (magnet + sleeve in SPM)
}

/** Average coil span in slots from the coil list. */
export function averageSpan(layout: WindingLayout, Q: number): number {
  if (!layout.coils.length) return 1;
  let s = 0;
  for (const c of layout.coils) {
    const d = Math.abs(c.ret.slot - c.go.slot);
    s += Math.min(d, Q - d);
  }
  return s / layout.coils.length;
}

export function designStator(spec: MachineSpec, main: MainDimensions, layout: WindingLayout, kw1: number, flux: FluxInputs): StatorResult {
  const steel = STEELS[spec.steel];
  const Q = spec.winding.slots;
  const m = main.m;
  const a = Math.max(1, Math.round(spec.winding.parallelPaths));
  const layers = Math.max(1, layout.units); // turns units per slot (a double-turn layer counts twice)
  const kfe = spec.stackingFactor;
  const { D, L, tau, f } = main;
  const slotPitch = (Math.PI * D) / Q;

  // Turns from the EMF equation E = 4.44·f·Φ1·kw·N.
  const phiDesign = flux.Bav * tau * L;
  const phi1Design = flux.phi1Factor * phiDesign;
  const Etarget = flux.emfFactor * main.Vph;
  const NphTarget = Etarget / (4.44 * f * phi1Design * kw1);
  const ZsTarget = (2 * m * NphTarget * a) / Q;
  const zLayer = Math.max(1, Math.round(ZsTarget / layers));
  const Zs = zLayer * layers;
  const Nph = (Q * Zs) / (2 * m * a);
  const ratio = NphTarget / Nph;
  const Bav = flux.fluxFixed ? flux.Bav : flux.Bav * ratio;
  const BgPeak = flux.fluxFixed ? flux.BgPeak : flux.BgPeak * ratio;
  const phi = Bav * tau * L;
  const phi1 = flux.phi1Factor * phi;
  const E = 4.44 * f * phi1 * kw1 * Nph;
  const ac = (2 * m * Nph * main.Iph) / (Math.PI * D);

  // Conductors
  const conductorArea = main.Iph / (a * spec.currentDensity); // mm²
  const dMax = Math.max(0.2, spec.maxStrandDiameterMm);
  const strands = Math.max(1, Math.ceil(conductorArea / ((Math.PI * dMax * dMax) / 4)));
  const strandDiameter = Math.sqrt((4 * conductorArea) / (Math.PI * strands));
  const copperPerSlot = Zs * conductorArea;
  const targetArea = copperPerSlot / Math.max(0.05, spec.fillFactor);

  // Slot & teeth
  const toothWidth = (BgPeak * slotPitch) / (kfe * spec.BtoothMax); // m
  const shape = shapeOf(spec.statorSlot.shape);
  const ctx = { R: (D / 2) * 1000, Q, side: 'stator' as const, toothWidth: toothWidth * 1000, fixed: fixedParams(spec.statorSlot) };
  let params = { ...spec.statorSlot.params };
  let limited = false;
  if (spec.statorSlot.autoSize) {
    const r = autoSizeSlot(shape, ctx, targetArea);
    params = r.params;
    limited = r.limited;
  }
  const metrics = slotMetrics(shape, params, (D / 2) * 1000, Q, 'stator');
  const fill = copperPerSlot / Math.max(1e-9, metrics.conductorArea);
  const Btooth = (BgPeak * slotPitch) / (kfe * Math.max(1e-5, metrics.toothMin / 1000));
  const BtoothMean = (BgPeak * slotPitch) / (kfe * Math.max(1e-5, metrics.toothMean / 1000));
  const depth = metrics.depth / 1000;

  // Yoke carries half the pole flux.
  const yoke = phi / (2 * kfe * L * spec.ByokeMax);
  const Byoke = spec.ByokeMax;
  const Do = D + 2 * (depth + yoke);

  const slotOpening = metrics.opening / 1000;
  const kC = carter(slotPitch, slotOpening, main.airgap + flux.magneticGapExtra);

  // End winding and resistance
  const span = averageSpan(layout, Q);
  const spanArc = span * ((Math.PI * (D + depth)) / Q);
  const straight = 0.012 + 0.2 * depth;
  const endWinding = (Math.PI * spanArc) / 2 + 2 * straight;
  const overhang = straight + 0.4 * spanArc;
  const lmt = 2 * (L + endWinding);
  const rho = resistivity('copper', spec.copperTempC);
  const Rph = (rho * Nph * lmt) / (a * conductorArea * 1e-6);
  const copperMass = m * Nph * a * lmt * conductorArea * 1e-6 * CONDUCTORS.copper.density;

  const annulus = (Math.PI / 4) * ((D + 2 * depth) ** 2 - D * D);
  const teethArea = annulus - (Q * metrics.outlineArea) / 1e6;
  const teethMass = teethArea * L * kfe * steel.density;
  const yokeMass = (Math.PI / 4) * (Do * Do - (D + 2 * depth) ** 2) * L * kfe * steel.density;

  return {
    Q,
    slotPitch,
    Nph,
    NphTarget,
    Zs,
    zLayer,
    a,
    Bav,
    ac,
    phi,
    phi1,
    BgPeak,
    E,
    conductorArea,
    strands,
    strandDiameter,
    copperPerSlot,
    slot: { shape: shape.id, params, metrics, targetArea, limited },
    fill,
    toothWidth,
    Btooth,
    BtoothMean,
    yoke,
    Byoke,
    Do,
    carter: kC,
    slotOpening,
    avgCoilSpan: span,
    endWinding,
    overhang,
    lmt,
    Rph,
    copperMass,
    teethMass,
    yokeMass,
  };
}
