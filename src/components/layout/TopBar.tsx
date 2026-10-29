import { useEffect, useRef, useState } from 'react';
import { PRESETS } from '../../core/presets';
import type { MachineTopology } from '../../core/types';
import { useDesign } from '../../state/store';
import { Segmented } from '../inputs/SelectField';
import { ExportMenu } from '../export/ExportMenu';

const TOPOLOGIES: { value: MachineTopology; label: string }[] = [
  { value: 'induction', label: 'Induction' },
  { value: 'pmsm_spm', label: 'PMSM · SPM' },
  { value: 'pmsm_ipm', label: 'PMSM · IPM' },
  { value: 'wound_field', label: 'Wound field' },
];

export function TopBar() {
  const { spec, setTopology, setSpec, update, notify } = useDesign();
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('emds.theme') ?? 'auto';
    } catch {
      return 'auto';
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('emds.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const presetRef = useRef<HTMLSelectElement>(null);

  return (
    <header className="topbar">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="var(--ink)" />
          <circle cx="32" cy="32" r="20" fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray="6 4" />
          <circle cx="32" cy="32" r="11" fill="var(--copper)" />
          <circle cx="32" cy="32" r="4" fill="var(--ink)" />
        </svg>
        <div>
          <h1>EM Design Suite</h1>
          <small>D²L sizing · slots · windings · performance</small>
        </div>
      </div>
      <Segmented label="Machine topology" value={spec.topology} options={TOPOLOGIES} onChange={setTopology} />
      <select
        ref={presetRef}
        className="select"
        aria-label="Load a benchmark preset"
        value=""
        onChange={(e) => {
          const p = PRESETS.find((x) => x.id === e.target.value);
          if (p) {
            setSpec(p.build());
            notify(`Loaded preset: ${p.label}`);
          }
        }}
      >
        <option value="">Load preset…</option>
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <input className="input" aria-label="Design name" value={spec.name} onChange={(e) => update('name', e.target.value)} style={{ minWidth: 180, flex: '0 1 260px' }} />
      <div className="spacer" />
      <Segmented
        label="Colour theme"
        value={theme}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={setTheme}
      />
      <ExportMenu />
    </header>
  );
}
