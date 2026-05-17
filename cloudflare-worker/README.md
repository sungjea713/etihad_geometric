# OpenSky Cloudflare Worker proxy

OpenSky silently drops connections from Render's IP range. This Worker sits
between Render and OpenSky — Cloudflare's IPs aren't blocked.

## Deploy (Dashboard, ~2 minutes)

1. Go to https://dash.cloudflare.com/ → **Workers & Pages** → **Create**
2. Choose **Start with Hello World!** → name it (e.g. `etihad-opensky-proxy`) → Deploy
3. After deploy → **Edit code** → replace the file with [`src/index.js`](./src/index.js) → **Deploy**
4. Copy the URL (looks like `https://etihad-opensky-proxy.<your-account>.workers.dev`)

## Deploy (Wrangler CLI)

```bash
cd cloudflare-worker
npx wrangler login
npx wrangler deploy
```

## Wire to the app

Set two env vars in Render dashboard:

```
OPENSKY_AUTH_PROXY_URL=https://etihad-opensky-proxy.<your-account>.workers.dev/opensky-auth
OPENSKY_PROXY_URL=https://etihad-opensky-proxy.<your-account>.workers.dev/opensky
```

Trigger a redeploy (any small commit or "Clear cache & deploy").

## How it routes

| Worker path | Upstream |
| --- | --- |
| `/opensky-auth/<path>` | `https://auth.opensky-network.org/<path>` |
| `/opensky/<path>` | `https://opensky-network.org/<path>` |
| anything else | 404 |

## Cost

Cloudflare Workers free plan: 100,000 requests/day. We make ~960
requests/day to OpenSky (90s TTL). Plenty of headroom.
