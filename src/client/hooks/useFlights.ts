import { useEffect, useRef, useState } from "react";
import type { Flight, FlightsResponse } from "../../types/flight";
import { ts } from "../utils/log";

const POLL_MS = 30_000;

export function useFlights() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [enriching, setEnriching] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      ts("fetch_start");
      try {
        const res = await fetch("/api/flights");
        ts("fetch_response", { status: res.status });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FlightsResponse;
        const enriched = data.flights.filter((f) => f.origin).length;
        ts("fetch_parsed", { count: data.count, enriched });
        if (cancelled) return;
        setFlights(data.flights);
        setLastUpdate(data.lastRefresh);
        setEnriching(data.enriching ?? 0);
        setError(null);
        ts("setstate_done");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    function schedule() {
      if (document.visibilityState === "hidden") return;
      timerRef.current = setTimeout(async () => {
        await poll();
        schedule();
      }, POLL_MS);
    }

    poll().then(schedule);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (timerRef.current) clearTimeout(timerRef.current);
        poll().then(schedule);
      } else if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { flights, lastUpdate, enriching, error };
}
