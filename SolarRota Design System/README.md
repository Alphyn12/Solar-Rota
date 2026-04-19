# SolarRota Design System

A design system for **SolarRota** — a premium solar calculation and optimization platform for homeowners, businesses, and solar professionals. SolarRota helps users estimate solar potential, system sizing, energy production, financial return, and installation feasibility through a clean, modern, data-driven interface.

The product lives as a 7-step wizard: **Scenario → Location → Roof → Equipment → Finance → Calculate → Results**. Supported scenarios include On-Grid, Off-Grid, Agricultural Irrigation, Heat Pump, Flexible/Mobile, and EV Charging.

## Sources

- **Uploaded logo:** `uploads/20260418_2141_Image Generation_simple_compose_01kpgyar5aeg0bqt3hs420n1m5.png` → copied to `assets/solarrota-logo.png`
- **Codebase:** [Alphyn12/Solar-Rota](https://github.com/Alphyn12/Solar-Rota) (master branch). Key files read/imported:
  - `index.html` — root CSS variables, header, step panes, hero
  - `css/components.css`, `css/redesign.css`, `css/mobile.css`
  - `locales/en.json` — product copy & tone
  - `assets/solar-proposal-mark.svg`
  - `svg_files/*` — scenario icons (on-grid, off-grid, irrigation, heat-pump)

---

## Index

- `README.md` — this file (context, content & visual foundations, iconography)
- `colors_and_type.css` — CSS custom properties (colors, type, spacing, shadows, radii) + semantic base styles
- `fonts/` — (Google-font stubs: Space Grotesk display, Inter body — load via CDN)
- `assets/` — logo + SVG marks
- `svg_files/` — scenario icons (on-grid / off-grid / irrigation / heat-pump)
- `css/` — original imported stylesheets from the repo
- `preview/` — registered design-system preview cards (colors, type, components, brand)
- `ui_kits/solarrota-app/` — React-based UI kit recreating key screens
- `SKILL.md` — Claude Skill manifest (cross-compatible with Agent Skills)

---

## CONTENT FUNDAMENTALS

**Tone: precise, disciplined, technical-but-approachable.** SolarRota speaks like a senior solar engineer who is also your trusted advisor — it never oversells, never hides uncertainty. Every claim is qualified by the evidence behind it.

**Voice:**
- **Second-person, direct:** "Design your solar energy system with confidence." "Choose a scenario · Set the location · Get a disciplined estimate."
- **Noun-first, title-case headings:** "Equipment Selection", "Financial Parameters", "Your Results Are Ready".
- **Honest about confidence:** copy constantly distinguishes between *rough estimate*, *engineering estimate*, and *quote-ready candidate*. Disclaimers like "Pre-feasibility only — site measurement required" appear wherever uncertainty exists.
- **No hype, no emoji in UI chrome.** Minimal decorative emoji only in very specific warnings (⚠, ✓) and the occasional loading quote.

**Casing & punctuation:**
- Title Case for UI section headings ("Roof / layout assumptions", "System Summary")
- Sentence case for help text and descriptions
- Middle-dot separators for sequential actions ("Choose a scenario · Set the location · Get a disciplined estimate")
- Turkish/English/German trilingual — copy must travel well; avoid idioms

**Examples of the house voice:**
- Hero: *"Design your solar energy system **with confidence**."*
- Scenario card (On-Grid): *"Bill savings, self-consumption, export revenue, ROI, and proposal readiness."*
- Confidence hint: *"Best for commercial proposals when PVGIS, bill evidence, and source checks are verified."*
- Warning: *"Synthetic consumption profile in use — no real hourly data. Self-consumption estimate is conservative."*
- Off-grid honesty: *"Pre-feasibility only — site measurement and detailed energy analysis required for commercial offer."*

**Vibe:** engineering clarity meets premium financial product. Think *PVGIS + a clean trading dashboard*. Numbers are the hero. Copy supports them.

---

## VISUAL FOUNDATIONS

SolarRota's UI is a **dark, engineered interface** — deep navy canvas, amber (solar) as the primary accent, cyan as the secondary/technical accent, and a palette of scenario-specific colors that tag flows consistently.

### Palette
- **Background canvas:** `#0F172A` (near-black navy), with a body-wide gradient tint of amber in the top-left and cyan in the bottom-right (`bgDrift` animation, 18s)
- **Surface:** `#1E293B` solid and `rgba(255,255,255,0.03)` glass
- **Primary (Solar Amber):** `#F59E0B` with `#D97706` dark variant and `#FCD34D` highlight for gradient type treatments
- **Accent (Inverter Cyan):** `#06B6D4` / dark `#0891B2`
- **Scenario tags:** On-grid amber `#F59E0B`, Off-grid violet `#8B5CF6`, Irrigation green `#10B981`, Heat-pump pink `#EC4899`, Mobile cyan `#06B6D4`, EV blue `#3B82F6`
- **Status:** success `#10B981`, danger `#EF4444`, warning `#EAB308`
- **Text:** `#F1F5F9` primary, `#94A3B8` muted
- **Borders:** `#475569` solid, `rgba(255,255,255,0.08)` subtle

### Type
- **Display:** Space Grotesk (400–800), letter-spacing tightened `-0.03em` for headlines, `-0.04em` for KPIs.
- **Body:** Inter (400–700).
- **KPIs are huge:** `2.4rem` 800-weight, `-0.04em` letter-spacing, primary-colored.
- Headings frequently use a **text-gradient** (`linear-gradient(135deg,#F1F5F9 0%,#94A3B8 100%)`) with `-webkit-background-clip: text`.
- The logo wordmark uses a warmer gradient (`#F59E0B → #FCD34D`).

### Spacing & Radii
- Radii scale: `14px` (base) · `20px` (large) · `28px` (xl, hero CTA) · `40px` (2xl)
- Spacing is fluid but favors `14px`, `16px`, `24px` for card interiors
- Step-scale touch targets min 44px (Apple HIG / Material)

### Backgrounds
- Main body: dark navy with **two radial-gradient tint orbs** (amber top-left at 8% opacity, cyan bottom-right at 6%), slowly drifting
- Hero section: animated `--hero-gradient` (`135deg,#0A0F1E → #0F172A → #12203A → #0A0F1E`), floating solar-panel SVG ghosts at ~5% opacity with individual `floatPanel` animations (14–22s)
- Subtle SVG noise texture overlay on the whole page (`feTurbulence`, opacity 0.022)
- No images used as full-bleed backgrounds — backgrounds are pure color + SVG
- No hand-drawn illustrations

### Animation
- **Easing:** default `0.3s ease`; bouncy variant `0.4s cubic-bezier(0.34,1.56,0.64,1)` for card hover and scenario-card selection
- **Signature motions:** `floatPanel` (drifting solar panels), `sunRaysSpin` (logo rays rotate every 14s), `logoGlow` (drop-shadow pulse on logo), `cardGlowPulse` (amber box-shadow pulse on selected scenario), `pinDrop` (location pin on map), `slideUpCard` (bottom sheet), `heroFadeIn` (18px lift-in)
- **Step transitions:** 0.32s opacity fade only
- **No bounces on buttons;** buttons shrink on `:active` (`scale(0.97)`)

### Hover & Press
- Cards: lift `translateY(-2px)` to `-3px`, gain `shadow-glow-primary` (amber) or `shadow-glow-accent` (cyan), border brightens
- Buttons: `translateY(-1px)` + gradient brightening + a slanted shimmer sweep (pseudo-element that slides left→right in 0.5s)
- Press: `scale(0.97)` on all buttons, no color change
- Scenario cards: bouncy lift + animated top-edge gradient bar fades in

### Borders
- Subtle: 1px `rgba(255,255,255,0.08)` — default card
- Strong: 2px `var(--border)` (`#475569`) — inputs, inverter cards
- Selected: 2px scenario/accent color with a matching glow
- Left-border accents used sparingly, only for warning/info strips (`border-left: 3px solid var(--primary)`)

### Shadows (layered, never flat)
- `--shadow-sm`: 0 1px 3px rgba(0,0,0,0.3)
- `--shadow-md`: `0 4px 16px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)`
- `--shadow-glow-primary`: `0 0 24px rgba(245,158,11,0.3), 0 4px 16px rgba(0,0,0,0.4)`
- `--shadow-glow-accent`: `0 0 24px rgba(6,182,212,0.25), 0 4px 16px rgba(0,0,0,0.4)`
- `--shadow-card`: `0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)` — the signature glass card shadow, always paired with a **top-edge 1px inner highlight** via `::before`

### Transparency & Blur
- Glass surfaces everywhere: `rgba(255,255,255,0.03–0.06)` with `backdrop-filter: blur(8–24px) saturate(1.4–1.8)`
- The app header uses `rgba(15,23,42,0.85)` + blur 20px + saturate 1.6
- Bottom sheets use `rgba(15,23,42,0.97–0.98)` + blur 24px
- Use glass when the surface sits over map/content; use solid navy when it sits on empty canvas

### Imagery
- **Cool, technical, data-first.** When imagery appears, it's satellite maps (Leaflet), SVG diagrams (tilt/azimuth/compass/sun-path), and Chart.js charts.
- No stock photography, no people shots, no lifestyle imagery
- Scenario illustrations are flat 2-color SVGs with grid-line detail

### Cards — what they look like
- Glass fill, 1px subtle border, 14px radius, signature inset top-highlight, signature bevel shadow
- Title row uses the display font, primary-colored, `1rem 700`, with an optional 16px icon
- Hover lifts 2–3px, strengthens shadow, does not change border color (unless selectable)
- Selected-state cards: color-matched border + glow + tint overlay (amber for default, scenario color for scenario cards)

### ICONOGRAPHY

SolarRota does **not** use a packaged icon font. Every icon in the codebase is an inline SVG, stroke-based, drawn in a **Lucide / Feather-style** vocabulary:

- **Stroke:** `stroke="currentColor"`, `stroke-width="2"` (occasionally 2.5 on primary CTAs), `stroke-linecap="round"`
- **Fill:** `none` — strokes only. Exceptions: the logo sun (filled amber disc + rays), the `compass-svg`, tilt-diagram, sun-path diagrams, and the scenario cards (which layer a filled shape + details).
- **Viewbox:** 24×24 default for interface icons; 36×36 for the logo mark; complex diagrams run in a wider canvas (200×200 compass, 400×180 tilt diagram, etc.)
- **Sizes:** 13–18px inline with text, 40px logo, 44px scenario cell icon, 56px scenario card icon inside a rounded tile.
- **Color:** inherit from parent (`currentColor`) — this is how icons "go primary amber" on hover/active states.

**Scenario illustrations** (`svg_files/`) are larger conceptual SVGs (not simple glyphs): on-grid, off-grid, agricultural-irrigation, heat-pump. Use these at 44–56px inside the scenario chooser card's icon tile. They are 2-color illustrations that match the scenario color.

**Logo:** see `assets/solarrota-logo.png` (provided brand asset — blue solar-panel mark + wordmark swoosh). The in-app header currently uses an SVG amber sun (`<g>` rotating rays + inner disc) — retained as a secondary mark. Prefer the provided wordmark on marketing surfaces; prefer the sun mark on in-app chrome where it must animate.

**Emoji:** avoided in UI chrome. Two narrow exceptions exist in loading quotes and rare warning text (⚠, ✓, →). Never use emoji as primary iconography.

**Unicode glyphs as icons:** sparingly — an arrow `→` in a CTA suffix, `⬡` as a Leaflet-draw hex marker, `✓` in status chips. Always prefer an SVG equivalent for anything larger than body copy.

**CDN substitution note:** If a larger icon set is ever needed, use Lucide (`lucide.dev`) — it matches the stroke-2 round-cap style 1:1. No substitution is flagged today because the codebase's inline SVGs are sufficient for the ~30 icons in use.

### Layout rules
- Max content width `1200px`, padded `24px 16px 80px`
- Sticky header (88px tall), step dots sticky inside header
- Some steps break out of the grid (step-2 full-bleed map, step-3 60/40 split) — these use `width:100vw; margin-left: calc(50% - 50vw)`
- Mobile: sticky bottom nav with min 44/48px tap targets
