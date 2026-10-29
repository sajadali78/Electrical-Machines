import { useState } from 'react';
import { useDesign } from '../../state/store';
import { Segmented } from '../inputs/SelectField';
import { AxialView } from './AxialView';
import { CrossSection } from './CrossSection';

export function CadTab() {
  const { result: r, spec } = useDesign();
  const [view, setView] = useState<'radial' | 'axial'>('radial');
  const [dims, setDims] = useState(true);
  const [labels, setLabels] = useState(true);
  const [housing, setHousing] = useState(false);
  if (!r) return null;
  const m = spec.winding.phases;
  return (
    <div className="tab-body">
      <div className="panel">
        <div className="panel-head">
          <h3>{view === 'radial' ? 'Radial cross-section' : 'Axial section'}</h3>
          <span className="sub">Scroll to zoom · drag to pan · hover for dimensions and flux densities</span>
          <div className="spacer" />
          <Segmented
            label="View"
            value={view}
            options={[
              { value: 'radial', label: 'Radial' },
              { value: 'axial', label: 'Axial' },
            ]}
            onChange={setView}
          />
          <label className="check-inline">
            <input type="checkbox" checked={dims} onChange={(e) => setDims(e.target.checked)} /> Dimensions
          </label>
          {view === 'radial' && (
            <>
              <label className="check-inline">
                <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Phase labels
              </label>
              <label className="check-inline">
                <input type="checkbox" checked={housing} onChange={(e) => setHousing(e.target.checked)} /> Frame
              </label>
            </>
          )}
        </div>
        <div className="panel-body">
          {view === 'radial' ? <CrossSection r={r} opts={{ dims, labels, housing }} svgId="cad-radial" /> : <AxialView r={r} dims={dims} svgId="cad-axial" />}
          <div className="legend" style={{ marginTop: 8 }}>
            {Array.from({ length: m }, (_, j) => (
              <span key={j}>
                <i style={{ background: `var(--ph-${j % 8})` }} />
                Phase {String.fromCharCode(65 + j)} (hatched = return side)
              </span>
            ))}
            <span>
              <i style={{ background: 'var(--steel)' }} />
              Lamination
            </span>
            {r.rotor.kind === 'pm' && (
              <>
                <span>
                  <i style={{ background: 'var(--magnet-n)' }} />
                  Magnet N
                </span>
                <span>
                  <i style={{ background: 'var(--magnet-s)' }} />
                  Magnet S
                </span>
              </>
            )}
            {r.rotor.kind !== 'pm' && (
              <span>
                <i style={{ background: r.rotor.kind === 'induction' && r.spec.induction.barMaterial === 'aluminum' ? 'var(--aluminum)' : 'var(--copper-fill)' }} />
                {r.rotor.kind === 'induction' ? 'Rotor cage / winding' : 'Field winding'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
