# Etihad Geometric

Real-time Etihad Airways flight tracker — Bun fullstack app with a 2D MapLibre map and a 3D CesiumJS globe.

Live aircraft positions via **OpenSky Network**, route enrichment (origin / destination / scheduled times / aircraft type) via **FlightAware** public flight pages.

## Features

- **2D Map** — sci-fi dark theme, neon green country borders, amber plane icons that rotate to heading
- **3D Globe** — same data on a rotating Earth (CesiumJS + Cesium Ion imagery if token provided, OSM fallback otherwise)
- **Flight Table** (top-right, collapsible) — callsign / from / to / dep / arr with per-flight visibility toggles + Select all / Clear all
- **Click-anchored popup** — full flight card in both views; the 3D card follows the plane as the globe rotates
- **Animated star field** background with rare shooting stars
- **Sci-fi loading HUD** with progressive stages: Establishing uplink → Scanning skies → Acquiring flight plans → Rendering map → Ready

## Quick start

```bash
cp .env.example .env   # fill OpenSky + Cesium Ion keys
bun install            # postinstall copies Cesium static assets
bun run dev            # http://localhost:5016
```

| Key | Where to get it |
| --- | --- |
| `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` | https://opensky-network.org/my-opensky/account (free, non-commercial) |
| `CESIUM_ION_TOKEN` | https://ion.cesium.com/tokens (free tier) |
| `PORT` | local default 5016; Render injects |

## Deploy to Render

`bun.lock` triggers Bun runtime auto-detection. `render.yaml` provided.

```bash
git push                       # Render web service auto-builds
# Set the three env vars in the Render dashboard
```

## Project structure

```
src/
├── server.ts                  # Bun.serve routes + SPA fallback
├── api/                       # OpenSky + FlightAware clients, cache
├── client/                    # React 19 SPA
│   ├── components/            # TwoDMap, ThreeDGlobe, FlightTable, ...
│   ├── hooks/useFlights.ts    # 30s polling, Page Visibility aware
│   └── utils/log.ts           # client → server timing logger
└── types/flight.ts
```

For implementation conventions and gotchas see [CLAUDE.md](./CLAUDE.md) and [`.claude/rules/`](./.claude/rules/).

## Notes / limits

- OpenSky free tier is **non-commercial** with a daily credit budget. Backend cache TTL stays at 90s to keep usage at ~96% of the daily limit.
- FlightAware scraping is in a ToS gray area — fine for personal / demo. For commercial use switch to AeroAPI.
- 28 parallel FlightAware fetches on cold start takes ~30s; subsequent loads use the 6h enrichment cache.
