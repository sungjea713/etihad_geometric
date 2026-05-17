import { $ } from "bun";
import { existsSync } from "node:fs";

const src = "node_modules/cesium/Build/Cesium";
const dest = "public/cesium";

if (!existsSync(src)) {
  console.log("[copy-cesium] cesium not installed yet — skipping");
  process.exit(0);
}

await $`rm -rf ${dest}`.nothrow();
await $`mkdir -p public`;
await $`cp -R ${src} ${dest}`;
console.log(`[copy-cesium] copied ${src} -> ${dest}`);
