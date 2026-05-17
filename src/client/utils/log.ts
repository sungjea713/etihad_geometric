let sessionStart = 0;
let sessionId = "";

if (typeof window !== "undefined") {
  sessionStart = performance.timeOrigin + performance.now();
  sessionId = Math.random().toString(36).slice(2, 8);
}

export function ts(event: string, extra?: unknown) {
  if (typeof window === "undefined") return;
  const elapsed = Math.round(performance.timeOrigin + performance.now() - sessionStart);
  const body = JSON.stringify({ sid: sessionId, event, elapsed, extra });
  try {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
  // also log locally
  console.log(`[${sessionId}] +${elapsed}ms ${event}`, extra ?? "");
}
