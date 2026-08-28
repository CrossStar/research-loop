import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const outputDirectory = resolve("dist/pi");
const extensionPath = resolve(outputDirectory, "index.js");
await mkdir(outputDirectory, { recursive: true });
const result = await build({
  entryPoints: [resolve("src/index.ts")],
  outfile: extensionPath,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
  write: false,
  external: [
    "@earendil-works/pi-ai",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-tui",
    "typebox",
  ],
});
const bundle = result.outputFiles[0]?.contents;
if (!bundle) throw new Error("Pi extension bundle was not generated.");
await writeChangedFileWithRetry(extensionPath, bundle);
await copyFile(
  resolve("src/checkpoint-report-template.html"),
  resolve(outputDirectory, "checkpoint-report-template.html"),
);

async function writeChangedFileWithRetry(path, content) {
  try {
    const existing = await readFile(path);
    if (existing.equals(content)) return;
  } catch {
    // The first build has no existing output.
  }

  let lastError;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await writeFile(path, content);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw lastError;
}
