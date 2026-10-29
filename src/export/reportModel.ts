import { shapeOf } from '../core/slots';
import type { DesignResult } from '../core/sizing/result';
import { phaseName } from '../core/winding/phases';
import { fmt, sig } from '../ui/format';

export interface ReportRow {
  label: string;
  symbol: string;
  value: string;
  unit: string;
  note?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  rows: ReportRow[];
}

const row = (label: string, symbol: string, value: string, unit = '', note?: string): ReportRow => ({ label, symbol, value, unit, note });
const mm = (m: number, d = 2) => fmt(m * 1000, d);

const TOPOLOGY: Record<string, string> = {
  induction: 'Induction machine',
  pmsm_spm: 'PMSM — surface magnets',
  pmsm_ipm: 'PMSM — interior magnets',
  wound_field: 'Wound-field synchronous',
};

/** All inputs and results as labelled tables (shared by the calculation sheet, CSV, PDF and Sheets). */
export function buildReport(r: DesignResult): ReportSection[] {
  const s = r.spec;
  const m = r.main;
  const st = r.stator;
  const w = r.winding;
  const e = r.electrical;
  const L = r.losses;
  const P = r.performance;
  const rot = r.rotor;
  const sections: ReportSection[] = [];

  sections.push({
    id: 'inputs',
    title: 'Input specification',
    rows: [
      row('Design name', '', s.name),
      row('Topology', '', TOPOLOGY[s.topology]),
      row('Rated output power', 'Pₙ', fmt(s.powerKw, 2), 'kW'),
      row('Rated line voltage', 'Vₙ', fmt(s.voltageV, 1), 'V', s.connection === 'star' ? 'star' : 'delta'),
      row('Frequency', 'f', fmt(s.frequencyHz, 2), 'Hz'),
      row('Phases / poles', 'm / 2p', `${s.winding.phases} / ${s.winding.poles}`),
      row('Assumed efficiency', 'η₀', fmt(s.targetEfficiency, 2), '%'),
      row('Assumed power factor', 'cos φ₀', fmt(s.targetPowerFactor, 3)),
      row('Specific magnetic loading', 'B_av', fmt(s.Bav, 3), 'T'),
      row('Specific electric loading', 'ac', fmt(s.ac, 0), 'A/m'),
      row('Sizing mode', '', s.sizingMode === 'd2l' ? `D²L, λ = L/τ = ${fmt(s.aspectRatio, 2)}` : 'manual D, L'),
      row('Current density', 'J', fmt(s.currentDensity, 2), 'A/mm²'),
      row('Slot fill factor', 'k_fill', fmt(s.fillFactor, 2)),
      row('Lamination', '', s.steel),
      row('Tooth / yoke flux limits', 'B_t / B_y', `${fmt(s.BtoothMax, 2)} / ${fmt(s.ByokeMax, 2)}`, 'T'),
    ],
  });

  sections.push({
    id: 'main',
    title: 'Main dimensions (D²L output equation)',
    rows: [
      row('Synchronous speed', 'n_s = 60f/p', fmt(m.nsRpm, 1), 'rpm'),
      row('Input apparent power', 'S = P/(η·cosφ)', fmt(m.Sin / 1000, 3), 'kVA'),
      row('Output coefficient', 'C₀ = 11·k_w·B_av·ac·10⁻³', fmt(m.C0, 2), 'kVA·s/m³'),
      row('D²L', 'D²L = S/(C₀·n_s)', sig(m.D2L, 4), 'm³'),
      row('Bore diameter', 'D', mm(m.D), 'mm'),
      row('Stack length', 'L', mm(m.L), 'mm'),
      row('Pole pitch', 'τ = πD/2p', mm(m.tau), 'mm'),
      row('Aspect ratio', 'L/τ', fmt(m.aspectRatio, 3)),
      row('Peripheral speed', 'v = πD·n_s', fmt(m.peripheralSpeed, 2), 'm/s'),
      row('Air gap', 'g', mm(m.airgap, 3), 'mm', m.airgapAuto ? 'empirical' : 'user'),
      row('Rated torque', 'Tₙ', fmt(r.torqueRated, 2), 'N·m'),
      row('Tangential stress', 'σ = T/(2πr²L)', fmt(r.shear / 1000, 2), 'kPa'),
      row('Torque per rotor volume', 'TRV', fmt(r.trv / 1000, 2), 'kN·m/m³'),
    ],
  });

  const slotShape = shapeOf(st.slot.shape);
  sections.push({
    id: 'stator',
    title: 'Stator winding, slots, teeth and yoke',
    rows: [
      row('Slots', 'Q', `${st.Q}`),
      row('Slot pitch at bore', 'τ_s = πD/Q', mm(st.slotPitch), 'mm'),
      row('Turns in series per phase', 'N_ph', fmt(st.Nph, 1), '', `target ${fmt(st.NphTarget, 2)}`),
      row('Conductors per slot', 'Z_s', `${st.Zs}`, '', `${st.zLayer} per layer`),
      row('Parallel paths', 'a', `${st.a}`),
      row('Phase EMF', 'E = 4.44·f·Φ₁·k_w·N', fmt(st.E, 2), 'V'),
      row('Flux per pole', 'Φ = B_av·τ·L', fmt(st.phi * 1000, 4), 'mWb'),
      row('Actual magnetic loading', 'B_av', fmt(st.Bav, 4), 'T'),
      row('Actual electric loading', 'ac = 2mN_phI/(πD)', fmt(st.ac, 0), 'A/m'),
      row('Conductor cross-section', 'a_c = I/(aJ)', fmt(st.conductorArea, 3), 'mm²'),
      row('Strands', 'n × d', `${st.strands} × ${fmt(st.strandDiameter, 3)}`, 'mm'),
      row('Slot shape', '', slotShape.name),
      ...slotShape.params.map((p) => row(p.label, p.symbol, fmt(st.slot.params[p.key] ?? 0, 3), 'mm')),
      row('Slot depth', 'h_s', fmt(st.slot.metrics.depth, 2), 'mm'),
      row('Slot winding area', 'A_slot', fmt(st.slot.metrics.conductorArea, 2), 'mm²', `required ${fmt(st.slot.targetArea, 1)}`),
      row('Actual fill factor', 'k_fill', fmt(st.fill, 3)),
      row('Slot leakage permeance', 'λ_u', fmt(st.slot.metrics.permeance, 3)),
      row('Tooth width (min / mean)', 'b_t', `${fmt(st.slot.metrics.toothMin, 2)} / ${fmt(st.slot.metrics.toothMean, 2)}`, 'mm'),
      row('Tooth flux density (peak)', 'B_t', fmt(st.Btooth, 3), 'T'),
      row('Yoke depth', 'h_ys = Φ/(2k_fe L B_y)', mm(st.yoke), 'mm'),
      row('Yoke flux density', 'B_ys', fmt(st.Byoke, 3), 'T'),
      row('Outer diameter', 'D_o', mm(st.Do, 1), 'mm'),
      row('Carter coefficient', 'k_C', fmt(st.carter, 4)),
      row('Mean turn length', 'l_mt', mm(st.lmt, 1), 'mm'),
      row('End-winding overhang', 'l_oh', mm(st.overhang, 1), 'mm'),
      row('Phase resistance', `R_ph @ ${s.copperTempC} °C`, sig(st.Rph, 4), 'Ω'),
    ],
  });

  sections.push({
    id: 'winding',
    title: 'Winding analysis',
    rows: [
      row('Slots per pole per phase', 'q', w.qLabel),
      row('Layers / layout', '', `${r.layout.layers} / ${r.layout.kind}`),
      row('Periodicity', 't = gcd(Q, p)', `${w.t}`, '', w.antiperiodic ? 'anti-periodic' : ''),
      row('Fundamental winding factor', 'k_w1', fmt(w.kw1, 5)),
      row('Distribution / pitch factor', 'k_d1 / k_p1', w.kd1 !== null && w.kp1 !== null ? `${fmt(w.kd1, 4)} / ${fmt(w.kp1, 4)}` : '—'),
      row('Skew factor', 'k_sk1', fmt(w.ksk1, 4)),
      row('Slot-opening factor', 'k_so1', fmt(w.kso1, 4)),
      row('MMF total harmonic distortion', 'THD', fmt(w.thdMmf * 100, 2), '%'),
      row('Differential leakage coefficient', 'σ_δ', fmt(w.sigmaDiff, 5)),
      row('Cogging fundamental order', 'LCM(Q, 2p)', `${w.lcmQ2p}`),
      row('Lowest radial force order', 'GCD(Q, 2p)', `${w.gcdQ2p}`),
      row('Max parallel paths', 'a_max', `${w.maxParallelPaths}`),
      row('Balanced', '', w.balanced ? 'yes' : 'no'),
    ],
  });

  if (rot.kind === 'induction') {
    sections.push({
      id: 'rotor',
      title: rot.rotorType === 'cage' ? 'Rotor — squirrel cage' : 'Rotor — wound',
      rows: [
        row('Rotor slots', 'Q_r', `${rot.Qr}`, '', rot.QrAuto ? 'auto' : 'user'),
        row('Rotor outer diameter', 'D_r = D − 2g', mm(rot.Dr, 2), 'mm'),
        row(rot.rotorType === 'cage' ? 'Bar current' : 'Rotor phase current', 'I_b', fmt(rot.barCurrent, 2), 'A'),
        row('Conductor area (required / actual)', 'A_b', `${fmt(rot.barArea, 1)} / ${fmt(rot.slot.metrics.conductorArea, 1)}`, 'mm²'),
        ...(rot.rotorType === 'cage'
          ? [
              row('End-ring current', 'I_e = I_b/(2 sin(πp/Q_r))', fmt(rot.ringCurrent, 1), 'A'),
              row('End-ring section', 'A_e', fmt(rot.ringArea, 1), 'mm²', `${mm(rot.ringHeight, 1)} × ${mm(rot.ringWidth, 1)} mm`),
            ]
          : [row('Rotor turns / phase', 'N₂', fmt(rot.N2 ?? 0, 0)), row('Rotor winding factor', 'k_w2', fmt(rot.kw2 ?? 0, 4))]),
        row('Rotor slot shape', '', shapeOf(rot.slot.shape).name),
        ...shapeOf(rot.slot.shape).params.map((p) => row(p.label, p.symbol, fmt(rot.slot.params[p.key] ?? 0, 3), 'mm')),
        row('Rotor tooth flux density', 'B_tr', fmt(rot.Btooth, 3), 'T'),
        row('Rotor yoke depth / flux', 'h_yr / B_yr', `${mm(rot.yoke, 1)} / ${fmt(rot.Byoke, 2)}`, 'mm / T'),
        row('Shaft (core bore / min.)', 'D_sh', `${mm(rot.Di, 1)} / ${mm(rot.shaftMin, 1)}`, 'mm'),
        row('Referred rotor resistance', "R₂'", sig(rot.R2, 4), 'Ω'),
        row('Referred rotor leakage', "L₂'", sig(rot.L2 * 1000, 4), 'mH'),
        ...rot.comboWarnings.map((wn) => row('Slot combination note', '', wn)),
      ],
    });
  } else if (rot.kind === 'pm') {
    sections.push({
      id: 'rotor',
      title: rot.layout === 'spm' ? 'Rotor — surface permanent magnets' : `Rotor — interior magnets (${rot.layout === 'ipm-v' ? 'V-shape' : 'bar'})`,
      rows: [
        row('Rotor outer diameter', 'D_r', mm(rot.Dr, 2), 'mm'),
        row('Magnet thickness', 'h_m', mm(rot.hm, 2), 'mm', rot.hmAuto ? 'auto' : 'user'),
        row('Magnet width per piece', 'w_m', mm(rot.wm, 2), 'mm'),
        row('Magnets per pole', '', `${rot.magnetsPerPole}`),
        row('Pole arc ratio', 'α_p', fmt(rot.poleArc, 3)),
        ...(rot.layout !== 'spm' ? [row('V apex depth', 'd_apex', mm(rot.apexDepth, 2), 'mm'), row('Bridge thickness', 't_b', mm(rot.bridge, 2), 'mm')] : []),
        ...(rot.sleeve > 0 ? [row('Sleeve', 't_sl', mm(rot.sleeve, 2), 'mm')] : []),
        row('Gap flux density (flat top)', 'B_g', fmt(rot.Bg, 4), 'T'),
        row('Fundamental gap flux density', 'B̂_g1', fmt(rot.B1, 4), 'T'),
        row('Magnet working point', 'B_m', fmt(rot.Bm, 3), 'T'),
        row('PM flux linkage (peak)', 'ψ_m', sig(rot.psiM, 4), 'Wb'),
        row('Back-EMF at rated speed', 'E₀', fmt(rot.E0, 2), 'V'),
        row('Magnet volume / mass', 'V_m', `${fmt(rot.magnetVolume * 1e6, 1)} cm³ / ${fmt(rot.magnetMass, 3)} kg`),
        row('Rotor yoke depth / flux', 'h_yr / B_yr', `${mm(rot.yoke, 1)} / ${fmt(rot.Byoke, 2)}`, 'mm / T'),
        row('Shaft (core bore / min.)', 'D_sh', `${mm(rot.Di, 1)} / ${mm(rot.shaftMin, 1)}`, 'mm'),
      ],
    });
  } else {
    sections.push({
      id: 'rotor',
      title: rot.poleType === 'salient' ? 'Rotor — salient wound field' : 'Rotor — cylindrical wound field',
      rows: [
        row('Rotor outer diameter', 'D_r', mm(rot.Dr, 2), 'mm'),
        row('Pole arc ratio', 'ψ', fmt(rot.poleArc, 3)),
        ...(rot.poleType === 'salient'
          ? [
              row('Pole body width', 'b_p', mm(rot.poleBodyWidth, 1), 'mm'),
              row('Pole body height', 'h_p', mm(rot.poleBodyHeight, 1), 'mm'),
              row('Pole shoe height', 'h_ps', mm(rot.poleShoeHeight, 1), 'mm'),
              row('Field coil width × height', '', `${mm(rot.coilWidth, 1)} × ${mm(rot.coilHeight, 1)}`, 'mm'),
            ]
          : [row('Rotor slots (pitch positions)', 'Q_r', `${rot.Qr}`), row('Wound slots per pole', '', `${rot.woundSlotsPerPole}`)]),
        row('Field MMF no-load / rated', 'F_f', `${fmt(rot.fieldATnoLoad, 0)} / ${fmt(rot.fieldATrated, 0)}`, 'A·t'),
        row('Field turns per pole', 'T_f', fmt(rot.fieldTurnsPerPole, 1)),
        row('Field current', 'I_f', fmt(rot.fieldCurrent, 2), 'A'),
        row('Field conductor area', 'a_f', fmt(rot.fieldConductorArea, 2), 'mm²'),
        row('Field resistance', 'R_f', sig(rot.fieldResistance, 4), 'Ω'),
        row('Excitation loss', 'P_f', fmt(rot.fieldLoss, 0), 'W'),
        row('Excitation EMF', 'E₀', fmt(rot.E0, 2), 'V'),
        row('Rotor yoke depth / flux', 'h_yr / B_yr', `${mm(rot.yoke, 1)} / ${fmt(rot.Byoke, 2)}`, 'mm / T'),
      ],
    });
  }

  sections.push({
    id: 'circuit',
    title: 'Equivalent-circuit parameters',
    rows: [
      row('Stator resistance', 'R₁', sig(e.R1, 4), 'Ω'),
      row('Magnetizing inductance', 'L_m', sig(e.Lm * 1000, 4), 'mH'),
      row('Magnetizing reactance', 'X_m', sig(e.Xm, 4), 'Ω'),
      row('Slot leakage', 'L_u', sig(e.Lslot * 1000, 4), 'mH'),
      row('End-winding leakage', 'L_ew', sig(e.Lend * 1000, 4), 'mH'),
      row('Differential leakage', 'L_δσ = σ_δ·L_m', sig(e.Ldiff * 1000, 4), 'mH'),
      row('Total stator leakage', 'L_σ', sig(e.Lsigma * 1000, 4), 'mH'),
      row('Leakage reactance', 'X₁', sig(e.X1, 4), 'Ω'),
      row('d / q inductance', 'L_d / L_q', `${sig(e.Ld * 1000, 4)} / ${sig(e.Lq * 1000, 4)}`, 'mH'),
      row('Saturation factor', 'k_sat', fmt(e.ksat, 3)),
      row('Effective air gap', 'δ_ef', mm(e.airgapEff, 3), 'mm'),
      row('MMF per pole: gap / teeth / yoke', '', `${fmt(e.fieldAT.gap, 0)} / ${fmt(e.fieldAT.statorTeeth + e.fieldAT.rotorTeeth, 0)} / ${fmt(e.fieldAT.statorYoke + e.fieldAT.rotorYoke, 0)}`, 'A·t'),
    ],
  });

  sections.push({
    id: 'losses',
    title: 'Losses and efficiency at rated load',
    rows: [
      row('Stator copper loss', 'P_cu1 = mI²R₁', fmt(L.statorCopper, 1), 'W'),
      row(rot.kind === 'wound_field' ? 'Field (excitation) loss' : rot.kind === 'pm' ? 'Rotor conductor loss' : 'Rotor conductor loss', 'P_cu2', fmt(L.rotorCopper, 1), 'W'),
      row('Stator iron loss — teeth', 'P_fe,t', fmt(L.statorIronTeeth, 1), 'W'),
      row('Stator iron loss — yoke', 'P_fe,y', fmt(L.statorIronYoke, 1), 'W'),
      row('Friction & windage', 'P_fw', fmt(L.mechanical, 1), 'W'),
      row('Stray load loss', 'P_LL', fmt(L.stray, 1), 'W'),
      row('Total losses', 'ΣP', fmt(L.total, 1), 'W'),
      row('Input power', 'P_in', fmt(L.Pin / 1000, 3), 'kW'),
      row('Efficiency', 'η', fmt(L.efficiency * 100, 3), '%'),
    ],
  });

  sections.push({
    id: 'performance',
    title: 'Rated operating point and capability',
    rows: [
      row('Speed', 'n', fmt(P.rated.speedRpm, 1), 'rpm'),
      ...(P.rated.slip !== null ? [row('Slip', 's', fmt(P.rated.slip * 100, 3), '%')] : []),
      row('Shaft torque', 'T', fmt(P.rated.torque, 2), 'N·m'),
      row('Phase current', 'I_ph', fmt(P.rated.current, 2), 'A'),
      row('Line current', 'I_L', fmt(P.rated.current * (s.connection === 'delta' ? 2 * Math.sin(Math.PI / s.winding.phases) : 1), 2), 'A'),
      row('Power factor', 'cos φ', fmt(P.rated.powerFactor, 4)),
      row('Phase voltage required', 'V_ph', fmt(P.rated.voltage, 1), 'V'),
      ...(P.rated.id !== undefined ? [row('d / q current (peak)', 'i_d / i_q', `${fmt(P.rated.id, 1)} / ${fmt(P.rated.iq ?? 0, 1)}`, 'A')] : []),
      ...(P.startTorque !== null ? [row('Starting torque', 'T_st', fmt(P.startTorque, 1), 'N·m', `${fmt(P.startTorque / r.torqueRated, 2)} × Tₙ`)] : []),
      ...(P.startCurrent !== null ? [row('Starting current', 'I_st', fmt(P.startCurrent, 1), 'A', `${fmt(P.startCurrent / P.rated.current, 2)} × Iₙ`)] : []),
      row(rot.kind === 'wound_field' ? 'Pull-out torque' : rot.kind === 'induction' ? 'Breakdown torque' : 'Peak torque (rated current)', 'T_max', fmt(P.maxTorque, 1), 'N·m', `${fmt(P.maxTorque / r.torqueRated, 2)} × Tₙ`),
      row('Base speed', 'n_b', fmt(P.baseSpeed, 0), 'rpm'),
      row('Maximum speed', 'n_max', fmt(P.maxSpeed, 0), 'rpm'),
    ],
  });

  sections.push({
    id: 'masses',
    title: 'Active masses and material cost',
    rows: [
      row('Stator iron', '', fmt(r.masses.statorIron, 2), 'kg'),
      row('Rotor iron', '', fmt(r.masses.rotorIron, 2), 'kg'),
      row('Stator copper', '', fmt(r.masses.statorCopper, 2), 'kg'),
      row('Rotor conductors', '', fmt(r.masses.rotorConductor, 2), 'kg'),
      row('Magnets', '', fmt(r.masses.magnet, 3), 'kg'),
      row('Total active mass', '', fmt(r.masses.total, 2), 'kg'),
      row('Material cost estimate', '', fmt(r.masses.cost, 0), 'USD'),
    ],
  });

  return sections;
}

/** Winding layout as rows for tables / spreadsheets. */
export function windingRows(r: DesignResult): string[][] {
  const head = ['Layer', ...Array.from({ length: r.stator.Q }, (_, k) => `${k + 1}`)];
  const rows = r.layout.matrix.map((row, l) => [`${l + 1}`, ...row.map((c) => (c.sign === 0 ? '' : `${phaseName(c.phase)}${c.sign > 0 ? '+' : '-'}`))]);
  return [head, ...rows];
}

export function harmonicRows(r: DesignResult, max = 60): string[][] {
  const head = ['ν (mech)', 'ν/p (elec)', 'k_w', 'k_p', 'k_d', 'k_sk', 'k_so', 'MMF %', 'rotation'];
  const rows = r.winding.harmonics
    .slice(0, max)
    .filter((h) => h.kw > 1e-6 || h.mmf > 1e-9)
    .map((h) => [`${h.order}`, fmt(h.elecOrder, 3), fmt(h.kw, 4), h.kp === null ? '' : fmt(h.kp, 4), h.kd === null ? '' : fmt(h.kd, 4), fmt(h.ksk, 4), fmt(h.kso, 4), fmt(h.mmfRel * 100, 2), h.direction]);
  return [head, ...rows];
}
