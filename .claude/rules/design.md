# Design rules

## Palette

| Token | Hex | Usage |
| --- | --- | --- |
| Background | `#02060d` | App + map background |
| Surface | `#030a10` | Solid cards (flight table) |
| Border / accent green | `#00ff9c` | Neon — country borders, brand, status, country labels |
| Plane / route accent | `#ffd60a` | Amber — plane fill, route lines, arrow chevron, takeoff highlight |
| Plane outline | `#1a0d00` | Dark amber for plane stroke |
| Text primary | `#d8f5e8` | High-contrast on dark |
| Text muted | `#6b8a7f` | Labels, sub-text |
| Country label | `#9affd0` | Slightly desaturated green |

## Typography

- `ui-monospace, "SF Mono", Menlo, monospace` everywhere — gives the sci-fi console feel.
- UPPERCASE + letter-spacing 0.5–1.8px for headings, callsigns, tags.
- Sans-serif only inside MapLibre via the embedded `Open Sans Semibold` (demotiles glyphs).

## 2D map layer order (bottom → top)

1. `bg` (background, transparent — star canvas shows through ocean)
2. `country-fill` (0.85 alpha so stars peek through faintly on land)
3. `country-glow` (3px breathing line)
4. `country-line` (0.6px sharp line)
5. `country-label` (NAME, sized by zoom, halo)
6. `routes-glow` (10px amber blur, opacity 0.14)
7. `routes-line` (dashed amber, flown 0.55 / planned 0.35)
8. `endpoints-halo` + `endpoints-dot` + `endpoints-arrow` (destination chevron) + `endpoints-label`
9. `planes-pulse` (animated radar ping image)
10. `planes-symbol` (plane icon rotated to heading)

## Animation budget per element

- Star halo + spike: only when alpha > 0.4 — skip the work on dim stars.
- Plane pulse: 2.2s loop, three rings staggered 1/3 cycle apart.
- Country breath: 1.8s sine, opacity and width vary in anti-phase.
- Loading spinner: outer 1.4s clockwise, inner 1.8s counter — never the same period.

## Popup card

[`flight-popup.ts`](../../src/client/components/flight-popup.ts) is shared between 2D MapLibre popups and 3D Cesium popups. Always go through `buildPopupHtml()` so both views stay in sync.

Structure:
1. Header: callsign (amber, glow) + aircraft type (green) + origin country (muted uppercase)
2. Route: `FROM {ICAO · CITY}` / `TO {ICAO · CITY}` lines with green `FROM`/`TO` tag chips
3. Times: Departure / Arrival / Total / Remaining (computed `landing - takeoff`, `landing - now`)
4. Telemetry: Altitude (ft) / Speed (kt) / Heading (°)

Sections separated by 1px amber borders.

## Loading HUD

- Center of viewport, fixed size ~480px wide
- Double-ring spinner (green outer, amber inner, opposite directions)
- Title UPPERCASE + blinking dot suffix
- Sub-message rotates every 2.2s, fades in/out
- Fade out by translating up `12px` + opacity 0 over 500ms — gentler than just disappearing
