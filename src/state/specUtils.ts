import { baseSpec, withSlotPole } from '../core/defaults';
import type { MachineSpec } from '../core/types';
import { defaultPairs } from '../core/winding/layout';

/** Immutable set by dotted path (`winding.slots`). */
export function setIn<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const src = obj as Record<string, unknown>;
  return { ...src, [head]: rest.length ? setIn(src[head], rest.join('.'), value) : value } as T;
}

export function getIn(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), obj);
}

/** Deep-merge a (possibly older/partial) saved spec over the current defaults. */
export function mergeSpec(saved: unknown): MachineSpec {
  const base = baseSpec() as unknown as Record<string, unknown>;
  const merge = (a: Record<string, unknown>, b: unknown): Record<string, unknown> => {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return a;
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
      const av = a[k];
      if (av && typeof av === 'object' && !Array.isArray(av) && v && typeof v === 'object' && !Array.isArray(v) && k !== 'params') out[k] = merge(av as Record<string, unknown>, v);
      else if (v !== undefined) out[k] = v;
    }
    return out;
  };
  return merge(base, saved) as unknown as MachineSpec;
}

/** Apply a field change with the side effects that keep the winding consistent. */
export function applyChange(spec: MachineSpec, path: string, value: unknown): MachineSpec {
  if (path === 'winding.slots' || path === 'winding.poles') {
    const Q = path === 'winding.slots' ? Math.max(3, Math.round(Number(value))) : spec.winding.slots;
    let poles = path === 'winding.poles' ? Math.max(2, Math.round(Number(value))) : spec.winding.poles;
    if (poles % 2) poles += 1;
    return withSlotPole(spec, Q, poles);
  }
  let next = setIn(spec, path, value);
  if (path === 'winding.layers') {
    const L = Math.max(1, Math.min(8, Math.round(Number(value))));
    next = setIn(next, 'winding.layers', L);
    next = setIn(next, 'winding.custom', null);
    if (L >= 4 && next.winding.pairs.length < L / 2) next = setIn(next, 'winding.pairs', defaultPairs(L, next.winding.coilPitch));
  }
  if (path === 'winding.coilPitch') {
    const y = Math.max(1, Math.round(Number(value)));
    next = setIn(next, 'winding.coilPitch', y);
    if (spec.winding.pairs.every((p) => p.pitch === spec.winding.coilPitch)) {
      next = setIn(next, 'winding.pairs', spec.winding.pairs.map((p) => ({ ...p, pitch: y })));
    }
    next = setIn(next, 'winding.custom', null);
  }
  if (path === 'winding.phases') next = setIn(next, 'winding.custom', null);
  return next;
}
