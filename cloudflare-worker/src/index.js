/**
 * OpenSky proxy worker — bypasses Render IP blocks on OpenSky.
 *
 * Routes:
 *   /opensky-auth/* → https://auth.opensky-network.org/*
 *   /opensky/*      → https://opensky-network.org/*
 *
 * Deploy with `wrangler deploy` (after `wrangler login`) or via the
 * Cloudflare dashboard (Workers & Pages → Create → paste this file).
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);

    let target;
    if (url.pathname.startsWith("/opensky-auth/")) {
      target = "https://auth.opensky-network.org" + url.pathname.slice("/opensky-auth".length);
    } else if (url.pathname.startsWith("/opensky/")) {
      target = "https://opensky-network.org" + url.pathname.slice("/opensky".length);
    } else {
      return new Response(
        "OpenSky proxy. Use /opensky-auth/... or /opensky/...",
        { status: 404 }
      );
    }

    if (url.search) target += url.search;

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ipcountry");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");
    headers.delete("x-forwarded-for");
    headers.delete("x-real-ip");

    const init = {
      method: request.method,
      headers,
      redirect: "follow",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }

    const upstream = await fetch(target, init);

    // pass response through with CORS so it works in browsers too
    const respHeaders = new Headers(upstream.headers);
    respHeaders.set("access-control-allow-origin", "*");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  },
};
