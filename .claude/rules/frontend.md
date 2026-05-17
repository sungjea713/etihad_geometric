# Frontend rules

## React patterns

- React 19, no router library — tab routing in [`App.tsx`](../../src/client/App.tsx) uses `history.pushState` + `popstate`.
- Polling: [`useFlights`](../../src/client/hooks/useFlights.ts) — 30s interval, paused via `document.visibilityState`, cleans up on unmount.
- Visibility state lives in `App.tsx` as `visibleSet: Set<icao24>`. `initializedRef` ensures we only auto-select-all once on first flight arrival; later user actions are not overwritten.
- Pass `visibleFlights` (filtered) to map components but pass the full `flights` to `FlightTable` so hidden rows can be re-shown.

## MapLibre gotchas

- **Closure trap**: the `useEffect(() => { ... }, [])` block that creates the map captures `flights` at mount (usually `[]`). `map.on("load")` fires asynchronously, by which time `flights` has data — but the closure still sees `[]`. Always read latest data through `flightsRef.current` inside the load callback (`pushData()` already does this).
- The `useEffect[flights]` block does **not** fire if you don't depend on `flights`. Both code paths (load callback and flights effect) must funnel through the same `pushData()` so first-paint works whichever happens first.
- `map.once("idle")` is a reasonable ready signal but is occasionally never fired (offline tiles, errors). Always pair with a `setTimeout(emit, 2000)` fallback.
- Use `addImage("plane", img)` for SVG icons — encode the SVG as a data URI and load via `new Image()`. Don't try to use sprites for one-off icons.

## CesiumJS gotchas

- Cesium 1.141 renamed `Cesium.SceneTransforms.wgs84ToWindowCoordinates` → `worldToWindowCoordinates`. We call the new name with `?.` fallback to the old one.
- Set `viewer.resolutionScale = window.devicePixelRatio` after creating the viewer — otherwise labels are blurry on Retina.
- For anchored popups, hook `viewer.scene.postRender.addEventListener` (not React state) and update DOM via ref. Updating React state every frame causes layout thrash.
- Hide the popup when the entity is on the far side of the globe: compute the dot product between camera-to-entity and camera-to-center; threshold around `0.2`.
- Click handling: `viewer.scene.pick(click.position)` returns an object whose `.id.id` matches the entity ID string. Prefix entity IDs like `plane-{icao24}` so picks are easy to dispatch.
- Cesium static assets must be served from `/cesium/*`. `scripts/copy-cesium-assets.ts` copies them from `node_modules/cesium/Build/Cesium` on `postinstall`.
- Always set `window.CESIUM_BASE_URL = "/cesium/"` before `import("cesium")` (we dynamic-import to keep the initial bundle small).

## Animation budget

- Canvas star field: ~850 stars + ~1 shooting star every 8–12s. RAF loop with halo gradients per star is fine on M-series Macs; on weaker hardware drop `STAR_COUNT` first.
- MapLibre `country-glow` opacity/width breathes via `requestAnimationFrame` calling `setPaintProperty`. Cancel on unmount.
- Cesium popup follows entity at `postRender` rate (~60fps). Use `ref.style.left/top` direct DOM mutation — never `setState`.

## Loading HUD

Timeline-driven (`LoadingHud.tsx`):
- `boot` 0–700ms · `scan` 700–1300ms · `enrich` 1300–2900ms (with N/M counter) · `render` 2900ms+
- Hold "Ready" until **both** `dataReady` (enrichedCount === count) **and** `mapReady` (from onReady prop) are true.
- 3s fallback timeout: fade even if `mapReady` never fires.
- Map fade-in via `.map-fade.shown` class on a wrapper `div` — drives opacity 0→1 in 800ms, synchronized with HUD fade-out for a smooth handoff.

## ts() debug logging

[`utils/log.ts`](../../src/client/utils/log.ts) ships timestamped events to `/api/log` so the server console has a unified client+server timeline. Keep the existing instrumentation; add new `ts("event_name", { extra })` calls when chasing timing bugs.
