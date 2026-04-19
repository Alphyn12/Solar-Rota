# SolarRota — Web App UI Kit

Four core screens of the SolarRota calculation wizard, recreated with pixel-fidelity to the CSS tokens in the source repo (`css/style.css`, `css/pro-branding.css`).

## Screens
1. **Home** — workspace KPIs + recent projects
2. **Scenario** — the 6 calculation scenarios (step 01)
3. **Equipment** — module picker + BoM (step 04)
4. **Report** — final dashboard with production chart, donuts, verification status (step 07)

Use the bottom-right floating nav to jump between them.

## Components (reusable)
- `Topbar` — logo, nav, active project, avatar
- `Stepper` — 7-step wizard indicator with progress bar
- `ScenarioCard` — gradient-tinted scenario tile
- `KpiTile`, `DonutRing`, `ProductionChart` — data viz
- All button/input/chip primitives live in `kit.css`

## Files
- `index.html` — mounts the app
- `kit.css` — tokens + component primitives
- `App.jsx` — screens + routing
- Individual component JSX files
