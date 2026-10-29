import type { CheckStatus, DesignCheck, DesignResult } from './result';

const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');

function range(id: string, label: string, value: number, lo: number, hi: number, digits: number, unit: string, hint?: string, hardFactor = 1.12): DesignCheck {
  let status: CheckStatus = 'ok';
  if (value < lo || value > hi) status = 'warn';
  if (value > hi * hardFactor || value < lo / hardFactor) status = 'error';
  return { id, label, status, value: `${f(value, digits)} ${unit}`, limit: `${f(lo, digits)} … ${f(hi, digits)} ${unit}`, hint };
}

function max(id: string, label: string, value: number, limit: number, digits: number, unit: string, hint?: string, hard = 1.08): DesignCheck {
  const status: CheckStatus = value <= limit * 1.005 ? 'ok' : value <= limit * hard ? 'warn' : 'error';
  return { id, label, status, value: `${f(value, digits)} ${unit}`, limit: `≤ ${f(limit, digits)} ${unit}`, hint };
}

export function buildChecks(r: DesignResult): DesignCheck[] {
  const { spec, stator: st, winding: w, main, rotor, losses, performance: perf } = r;
  const c: DesignCheck[] = [];

  c.push({
    id: 'winding-balance',
    label: 'Winding symmetry',
    status: w.balanced ? 'ok' : 'error',
    value: w.balanced ? 'balanced' : 'unbalanced',
    limit: 'balanced m-phase',
    hint: w.balanceNotes.join(' ') || undefined,
  });
  const a = spec.winding.parallelPaths;
  c.push({
    id: 'parallel-paths',
    label: 'Parallel paths',
    status: w.maxParallelPaths % a === 0 ? 'ok' : 'error',
    value: `${a}`,
    limit: `divisor of ${w.maxParallelPaths}`,
    hint: 'The number of parallel paths must divide the number of identical coil groups.',
  });
  c.push(max('Bt', 'Stator tooth flux density (peak)', st.Btooth, spec.BtoothMax, 2, 'T', 'Increase slot count/tooth width or reduce B_av.'));
  c.push(max('By', 'Stator yoke flux density', st.Byoke, spec.ByokeMax, 2, 'T'));
  c.push(max('fill', 'Slot fill factor (copper/slot area)', st.fill, Math.min(0.6, spec.fillFactor), 3, '', 'Random-wound round wire is limited to ≈ 0.40–0.45.', 1.1));
  if (st.slot.limited) c.push({ id: 'slot-limit', label: 'Stator slot area', status: 'error', value: 'not reachable', limit: 'required area', hint: 'The slot cannot reach the required area with the tooth width; raise ac/J or the slot count.' });
  c.push(range('J', 'Current density', spec.currentDensity, 2.5, 8, 1, 'A/mm²', 'Higher J needs forced cooling.'));
  c.push(range('ac', 'Electric loading (actual)', st.ac / 1000, 10, 65, 1, 'kA/m'));
  c.push(range('Bav', 'Specific magnetic loading (actual)', st.Bav, 0.3, 0.8, 3, 'T'));
  c.push(range('lt', 'Aspect ratio L/τ', main.aspectRatio, 0.5, 3, 2, ''));
  c.push(max('v', 'Peripheral speed', (Math.PI * main.D * perf.maxSpeed) / 60, rotor.kind === 'pm' && rotor.layout === 'spm' && rotor.sleeve === 0 ? 40 : 120, 1, 'm/s', 'Above ≈ 40 m/s SPM magnets need a retaining sleeve.'));
  c.push(max('kw1', 'Fundamental winding factor', -w.kw1, -0.85, 3, '', undefined, 1.06));
  c[c.length - 1] = { ...c[c.length - 1], value: f(w.kw1, 3), limit: '≥ 0.850', status: w.kw1 >= 0.85 ? 'ok' : w.kw1 >= 0.75 ? 'warn' : 'error' };

  const eta = losses.efficiency * 100;
  const dEta = eta - spec.targetEfficiency;
  c.push({
    id: 'eta',
    label: 'Calculated vs assumed efficiency',
    status: Math.abs(dEta) < 1.5 ? 'ok' : dEta > -4 ? 'warn' : 'error',
    value: `${f(eta, 2)} %`,
    limit: `${f(spec.targetEfficiency, 1)} % assumed`,
    hint: 'Use “Adopt calculated η / PF” to iterate the sizing.',
  });
  const pf = perf.rated.powerFactor;
  c.push({
    id: 'pf',
    label: 'Calculated vs assumed power factor',
    status: Math.abs(pf - spec.targetPowerFactor) < 0.04 ? 'ok' : pf - spec.targetPowerFactor > -0.1 ? 'warn' : 'error',
    value: f(pf, 3),
    limit: `${f(spec.targetPowerFactor, 2)} assumed`,
  });
  for (const n of perf.notes) c.push({ id: `perf-${n.length}`, label: 'Operating point', status: 'error', value: 'infeasible', limit: 'feasible', hint: n });

  if (rotor.kind === 'induction') {
    c.push(max('Btr', 'Rotor tooth flux density (peak)', rotor.Btooth, spec.BtoothMax * 1.05, 2, 'T'));
    c.push(max('Byr', 'Rotor yoke flux density', rotor.Byoke, spec.BrotorYokeMax, 2, 'T', 'Shaft limits the rotor yoke depth.'));
    if (rotor.slot.limited) c.push({ id: 'rslot', label: 'Rotor slot area', status: 'error', value: 'not reachable', limit: 'required area' });
    c.push({
      id: 'qr',
      label: 'Slot combination Qs/Qr',
      status: rotor.comboWarnings.length ? 'warn' : 'ok',
      value: `${st.Q}/${rotor.Qr}`,
      limit: 'no cusps / noise',
      hint: rotor.comboWarnings.join(' ') || undefined,
    });
    if (perf.startTorque !== null && rotor.rotorType === 'cage') c.push(range('tst', 'Starting torque ratio Tst/Tn', perf.startTorque / r.torqueRated, 0.8, 3.5, 2, '×'));
    c.push(range('tmax', 'Breakdown torque ratio Tmax/Tn', perf.maxTorque / r.torqueRated, 1.6, 4, 2, '×'));
    if (perf.startCurrent !== null) c.push(max('ist', 'Starting current ratio Ist/In', perf.startCurrent / perf.rated.current, 8, 2, '×'));
  }
  if (rotor.kind === 'pm') {
    c.push(max('Byr', 'Rotor yoke flux density', rotor.Byoke, spec.BrotorYokeMax, 2, 'T'));
    c.push({
      id: 'demag',
      label: 'Magnet working point Bm/Br',
      status: rotor.Bm / spec.pm.remanence > 0.5 ? 'ok' : rotor.Bm / spec.pm.remanence > 0.35 ? 'warn' : 'error',
      value: f(rotor.Bm / spec.pm.remanence, 2),
      limit: '> 0.50',
      hint: 'Low working point → demagnetisation risk under load/overtemperature.',
    });
    if (rotor.geometryLimited) c.push({ id: 'pmgeo', label: 'Magnet geometry', status: 'warn', value: 'limited', limit: 'target B_g', hint: 'Magnets cannot produce the target B_av within the rotor; increase hm, Br or lower B_av.' });
    c.push(max('vr', 'Rated voltage requirement', perf.rated.voltage, main.Vph, 1, 'V', 'Reduce turns (EMF ratio) or raise DC link.', 1.03));
  }
  if (rotor.kind === 'wound_field') {
    c.push(max('Byr', 'Rotor yoke flux density', rotor.Byoke, spec.BrotorYokeMax, 2, 'T'));
    if (rotor.coreLimited) c.push({ id: 'wfcoil', label: 'Field coil space', status: 'warn', value: 'tight', limit: 'interpolar space', hint: 'Increase pole count/diameter or field current density.' });
    c.push(range('tpo', 'Pull-out torque ratio', perf.maxTorque / r.torqueRated, 1.5, 3.5, 2, '×'));
  }
  if ('Di' in rotor) c.push(max('shaft', 'Shaft fits inside rotor core', rotor.shaftMin * 1000, rotor.Di * 1000, 1, 'mm', 'Minimum shaft diameter from torsional stress (35 MPa).'));
  return c;
}
