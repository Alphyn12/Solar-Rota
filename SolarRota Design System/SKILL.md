---
name: solarrota-design
description: Use this skill to generate well-branded interfaces and assets for SolarRota, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference

- **Tokens:** `colors_and_type.css` — CSS variables for the full color + type system, copy-pasteable into any HTML file.
- **Assets:** `assets/logo.png` (and `solarrota-logo.png`) — primary brand lockup.
- **UI kit:** `ui_kits/web_app/` — the 7-step calculation wizard recreated with React + Babel. Re-usable `Topbar`, `Stepper`, `ScenarioCard`, `KpiTile`, `DonutRing`, `ProductionChart`, plus `kit.css` primitives (buttons, inputs, chips, glass cards).
- **Card previews:** `preview/*.html` — small specimens for colors, type, spacing, components, brand.

## Core brand rules

- Dark canvas (#0F172A) with dual radial wash: amber top-left, cyan bottom-right.
- **Amber (#F59E0B → #FCD34D) is sacred.** It signals active / selected / "this is the primary CTA". Use once per screen.
- Cyan (#06B6D4) is the second voice — accents, efficiency metrics, trusted-data indicators.
- Everything else is slate — surfaces, borders, muted text. No additional hues.
- Scenario accents are **tonal ramps** of amber/cyan/slate, not a rainbow.
- Type: Space Grotesk for display + numerals (tabular-nums always), Inter for body. Tight tracking on display (−4% to −6%).
- Glass cards over dark canvas; inner top highlight + soft outer shadow.
- Radii: 14 cards, 20 panels, 28 hero, 40 pills.
- Tone: precise, disciplined, evidence-based. "Verified", "reconciled", "PVGIS-matched". Never effusive.
