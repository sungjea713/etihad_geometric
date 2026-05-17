# Etihad Geometric — Project Guide

Real-time flight tracker for Etihad Airways. Bun fullstack app deployed to Render.com.

## What it is

- Pulls live aircraft positions from **OpenSky Network** every 90s
- Filters to Etihad fleet by ICAO callsign prefix `ETD`
- Enriches each callsign with origin / destination / aircraft type / scheduled times by scraping **FlightAware** public flight pages
- Renders two synchronized views: **2D MapLibre** map and **3D CesiumJS** globe
- Sci-fi neon HUD style (green countries / amber planes), animated star field background, click-to-popup flight details

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | Bun 1.3 (`Bun.serve()` + HTML imports, no bundler config) |
| Frontend | React 19, MapLibre GL JS 4, CesiumJS 1.141 |
| Backend | Bun.serve routes, no framework |
| Data | OpenSky Network (OAuth2) + FlightAware public pages |
| Deploy | Render.com — `bun.lock` triggers Bun runtime auto-detect |

## Quick start

```bash
cp .env.example .env   # fill in keys
bun install            # postinstall copies cesium assets
bun run dev            # bun --hot src/server.ts
# → http://localhost:5016
```

## Environment

| Key | Source | Required |
| --- | --- | --- |
| `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` | https://opensky-network.org/my-opensky/account | yes |
| `CESIUM_ION_TOKEN` | https://ion.cesium.com/tokens | recommended (otherwise OSM fallback) |
| `PORT` | local default 5016; Render injects | no |

`.env` is auto-loaded by Bun. `credentials.json` (Etihad/OpenSky download) is gitignored.

## Directory layout

```
src/
├── server.ts                  # Bun.serve routes + SPA fallback
├── index.html                 # HTML import entry, loads /client/App.tsx
├── api/
│   ├── router.ts              # /api/* dispatcher + timing logs
│   ├── opensky-client.ts      # OAuth2 token cache + /states/all
│   ├── flightaware-client.ts  # HTML scrape + bootstrap JSON parse
│   ├── flight-cache.ts        # in-memory store + lazy enrichment
│   └── airports.ts            # unused fallback, kept for reuse
├── client/
│   ├── App.tsx                # tab routing + visibility state
│   ├── hooks/useFlights.ts    # 30s polling with Page Visibility pause
│   ├── components/
│   │   ├── TwoDMap.tsx        # MapLibre setup + plane/route/endpoint layers
│   │   ├── ThreeDGlobe.tsx    # Cesium viewer + click-anchored popup
│   │   ├── StarField.tsx      # canvas star background animation
│   │   ├── LoadingHud.tsx     # boot → scan → enrich → render → ready
│   │   ├── FlightTable.tsx    # collapsible fleet table w/ checkboxes
│   │   ├── TabBar.tsx
│   │   └── flight-popup.ts    # shared popup HTML builder
│   ├── utils/log.ts           # ts() client → server timing logs via /api/log
│   └── styles/global.css
└── types/flight.ts            # Flight + Airport shared types

public/cesium/                 # Cesium static assets (copied by postinstall)
scripts/copy-cesium-assets.ts
render.yaml
.claude/rules/                 # focused conventions per domain
```

## Data pipeline timing

```
client polls /api/flights every 30s          (Page Visibility aware)
        │
        ▼
backend cache (90s TTL — OpenSky daily-credit budget)
        │ miss → fetchEtihadStates()  (OpenSky /states/all, ~1–3s, 4 credits)
        │       → store positions
        │       → background enrichRoute() per icao24
        │              → fetchFlightAwareRoute() (HTML scrape, ~500KB, ~1s each)
        │              → origin / dest / takeoff / landing / aircraftType
        │              → 6-hour cache per callsign
        ▼
JSON response: { flights[], lastRefresh, count }
```

OpenSky daily budget: ~960 calls/day at 90s TTL × 4 credits = 3,840 / 4,000 budget.

## Render.com deploy

`bun.lock` in the repo triggers Bun runtime auto-detect. `render.yaml` provided.

```yaml
buildCommand: bun install
startCommand: bun src/server.ts
envVars: OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET, CESIUM_ION_TOKEN
```

`postinstall` runs `scripts/copy-cesium-assets.ts` → copies `node_modules/cesium/Build/Cesium` to `public/cesium/` so the SPA can load Cesium assets at `/cesium/*`.

## Known constraints

- **OpenSky free tier** is non-commercial only. Daily credit limit ~4,000. Don't drop TTL below 90s without re-checking the budget.
- **FlightAware scraping** is in a gray area of their ToS — fine for personal / demo use at our cache rates (1 fetch per callsign per 6h). For commercial use switch to AeroAPI (paid).
- `wgs84ToWindowCoordinates` is removed in newer Cesium — use `worldToWindowCoordinates` (we keep a fallback for older versions).
- MapLibre `useEffect[flights]` does **not** re-run when `flights` prop reference is stable. The first `pushData` after `map.on("load")` must use a `flightsRef.current` snapshot, not the closure variable.

## Domain rules

Detailed conventions live in [`.claude/rules/`](./.claude/rules/):

- [`backend.md`](./.claude/rules/backend.md) — cache TTLs, API timing, OAuth handling, scraping safety
- [`frontend.md`](./.claude/rules/frontend.md) — React patterns, MapLibre/Cesium gotchas, ready signaling
- [`design.md`](./.claude/rules/design.md) — color palette, animation budgets, popup card structure
- [`data-sources.md`](./.claude/rules/data-sources.md) — OpenSky + FlightAware response shapes and fallbacks
