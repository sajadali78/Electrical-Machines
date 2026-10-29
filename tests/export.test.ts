import { describe, expect, it } from 'vitest';
import { PRESETS, runDesign } from '../src/core';
import { buildReport, harmonicRows, windingRows } from '../src/export/reportModel';
import { exportTabs, toCsv } from '../src/export/tables';

describe('report model', () => {
  for (const p of PRESETS) {
    it(`builds complete tables for ${p.id}`, () => {
      const r = runDesign(p.build(), { lite: false });
      const report = buildReport(r);
      expect(report.length).toBeGreaterThanOrEqual(8);
      for (const s of report) for (const row of s.rows) expect(row.value).not.toContain('NaN');
      expect(windingRows(r)[0].length).toBe(r.stator.Q + 1);
      expect(harmonicRows(r).length).toBeGreaterThan(1);
      const tabs = exportTabs(r);
      expect(tabs.map((t) => t.title)).toContain('Winding layout');
      expect(toCsv(r)).toContain('# Calculation sheet');
    });
  }
});
