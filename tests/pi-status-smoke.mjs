import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: 'export { ResearchCore } from "./src/core/research-core.ts"; export { renderPiResearchStatus } from "./src/pi-status.ts";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  write: false,
});
const { ResearchCore, renderPiResearchStatus } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const plainTheme = { fg: (_color, text) => text };

const off = new ResearchCore();
assert.equal(renderPiResearchStatus(off.snapshot(), plainTheme), "◇ research  off");

const defaultMode = new ResearchCore();
defaultMode.setEnabled(true);
defaultMode.evaluateToolCall("read", { path: "README.md" });
assert.equal(
  renderPiResearchStatus(defaultMode.snapshot(), plainTheme),
  "◇ research  exploration · no proposition · read only",
);

const brainstorming = new ResearchCore();
brainstorming.setEnabled(true);
brainstorming.enterMode("brainstorming", "Compare directions");
assert.equal(
  renderPiResearchStatus(brainstorming.snapshot(), plainTheme),
  "◇ research  brainstorming · no proposition · read only",
);

const exploration = new ResearchCore();
exploration.setEnabled(true);
exploration.enterMode("exploration", "Map the implementation");
exploration.setProposition("P1");
assert.equal(
  renderPiResearchStatus(exploration.snapshot(), plainTheme),
  "◇ research  exploration · P1 · read only",
);
assert.equal(
  renderPiResearchStatus(exploration.snapshot(), plainTheme, true, "Q2"),
  "◇ research  exploration · P1 next Q2 · read only · waiting for decision",
);

const experiment = new ResearchCore();
experiment.setEnabled(true);
experiment.setProposition("P1");
experiment.enterMode("experiment", "Reproduce the baseline", {
  title: "Baseline reproduction",
  questionId: "Q1",
  question: "Does the baseline match the reference?",
  predictions: [
    { observation: "the metric improves", implication: "the question is answered positively" },
    { observation: "the metric does not improve", implication: "the question is answered negatively" },
  ],
  intent: "reproduction",
  plannedDataScope: "official evaluation split",
});
experiment.upsertArtifact({
  path: "results/metrics.json",
  kind: "file",
  extension: ".json",
  size: 128,
  modifiedAt: Date.now(),
});
for (let index = 0; index < 6; index += 1) {
  experiment.evaluateToolCall("read", { path: `result-${index}.json` });
}
assert.equal(
  renderPiResearchStatus(experiment.snapshot(), plainTheme),
  "◆ research  experiment · P1 Q1 · reproduction · 6 actions · 1 output · review due",
);

experiment.reachCheckpoint(2);
assert.equal(
  renderPiResearchStatus(experiment.snapshot(), plainTheme),
  "◆ research  checkpoint · 2 results",
);

const styledTheme = { fg: (color, text) => `<${color}>${text}</${color}>` };
const styled = renderPiResearchStatus(experiment.snapshot(), styledTheme);
assert.match(styled, /<success>◆<\/success>/);
assert.match(styled, /<accent>research<\/accent>/);
assert.match(styled, /<text>2 results<\/text>/);

console.log("Pi status smoke test passed");
