import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { TabBar } from "./components/TabBar";
import { TwoDMap } from "./components/TwoDMap";
import { ThreeDGlobe } from "./components/ThreeDGlobe";
import { LoadingHud } from "./components/LoadingHud";
import { FlightTable } from "./components/FlightTable";
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
  const initializedRef = useRef(false);
  const { flights, lastUpdate, error } = useFlights();

  useEffect(() => {
    const onPop = () => setTab(tabFromPath(location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Initialize visibleSet to "show all" the first time flights arrive.
  // After that, leave it alone — user controls via buttons / checkboxes.
  useEffect(() => {
    if (initializedRef.current || flights.length === 0) return;
    initializedRef.current = true;
    setVisibleSet(new Set(flights.map((f) => f.icao24)));
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
        <LoadingHud
          flightCount={flights.length}
          enrichedCount={flights.filter((f) => f.origin).length}
          lastUpdate={lastUpdate}
          mapReady={mapReady}
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
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
