import { useEffect, useRef, useState } from "react";
import { ts } from "../utils/log";

interface Props {
  flightCount: number;
  enrichedCount: number;
  lastUpdate: number;
  mapReady: boolean;
}

const SUB_MESSAGES: Record<string, string[]> = {
  boot: [
    "Linking to OpenSky Network...",
    "Negotiating OAuth handshake...",
    "Spinning up satellites...",
  ],
  scan: [
    "Listening on 1090 MHz ADS-B...",
    "Filtering ETD callsigns...",
    "Waiting for fleet ping...",
  ],
  enrich: [
    "Cross-referencing FlightAware...",
    "Mapping origin → destination...",
    "Plotting great-circle paths...",
    "Reading takeoff / landing times...",
  ],
  render: [
    "Drawing flight paths...",
    "Initializing canvas...",
    "Rendering live fleet...",
  ],
};

const TITLES: Record<string, string> = {
  boot: "Establishing uplink",
  scan: "Scanning skies",
  enrich: "Acquiring flight plans",
  render: "Rendering map",
};

// pseudo timeline (ms from mount)
const T_BOOT = 0;
const T_SCAN = 700;
const T_ENRICH = 1300;
const T_RENDER = 2900;
const T_PSEUDO_DONE = 3500;

type Stage = "boot" | "scan" | "enrich" | "render";

export function LoadingHud({ flightCount, enrichedCount, lastUpdate, mapReady }: Props) {
  const mountedAtRef = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const [phase, setPhase] = useState<"show" | "fade" | "hidden">("show");

  // tick the clock until both pseudo timeline is done AND we've started fading
  useEffect(() => {
    if (phase !== "show") return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  const elapsed = now - mountedAtRef.current;
  const pseudoDone = elapsed >= T_PSEUDO_DONE;

  const dataReady =
    lastUpdate > 0 && flightCount > 0 && enrichedCount >= flightCount;
  const allReady = pseudoDone && dataReady && mapReady;

  useEffect(() => {
    if (!allReady) return;
    ts("hud_allReady", { dataReady, mapReady });
    const dwell = setTimeout(() => {
      ts("hud_phase_fade");
      setPhase("fade");
    }, 400);
    const gone = setTimeout(() => {
      ts("hud_phase_hidden");
      setPhase("hidden");
    }, 1100);
    return () => {
      clearTimeout(dwell);
      clearTimeout(gone);
    };
  }, [allReady, dataReady, mapReady]);

  // fallback: if dataReady or mapReady never come, fade out after a long time
  useEffect(() => {
    if (phase !== "show" || allReady) return;
    if (!pseudoDone) return;
    const fb = setTimeout(() => setPhase("fade"), 4000);
    const fbGone = setTimeout(() => setPhase("hidden"), 4700);
    return () => {
      clearTimeout(fb);
      clearTimeout(fbGone);
    };
  }, [phase, allReady, pseudoDone]);

  if (phase === "hidden") return null;

  // compute pseudo stage from elapsed time
  let stage: Stage;
  if (elapsed < T_SCAN) stage = "boot";
  else if (elapsed < T_ENRICH) stage = "scan";
  else if (elapsed < T_RENDER) stage = "enrich";
  else stage = "render";

  // pseudo enriched count animates 0 → target during enrich stage
  const enrichTotal = Math.max(flightCount, 1);
  const enrichProgress =
    stage === "enrich"
      ? Math.max(0, Math.min(1, (elapsed - T_ENRICH) / (T_RENDER - T_ENRICH)))
      : stage === "render" || allReady
      ? 1
      : 0;
  const pseudoEnriched = Math.floor(enrichProgress * enrichTotal);

  // pick rotating sub-message
  const subs = SUB_MESSAGES[stage];
  const subIdx = Math.floor(elapsed / 800) % subs.length;
  const sub = allReady ? "All systems nominal" : subs[subIdx];
  const title = allReady ? "Ready" : TITLES[stage];
  const progress =
    stage === "enrich" && !allReady ? `${pseudoEnriched} / ${enrichTotal}` : null;

  return (
    <div className={`loading-hud ${phase === "fade" ? "fading" : ""}`}>
      <div className="loading-spinner-wrap">
        <div className="loading-spinner" />
        <div className="loading-spinner loading-spinner-inner" />
        <div className="loading-icon">✈</div>
      </div>
      <div className="loading-body">
        <div className="loading-title">
          {title}
          {progress ? <span className="loading-progress"> [{progress}]</span> : null}
        </div>
        <div className="loading-sub">{sub}</div>
      </div>
    </div>
  );
}
