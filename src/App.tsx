import { useState } from 'react';
import { CadTab } from './components/cad/CadTab';
import { OptimizerTab } from './components/optimize/OptimizerTab';
import { PerformanceTab } from './components/performance/PerformanceTab';
import { SheetTab } from './components/results/SheetTab';
import { SlotsTab } from './components/slots/SlotsTab';
import { CombinationTab } from './components/winding/CombinationTab';
import { VernierTab } from './components/vernier/VernierTab';
import { WindingTab } from './components/winding/WindingTab';
import { ParameterSheet } from './components/layout/ParameterSheet';
import { TopBar } from './components/layout/TopBar';
import { ChecksList, Summary } from './components/results/Summary';
import { Group } from './components/inputs/Group';
import { useDesign } from './state/store';

const TABS = [
  { id: 'cad', label: 'Cross-section' },
  { id: 'slots', label: 'Slots' },
  { id: 'winding', label: 'Winding' },
  { id: 'combos', label: 'Slot / pole' },
  { id: 'perf', label: 'Performance' },
  { id: 'vernier', label: 'Vernier machine' },
  { id: 'opt', label: 'Optimizer' },
  { id: 'sheet', label: 'Calculation sheet' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function App() {
  const { error, toast } = useDesign();
  const [tab, setTab] = useState<TabId>('cad');
  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <aside className="left-pane" aria-label="Design parameters">
          <ParameterSheet />
        </aside>
        <main className="right-pane">
          <Summary />
          <Group title="Design checks" open={false}>
            <ChecksList />
          </Group>
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" type="button" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          {error && <div className="empty-note">Calculation error: {error}</div>}
          {tab === 'cad' && <CadTab />}
          {tab === 'slots' && <SlotsTab />}
          {tab === 'winding' && <WindingTab />}
          {tab === 'combos' && <CombinationTab />}
          {tab === 'perf' && <PerformanceTab />}
          {tab === 'vernier' && <VernierTab />}
          {tab === 'opt' && <OptimizerTab />}
          {tab === 'sheet' && <SheetTab />}
        </main>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
