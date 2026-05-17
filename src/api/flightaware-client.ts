import type { Airport } from "../types/flight";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface FlightAwareRoute {
  origin?: Airport;
  destination?: Airport;
  aircraftType?: string;
  status?: string;
  takeoff?: number;
  landing?: number;
}

function pickTime(t: { actual?: number | null; estimated?: number | null; scheduled?: number | null } | undefined): number | undefined {
  if (!t) return undefined;
  return t.actual ?? t.estimated ?? t.scheduled ?? undefined;
}

function parseAirport(data: any): Airport | undefined {
  if (!data || !data.icao || !Array.isArray(data.coord) || data.coord.length !== 2) {
    return undefined;
  }
  const [lng, lat] = data.coord;
  if (typeof lng !== "number" || typeof lat !== "number") return undefined;
  const loc = String(data.friendlyLocation ?? "");
  const [city, country] = loc.split(",").map((s) => s.trim());
  return {
    icao: data.icao,
    name: data.friendlyName ?? data.icao,
    city: city ?? "",
    country: country ?? "",
    lat,
    lng,
  };
}

function extractBalancedJson(html: string, marker: string): string | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  let i = idx + marker.length;
  while (i < html.length && /\s/.test(html[i])) i++;
  if (html[i] !== "{") return null;
  const start = i;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === '"') inString = false;
    } else {
      if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return html.slice(start, i + 1);
      }
    }
  }
  return null;
}

export async function fetchFlightAwareRoute(callsign: string): Promise<FlightAwareRoute | null> {
  const cs = callsign.trim();
  if (!cs) return null;
  const url = `https://ko.flightaware.com/live/flight/${encodeURIComponent(cs)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko,en;q=0.8" },
  });
  if (!res.ok) {
    console.error(`[flightaware] ${cs}: HTTP ${res.status}`);
    return null;
  }
  const html = await res.text();
  const raw = extractBalancedJson(html, "trackpollBootstrap =");
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    const flights = json?.flights ?? {};
    const firstKey = Object.keys(flights)[0];
    if (!firstKey) return null;
    const logs: any[] = flights[firstKey]?.activityLog?.flights ?? [];
    if (logs.length === 0) return null;

    const primary = logs[0];
    // some adhoc / in-progress flights leave fields null on the first record —
    // walk later records to back-fill what we can
    const originFallback = logs.find((l: any) => parseAirport(l.origin));
    const destFallback = logs.find((l: any) => parseAirport(l.destination));
    const acTypeFallback = logs.find((l: any) => l.aircraftTypeFriendly);
    const landingFallback = logs.find((l: any) => pickTime(l.landingTimes));

    return {
      origin: parseAirport(primary.origin) ?? (originFallback ? parseAirport(originFallback.origin) : undefined),
      destination: parseAirport(primary.destination) ?? (destFallback ? parseAirport(destFallback.destination) : undefined),
      aircraftType: primary.aircraftTypeFriendly ?? acTypeFallback?.aircraftTypeFriendly,
      status: primary.flightStatus,
      takeoff: pickTime(primary.takeoffTimes),
      landing: pickTime(primary.landingTimes) ?? (landingFallback ? pickTime(landingFallback.landingTimes) : undefined),
    };
  } catch (e) {
    console.error(`[flightaware] ${cs} JSON parse failed:`, e);
    return null;
  }
}
