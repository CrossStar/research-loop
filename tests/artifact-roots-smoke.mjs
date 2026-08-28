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
  resolveArtifactWatchTargets,
} = await import(moduleUrl);

const cwd = await mkdtemp(join(tmpdir(), "research-loop-roots-"));
const previousVirtualEnv = process.env.VIRTUAL_ENV;
const previousCondaPrefix = process.env.CONDA_PREFIX;
try {
  await mkdir(join(cwd, "runs", "experiment-001", "figures"), { recursive: true });
  await mkdir(join(cwd, "runs", "experiment-001", "shards"), { recursive: true });
  await mkdir(join(cwd, "runs", "experiment-002"), { recursive: true });
  await mkdir(join(cwd, "runs", "experiment-001", "scratch"), { recursive: true });
  await mkdir(join(cwd, ".venv-train", "lib", "site-packages", "numpy", "data"), { recursive: true });
  await mkdir(join(cwd, "python-runtime", "lib", "site-packages"), { recursive: true });
  await mkdir(join(cwd, "custom-runtime", "artifacts"), { recursive: true });
  await mkdir(join(cwd, "conda-runtime", "artifacts"), { recursive: true });
  await writeFile(join(cwd, "runs", "experiment-001", "summary.json"), '{"accuracy":0.9}\n');
  await writeFile(join(cwd, "runs", "experiment-001", "figures", "main.png"), "png");
  await writeFile(join(cwd, "runs", "experiment-001", "shards", "part-001.csv"), "x,y\n1,2\n");
  await writeFile(join(cwd, "runs", "experiment-001", "shards", "part-002.csv"), "x,y\n3,4\n");
  await writeFile(join(cwd, "runs", "experiment-002", "other.json"), "{}\n");
  await writeFile(join(cwd, "runs", "experiment-001", "scratch", "ignored.json"), "{}\n");
  await writeFile(join(cwd, ".venv-train", "lib", "site-packages", "numpy", "data", "pollution.json"), "{}\n");
  await writeFile(join(cwd, "python-runtime", "pyvenv.cfg"), "home = /usr/bin\n");
  await writeFile(join(cwd, "python-runtime", "lib", "site-packages", "pollution.json"), "{}\n");
  await writeFile(join(cwd, "custom-runtime", "artifacts", "pollution.json"), "{}\n");
  await writeFile(join(cwd, "conda-runtime", "artifacts", "pollution.json"), "{}\n");
  await writeFile(join(cwd, "summary.json"), "{}\n");
  await writeFile(join(cwd, ".research-loopignore"), "runs/experiment-001/scratch/\n");
  process.env.VIRTUAL_ENV = join(cwd, "custom-runtime");
  process.env.CONDA_PREFIX = join(cwd, "conda-runtime");

  assert.deepEqual(
    normalizeArtifactRoots(cwd, [
      "runs/experiment-001",
      "runs/experiment-001/figures",
      "runs/experiment-001/scratch",
      "../escape",
      ".",
      ".venv-train/lib/site-packages/numpy/data",
      "python-runtime/lib/site-packages",
      "custom-runtime/artifacts",
      "conda-runtime/artifacts",
    ]),
    ["runs/experiment-001"],
  );
  assert.deepEqual(resolveArtifactWatchTargets(cwd, []), []);
  assert.deepEqual(resolveArtifactWatchTargets(cwd, ["future/run"]), []);
  const rootFileTargets = resolveArtifactWatchTargets(cwd, ["summary.json"]);
  assert.equal(rootFileTargets.length, 1);
  assert.equal(rootFileTargets[0].recursive, false);
  assert.equal(rootFileTargets[0].path.endsWith("summary.json"), true);
  assert.equal(inferArtifactRoot({ kind: "file", path: "runs/experiment-001/figures/main.png" }), "runs/experiment-001");
  assert.equal(inferArtifactRoot({ kind: "file", path: "summary.json" }), "summary.json");

  const artifacts = await discoverArtifactsFromRoots(cwd, ["runs/experiment-001"]);
  assert.equal(artifacts.some((artifact) => artifact.path === "runs/experiment-001/summary.json"), true);
  assert.equal(artifacts.some((artifact) => artifact.path === "runs/experiment-001/figures/main.png"), true);
  const dataset = artifacts.find((artifact) => artifact.kind === "dataset");
  assert.equal(dataset?.path, "runs/experiment-001/shards");
  assert.equal(dataset?.fileCount, 2);
  assert.equal(artifacts.some((artifact) => artifact.path.includes("experiment-002")), false);
  assert.equal(artifacts.some((artifact) => artifact.path.includes("scratch")), false);

  const rootFile = await discoverArtifactsFromRoots(cwd, ["summary.json"]);
  assert.deepEqual(rootFile.map((artifact) => artifact.path), ["summary.json"]);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    discoverArtifactsFromRoots(cwd, ["runs/experiment-001"], controller.signal),
    (error) => error?.name === "AbortError",
  );
} finally {
  if (previousVirtualEnv === undefined) delete process.env.VIRTUAL_ENV;
  else process.env.VIRTUAL_ENV = previousVirtualEnv;
  if (previousCondaPrefix === undefined) delete process.env.CONDA_PREFIX;
  else process.env.CONDA_PREFIX = previousCondaPrefix;
  await rm(cwd, { recursive: true, force: true });
}

console.log("Artifact roots smoke test passed");
