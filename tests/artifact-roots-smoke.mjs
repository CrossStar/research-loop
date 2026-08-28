import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/artifacts.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  write: false,
});
const source = bundle.outputFiles[0]?.text;
assert.ok(source, "artifact bundle was not generated");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const {
  discoverArtifactsFromRoots,
  inferArtifactRoot,
  normalizeArtifactRoots,
} = await import(moduleUrl);

const cwd = await mkdtemp(join(tmpdir(), "research-loop-roots-"));
try {
  await mkdir(join(cwd, "runs", "experiment-001", "figures"), { recursive: true });
  await mkdir(join(cwd, "runs", "experiment-001", "shards"), { recursive: true });
  await mkdir(join(cwd, "runs", "experiment-002"), { recursive: true });
  await writeFile(join(cwd, "runs", "experiment-001", "summary.json"), '{"accuracy":0.9}\n');
  await writeFile(join(cwd, "runs", "experiment-001", "figures", "main.png"), "png");
  await writeFile(join(cwd, "runs", "experiment-001", "shards", "part-001.csv"), "x,y\n1,2\n");
  await writeFile(join(cwd, "runs", "experiment-001", "shards", "part-002.csv"), "x,y\n3,4\n");
  await writeFile(join(cwd, "runs", "experiment-002", "other.json"), "{}\n");

  assert.deepEqual(
    normalizeArtifactRoots(cwd, ["runs/experiment-001", "runs/experiment-001/figures", "../escape"]),
    ["runs/experiment-001"],
  );
  assert.equal(inferArtifactRoot({ kind: "file", path: "runs/experiment-001/figures/main.png" }), "runs/experiment-001");
  assert.equal(inferArtifactRoot({ kind: "file", path: "summary.json" }), ".");

  const artifacts = await discoverArtifactsFromRoots(cwd, ["runs/experiment-001"]);
  assert.equal(artifacts.some((artifact) => artifact.path === "runs/experiment-001/summary.json"), true);
  assert.equal(artifacts.some((artifact) => artifact.path === "runs/experiment-001/figures/main.png"), true);
  const dataset = artifacts.find((artifact) => artifact.kind === "dataset");
  assert.equal(dataset?.path, "runs/experiment-001/shards");
  assert.equal(dataset?.fileCount, 2);
  assert.equal(artifacts.some((artifact) => artifact.path.includes("experiment-002")), false);
} finally {
  await rm(cwd, { recursive: true, force: true });
}

console.log("Artifact roots smoke test passed");
