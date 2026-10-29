import { createContext, useCallback, useContext, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { baseSpec, topologyDefaults } from '../core/defaults';
import { runDesign } from '../core/sizing/design';
import type { DesignResult } from '../core/sizing/result';
import type { MachineSpec, MachineTopology } from '../core/types';
import { applyChange, mergeSpec } from './specUtils';

const STORAGE_KEY = 'emds.spec.v1';

function loadInitial(): MachineSpec {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return mergeSpec(JSON.parse(raw));
  } catch {
    /* storage unavailable */
  }
  return baseSpec();
}

interface Store {
  spec: MachineSpec;
  result: DesignResult | null;
  error: string | null;
  stale: boolean;
  update: (path: string, value: unknown) => void;
  setSpec: (spec: MachineSpec) => void;
  setTopology: (t: MachineTopology) => void;
  adoptCalculated: () => void;
  toast: string | null;
  notify: (msg: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [spec, setSpecState] = useState<MachineSpec>(loadInitial);
  const [toast, setToast] = useState<string | null>(null);
  const deferred = useDeferredValue(spec);

  const { result, error } = useMemo(() => {
    try {
      return { result: runDesign(deferred), error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [deferred]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(spec));
    } catch {
      /* ignore */
    }
  }, [spec]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  const update = useCallback((path: string, value: unknown) => setSpecState((s) => applyChange(s, path, value)), []);
  const setSpec = useCallback((s: MachineSpec) => setSpecState(mergeSpec(s)), []);
  const setTopology = useCallback((t: MachineTopology) => setSpecState((s) => topologyDefaults(s, t)), []);
  const adoptCalculated = useCallback(() => {
    if (!result) return;
    setSpecState((s) => ({
      ...s,
      targetEfficiency: +(result.losses.efficiency * 100).toFixed(2),
      targetPowerFactor: +Math.min(1, result.performance.rated.powerFactor).toFixed(3),
    }));
  }, [result]);

  const value = useMemo<Store>(
    () => ({ spec, result, error, stale: spec !== deferred, update, setSpec, setTopology, adoptCalculated, toast, notify }),
    [spec, result, error, deferred, update, setSpec, setTopology, adoptCalculated, toast, notify],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDesign(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useDesign must be used inside <DesignProvider>');
  return s;
}
