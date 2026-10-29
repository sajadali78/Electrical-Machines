# Architecture

```
MachineSpec (inputs, JSON-serialisable)
      │
      ▼
runDesign(spec)  ── src/core/sizing/design.ts
  1. generateLayout(winding)          → winding matrix [layer][slot] + coil list
                                        (1 layer, double layer, or a stack of shifted base layers)
  2. analyzeWinding (fast)            → k_w1 (with skew) for the output equation
  3. mainDimensions                   → S, C₀, D²L, D, L, τ, g
  4. flux definition per topology     → B_av, Φ₁/Φ, peak B_g (PM: magnet sizing first)
  5. designStator                     → turns, conductors, slot auto-size, teeth, yoke, R_ph
  6. analyzeWinding (full)            → harmonics, σ_δ, k_so with real slot opening
  7. rotor design (IM / PM / WF)      → rotor slots, bars/rings, magnets or poles & field
  8. electricalParams                 → magnetic circuit, k_sat, L_m, leakages, L_d, L_q
  9. performance                      → rated point, envelope, efficiency map, curves
 10. masses, checks
      │
      ▼
DesignResult (SI units) ──► React views, report model, exports
```

- **The core is pure.** `src/core` has no DOM or React dependency, so it can be tested in Node and reused, for example from a CLI or a Web Worker.
- **Units.** Engines work in SI units (m, T, A, W, H, Ω). Slot-shape parameters are the exception: they are stored in mm, because that is how they are entered and drawn.
- **Single source of truth.** The UI only edits `MachineSpec` through `update(path, value)` (`src/state/store.tsx`), and the result is recomputed from it. `useDeferredValue` keeps typing responsive. The spec is saved to `localStorage` and can be exported or imported as JSON.
- **Slot shapes are plugins.** Each file in `src/core/slots/shapes/` describes one shape:
  - outline polygon
  - conductor regions
  - dimension annotations
  - a `build(ctx, h)` function that sizes the body for a given depth while keeping the minimum tooth width

  Area, permeance, tooth profile, equal-area layer splitting and drawing are derived generically from those polygons. To add a slot shape, add a file and register it in `src/core/slots/index.ts`.
- **One report model.** `src/export/reportModel.ts` turns a `DesignResult` into labelled tables. The calculation-sheet tab, CSV, PDF and Google Sheets exports all render from it.
- **Drawings.** The drawings are React SVG: `CrossSection`, `AxialView` and `SlotDetail`. For the PDF, an off-screen copy is rendered with the light theme, its CSS variables are resolved into attributes (`inlineSvg`), and svg2pdf converts it to vector graphics.
- **Hosting.** The app is fully static. Vite builds with `base: './'`, so the same `dist/` works on GitHub Pages, any static host, or a local file server.
