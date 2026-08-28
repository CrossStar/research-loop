import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const manifest = JSON.parse(await readFile("package.json", "utf8"));
assert.deepEqual(manifest.pi?.extensions, ["./dist/pi/index.js"]);
assert.equal(manifest.scripts?.prepare, undefined);
const extensionPath = resolve("dist/pi/index.js");
const templatePath = resolve("dist/pi/checkpoint-report-template.html");
await access(extensionPath);
await access(templatePath);
const extension = await import(`${pathToFileURL(extensionPath).href}?smoke=${Date.now()}`);
assert.equal(typeof extension.default, "function");
const commands = [];
const tools = [];
extension.default({
  appendEntry() {},
  events: { on() {} },
  exec: async () => ({ code: 0, stdout: "", stderr: "" }),
  getActiveTools: () => [],
  on() {},
  registerCommand(name) { commands.push(name); },
  registerTool(tool) { tools.push(tool.name); },
  setActiveTools() {},
});
assert.equal(commands.includes("checkpoint-viewer"), true);
assert.equal(commands.includes("artifacts"), true);
assert.equal(tools.includes("research_checkpoint"), true);
const template = await readFile(templatePath, "utf8");
assert.match(template, /checkpoint-viewer/);

console.log("Pi package smoke test passed");
