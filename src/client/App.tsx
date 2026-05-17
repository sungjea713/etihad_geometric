import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { TabBar } from "./components/TabBar";
import { TwoDMap } from "./components/TwoDMap";
import { ThreeDGlobe } from "./components/ThreeDGlobe";
import { LoadingHud } from "./components/LoadingHud";
import { FlightTable } from "./components/FlightTable";
import { ShootingStarField, type ShootTier } from "./components/ShootingStarField";
import { LuckCard } from "./components/LuckCard";
import { useFlights } from "./hooks/useFlights";
import { ts } from "./utils/log";

ts("app_module_loaded");

type Tab = "2d" | "3d";

function tabFromPath(pathname: string): Tab {
  if (pathname === "/3d") return "3d";
  return "2d";
}

function App() {
  const [tab, setTab] = useState<Tab>(() => tabFromPath(location.pathname));
  const [mapReady, setMapReady] = useState(false);
  const [visibleSet, setVisibleSet] = useState<Set<string>>(new Set());
  const [pickedShoot, setPickedShoot] = useState<ShootTier | null>(null);
  const initializedRef = useRef(false);
  const { flights, lastUpdate, enriching, isFetching, error } = useFlights();

  useEffect(() => {
    const onPop = () => setTab(tabFromPath(location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // First arrival → show all.
  // Subsequent polls → auto-add any newly-spotted aircraft so a fresh ETD
  // callsign doesn't quietly stay hidden. User can still hide them via the
  // table.
  useEffect(() => {
    if (flights.length === 0) return;
    setVisibleSet((prev) => {
      if (!initializedRef.current) {
        initializedRef.current = true;
        return new Set(flights.map((f) => f.icao24));
      }
      let changed = false;
      const next = new Set(prev);
      for (const f of flights) {
        if (!next.has(f.icao24)) {
          next.add(f.icao24);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [flights]);

  const handleChange = (next: Tab) => {
    setTab(next);
    setMapReady(false);
    history.pushState(null, "", `/${next}`);
  };

  const toggleVisible = useCallback((icao: string) => {
    setVisibleSet((prev) => {
      const next = new Set(prev);
      if (next.has(icao)) next.delete(icao);
      else next.add(icao);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setVisibleSet(new Set(flights.map((f) => f.icao24)));
  }, [flights]);

  const hideAll = useCallback(() => {
    setVisibleSet(new Set());
  }, []);

  const visibleFlights = flights.filter((f) => visibleSet.has(f.icao24));

  return (
    <div className="app">
      <TabBar
        activeTab={tab}
        onChange={handleChange}
        count={flights.length}
        lastUpdate={lastUpdate}
        error={error}
      />
      <div className="main">
        <div className="for-hyerim-wrap" aria-label="Message for Hyerim">
          {Array.from({ length: 16 }, (_, i) => {
            const isStar = i % 2 === 0;
            const x = (i * 37) % 100;
            const y = (i * 53) % 100;
            const size = isStar ? 8 + ((i * 3) % 7) : 3 + (i % 3);
            const delay = (i * 0.21) % 2.4;
            const duration = 1.6 + ((i * 0.31) % 1.4);
            return (
              <span
                key={i}
                className={`hyerim-spark ${isStar ? "star" : ""}`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                }}
              />
            );
          })}
          <div className="for-hyerim">
            어딘가 비행하고 있을 혜림이에게 행운과 행복을
          </div>
        </div>
        <LoadingHud
          flightCount={flights.length}
          enrichedCount={flights.length - enriching}
          enriching={enriching}
          lastUpdate={lastUpdate}
          mapReady={mapReady}
          refreshing={isFetching}
        />
        <div className={`map-fade ${mapReady ? "shown" : ""}`}>
          {tab === "2d" ? (
            <TwoDMap
              flights={visibleFlights}
              onReady={() => {
                ts("app_setMapReady");
                setMapReady(true);
              }}
            />
          ) : (
            <ThreeDGlobe
              flights={visibleFlights}
              onReady={() => {
                ts("app_setMapReady");
                setMapReady(true);
              }}
            />
          )}
        </div>
        <FlightTable
          flights={flights}
          visibleSet={visibleSet}
          onToggleVisible={toggleVisible}
          onShowAll={showAll}
          onHideAll={hideAll}
        />
        <ShootingStarField onPick={setPickedShoot} />
        {pickedShoot && (
          <LuckCard tier={pickedShoot} onClose={() => setPickedShoot(null)} />
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
