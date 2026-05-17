function formatTime(epochSec: number): string {
  if (!epochSec || !Number.isFinite(epochSec)) return "—";
  return new Date(epochSec * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPopupHtml(p: Record<string, unknown>): string {
  const callsign = String(p.callsign || p.icao24 || "—").trim();
  const aircraftType = String(p.aircraftType || "");
  const originCountry = String(p.originCountry || "");
  const originIcao = String(p.originIcao || "");
  const originName = String(p.originName || "");
  const originCity = String(p.originCity || "");
  const destIcao = String(p.destIcao || "");
  const destName = String(p.destName || "");
  const destCity = String(p.destCity || "");
  const takeoff = Number(p.takeoff || 0);
  const landing = Number(p.landing || 0);
  const altM = p.altitudeM == null ? null : Number(p.altitudeM);
  const velMs = p.velocityMs == null ? null : Number(p.velocityMs);
  const heading = Math.round(Number(p.heading || 0));

  const altFt = altM != null ? Math.round(altM * 3.281) : null;
  const speedKt = velMs != null ? Math.round(velMs * 1.944) : null;

  const nowSec = Math.floor(Date.now() / 1000);
  const totalSec = takeoff && landing ? landing - takeoff : 0;
  const remainSec = landing && nowSec < landing ? landing - nowSec : 0;

  const fromLine = originIcao
    ? `<div class="popup-line"><span class="popup-tag">FROM</span> <strong>${escapeHtml(originIcao)}</strong> · ${escapeHtml(originCity || originName)}</div>`
    : "";
  const toLine = destIcao
    ? `<div class="popup-line"><span class="popup-tag">TO</span> <strong>${escapeHtml(destIcao)}</strong> · ${escapeHtml(destCity || destName)}</div>`
    : "";

  return `
    <div class="popup-head">
      <div class="popup-callsign">${escapeHtml(callsign)}</div>
      ${aircraftType ? `<div class="popup-aircraft">${escapeHtml(aircraftType)}</div>` : ""}
      ${originCountry ? `<div class="popup-country">${escapeHtml(originCountry)}</div>` : ""}
    </div>
    ${fromLine || toLine ? `<div class="popup-section">${fromLine}${toLine}</div>` : ""}
    ${takeoff || landing ? `
      <div class="popup-section">
        <div class="popup-line"><span class="popup-key">Departure</span><span class="popup-val">${formatTime(takeoff)}</span></div>
        <div class="popup-line"><span class="popup-key">Arrival</span><span class="popup-val">${formatTime(landing)}</span></div>
        <div class="popup-line"><span class="popup-key">Total</span><span class="popup-val">${formatDuration(totalSec)}</span></div>
        <div class="popup-line"><span class="popup-key">Remaining</span><span class="popup-val">${formatDuration(remainSec)}</span></div>
      </div>` : ""}
    <div class="popup-section">
      ${altFt != null ? `<div class="popup-line"><span class="popup-key">Altitude</span><span class="popup-val">${altFt.toLocaleString()} ft</span></div>` : ""}
      ${speedKt != null ? `<div class="popup-line"><span class="popup-key">Speed</span><span class="popup-val">${speedKt} kt</span></div>` : ""}
      <div class="popup-line"><span class="popup-key">Heading</span><span class="popup-val">${heading}°</span></div>
    </div>
  `;
}
