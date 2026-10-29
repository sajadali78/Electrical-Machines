import { runDesign } from '../sizing/design';
import type { MachineSpec } from '../types';

export interface ParetoPoint {
  aspectRatio: number;
  currentDensity: number;
  totalLoss: number; // W
  activeMass: number; // kg
  cost: number;
  efficiency: number;
  D: number;
  L: number;
  Do: number;
  feasible: boolean; // no failing (error) checks
  pareto: boolean;
}

/**
 * Sweep L/τ and current density (slot depth) with the fast design path and mark the
 * non-dominated designs for minimum loss and minimum active mass.
 */
export function optimizeDesign(
  spec: MachineSpec,
  ar: [number, number] = [0.6, 2.8],
  J: [number, number] = [3, 8],
  n = 9,
): ParetoPoint[] {
  const pts: ParetoPoint[] = [];
  const base: MachineSpec = { ...spec, sizingMode: 'd2l' };
  for (let i = 0; i < n; i++) {
    const aspectRatio = ar[0] + ((ar[1] - ar[0]) * i) / (n - 1);
    for (let k = 0; k < n; k++) {
      const currentDensity = J[0] + ((J[1] - J[0]) * k) / (n - 1);
      try {
        const r = runDesign({ ...base, aspectRatio, currentDensity }, { lite: true });
        const feasible = !r.checks.some((c) => c.status === 'error' && !['eta', 'pf'].includes(c.id));
        pts.push({
          aspectRatio,
          currentDensity,
          totalLoss: r.losses.total,
          activeMass: r.masses.total,
          cost: r.masses.cost,
          efficiency: r.losses.efficiency,
          D: r.main.D,
          L: r.main.L,
          Do: r.stator.Do,
          feasible,
          pareto: false,
        });
      } catch {
        /* skip non-converging points */
      }
    }
  }
  // Pareto front among feasible designs; if none passes the checks, among all designs.
  const finite = pts.filter((p) => Number.isFinite(p.totalLoss));
  const feasible = finite.filter((p) => p.feasible);
  const cand = feasible.length ? feasible : finite;
  for (const p of cand) {
    p.pareto = !cand.some((q) => q !== p && q.totalLoss <= p.totalLoss && q.activeMass <= p.activeMass && (q.totalLoss < p.totalLoss || q.activeMass < p.activeMass));
  }
  return pts;
}
