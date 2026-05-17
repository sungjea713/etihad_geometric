# Backend rules

## OpenSky usage

- OAuth2 client_credentials grant. Cache the access_token in module-level state and refresh ~60s before expiry. Do not re-fetch per request.
- `/states/all` (no bbox) costs **4 credits per call**. Standard accounts get 4,000 credits/day. Hard floor for `TTL_MS` in [`flight-cache.ts`](../../src/api/flight-cache.ts) is **90s** — anything lower will exhaust the daily budget.
- Filter to Etihad on the server with `callsign.trim().startsWith("ETD")`. Don't ship the full 10–20k state vector to clients.
- If OpenSky returns 429 / 503, just log and reuse the last cached response. Never block on retries.

## FlightAware scraping

- Public page URL: `https://ko.flightaware.com/live/flight/{CALLSIGN}` (Korean locale gives nicer airport names).
- The page embeds a `trackpollBootstrap = {...};` JSON blob — extract with a **balanced-brace parser**, not a lazy regex (regex truncates at the first `}` in nested JSON).
- First entry in `activityLog.flights` is the current flight, but adhoc/in-progress flights sometimes have `destination`, `landing`, or `aircraftType` null. **Fall back to the next entry that has the field** — same callsign usually flies the same route.
- Cache per-icao24 enrichment for **6 hours** (`ROUTE_REFETCH_MS`). New aircraft or callsign-change triggers a re-fetch.
- Always send `User-Agent: Mozilla/5.0 Chrome/126.0` — bare requests get blocked.
- 28 parallel fetches on cold cache is fine; takes ~30s. Don't add concurrency limiting unless we get blocked.
- ToS gray area. Personal / demo use at this rate is fine. **For commercial use switch to AeroAPI.**

## Cache shape

`flight-cache.ts` keeps a `Map<icao24, Entry>`:
- `latest`: current OpenSky state (position, heading, speed)
- `origin` / `destination` / `takeoff` / `landing` / `aircraftType`: enriched from FlightAware
- `routeFetchedAt`: timestamp of last enrichment attempt (success or failure)
- `routeInFlight`: bool guard against concurrent enrich for the same icao

If callsign changes for the same icao24, **reset** all enriched fields — the aircraft is on a different flight.

## Request handlers

All routes in [`router.ts`](../../src/api/router.ts). Pattern:
- Wrap each branch in try/catch; return JSON `{ error }` on throw.
- Don't add request validation libraries — the surface is small.
- `/api/flights` already prints a per-request timing log (`count`, `origin enriched count`, total ms). Keep it.
- `/api/log` accepts client-side events for unified server-side timeline debugging.

## Bun specifics

- Don't use `node:fs` / `node:http` — use `Bun.file`, `Bun.serve`, `Bun.$`.
- `.env` is auto-loaded; do not import `dotenv`.
- Top-level `await` works at module scope.
- `bun --hot` hot-reloads modules but **module-level state (Map, intervals) persists** until full process restart.
