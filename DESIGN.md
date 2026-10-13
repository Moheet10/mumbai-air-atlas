# DESIGN.md — Mumbai Air Quality Dashboard

This file is the source of truth for all visual decisions. AI agents: read it before every UI change. If a request conflicts with this file, follow this file and say so.

## Direction

Editorial data journalism. It should feel like a page from a newspaper's data desk, not a SaaS dashboard. Calm, dense with information, typographic first. One theme only (light). No dark mode.

## Color tokens

```css
:root {
  --paper:   #F4EFE6;  /* page background */
  --paper-2: #EBE4D6;  /* panels, subtle fills */
  --ink:     #1B1A17;  /* primary text, chart lines */
  --ink-2:   #6B665C;  /* secondary text, axis labels */
  --rule:    #D9D2C3;  /* hairlines, gridlines */

  /* CPCB AQI categories — the ONLY accent colors in the app */
  --aqi-good:         #4C8C6B;  /*   0–50  */
  --aqi-satisfactory: #A3B56A;  /*  51–100 */
  --aqi-moderate:    #E0B341;  /* 101–200 */
  --aqi-poor:        #D9772B;  /* 201–300 */
  --aqi-very-poor:   #B53A2D;  /* 301–400 */
  --aqi-severe:      #6E1F2B;  /* 401–500 */
}
```

Rules:
- Color is data. Never use the AQI colors decoratively. Everything else is paper, ink, and rules.
- Forecast uncertainty bands: `--ink` at 12% opacity.
- Interactive elements (links, buttons): ink text with an underline. No filled colored buttons.

## Typography

Two fonts only.
- **Newsreader** (Google Fonts): headlines, body text, captions. Headlines at weight 500, tight leading (1.1). Body 18px, leading 1.55, max line width 65ch.
- **IBM Plex Mono**: every number, label, axis tick, timestamp, station ID. Use tabular figures.

Scale: 12 / 14 / 18 / 24 / 36 / 56 / 88px. The AQI hero number can go to 88px in Plex Mono.

Do not use Inter, Poppins, Space Grotesk, Roboto, or system-ui defaults.

## Layout and spacing

- 8px base unit. Spacing steps: 8, 16, 24, 40, 64, 96.
- 12-column grid, max content width 1200px, generous outer margins.
- Structure with 1px `--rule` hairlines and whitespace, not cards with shadows.
- Corner radius: 0 everywhere, except 2px on inputs.
- No box shadows. No gradients. No glassmorphism. No blur.
- Charts sit directly on the paper with hairline axes. No chart "cards".

## Components

- **Hero:** a single large AQI number with its category name, a one-sentence plain-English summary, and a timestamp. Nothing else above the fold.
- **Map:** MapLibre with a muted, low-saturation basemap (paper-toned). Stations are circles filled with their AQI category color, 1px ink stroke.
- **Forecast chart:** ink line for observed, dashed ink line for forecast, shaded uncertainty band, thin vertical rule at "now". Annotate notable events directly on the chart with small mono labels.
- **What changed panel:** 2 to 4 sentences of generated plain text explaining the latest anomaly, with weather values in mono.
- **Model honesty box:** always visible somewhere: forecast MAE vs the naive baseline MAE. If the model is only marginally better, the page says so.

## Motion

- Default: none. Page loads without entrance animations.
- Allowed: 150ms opacity/underline transitions on hover; chart line drawing in once on first load (600ms, ease-out); the hero number counting up once.
- Respect `prefers-reduced-motion`.
- ReactBits and other effect libraries: do not use them for this project except for the hero number count-up if needed. Flashy animated components fight the editorial direction.

## Icons and imagery

- No emoji. No icon-in-a-circle decorations.
- Icons only where they carry meaning (e.g. a wind direction arrow). Thin 1.5px line style, ink color.
- No stock illustrations, no AI-generated imagery.

## Banned patterns (the "AI look")

Purple/blue gradients, centered hero with two CTA buttons, three-column feature cards with icons, rounded-2xl cards with soft shadows, glowing borders, bento grids, gradient text, "Welcome to..." copy, lorem ipsum, fake testimonials.

## Copy

Plain, specific, a little dry. State numbers and units. Say "PM2.5 reached 142 µg/m³ at Bandra at 6 a.m." not "Air quality was bad." No exclamation marks.

## Working rules for AI agents

1. Build one screen or component per request, then stop and screenshot it with the Playwright MCP at 1440px and 390px widths. Fix spacing and alignment issues before moving on.
2. Use only the CSS variables above. Never introduce a hex value inline.
3. Do not add dependencies without asking.
4. Before finishing, list any place where you deviated from this file.
