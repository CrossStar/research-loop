import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const extension = await import(`${pathToFileURL(resolve("dist/pi/index.js")).href}?proposition=${Date.now()}`);
const project = await mkdtemp(join(tmpdir(), "research-loop-proposition-"));
const tools = new Map();
const commands = new Map();
const handlers = new Map();
const entries = [];
const sentMessages = [];
const confirmations = [];
const selections = [];
const notifications = [];
let activeTools = ["read", "write", "bash"];
let aborts = 0;
let confirmAnswer = true;

extension.default({
  appendEntry(customType, data) { entries.push({ id: `entry-${entries.length}`, type: "custom", customType, data }); },
  events: { on() {} },
  exec: async () => ({ code: 0, stdout: "", stderr: "" }),
  getActiveTools: () => [...activeTools],
  on(name, handler) { handlers.set(name, handler); },
  registerCommand(name, command) { commands.set(name, command); },
  registerTool(tool) { tools.set(tool.name, tool); },
  sendUserMessage(message) { sentMessages.push(message); },
  setActiveTools(value) { activeTools = [...value]; },
});

const ctx = {
  cwd: project,
  hasUI: true,
  mode: "tui",
  abort() { aborts += 1; },
  sessionManager: {
    getLeafEntry: () => entries.at(-1),
    getEntry: (id) => entries.find((entry) => entry.id === id),
  },
  ui: {
    theme: { fg: (_color, text) => text },
    notify(message, level) { notifications.push({ message, level }); },
    setStatus() {},
    setWidget() {},
    async confirm(title, message) {
      confirmations.push({ title, message });
      return confirmAnswer;
    },
    async select(title, options) {
      selections.push({ title, options });
      return options.find((option) => option.startsWith("Q3"));
    },
    async editor(_title, prefill) { return `${prefill}\n先只看两个种子。`; },
    async input() { return undefined; },
  },
};
const run = (name, params) => tools.get(name).execute(`call-${name}`, params, undefined, undefined, ctx);
const policy = () => handlers.get("context")({ messages: [] }).messages.at(-1)?.content ?? "";
const predictions = [
  { observation: "两个种子都显示实验组更高", implication: "差异跨种子稳定" },
  { observation: "至少一个种子反向", implication: "差异可能来自种子波动" },
];

try {
  handlers.get("session_start")({}, ctx);
  await commands.get("research").handler("on", ctx);
  assert.equal(activeTools.includes("research_proposition"), true);
  assert.match(policy(), /No active proposition/);

  const blockedExperiment = await run("research_mode", {
    mode: "experiment",
    objective: "Test stability",
    title: "Seed stability",
    questionId: "Q1",
    rationale: "Seeds separate noise from effect.",
    predictions,
    intent: "exploratory",
    plannedDataScope: "two seeds",
  });
  assert.equal(blockedExperiment.details.accepted, false);
  assert.match(blockedExperiment.content[0].text, /active proposition/);

  confirmAnswer = false;
  const declined = await run("research_proposition", {
    action: "create",
    statement: "实验组优于对照组",
    questions: [{ question: "差异是否跨种子稳定？", rationale: "单次运行可能来自种子波动。" }],
  });
  assert.equal(declined.details.accepted, false);
  assert.equal(aborts, 1);
  confirmAnswer = true;

  const created = await run("research_proposition", {
    action: "create",
    statement: "实验组在主要指标上优于对照组",
    background: "单次运行中实验组更好。",
    questions: [
      { question: "差异是否跨种子稳定？", rationale: "单次运行可能来自种子波动。" },
      { question: "差异是否跨数据集成立？", rationale: "命题没有限定数据分布。" },
    ],
  });
  assert.equal(created.details.accepted, true);
  assert.match(confirmations.at(-1).message, /Q2　差异是否跨数据集成立？/);
  assert.equal(entries.at(-1).data.propositionId, "P1");
  assert.match(await readFile(join(project, "checkpoints", "propositions", "P1.md"), "utf8"), /# 命题 P1：实验组在主要指标上优于对照组/);
  assert.match(policy(), /Active proposition P1/);
  assert.match(policy(), /- Q2: 差异是否跨数据集成立？/);

  const unknownQuestion = await run("research_mode", {
    mode: "experiment",
    objective: "Test stability",
    title: "Seed stability",
    questionId: "Q9",
    rationale: "Seeds separate noise from effect.",
    predictions,
    intent: "exploratory",
    plannedDataScope: "two seeds",
  });
  assert.match(unknownQuestion.content[0].text, /Q9 is not registered under P1\. Open questions: Q1, Q2/);

  const entered = await run("research_mode", {
    mode: "experiment",
    objective: "Test stability",
    title: "Seed stability",
    questionId: "Q1",
    rationale: "Seeds separate noise from effect.",
    predictions,
    intent: "exploratory",
    plannedDataScope: "two seeds",
    artifactRoots: ["results"],
  });
  assert.equal(entered.details.accepted, true);
  assert.match(entered.content[0].text, /Question Q1: 差异是否跨种子稳定？/);
  assert.equal(activeTools.includes("research_proposition"), false);
  assert.match(policy(), /Prediction 2: if 至少一个种子反向/);

  await mkdir(join(project, "results"), { recursive: true });
  await writeFile(join(project, "results", "summary.json"), JSON.stringify({ gap: 0.09 }), "utf8");
  const checkpoint = await run("research_checkpoint", {
    title: "实验组在两个种子上都领先",
    answer: "差异在两个种子上方向一致。",
    verdict: "supports",
    verdictReason: "两个种子都显示正向差异。",
    whyMarkdown: "单次运行不能区分效应和种子波动。",
    dataset: { name: "合成数据", reason: "可控制真实差异。", description: "每个种子 1000 个样本。" },
    keyHyperparameters: [{ name: "种子", value: "7, 42", reason: "检查方向一致性。" }],
    designMarkdown: "比较两个种子下两组的准确率。",
    observationsMarkdown: "两个种子的差异都约为 0.09，详见 [汇总](results/summary.json)。",
    predictionOutcomes: [
      { outcome: "observed", note: "两个种子差异均为正。" },
      { outcome: "not-observed", note: "没有反向种子。" },
    ],
    judgmentMarkdown: "预期 1 出现，差异跨种子稳定；两个种子仍不足以估计方差。",
    newQuestions: [{
      question: "差异是否来自数据增强？",
      whyItArose: "实验组同时改变了数据增强。",
      proposedExperiment: "只关闭数据增强。",
      predictions: [
        { observation: "差异消失", implication: "增强解释差异" },
        { observation: "差异保持", implication: "差异来自其他改动" },
      ],
    }],
    protocols: [{ title: "seeds", intent: "exploratory", dataScope: "two seeds", sources: [], deviations: [] }],
    reproduction: {
      model: "not-applicable",
      modelRevision: "not-applicable",
      dataset: "synthetic",
      dataRevision: "v1",
      codeCommit: "test",
      seeds: ["7", "42"],
      parameters: [],
    },
    artifacts: [{ path: "results/summary.json", title: "汇总", role: "diagnostic", description: "保存差异。" }],
  });
  assert.equal(checkpoint.isError, undefined, checkpoint.content[0].text);
  assert.match(checkpoint.content[0].text, /✓ C1 answered Q1/);
  assert.match(checkpoint.content[0].text, /Q3 差异是否来自数据增强？/);
  const [directory] = (await readdir(join(project, "checkpoints"))).filter((name) => name.startsWith("checkpoint-"));
  const markdown = await readFile(join(project, "checkpoints", directory, "checkpoint.md"), "utf8");
  assert.match(markdown, /\| 预期 1 \| 两个种子都显示实验组更高 \| 差异跨种子稳定 \|/);
  assert.match(markdown, /### Q3　差异是否来自数据增强？/);

  await handlers.get("agent_settled")({}, ctx);
  assert.match(selections.at(-1).title, /C1 已完成 · 命题 P1/);
  assert.deepEqual(selections.at(-1).options.slice(0, 2), ["Q3　差异是否来自数据增强？（本轮新问题）", "Q2　差异是否跨数据集成立？"]);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /下一步问题 Q3：差异是否来自数据增强？/);
  assert.match(sentMessages[0], /建议实验：只关闭数据增强。/);
  assert.match(sentMessages[0], /先只看两个种子。/);
  assert.match(policy(), /The user selected Q3 as the next question/);
  assert.match(policy(), /C1 answered Q1 \(supports\)/);
  await handlers.get("agent_settled")({}, ctx);
  assert.equal(sentMessages.length, 1, "a handoff runs once per checkpoint");
  assert.equal(notifications.some((item) => item.level === "warning" && /failed/.test(item.message)), false);
} finally {
  await handlers.get("session_shutdown")?.({}, ctx);
  await rm(project, { recursive: true, force: true });
}

console.log("Pi proposition chain smoke test passed");
