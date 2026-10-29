import type { DesignResult } from '../../core/sizing/result';
import { phaseName } from '../../core/winding/phases';
import { fmt } from '../../ui/format';

export interface InspectInfo {
  title: string;
  rows: [string, string][];
}

const mmv = (m: number, d = 2) => `${fmt(m * 1000, d)} mm`;

/** Classify a point (mm, screen coordinates) in the cross-section by radius and angle. */
export function classify(r: DesignResult, x: number, y: number): string | null {
  const rad = Math.hypot(x, y) / 1000;
  const th = Math.atan2(-y, x);
  const st = r.stator;
  const Rs = r.main.D / 2;
  const depth = st.slot.metrics.depth / 1000;
  const Q = st.Q;
  const idx = (n: number, offset = 0) => {
    const k = ((Math.PI / 2 - th) / (2 * Math.PI)) * n + offset;
    return ((Math.round(k) % n) + n) % n;
  };
  if (rad > st.Do / 2) return null;
  if (rad > Rs + depth) return 'stator-yoke';
  if (rad >= Rs) return `stator-tooth:${idx(Q, 0.5)}`;
  const rot = r.rotor;
  const Dr = rot.Dr;
  if (rad >= Dr / 2) return 'airgap';
  const Di = rot.Di;
  if (rad < Di / 2) return 'shaft';
  if (rot.kind === 'induction') {
    const d = rot.slot.metrics.depth / 1000;
    return rad > Dr / 2 - d ? `rotor-tooth:${idx(rot.Qr, 0.5)}` : 'rotor-yoke';
  }
  if (rot.kind === 'pm') return 'rotor-core';
  return rot.poleType === 'salient' ? 'rotor-hub' : 'rotor-core';
}

export function inspect(r: DesignResult, key: string): InspectInfo | null {
  const [kind, idxs] = key.split(':');
  const i = Number(idxs ?? 0);
  const st = r.stator;
  const rot = r.rotor;
  const e = r.electrical;
  switch (kind) {
    case 'stator-slot': {
      const cells = r.layout.matrix.map((row, l) => {
        const c = row[i];
        return [`Layer ${l + 1}`, c && c.sign ? `${phaseName(c.phase)}${c.sign > 0 ? '+' : '−'}` : 'empty'] as [string, string];
      });
      return {
        title: `Stator slot ${i + 1}`,
        rows: [
          ...cells,
          ['Conductors / slot', `${st.Zs}`],
          ['Turns / coil side', `${st.zLayer}`],
          ['Conductor area', `${fmt(st.conductorArea, 2)} mm²`],
          ['Strands', `${st.strands} × Ø${fmt(st.strandDiameter, 3)} mm`],
          ['Slot winding area', `${fmt(st.slot.metrics.conductorArea, 1)} mm²`],
          ['Fill factor', fmt(st.fill, 3)],
          ['Depth', `${fmt(st.slot.metrics.depth, 2)} mm`],
        ],
      };
    }
    case 'stator-tooth':
      return {
        title: `Stator tooth ${i + 1}`,
        rows: [
          ['Min / mean width', `${fmt(st.slot.metrics.toothMin, 2)} / ${fmt(st.slot.metrics.toothMean, 2)} mm`],
          ['B tooth peak', `${fmt(st.Btooth, 2)} T`],
          ['B tooth mean', `${fmt(st.BtoothMean, 2)} T`],
          ['Slot pitch (bore)', mmv(st.slotPitch)],
          ['Tooth height', `${fmt(st.slot.metrics.depth, 2)} mm`],
        ],
      };
    case 'stator-yoke':
      return {
        title: 'Stator yoke',
        rows: [
          ['Yoke depth h_ys', mmv(st.yoke)],
          ['B yoke', `${fmt(st.Byoke, 2)} T`],
          ['Outer diameter', mmv(st.Do, 1)],
          ['Flux per pole Φ', `${fmt(st.phi * 1000, 3)} mWb`],
        ],
      };
    case 'airgap':
      return {
        title: 'Air gap',
        rows: [
          ['Mechanical gap g', mmv(r.main.airgap)],
          ['Carter factor k_C', fmt(e.carterTotal, 3)],
          ['Saturation factor k_sat', fmt(e.ksat, 3)],
          ['Effective gap δ_ef', mmv(e.airgapEff, 3)],
          ['Peak gap flux density', `${fmt(st.BgPeak, 3)} T`],
          ['Average B_av', `${fmt(st.Bav, 3)} T`],
        ],
      };
    case 'shaft':
      return { title: 'Shaft', rows: [['Rotor core bore', mmv(rot.Di, 1)], ['Min. shaft Ø (35 MPa)', mmv(rot.shaftMin, 1)], ['Rated torque', `${fmt(r.torqueRated, 1)} N·m`]] };
    case 'rotor-bar':
      if (rot.kind !== 'induction') return null;
      return {
        title: rot.rotorType === 'cage' ? `Rotor bar ${i + 1}` : `Rotor slot ${i + 1}`,
        rows:
          rot.rotorType === 'cage'
            ? [
                ['Bar current', `${fmt(rot.barCurrent, 1)} A`],
                ['Bar area', `${fmt(rot.slot.metrics.conductorArea, 1)} mm²`],
                ['Bar current density', `${fmt(rot.barCurrent / rot.slot.metrics.conductorArea, 2)} A/mm²`],
                ['End-ring current', `${fmt(rot.ringCurrent, 0)} A`],
                ['End-ring section', `${fmt(rot.ringArea, 0)} mm²`],
              ]
            : [
                ['Rotor turns / phase', fmt(rot.N2 ?? 0, 0)],
                ['Rotor current', `${fmt(rot.barCurrent, 1)} A`],
                ['Rotor k_w1', fmt(rot.kw2 ?? 0, 3)],
              ],
      };
    case 'rotor-tooth':
      if (rot.kind !== 'induction') return null;
      return { title: `Rotor tooth ${i + 1}`, rows: [['Min width', `${fmt(rot.slot.metrics.toothMin, 2)} mm`], ['B tooth peak', `${fmt(rot.Btooth, 2)} T`]] };
    case 'rotor-yoke':
    case 'rotor-core':
    case 'rotor-hub':
      return { title: 'Rotor yoke', rows: [['Yoke depth', mmv((rot as { yoke: number }).yoke)], ['B yoke', `${fmt((rot as { Byoke: number }).Byoke, 2)} T`], ['Rotor outer Ø', mmv(rot.Dr, 1)]] };
    case 'magnet':
      if (rot.kind !== 'pm') return null;
      return {
        title: `Magnet, pole ${i + 1} (${i % 2 === 0 ? 'N' : 'S'})`,
        rows: [
          ['Thickness h_m', mmv(rot.hm)],
          ['Width w_m', mmv(rot.wm)],
          ['Remanence B_r', `${fmt(r.spec.pm.remanence, 2)} T`],
          ['Gap flux B_g', `${fmt(rot.Bg, 3)} T`],
          ['Working point B_m', `${fmt(rot.Bm, 3)} T`],
          ['Total magnet mass', `${fmt(rot.magnetMass, 3)} kg`],
        ],
      };
    case 'pole':
      if (rot.kind !== 'wound_field') return null;
      return {
        title: `Salient pole ${i + 1}`,
        rows: [
          ['Body width b_p', mmv(rot.poleBodyWidth)],
          ['Body height h_p', mmv(rot.poleBodyHeight)],
          ['Shoe height', mmv(rot.poleShoeHeight)],
          ['Pole arc ratio ψ', fmt(rot.poleArc, 2)],
        ],
      };
    case 'field-coil':
      if (rot.kind !== 'wound_field') return null;
      return {
        title: 'Field coil',
        rows: [
          ['Turns / pole', fmt(rot.fieldTurnsPerPole, 1)],
          ['Field current', `${fmt(rot.fieldCurrent, 2)} A`],
          ['Conductor area', `${fmt(rot.fieldConductorArea, 2)} mm²`],
          ['Rated field MMF', `${fmt(rot.fieldATrated, 0)} A·t`],
          ['Field loss', `${fmt(rot.fieldLoss, 0)} W`],
        ],
      };
    case 'rotor-slot':
      return { title: `Rotor slot ${i + 1}`, rows: [] };
    default:
      return null;
  }
}
