# Data sources

## OpenSky Network (positions)

- Endpoint: `https://opensky-network.org/api/states/all`
- Auth: OAuth2 client_credentials, token URL `https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token`
- Response: `{ time, states: [[icao24, callsign, country, time_position, last_contact, lng, lat, baro_alt, on_ground, velocity, true_track, vertical_rate, sensors, geo_alt, squawk, spi, position_source], ...] }`
- We filter to `callsign.trim().startsWith("ETD")` server-side. Drops the ~10k state response to ~20–30 entries.
- Daily credits: 4,000 for standard accounts. `/states/all` no-bbox = 4 credits per call.

## FlightAware (route + schedule enrichment)

- URL pattern: `https://ko.flightaware.com/live/flight/{CALLSIGN}` (Korean locale gives translated friendly names)
- HTML embeds `var trackpollBootstrap = { ... };` near the page top. Extract with balanced-brace JSON parser.
- Path to the useful entry:

```js
json.flights[firstKey].activityLog.flights[0]   // primary (current flight)
```

Shape (truncated):

```ts
{
  origin: { icao, iata, friendlyName, friendlyLocation: "City, Country", coord: [lng, lat] } | null,
  destination: { ...same... } | null,
  aircraftType: "B77W",
  aircraftTypeFriendly: "Boeing 777-300ER (twin-jet)",
  flightStatus: "airborne" | "scheduled" | ...,
  takeoffTimes: { scheduled, estimated, actual } | null,
  landingTimes: { scheduled, estimated, actual } | null,
  // ... and many more we don't use
}
```

### Field fallbacks

In-progress / adhoc flights often have nulls on the **first** entry. Walk the array for the first entry that has the field:

| Field | Fallback strategy |
| --- | --- |
| `origin` | first entry with valid `parseAirport(origin)` |
| `destination` | first entry with valid `parseAirport(destination)` |
| `aircraftType` | first entry with `aircraftTypeFriendly` |
| `landing` | first entry with valid `landingTimes` |
| `takeoff` | use primary only (current flight) |
| `status` | use primary only |

`takeoff` is the only field that **must** come from the primary entry — historical takeoff times would be wrong.

## Time picker

`pickTime({ actual, estimated, scheduled })` returns the first defined value in priority `actual > estimated > scheduled`. Returns `undefined` if all are null.

## Things we do not call

- `/api/flights/aircraft` (OpenSky historical flights) — too sparse, often returns null airports for currently-airborne aircraft. FlightAware gives us better data.
- OpenFlights `airports.dat` — not needed once FlightAware provides coords directly. The loader at `src/api/airports.ts` is kept for future reuse but unused at runtime.
- Aviation Edge / AviationStack — paid, only worth it for commercial deploy with strict accuracy SLA.
