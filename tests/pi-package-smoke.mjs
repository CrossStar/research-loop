import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const manifest = JSON.parse(await readFile("package.json", "utf8"));
assert.deepEqual(manifest.pi?.extensions, ["./dist/pi/index.js"]);
assert.equal(manifest.scripts?.prepare, undefined);
assert.match(manifest.dependencies?.ignore, /^\^7\./);
const extensionPath = resolve("dist/pi/index.js");
const templatePath = resolve("dist/pi/checkpoint-report-template.html");
await access(extensionPath);
await access(templatePath);
const extension = await import(`${pathToFileURL(extensionPath).href}?smoke=${Date.now()}`);
assert.equal(typeof extension.default, "function");
const commands = [];
const tools = [];
const lifecycleHandlers = new Map();
const appendedEntries = [];
let activeTools = [];
extension.default({
  appendEntry(customType, data) { appendedEntries.push({ customType, data }); },
  events: { on() {} },
  exec: async () => ({ code: 0, stdout: "", stderr: "" }),
  getActiveTools: () => [...activeTools],
  on(name, handler) { lifecycleHandlers.set(name, handler); },
  registerCommand(name) { commands.push(name); },
  registerTool(tool) { tools.push(tool.name); },
  setActiveTools(toolsToSet) { activeTools = [...toolsToSet]; },
});
assert.equal(commands.includes("checkpoint-viewer"), true);
assert.equal(commands.includes("artifacts"), true);
assert.equal(tools.includes("research_checkpoint"), true);

const stateEntry = {
  id: "state",
  parentId: undefined,
  type: "custom",
  customType: "research-loop-state",
  data: {
    enabled: true,
    workMode: "experiment",
    artifactRoots: [".", ".venv-train/lib/python3.10/site-packages/numpy/data", "dist/pi"],
    experiment: {
      title: "Resume smoke",
      question: "Does startup return before artifact discovery?",
      intent: "diagnostic",
      plannedDataScope: "existing dist/pi files",
      artifactRoots: [".", ".venv-train/lib/python3.10/site-packages/numpy/data", "dist/pi"],
    },
    artifacts: [{
      kind: "file",
      path: ".venv-train/lib/python3.10/site-packages/numpy/data/pollution.json",
      name: "pollution.json",
      extension: ".json",
      size: 1,
      mtimeMs: 1,
      discoveredAt: 1,
    }],
  },
};
const notifications = [];
const context = {
  cwd: resolve("."),
  hasUI: true,
  sessionManager: {
    getLeafEntry: () => stateEntry,
    getEntry: () => undefined,
  },
  ui: {
    notify(message) { notifications.push(message); },
    setStatus() {},
    setWidget() {},
    theme: { fg: (_color, text) => text },
  },
};
const sessionStartResult = lifecycleHandlers.get("session_start")({}, context);
assert.equal(sessionStartResult, undefined, "session_start must not await artifact rediscovery");
assert.deepEqual(appendedEntries.at(-1)?.data.artifactRoots, ["dist/pi"]);
assert.deepEqual(appendedEntries.at(-1)?.data.experiment.artifactRoots, ["dist/pi"]);
assert.equal(Object.hasOwn(appendedEntries.at(-1)?.data ?? {}, "artifacts"), false);
await lifecycleHandlers.get("session_shutdown")({}, context);
await new Promise((resolveWait) => setTimeout(resolveWait, 20));
assert.equal(notifications.some((message) => /background initialization failed/i.test(message)), false);

const template = await readFile(templatePath, "utf8");
assert.match(template, /checkpoint-viewer/);

console.log("Pi package smoke test passed");
