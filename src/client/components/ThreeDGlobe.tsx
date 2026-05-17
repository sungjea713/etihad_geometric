import { useEffect, useRef, useState } from "react";
import type { Flight } from "../../types/flight";
import { buildPopupHtml } from "./flight-popup";

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

const PLANE_COLOR_HEX = "#ffd60a";
const PLANE_OUTLINE = "#1a0d00";
const NEON = "#00ff9c";

const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
  <g transform="rotate(-45 12 12)">
    <path fill="${PLANE_COLOR_HEX}" fill-opacity="0.95" stroke="${PLANE_OUTLINE}" stroke-width="1.4" stroke-linejoin="round"
          d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z"/>
  </g>
</svg>`;
const PLANE_DATA_URL = "data:image/svg+xml;utf8," + encodeURIComponent(PLANE_SVG);

interface Props {
  flights: Flight[];
  onReady?: () => void;
}

interface EntitySet {
  plane: any;
  flown?: any;
  planned?: any;
  origin?: any;
  destination?: any;
}

function greatCircle(start: [number, number], end: [number, number], steps = 64): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lng1 = toRad(start[0]);
  const lat1 = toRad(start[1]);
  const lng2 = toRad(end[0]);
  const lat2 = toRad(end[1]);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
      )
    );
  if (d === 0 || !Number.isFinite(d)) return [start, end];
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lng = Math.atan2(y, x);
    out.push([toDeg(lng), toDeg(lat)]);
  }
  return out;
}

function flightProps(f: Flight): Record<string, unknown> {
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

export function ThreeDGlobe({ flights, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const entitiesRef = useRef<Map<string, EntitySet>>(new Map());
  const flightsRef = useRef<Flight[]>(flights);
  const CesiumRef = useRef<any>(null);
  const handlerRef = useRef<any>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const readyEmittedRef = useRef(false);
  const [pickedIcao24, setPickedIcao24] = useState<string | null>(null);
  const pickedIcao24Ref = useRef<string | null>(null);
  pickedIcao24Ref.current = pickedIcao24;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const postRenderRemoverRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    flightsRef.current = flights;
    syncEntities();
    if (flights.length > 0 && viewerRef.current && !readyEmittedRef.current) {
      readyEmittedRef.current = true;
      const emit = () => onReadyRef.current?.();
      requestAnimationFrame(() => requestAnimationFrame(emit));
      setTimeout(emit, 2000);
    }
  }, [flights]);

  useEffect(() => {
    let disposed = false;

    async function init() {
      if (!containerRef.current) return;

      window.CESIUM_BASE_URL = "/cesium/";
      const Cesium = await import("cesium");
      if (disposed) return;
      CesiumRef.current = Cesium;

      try {
        const res = await fetch("/api/cesium-token");
        const { token } = (await res.json()) as { token: string };
        if (token) Cesium.Ion.defaultAccessToken = token;
      } catch (e) {
        console.warn("[3d] cesium token fetch failed; falling back to OSM", e);
      }

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        baseLayerPicker: false,
        infoBox: false,
        selectionIndicator: false,
      });

      if (!Cesium.Ion.defaultAccessToken) {
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(
          new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" })
        );
      }

      viewer.resolutionScale = window.devicePixelRatio || 1;
      viewer.scene.globe.enableLighting = true;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(54.65, 24.43, 18_000_000),
        duration: 0,
      });

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: any) => {
        const picked = viewer.scene.pick(click.position);
        const id: string | undefined = picked?.id?.id;
        if (id && id.startsWith("plane-")) {
          setPickedIcao24(id.slice(6));
        } else {
          setPickedIcao24(null);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      handlerRef.current = handler;

      // Keep the popup card glued to the picked plane's screen position
      const remove = viewer.scene.postRender.addEventListener(() => {
        const card = cardRef.current;
        if (!card) return;
        const icao = pickedIcao24Ref.current;
        if (!icao) {
          card.style.display = "none";
          return;
        }
        const ent = viewer.entities.getById(`plane-${icao}`);
        if (!ent) {
          card.style.display = "none";
          return;
        }
        const pos = ent.position?.getValue(Cesium.JulianDate.now());
        if (!pos) {
          card.style.display = "none";
          return;
        }
        const sp =
          Cesium.SceneTransforms.worldToWindowCoordinates?.(viewer.scene, pos) ??
          Cesium.SceneTransforms.wgs84ToWindowCoordinates?.(viewer.scene, pos);
        if (!sp) {
          card.style.display = "none";
          return;
        }
        // also hide if entity is on far side of globe (behind horizon)
        const cameraPos = viewer.camera.positionWC;
        const toEntity = Cesium.Cartesian3.subtract(pos, cameraPos, new Cesium.Cartesian3());
        const toCenter = Cesium.Cartesian3.negate(cameraPos, new Cesium.Cartesian3());
        const dot = Cesium.Cartesian3.dot(
          Cesium.Cartesian3.normalize(toEntity, new Cesium.Cartesian3()),
          Cesium.Cartesian3.normalize(toCenter, new Cesium.Cartesian3())
        );
        if (dot < 0.2) {
          card.style.display = "none";
          return;
        }
        card.style.display = "block";
        card.style.left = `${Math.round(sp.x + 24)}px`;
        card.style.top = `${Math.round(sp.y - 20)}px`;
      });
      postRenderRemoverRef.current = remove;

      viewerRef.current = viewer;
      syncEntities();
      if (flightsRef.current.length > 0 && !readyEmittedRef.current) {
        readyEmittedRef.current = true;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => onReadyRef.current?.())
        );
      }
    }

    init();

    return () => {
      disposed = true;
      postRenderRemoverRef.current?.();
      postRenderRemoverRef.current = null;
      handlerRef.current?.destroy();
      handlerRef.current = null;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      entitiesRef.current.clear();
    };
  }, []);

  function segmentPositions(Cesium: any, start: [number, number], end: [number, number], altitude: number) {
    const pts = greatCircle(start, end);
    return Cesium.Cartesian3.fromDegreesArrayHeights(
      pts.flatMap(([lng, lat]) => [lng, lat, altitude])
    );
  }

  function syncEntities() {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium) return;

    const planeColor = Cesium.Color.fromCssColorString(PLANE_COLOR_HEX);
    const neonColor = Cesium.Color.fromCssColorString(NEON);
    const dashFlown = new Cesium.PolylineDashMaterialProperty({
      color: planeColor.withAlpha(0.9),
      dashLength: 16,
    });
    const dashPlanned = new Cesium.PolylineDashMaterialProperty({
      color: planeColor.withAlpha(0.55),
      dashLength: 12,
    });

    const seen = new Set<string>();
    const seenEndpoints = new Set<string>();

    for (const f of flightsRef.current) {
      seen.add(f.icao24);
      const alt = f.baroAltitude ?? 10_000;
      const position = Cesium.Cartesian3.fromDegrees(f.longitude, f.latitude, alt);
      const heading = Cesium.Math.toRadians(f.trueTrack ?? 0);
      const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
      const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

      let ent = entitiesRef.current.get(f.icao24);
      if (!ent) {
        const plane = viewer.entities.add({
          id: `plane-${f.icao24}`,
          name: f.callsign || f.icao24,
          position,
          orientation,
          billboard: {
            image: PLANE_DATA_URL,
            rotation: -Cesium.Math.toRadians(f.trueTrack ?? 0),
            alignedAxis: Cesium.Cartesian3.UNIT_Z,
            width: 36,
            height: 36,
            scale: 1.0,
          },
          label: {
            text: f.callsign || f.icao24,
            font: "bold 14px ui-monospace, Menlo, monospace",
            pixelOffset: new Cesium.Cartesian2(0, -32),
            fillColor: planeColor,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            scale: 1.0,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString("rgba(2, 8, 12, 0.7)"),
            backgroundPadding: new Cesium.Cartesian2(6, 4),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 12_000_000),
          },
        });
        plane.properties = new Cesium.PropertyBag(flightProps(f));
        ent = { plane };
        entitiesRef.current.set(f.icao24, ent);
      } else {
        ent.plane.position = position;
        ent.plane.orientation = orientation;
        ent.plane.billboard.rotation = -Cesium.Math.toRadians(f.trueTrack ?? 0);
        ent.plane.properties = new Cesium.PropertyBag(flightProps(f));
      }

      if (f.origin) {
        const positions = segmentPositions(
          Cesium,
          [f.origin.lng, f.origin.lat],
          [f.longitude, f.latitude],
          alt * 0.5
        );
        if (ent.flown) ent.flown.polyline.positions = positions;
        else {
          ent.flown = viewer.entities.add({
            id: `flown-${f.icao24}`,
            polyline: { positions, width: 2, material: dashFlown, arcType: Cesium.ArcType.NONE },
          });
        }
        const key = `O:${f.origin.icao}`;
        if (!seenEndpoints.has(key)) {
          seenEndpoints.add(key);
          viewer.entities.getById(`ep-${key}`) ||
            viewer.entities.add({
              id: `ep-${key}`,
              position: Cesium.Cartesian3.fromDegrees(f.origin.lng, f.origin.lat, 0),
              point: {
                pixelSize: 7,
                color: planeColor,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1.5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              },
              label: {
                text: `${f.origin.icao}\n${f.origin.name}`,
                font: "bold 12px ui-monospace, Menlo, monospace",
                pixelOffset: new Cesium.Cartesian2(0, 14),
                fillColor: planeColor,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                scale: 1.0,
                showBackground: true,
                backgroundColor: Cesium.Color.fromCssColorString("rgba(2, 8, 12, 0.75)"),
                backgroundPadding: new Cesium.Cartesian2(6, 4),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15_000_000),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              },
            });
        }
      } else if (ent.flown) {
        viewer.entities.remove(ent.flown);
        ent.flown = undefined;
      }

      if (f.destination) {
        const positions = segmentPositions(
          Cesium,
          [f.longitude, f.latitude],
          [f.destination.lng, f.destination.lat],
          alt * 0.5
        );
        if (ent.planned) ent.planned.polyline.positions = positions;
        else {
          ent.planned = viewer.entities.add({
            id: `planned-${f.icao24}`,
            polyline: { positions, width: 2, material: dashPlanned, arcType: Cesium.ArcType.NONE },
          });
        }
        const key = `D:${f.destination.icao}`;
        if (!seenEndpoints.has(key)) {
          seenEndpoints.add(key);
          viewer.entities.getById(`ep-${key}`) ||
            viewer.entities.add({
              id: `ep-${key}`,
              position: Cesium.Cartesian3.fromDegrees(f.destination.lng, f.destination.lat, 0),
              point: {
                pixelSize: 7,
                color: planeColor,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1.5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              },
              label: {
                text: `${f.destination.icao}\n${f.destination.name}`,
                font: "10px ui-monospace, Menlo, monospace",
                pixelOffset: new Cesium.Cartesian2(0, 12),
                fillColor: planeColor,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                scale: 0.9,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15_000_000),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              },
            });
        }
      } else if (ent.planned) {
        viewer.entities.remove(ent.planned);
        ent.planned = undefined;
      }
    }

    // Remove planes that disappeared
    for (const [icao, ents] of entitiesRef.current) {
      if (!seen.has(icao)) {
        viewer.entities.remove(ents.plane);
        if (ents.flown) viewer.entities.remove(ents.flown);
        if (ents.planned) viewer.entities.remove(ents.planned);
        entitiesRef.current.delete(icao);
      }
    }

    // Remove endpoint entities not referenced this cycle
    const allEntities = viewer.entities.values;
    for (let i = allEntities.length - 1; i >= 0; i--) {
      const e = allEntities[i];
      if (typeof e.id === "string" && e.id.startsWith("ep-")) {
        const key = e.id.slice(3);
        if (!seenEndpoints.has(key)) viewer.entities.remove(e);
      }
    }
  }

  const picked = pickedIcao24 ? flights.find((f) => f.icao24 === pickedIcao24) : null;

  return (
    <>
      <div ref={containerRef} className="globe-container" />
      {picked && (
        <div
          ref={cardRef}
          className="flight-card flight-card-anchored"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="flight-card-close" onClick={() => setPickedIcao24(null)}>
            ×
          </button>
          <div dangerouslySetInnerHTML={{ __html: buildPopupHtml(flightProps(picked)) }} />
        </div>
      )}
    </>
  );
}
