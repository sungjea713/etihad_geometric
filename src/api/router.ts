import { getFlights, getStatus } from "./flight-cache";

const serverStart = Date.now();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleApi(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    if (path === "/api/flights" && req.method === "GET") {
      const t0 = Date.now();
      const data = await getFlights();
      const elapsed = Date.now() - t0;
      const withOrigin = data.flights.filter((f) => f.origin).length;
      console.log(`[srv +${Date.now() - serverStart}ms] /api/flights → count=${data.count} origin=${withOrigin} (${elapsed}ms)`);
      return json(data);
    }

    if (path === "/api/log" && req.method === "POST") {
      const body = (await req.json()) as { sid: string; event: string; elapsed: number; extra?: unknown };
      const extra = body.extra !== undefined ? ` ${JSON.stringify(body.extra)}` : "";
      console.log(`[cli ${body.sid} +${body.elapsed}ms] ${body.event}${extra}`);
      return json({ ok: true });
    }

    if (path === "/api/cesium-token" && req.method === "GET") {
      return json({ token: process.env.CESIUM_ION_TOKEN ?? "" });
    }

    if (path === "/api/health" && req.method === "GET") {
      return json({ ok: true, ...getStatus() });
    }

    return null;
  } catch (err) {
    console.error("[api]", path, err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}
