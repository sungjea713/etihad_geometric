import { fetchEtihadStates } from "./opensky-client";
import { fetchFlightAwareRoute } from "./flightaware-client";
import type { Airport, Flight, FlightsResponse } from "../types/flight";

const TTL_MS = 90_000;
const STALE_MS = 30 * 60 * 1000;
const ROUTE_REFETCH_OK_MS = 6 * 3600 * 1000;       // full success — refresh every 6h
const ROUTE_REFETCH_PARTIAL_MS = 15 * 60 * 1000;   // got the page but missing fields — retry in 15m
const ROUTE_REFETCH_FAIL_MS = 5 * 60 * 1000;       // page fetch errored / empty — retry in 5m

interface Entry {
  latest: Omit<Flight, "origin" | "destination" | "takeoff" | "landing" | "aircraftType">;
  lastSeen: number;
  origin?: Airport;
  destination?: Airport;
  takeoff?: number;
  landing?: number;
  aircraftType?: string;
  routeFetchedAt?: number;
  routeInFlight?: boolean;
}

const store = new Map<string, Entry>();
let lastRefresh = 0;
let inFlight: Promise<void> | null = null;

async function enrichRoute(icao24: string, callsign: string) {
  const entry = store.get(icao24);
  if (!entry || entry.routeInFlight) return;
  entry.routeInFlight = true;
  try {
    const route = await fetchFlightAwareRoute(callsign);
    if (!route) {
      // FlightAware fetch failed or page had no bootstrap JSON — short retry
      entry.routeFetchedAt = Date.now() - (ROUTE_REFETCH_OK_MS - ROUTE_REFETCH_FAIL_MS);
    } else if (!route.origin && !route.destination) {
      // got the page but no airport info — retry in 15m
      entry.routeFetchedAt = Date.now() - (ROUTE_REFETCH_OK_MS - ROUTE_REFETCH_PARTIAL_MS);
    } else {
      entry.routeFetchedAt = Date.now();
    }
    if (route?.origin) entry.origin = route.origin;
    if (route?.destination) entry.destination = route.destination;
    if (route?.takeoff) entry.takeoff = route.takeoff;
    if (route?.landing) entry.landing = route.landing;
    if (route?.aircraftType) entry.aircraftType = route.aircraftType;
  } catch (e) {
    console.error("[enrich]", callsign, e);
    // also a short retry on throw
    entry.routeFetchedAt = Date.now() - (ROUTE_REFETCH_OK_MS - ROUTE_REFETCH_FAIL_MS);
  } finally {
    entry.routeInFlight = false;
  }
}

async function doRefresh(): Promise<void> {
  const t0 = Date.now();
  console.log(`[cache] doRefresh start (store.size=${store.size})`);
  const states = await fetchEtihadStates();
  console.log(`[cache] fetchEtihadStates done in ${Date.now() - t0}ms → ${states.length} states`);
  const now = Date.now();

  for (const s of states) {
    const prev = store.get(s.icao24);
    const callsignChanged =
      prev?.latest && prev.latest.callsign.trim() !== s.callsign.trim();
    store.set(s.icao24, {
      latest: s,
      lastSeen: now,
      origin: callsignChanged ? undefined : prev?.origin,
      destination: callsignChanged ? undefined : prev?.destination,
      takeoff: callsignChanged ? undefined : prev?.takeoff,
      landing: callsignChanged ? undefined : prev?.landing,
      aircraftType: callsignChanged ? undefined : prev?.aircraftType,
      routeFetchedAt: callsignChanged ? undefined : prev?.routeFetchedAt,
      routeInFlight: prev?.routeInFlight,
    });

    const stale =
      callsignChanged ||
      !prev?.routeFetchedAt ||
      now - prev.routeFetchedAt > ROUTE_REFETCH_OK_MS;
    if (stale) {
      enrichRoute(s.icao24, s.callsign);
    }
  }

  for (const [icao, entry] of store) {
    if (now - entry.lastSeen > STALE_MS) {
      store.delete(icao);
    }
  }

  lastRefresh = now;
}

async function maybeRefresh(): Promise<void> {
  if (Date.now() - lastRefresh < TTL_MS) return;
  if (inFlight) return inFlight;
  inFlight = doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export async function getFlights(): Promise<FlightsResponse> {
  try {
    await maybeRefresh();
  } catch (err) {
    console.error("[flight-cache] refresh failed:", err);
  }
  const flights: Flight[] = [];
  let enriching = 0;
  for (const entry of store.values()) {
    if (!entry.routeFetchedAt) enriching++;
    flights.push({
      ...entry.latest,
      origin: entry.origin,
      destination: entry.destination,
      takeoff: entry.takeoff,
      landing: entry.landing,
      aircraftType: entry.aircraftType,
    });
  }
  return { flights, lastRefresh, count: flights.length, enriching };
}

export function getStatus() {
  return { count: store.size, lastRefresh };
}
