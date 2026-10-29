import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DesignResult } from '../../core/sizing/result';
import type { ReportFiguresRefs } from '../../export/pdf';
import { AxialView } from '../cad/AxialView';
import { CrossSection } from '../cad/CrossSection';
import { SlotDetail } from '../cad/SlotDetail';

/** Off-screen render of the drawings used by the PDF report. */
export function ReportFigures({ r, onReady }: { r: DesignResult; onReady: (refs: ReportFiguresRefs) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const q = (sel: string) => box.current?.querySelector<SVGSVGElement>(sel) ?? null;
        onReady({ radial: q('#rep-radial'), axial: q('#rep-axial'), slot: q('#rep-slot'), rotorSlot: q('#rep-rslot') });
      }),
    );
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rot = r.rotor;
  const rotorSlot = rot.kind === 'induction' ? rot.slot : rot.kind === 'wound_field' ? rot.slot : null;
  return createPortal(
    <div ref={box} aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width: 900 }}>
      <CrossSection r={r} opts={{ dims: true, labels: true, housing: false }} svgId="rep-radial" />
      <AxialView r={r} dims svgId="rep-axial" />
      <SlotDetail slot={r.stator.slot} R={(r.main.D / 2) * 1000} Q={r.stator.Q} side="stator" cells={r.layout.matrix.map((row) => row[0])} arrangement={r.spec.winding.arrangement} svgId="rep-slot" />
      {rotorSlot && (
        <SlotDetail
          slot={rotorSlot}
          R={(rot.Dr / 2) * 1000}
          Q={rot.kind === 'induction' ? rot.Qr : rot.kind === 'wound_field' ? rot.Qr : 1}
          side="rotor"
          cells={rot.kind === 'induction' && rot.rotorLayout ? rot.rotorLayout.map((row) => row[0]) : undefined}
          barFill={rot.kind === 'induction' && rot.rotorType === 'cage' && r.spec.induction.barMaterial === 'aluminum' ? 'var(--aluminum)' : 'var(--copper-fill)'}
          svgId="rep-rslot"
        />
      )}
    </div>,
    document.body,
  );
}
