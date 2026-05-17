import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Flight } from "../../types/flight";
import { buildPopupHtml } from "./flight-popup";
import { StarField } from "./StarField";
import { ts } from "../utils/log";

const NEON = "#00ff9c";
const PLANE_COLOR = "#ffd60a";
const PLANE_OUTLINE = "#1a0d00";
const PULSE_RGB = "255, 214, 10";

const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
  <g transform="rotate(-45 12 12)">
    <path fill="${PLANE_COLOR}" fill-opacity="0.95" stroke="${PLANE_OUTLINE}" stroke-width="1.4" stroke-linejoin="round"
          d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z"/>
  </g>
</svg>`;

const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12" width="24" height="12">
  <polyline points="2,12 12,0 22,12" fill="none" stroke="${PLANE_COLOR}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;

function makePulsingDot(map: maplibregl.Map) {
  const size = 120;
  return {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),
    context: null as CanvasRenderingContext2D | null,
    onAdd() {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      this.context = canvas.getContext("2d", { willReadFrequently: true });
    },
    render() {
      const ctx = this.context!;
      const cx = size / 2;
      const duration = 2200;
      const t = (performance.now() % duration) / duration;
      ctx.clearRect(0, 0, size, size);
      for (let i = 0; i < 3; i++) {
        const phase = (t + i / 3) % 1;
        const radius = phase * (size / 2 - 8);
        const alpha = (1 - phase) * 0.85;
        ctx.beginPath();
        ctx.arc(cx, cx, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${PULSE_RGB}, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cx, 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${PULSE_RGB}, 0.4)`;
      ctx.fill();
      this.data = ctx.getImageData(0, 0, size, size).data;
      map.triggerRepaint();
      return true;
    },
  } as maplibregl.StyleImageInterface;
}

function flightToProps(f: Flight) {
  return {
    icao24: f.icao24,
    callsign: f.callsign,
    originCountry: f.originCountry,
    heading: f.trueTrack ?? 0,
    altitudeM: f.baroAltitude,
    velocityMs: f.velocity,
    onGround: f.onGround,
    originIcao: f.origin?.icao ?? "",
    originName: f.origin?.name ?? "",
    originCity: f.origin?.city ?? "",
    destIcao: f.destination?.icao ?? "",
    destName: f.destination?.name ?? "",
    destCity: f.destination?.city ?? "",
    takeoff: f.takeoff ?? 0,
    landing: f.landing ?? 0,
    aircraftType: f.aircraftType ?? "",
  };
}

function buildPlanesGeoJSON(flights: Flight[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: flights.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.longitude, f.latitude] },
      properties: flightToProps(f),
    })),
  };
}

function bezierArc(
  start: [number, number],
  end: [number, number],
  curvature = 0.22,
  steps = 48
): [number, number][] {
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [start, end];
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const side = dx >= 0 ? 1 : -1;
  const nx = (-dy / len) * side;
  const ny = (dx / len) * side;
  const offset = len * curvature;
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2]);
  }
  return out;
}

function buildRoutesGeoJSON(flights: Flight[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const f of flights) {
    const current: [number, number] = [f.longitude, f.latitude];
    if (f.origin) {
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: bezierArc([f.origin.lng, f.origin.lat], current),
        },
        properties: { icao24: f.icao24, segment: "flown" },
      });
    }
    if (f.destination) {
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: bezierArc(current, [f.destination.lng, f.destination.lat]),
        },
        properties: { icao24: f.icao24, segment: "planned" },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function buildEndpointsGeoJSON(flights: Flight[]): GeoJSON.FeatureCollection {
  const dedup = new Map<string, GeoJSON.Feature>();
  for (const f of flights) {
    if (f.origin) {
      dedup.set(`O:${f.origin.icao}`, {
        type: "Feature",
        geometry: { type: "Point", coordinates: [f.origin.lng, f.origin.lat] },
        properties: { icao: f.origin.icao, name: f.origin.name, kind: "origin", heading: 0 },
      });
    }
    if (f.destination) {
      // heading from plane → destination (bearing in degrees, 0=N CW)
      const dLng = f.destination.lng - f.longitude;
      const dLat = f.destination.lat - f.latitude;
      const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
      dedup.set(`D:${f.destination.icao}`, {
        type: "Feature",
        geometry: { type: "Point", coordinates: [f.destination.lng, f.destination.lat] },
        properties: {
          icao: f.destination.icao,
          name: f.destination.name,
          kind: "destination",
          heading,
        },
      });
    }
  }
  return { type: "FeatureCollection", features: Array.from(dedup.values()) };
}

interface Props {
  flights: Flight[];
  onReady?: () => void;
}

export function TwoDMap({ flights, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const readyRef = useRef(false);
  const breatheRafRef = useRef<number | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const readyEmittedRef = useRef(false);
  const flightsRef = useRef<Flight[]>(flights);
  flightsRef.current = flights;

  useEffect(() => {
    if (!containerRef.current) return;
    ts("2d_mount");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          countries: {
            type: "vector",
            url: "https://demotiles.maplibre.org/tiles/tiles.json",
          },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "rgba(2, 6, 13, 0)" } },
          {
            id: "country-fill",
            type: "fill",
            source: "countries",
            "source-layer": "countries",
            paint: { "fill-color": "#0a1c19", "fill-opacity": 0.85 },
          },
          {
            id: "country-glow",
            type: "line",
            source: "countries",
            "source-layer": "countries",
            paint: { "line-color": NEON, "line-width": 3, "line-opacity": 0.25, "line-blur": 3 },
          },
          {
            id: "country-line",
            type: "line",
            source: "countries",
            "source-layer": "countries",
            paint: { "line-color": NEON, "line-width": 0.6, "line-opacity": 0.85 },
          },
          {
            id: "country-label",
            type: "symbol",
            source: "countries",
            "source-layer": "centroids",
            layout: {
              "text-field": ["get", "NAME"],
              "text-font": ["literal", ["Open Sans Semibold"]],
              "text-size": ["interpolate", ["linear"], ["zoom"], 1, 7, 2, 9, 3, 11, 4, 13, 6, 16],
              "text-letter-spacing": 0.08,
              "text-transform": "uppercase",
              "text-max-width": 6,
              "text-padding": 3,
              "symbol-sort-key": [
                "match",
                ["get", "ADM0_A3"],
                ["RUS", "CHN", "USA", "CAN", "BRA", "AUS", "IND", "ARG", "KAZ", "DZA", "COD", "SAU", "MEX", "IDN", "LBY", "IRN", "MNG", "PER", "TCD", "NER", "AGO", "MLI", "ZAF", "COL", "ETH", "BOL", "MRT", "EGY", "TZA", "NGA", "VEN", "NAM", "MOZ", "PAK", "TUR", "CHL", "ZMB", "MMR", "AFG", "SOM", "CAF", "UKR", "MDG", "KEN", "BWA", "FRA", "YEM", "THA", "ESP", "TKM"],
                0,
                10,
              ],
            },
            paint: {
              "text-color": "#9affd0",
              "text-halo-color": "#02060d",
              "text-halo-width": 1.6,
              "text-opacity": 0.92,
            },
          },
        ],
      },
      center: [40, 25],
      zoom: 0.2,
      minZoom: -2,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.on("load", async () => {
      ts("2d_map_load");
      const planeImg = new Image(32, 32);
      planeImg.onload = () => {
        if (!map.hasImage("plane")) map.addImage("plane", planeImg);
      };
      planeImg.src = "data:image/svg+xml;utf8," + encodeURIComponent(PLANE_SVG);

      const arrowImg = new Image(24, 12);
      arrowImg.onload = () => {
        if (!map.hasImage("arrow")) map.addImage("arrow", arrowImg);
      };
      arrowImg.src = "data:image/svg+xml;utf8," + encodeURIComponent(ARROW_SVG);

      if (!map.hasImage("pulse")) {
        map.addImage("pulse", makePulsingDot(map), { pixelRatio: 2 });
      }

      map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "routes-glow",
        type: "line",
        source: "routes",
        paint: { "line-color": PLANE_COLOR, "line-width": 8, "line-opacity": 0.14, "line-blur": 6 },
      });
      map.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes",
        paint: {
          "line-color": PLANE_COLOR,
          "line-width": 1.6,
          "line-opacity": ["case", ["==", ["get", "segment"], "flown"], 0.55, 0.35],
          "line-dasharray": [2.5, 3],
        },
      });
      map.addSource("endpoints", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "endpoints-halo",
        type: "circle",
        source: "endpoints",
        paint: {
          "circle-radius": 9,
          "circle-color": PLANE_COLOR,
          "circle-opacity": 0.18,
          "circle-blur": 0.8,
        },
      });
      map.addLayer({
        id: "endpoints-dot",
        type: "circle",
        source: "endpoints",
        paint: {
          "circle-radius": 4,
          "circle-color": PLANE_COLOR,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": PLANE_OUTLINE,
        },
      });
      map.addLayer({
        id: "endpoints-arrow",
        type: "symbol",
        source: "endpoints",
        filter: ["==", ["get", "kind"], "destination"],
        layout: {
          "icon-image": "arrow",
          "icon-rotate": ["get", "heading"],
          "icon-rotation-alignment": "map",
          "icon-size": 1.0,
          "icon-anchor": "top",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      map.addLayer({
        id: "endpoints-label",
        type: "symbol",
        source: "endpoints",
        layout: {
          "text-field": ["concat", ["get", "icao"], "\n", ["get", "name"]],
          "text-font": ["literal", ["Open Sans Semibold"]],
          "text-size": 10,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-padding": 4,
          "text-letter-spacing": 0.05,
          "text-max-width": 10,
        },
        paint: {
          "text-color": PLANE_COLOR,
          "text-halo-color": "#02060d",
          "text-halo-width": 1.8,
          "text-opacity": 0.95,
        },
      });

      map.addSource("planes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "planes-pulse",
        type: "symbol",
        source: "planes",
        layout: {
          "icon-image": "pulse",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-size": 1.2,
        },
      });
      map.addLayer({
        id: "planes-symbol",
        type: "symbol",
        source: "planes",
        layout: {
          "icon-image": "plane",
          "icon-rotate": ["get", "heading"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-size": 0.85,
        },
      });

      map.on("click", "planes-symbol", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const html = buildPopupHtml(f.properties as Record<string, unknown>);
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "320px" })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(html)
          .addTo(map);
      });
      map.on("mouseenter", "planes-symbol", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "planes-symbol", () => (map.getCanvas().style.cursor = ""));

      readyRef.current = true;
      pushData();

      const tick = () => {
        const now = performance.now();
        const glowOpacity = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(now / 1800));
        const glowWidth = 2.5 + 1.5 * (0.5 + 0.5 * Math.sin(now / 1800));
        const lineOpacity = 0.7 + 0.2 * (0.5 + 0.5 * Math.sin(now / 1800 + Math.PI));
        if (map.getLayer("country-glow")) {
          map.setPaintProperty("country-glow", "line-opacity", glowOpacity);
          map.setPaintProperty("country-glow", "line-width", glowWidth);
        }
        if (map.getLayer("country-line")) {
          map.setPaintProperty("country-line", "line-opacity", lineOpacity);
        }
        breatheRafRef.current = requestAnimationFrame(tick);
      };
      breatheRafRef.current = requestAnimationFrame(tick);
    });

    function pushData() {
      if (!readyRef.current || !mapRef.current) return;
      const m = mapRef.current;
      const fl = flightsRef.current;
      (m.getSource("planes") as maplibregl.GeoJSONSource | undefined)?.setData(buildPlanesGeoJSON(fl));
      (m.getSource("routes") as maplibregl.GeoJSONSource | undefined)?.setData(buildRoutesGeoJSON(fl));
      (m.getSource("endpoints") as maplibregl.GeoJSONSource | undefined)?.setData(buildEndpointsGeoJSON(fl));
      maybeEmitReady(fl.length, "pushData");
    }

    function maybeEmitReady(count: number, src: string) {
      if (count === 0 || readyEmittedRef.current) return;
      readyEmittedRef.current = true;
      ts("2d_setdata_first", { count, src });
      let emitted = false;
      const emit = (reason: string) => {
        if (emitted) return;
        emitted = true;
        ts("2d_ready_emit", { src: reason });
        onReadyRef.current?.();
      };
      map.once("idle", () => emit("idle"));
      setTimeout(() => emit("timeout2000"), 2000);
    }
    (mapRef.current as any).__push = pushData;

    return () => {
      if (breatheRafRef.current) cancelAnimationFrame(breatheRafRef.current);
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !readyRef.current) return;
    (mapRef.current as any).__push?.();
  }, [flights]);

  return (
    <>
      <StarField />
      <div ref={containerRef} className="map-container" />
    </>
  );
}
