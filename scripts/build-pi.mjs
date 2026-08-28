import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const outputDirectory = resolve("dist/pi");
await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [resolve("src/index.ts")],
  outfile: resolve(outputDirectory, "index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
  external: [
    "@earendil-works/pi-ai",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-tui",
    "typebox",
  ],
});
await copyFile(
  resolve("src/checkpoint-report-template.html"),
  resolve(outputDirectory, "checkpoint-report-template.html"),
);
