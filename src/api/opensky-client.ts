import type { Flight } from "../types/flight";

const TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const STATES_URL = "https://opensky-network.org/api/states/all";
const FLIGHTS_AIRCRAFT_URL = "https://opensky-network.org/api/flights/aircraft";
const CALLSIGN_PREFIX = "ETD";

let tokenCache: { token: string; expiresAt: number } | null = null;

async function fetchAccessToken(): Promise<string> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET not set");
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "EtihadGeometric/1.0 (+https://github.com/sungjea713/etihad_geometric)",
        Accept: "application/json",
      },
      body,
    });
  } catch (e) {
    const err = e as Error & { code?: string; cause?: unknown };
    throw new Error(`OpenSky token fetch threw: ${err.message} | code=${err.code ?? "n/a"} | cause=${JSON.stringify(err.cause ?? null)}`);
  }

  if (!res.ok) {
    throw new Error(`OpenSky token failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.token;
}

type OpenSkyState = [
  string,        // 0  icao24
  string | null, // 1  callsign
  string,        // 2  origin_country
  number | null, // 3  time_position
  number,        // 4  last_contact
  number | null, // 5  longitude
  number | null, // 6  latitude
  number | null, // 7  baro_altitude
  boolean,       // 8  on_ground
  number | null, // 9  velocity
  number | null, // 10 true_track
  number | null, // 11 vertical_rate
  number[] | null, // 12 sensors
  number | null, // 13 geo_altitude
  string | null, // 14 squawk
  boolean,       // 15 spi
  number,        // 16 position_source
];

export interface AircraftFlightRecord {
  icao24: string;
  firstSeen: number;
  lastSeen: number;
  estDepartureAirport: string | null;
  estArrivalAirport: string | null;
  callsign: string | null;
}

export async function fetchLastFlight(icao24: string): Promise<AircraftFlightRecord | null> {
  const token = await fetchAccessToken();
  const end = Math.floor(Date.now() / 1000);
  const begin = end - 24 * 3600;
  const url = `${FLIGHTS_AIRCRAFT_URL}?icao24=${icao24}&begin=${begin}&end=${end}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`[opensky] flights/aircraft ${icao24}: ${res.status}`);
    return null;
  }
  const data = (await res.json()) as AircraftFlightRecord[];
  if (!data.length) return null;
  return data.reduce((a, b) => (b.lastSeen > a.lastSeen ? b : a));
}

export async function fetchEtihadStates(): Promise<Omit<Flight, "origin" | "destination">[]> {
  const token = await fetchAccessToken();
  const res = await fetch(STATES_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "EtihadGeometric/1.0 (+https://github.com/sungjea713/etihad_geometric)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`OpenSky /states/all failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { states: OpenSkyState[] | null };
  if (!data.states) return [];

  const results: Omit<Flight, "origin" | "destination">[] = [];
  for (const s of data.states) {
    const callsign = (s[1] ?? "").trim();
    if (!callsign.startsWith(CALLSIGN_PREFIX)) continue;
    if (s[5] == null || s[6] == null) continue; // no position

    results.push({
      icao24: s[0],
      callsign,
      originCountry: s[2],
      longitude: s[5],
      latitude: s[6],
      baroAltitude: s[7],
      onGround: s[8],
      velocity: s[9],
      trueTrack: s[10],
      verticalRate: s[11],
      lastContact: s[4],
    });
  }
  return results;
}
