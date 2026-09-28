import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: 'export { ResearchCore } from "./src/core/research-core.ts"; export { resolveArtifactMetadata } from "./src/core/artifacts.ts";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  write: false,
});
const { ResearchCore, resolveArtifactMetadata } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const core = new ResearchCore();
assert.equal(core.enabled, false);
core.setEnabled(true);
assert.equal(core.workMode, "exploration");

const legacyCore = new ResearchCore({ enabled: true, workMode: "normal" });
assert.equal(legacyCore.workMode, "exploration");
assert.equal(core.enterMode("normal", "Use a removed mode").block, true);
assert.equal(core.workMode, "exploration");

assert.equal(core.enterMode("brainstorming", "Choose a model").block, false);
assert.equal(core.evaluateToolCall("write", { file_path: "model.py" })?.block, true);

core.startTurn();
assert.equal(core.enterMode("exploration", "Understand the experiment").block, false);
assert.match(core.policy(), /Read only the code and materials relevant to the current objective/);
assert.equal(core.evaluateToolCall("read", { file_path: "train.py" }), undefined);
assert.equal(core.evaluateToolCall("bash", { command: "python train.py" })?.block, true);
const scheduledExploration = core.evaluateToolCall("bash", { command: "sbatch repro/eval.sbatch" });
assert.equal(scheduledExploration?.block, true);
assert.equal(scheduledExploration?.approval, undefined);
assert.match(scheduledExploration?.reason, /switch to Experiment Mode/);
assert.equal(
  core.evaluateToolCall("research_mode", {
    mode: "brainstorming",
    objective: "Compare the understood paths",
  }),
  undefined,
);
assert.equal(core.lifecycleTransitionPending, true);
assert.match(core.evaluateToolCall("read", { file_path: "train.py" })?.reason, /transition to complete/);
core.completeLifecycleTransition();

core.startTurn();
const experiment = {
  title: "Compare optimizers",
  questionId: "Q1",
  question: "Does optimizer A converge faster than B?",
  predictions: [
    { observation: "the metric improves", implication: "the question is answered positively" },
    { observation: "the metric does not improve", implication: "the question is answered negatively" },
  ],
  intent: "exploratory",
  plannedDataScope: "validation split, 100 samples, one seed",
  artifactRoots: ["runs/optimizer-comparison", "runs/optimizer-comparison/figures"],
};
assert.match(core.enterMode("experiment", "Measure convergence", experiment).reason, /active proposition/);
core.setProposition("P1");
assert.match(
  core.enterMode("experiment", "Measure convergence", { ...experiment, predictions: experiment.predictions.slice(0, 1) }).reason,
  /at least two predictions/,
);
assert.equal(core.enterMode("experiment", "Measure convergence", experiment).block, false);
assert.equal(core.experiment.propositionId, "P1");
assert.match(core.policy(), /Question Q1: Does optimizer A/);
assert.match(core.policy(), /Prediction 2: if the metric does not improve/);
assert.match(core.policy(), /Write every mathematical expression as LaTeX/);
assert.deepEqual(core.artifactRoots, ["runs/optimizer-comparison"]);
const scheduledRun = core.evaluateToolCall("bash", {
  command: "sbatch repro/official_models/eval_obfuscated_activations.sbatch",
});
assert.equal(scheduledRun, undefined);
assert.equal(core.enterMode("exploration", "silently leave").block, true);

const reproductionCore = new ResearchCore();
reproductionCore.setEnabled(true);
reproductionCore.setProposition("P1");
reproductionCore.resetRequest("Please reproduce the official experiment");
assert.equal(reproductionCore.enterMode("experiment", "Reproduce the result", {
  title: "Official result",
  questionId: "Q1",
  question: "Does the official result reproduce?",
  predictions: [
    { observation: "the metric improves", implication: "the question is answered positively" },
    { observation: "the metric does not improve", implication: "the question is answered negatively" },
  ],
  intent: "reproduction",
  plannedDataScope: "official dataset and split",
  reference: "paper and repository",
}).block, false);
assert.match(reproductionCore.policy(), /check the official paper/);
const reducedReproduction = reproductionCore.evaluateToolCall("bash", {
  command: "python train.py --max_samples 100",
});
assert.equal(reducedReproduction?.block, true);
assert.equal(reducedReproduction?.approval?.kind, "protocol-deviation");

const approvedDiagnostic = new ResearchCore();
approvedDiagnostic.setEnabled(true);
approvedDiagnostic.setProposition("P1");
approvedDiagnostic.resetRequest("Please reproduce the result, but first use a small-sample diagnostic");
assert.equal(approvedDiagnostic.enterMode("experiment", "Run an approved diagnostic", {
  title: "Small-sample diagnostic",
  questionId: "Q2",
  question: "Can the reproduction pipeline execute?",
  predictions: [
    { observation: "the metric improves", implication: "the question is answered positively" },
    { observation: "the metric does not improve", implication: "the question is answered negatively" },
  ],
  intent: "diagnostic",
  plannedDataScope: "100 samples",
}).block, false);
assert.equal(approvedDiagnostic.evaluateToolCall("bash", {
  command: "python train.py --max_samples 100",
}), undefined);


const fidelityCore = (intent, prompt) => {
  const instance = new ResearchCore();
  instance.setEnabled(true);
  instance.setProposition("P1");
  instance.resetRequest(prompt);
  assert.equal(instance.enterMode("experiment", "Check fidelity", {
    title: "Fidelity",
    questionId: "Q1",
    question: "Does the result reproduce?",
    predictions: experiment.predictions,
    intent,
    plannedDataScope: "official split",
  }).block, false);
  return instance;
};
const declaredReproduction = fidelityCore("reproduction", "继续");
assert.equal(declaredReproduction.evaluateToolCall("bash", { command: "python eval.py --max_samples 100" })?.block, true);
assert.equal(declaredReproduction.evaluateToolCall("write", { content: "print(logits[:5])" }), undefined);
assert.equal(declaredReproduction.evaluateToolCall("bash", { command: "head -n 20 results/per_seed.csv" }), undefined);
assert.equal(declaredReproduction.evaluateToolCall("write", { content: "train_data = train_data[:1000]" })?.block, true);
assert.equal(declaredReproduction.evaluateToolCall("bash", { command: "head -n 1000 data/train.jsonl > data/subset.jsonl" })?.block, true);
const exploratory = fidelityCore("exploratory", "Please reproduce the official experiment");
assert.equal(exploratory.evaluateToolCall("bash", { command: "python eval.py --max_samples 100" }), undefined);

const reviewCore = fidelityCore("exploratory", "Measure the effect");
reviewCore.startTurn();
for (let index = 0; index < 6; index += 1) reviewCore.evaluateToolCall("read", { path: `run-${index}.log` });
assert.match(reviewCore.policy(), /\[SOFT REVIEW\] 6 actions have run/);
reviewCore.startTurn();
reviewCore.evaluateToolCall("read", { path: "summary.json" });
assert.doesNotMatch(reviewCore.policy(), /SOFT REVIEW/);

const artifactDirectory = await mkdtemp(join(tmpdir(), "research-loop-artifact-"));
try {
  const artifactPath = join(artifactDirectory, "metrics.json");
  await writeFile(artifactPath, "{\"loss\": 0.1}\n", "utf8");
  const artifact = await resolveArtifactMetadata(artifactDirectory, artifactPath);
  assert.equal(artifact?.path, "metrics.json");
  assert.equal(artifact?.extension, ".json");
} finally {
  await rm(artifactDirectory, { recursive: true, force: true });
}

core.reachCheckpoint(0);
assert.equal(core.workMode, "exploration");
assert.match(core.projectStatus().text, /CHECKPOINT REACHED/);

console.log("core smoke test passed");
