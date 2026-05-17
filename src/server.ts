import { handleApi } from "./api/router";
import homepage from "./index.html";

const PORT = parseInt(process.env.PORT ?? "5016");

const server = Bun.serve({
  port: PORT,
  idleTimeout: 60,
  routes: {
    "/": homepage,
    "/2d": homepage,
    "/3d": homepage,
    "/api/*": async (req) => {
      const response = await handleApi(req);
      return response ?? new Response("Not Found", { status: 404 });
    },
  },
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/")) {
      const response = await handleApi(req);
      return response ?? new Response("Not Found", { status: 404 });
    }

    const file = Bun.file(`public${url.pathname}`);
    if (await file.exists()) return new Response(file);

    return new Response(Bun.file("src/index.html"));
  },
});

console.log(`✈️  Etihad Live Flight Tracker — http://localhost:${server.port}`);
