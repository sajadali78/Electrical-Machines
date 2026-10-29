# EM Design Suite

A browser-based design workstation for radial-flux electrical machines. You enter the rating and the design choices; the app sizes the machine with the classical **D²L output equation** and gives you:

- **Main dimensions**: bore D, stack length L, air gap, outer diameter, plus checks on L/τ and peripheral speed.
- **Slot and tooth geometry** for nine parametric slot shapes. Every slot is drawn with annotated dimensions and auto-sized for the required copper area at a chosen tooth flux density.
- **Windings** with **any number of layers from 1 to 8**. Each layer is the star-of-slots base layer shifted by d slots with polarity ±, so 3-layer, 4-layer and odd-layer windings are generated automatically. You can also edit the winding matrix by hand. The app reports winding functions, rotating MMF waves, winding factors for every harmonic, THD, differential leakage, periodicity and the maximum number of parallel paths.
- **Winding configuration suggestions** in the style of online winding calculators, extended beyond two layers. For the chosen slots, poles and phases it checks feasibility and ranks every single- and double-layer coil span together with optimised 3…8-layer stacks by k_w1, MMF THD, σ_δ, sub-harmonics or end-winding span, and proposes alternative slot numbers.
- **Rotor design** for **induction** machines (squirrel cage or wound rotor), **PMSM** (surface or interior V/bar magnets) and **wound-field synchronous** machines (salient or cylindrical rotor).
- **Equivalent circuit, losses, efficiency and performance**: rated operating point, direct-on-line and inverter torque–speed curves, efficiency map, loss breakdown, and torque versus load angle.
- **Design-rule checks**, a **loss/mass Pareto optimiser**, and a **multi-layer winding optimiser**.
- **Exports**: vector PDF specification report, Google Sheets workbook, CSV tables, and design save/load (JSON).

Everything runs on the client in TypeScript. There is no server, so the app can be hosted on **GitHub Pages**.

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL. Other scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm test` | Unit tests (Vitest): winding factors, slot geometry, design presets |
| `npm run typecheck` | TypeScript project check |
| `npm run build` | Production build into `dist/` (relative paths, works from any sub-path) |
| `npm run preview` | Serve the production build locally |

## Deploying to GitHub Pages

The repository includes `.github/workflows/deploy.yml`. On every push to `main` it runs the tests, builds the app and publishes `dist/` to GitHub Pages.

1. Merge this branch into `main`.
2. In the repository open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. After the workflow finishes, the app is served at `https://<user>.github.io/<repository>/`. For this repository that is `https://sajadali78.github.io/Electrical-Machines/`.

`.github/workflows/ci.yml` runs the type check, tests and build on pull requests.

## Using the app

1. Pick a **topology** (Induction / PMSM SPM / PMSM IPM / Wound field) or load a **preset**:
   - 15 kW IE4 induction motor
   - 110 kW wound-rotor induction motor
   - 80 kW EV traction IPM motor
   - 3 kW 12-slot/10-pole SPM motor
   - 50 kW salient-pole synchronous machine
   - four-layer 12-slot/10-pole winding demo
2. Edit the parameter sheet on the left. Results update as you type, and the summary cards and **Design checks** show violations immediately.
3. Explore the tabs:
   - **Cross-section**: radial and axial drawings. Scroll to zoom, drag to pan, and hover any slot, tooth, magnet, pole or air gap for its dimensions and flux densities.
   - **Slots**: annotated stator and rotor slot drawings, a slot data table, the tooth-width profile, and libraries of all slot shapes.
   - **Winding**: configuration suggestions (apply with one click), summary, editable layout matrix, layer-stack editor, developed winding diagram, star of slots, winding functions, MMF with a time slider, harmonic spectrum and table, and the layer-stack optimiser.
   - **Slot / pole**: winding-factor chart over slot and pole counts (click a cell to use it).
   - **Performance**: torque–speed, power, efficiency map, loss donut, efficiency/PF, load angle, equivalent circuit.
   - **Optimizer**: L/τ × J sweep with the Pareto front of total loss versus active mass.
   - **Calculation sheet**: every input and result with its symbol or formula and unit.
4. Use **Adopt calculated η / PF** to feed the calculated efficiency and power factor back into the sizing and iterate.

### Google Sheets export

Export → **Google Sheets…** creates a spreadsheet in your Drive. It uses the Google Identity Services token flow in the browser (scope `https://www.googleapis.com/auth/spreadsheets`). You need an OAuth client ID once:

1. In Google Cloud Console, enable the **Google Sheets API**.
2. Create credentials: **OAuth client ID → Web application**.
3. Add your site origin (for example `https://sajadali78.github.io`, or `http://localhost:5173` for development) under **Authorized JavaScript origins**.
4. Paste the client ID into the export dialog. It is stored only in your browser.

## Project structure

```
src/
  core/                 Pure TypeScript engines (no DOM), unit-tested
    winding/            star of slots, layout generators (1/2/multi-layer, custom),
                        winding-function & harmonic analysis, slot/pole table, layer optimiser
    slots/              slot geometry kernel + one file per slot shape (outline, conductors,
                        dimensions, auto-sizing), numeric permeance and tooth profile
    sizing/             D²L main dimensions, stator, rotors (induction / PM / wound field),
                        magnetic circuit & inductances, checks, design orchestrator
    performance/        induction equivalent circuit, synchronous dq model, loss scaling
    optimize/           Pareto sweep
    materials.ts        steels (loss model, B–H), conductors, magnets
    presets.ts          benchmark designs
  components/           React UI (inputs, CAD views, winding views, charts, tabs, export)
  export/               report model, PDF (jsPDF + svg2pdf), Google Sheets, CSV
  state/                design store (spec → result), persistence
  styles/               design tokens (light/dark) and layout
tests/                  Vitest suites
docs/                   THEORY.md (equations & assumptions), ARCHITECTURE.md
public/fonts/           DejaVu Sans (Unicode font embedded in PDF reports)
```

See [`docs/THEORY.md`](docs/THEORY.md) for the equations and assumptions, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the data flow.

## Scope and limitations

This is an **analytical pre-design** tool meant to produce a consistent starting point before finite-element analysis. It does not replace FEA:

- Magnetic saturation is handled with a saturation factor from the B–H curve, and the inductances are unsaturated.
- Skin effect in rotor bars and magnet eddy-current losses are not modelled.
- Thermal behaviour is represented only through the current density limits.
- The IPM saliency ratio is an input, not a computed result.

## Credits

- Winding layouts follow the star-of-slots method (Bianchi & Dai Prè) used by online winding calculators such as Emetor. Windings with more layers are built as stacks of shifted base layers.
- Sizing and parameter formulas follow Pyrhönen, Jokinen & Hrabovcová, *Design of Rotating Electrical Machines*, and Sawhney, *A Course in Electrical Machine Design*.
- The PDF reports embed DejaVu Sans (Bitstream Vera license; see `public/fonts/DejaVu-LICENSE.txt`).
