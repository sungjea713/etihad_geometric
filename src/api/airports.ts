import type { Airport } from "../types/flight";

const URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat";

let cache: Map<string, Airport> | null = null;
let loading: Promise<void> | null = null;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const c of line) {
    if (c === '"') q = !q;
    else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

async function load(): Promise<void> {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`airports.dat fetch failed ${res.status}`);
  const text = await res.text();
  const map = new Map<string, Airport>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (cols.length < 8) continue;
    const icao = cols[5];
    if (!icao || icao === "\\N" || icao.length !== 4) continue;
    const lat = parseFloat(cols[6]);
    const lng = parseFloat(cols[7]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    map.set(icao, {
      icao,
      name: cols[1],
      city: cols[2],
      country: cols[3],
      lat,
      lng,
    });
  }
  cache = map;
  console.log(`[airports] loaded ${cache.size} ICAO entries`);
}

export async function getAirport(icao: string | null | undefined): Promise<Airport | null> {
  if (!icao) return null;
  if (!cache) {
    if (!loading) {
      loading = load().catch((e) => {
        console.error("[airports]", e);
        loading = null;
      });
    }
    await loading;
  }
  return cache?.get(icao) ?? null;
}
