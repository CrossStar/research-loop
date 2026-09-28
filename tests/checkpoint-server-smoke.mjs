import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: 'export * from "./src/checkpoint-server.ts"; export * from "./src/checkpoint-store.ts"; export * from "./src/proposition-store.ts";',
    resolveDir: process.cwd(),
    sourcefile: "checkpoint-viewer-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  write: false,
});
const source = bundle.outputFiles[0]?.text;
assert.ok(source, "checkpoint viewer bundle was not generated");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const {
  CheckpointStore,
  CheckpointViewerServer,
  describePropositionForPolicy,
  formatSshPortForwardCommand,
  mathTextHtml,
  nextCheckpointSequence,
  nextQuestionNumber,
  parseCheckpointMarkdown,
  PropositionStore,
  questionPath,
  validateCheckpointDraft,
} = await import(moduleUrl);

assert.equal(
  formatSshPortForwardCommand("http://127.0.0.1:43119/latest", "moon"),
  "ssh -N -o RemoteCommand=none -o RequestTTY=no -L 43119:127.0.0.1:43119 moon",
);

const project = await mkdtemp(join(tmpdir(), "research-loop-checkpoint-viewer-"));
const outside = await mkdtemp(join(tmpdir(), "research-loop-checkpoint-outside-"));
const results = join(project, "results");
await mkdir(results, { recursive: true });
const pngPath = join(results, "figure.png");
const jsonPath = join(results, "summary.json");
const csvPath = join(results, "per_seed.csv");
await writeFile(pngPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
await writeFile(jsonPath, JSON.stringify({ aggregate: { accuracy: 0.91 }, seeds: [7, 42] }, null, 2));
await writeFile(csvPath, "seed,accuracy\n7,0.90\n42,0.92\n", "utf8");
await writeFile(join(outside, "secret.json"), JSON.stringify({ secret: true }), "utf8");
await symlink(outside, join(project, "escape"), process.platform === "win32" ? "junction" : "dir");
await mkdir(join(project, "checkpoints"), { recursive: true });
await writeFile(
  join(project, "checkpoints", "legacy.md"),
  "# Checkpoint：旧格式记录\n\n## 4. 结论与下一步\n\n旧记录也应被 Viewer 发现。\n",
  "utf8",
);
await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));

const artifact = (path, name, extension, size) => ({
  kind: "file",
  path,
  name,
  extension,
  size,
  mtimeMs: Date.now(),
  discoveredAt: Date.now(),
});
const artifacts = [
  {
    path: "results/figure.png",
    title: "主要结果图",
    role: "evidence",
    description: "展示实验组与对照组差异。",
    artifact: artifact("results/figure.png", "figure.png", ".png", 68),
    absolutePath: pngPath,
  },
  {
    path: "results/summary.json",
    title: "汇总指标",
    role: "diagnostic",
    description: "保存聚合指标。",
    artifact: artifact("results/summary.json", "summary.json", ".json", 80),
    absolutePath: jsonPath,
  },
  {
    path: "results/per_seed.csv",
    title: "逐种子结果",
    role: "dataset",
    description: "保存逐种子精确数值。",
    artifact: artifact("results/per_seed.csv", "per_seed.csv", ".csv", 32),
    absolutePath: csvPath,
  },
];
const draft = {
  title: "实验组在主要指标上稳定优于对照组",
  experimentId: "viewer-smoke-001",
  answer: "两个随机种子都显示同方向差异。",
  verdict: "supports",
  verdictReason: "差异方向在两个种子上一致。",
  whyMarkdown: "此前观察到实验组可能优于对照组；运行成本介于 $5 and $10。本次希望判断该差异是稳定效应，还是单一种子波动。\n\n<script>unsafe()</script>",
  dataset: {
    name: "合成二分类数据 v1",
    reason: "可以精确控制两组的真实差异。",
    description: "每个种子 1000 个训练样本、500 个测试样本，20 维高斯特征，标签由线性规则生成。",
  },
  keyHyperparameters: [
    { name: "种子数", value: "2", reason: "先检查方向是否一致。" },
    { name: String.raw`正则化强度 $\lambda$`, value: String.raw`$10^{-2}$`, reason: "与对照组保持一致。" },
  ],
  designMarkdown: "本实验比较实验组和对照组，使用两个随机种子，并以准确率作为主要指标。",
  observationsMarkdown: [
    "本实验最重要的结果是：**两个随机种子都显示实验组更高。**",
    "",
    "![图 1　两个条件的准确率差异](results/figure.png \"图 1　两个条件的准确率差异\")",
    "",
    "图 1 显示两个随机种子的差异方向一致，支持稳定效应解释。汇总关系写为 $a+b=c$，代码字面量 `$not_math$` 保持原样。",
    "",
    "---",
    "",
    "[查看汇总 JSON](results/summary.json)",
    "",
    "[查看逐种子 CSV](results/per_seed.csv)",
    "",
    "### 表 1　逐种子准确率",
    "",
    "| 条件 | 种子数量 | 准确率 |",
    "| --- | ---: | ---: |",
    "| 实验组 | 2 | 0.91 |",
    "| 对照组 | 2 | 0.82 |",
    "",
    "表 1 显示实验组在汇总准确率上领先 0.09，这一结果说明总体差异与逐种子观察保持一致。",
    "",
    "---",
    "",
    "```checkpoint-chart",
    JSON.stringify({ type: "bar", title: "图 2　平均准确率比较", items: [{ label: "实验组", value: 0.91 }, { label: "对照组", value: 0.82 }] }),
    "```",
    "",
    "图 2 显示实验组柱高超过对照组，意味着当前数据范围内存在稳定的正向差异。",
    "",
    "---",
  ].join("\n"),
  judgmentMarkdown: "本实验支持实验组稳定优于对照组，但还不能证明具体机制。",
  predictionOutcomes: [
    { outcome: "observed", note: "两个种子都领先约 0.09（表 1）。" },
    { outcome: "not-observed", note: "没有种子出现反向差异。" },
  ],
  newQuestions: [{
    question: "差异是否来自数据增强？",
    whyItArose: "差异稳定存在，但实验组同时改变了增强策略。",
    proposedExperiment: "只关闭数据增强，保持其他设置不变。",
    predictions: [
      { observation: "差异消失", implication: "增强解释了差异" },
      { observation: "差异保持", implication: "差异来自其他改动" },
    ],
  }],
  revisionProposal: { statement: "实验组在同分布数据上优于对照组", reason: "只测试了同分布数据" },
  protocols: [{ title: "viewer smoke", intent: "diagnostic", dataScope: "two synthetic seeds", sources: [], deviations: [] }],
  reproduction: {
    model: "test-model",
    modelRevision: "r1",
    dataset: "synthetic",
    dataRevision: "v1",
    codeCommit: "abc1234",
    seeds: ["7", "42"],
    parameters: [{ name: "samples", value: "100" }],
    environment: "CPU smoke test",
  },
};
assert.deepEqual(validateCheckpointDraft(draft, artifacts, 2).errors, []);
assert.match(validateCheckpointDraft(draft, artifacts, 3).errors.join("\n"), /逐条对应/);
assert.match(validateCheckpointDraft({ ...draft, keyHyperparameters: [] }, artifacts, 2).errors.join("\n"), /至少需要一项/);
assert.match(validateCheckpointDraft({ ...draft, dataset: { ...draft.dataset, reason: " " } }, artifacts, 2).errors.join("\n"), /dataset 的 name、reason 和 description 不能为空/);
const detachedFigure = structuredClone(draft);
detachedFigure.observationsMarkdown = detachedFigure.observationsMarkdown.replace("![图 1　两个条件的准确率差异]", "[图 1　两个条件的准确率差异]");
assert.match(validateCheckpointDraft(detachedFigure, artifacts, 2).errors.join("\n"), /必须直接引用/);
const invalidChart = structuredClone(draft);
invalidChart.observationsMarkdown = invalidChart.observationsMarkdown.replace('"type":"bar"', '"type":"pie"');
assert.match(validateCheckpointDraft(invalidChart, artifacts, 2).errors.join("\n"), /type 必须是 bar 或 line/);
const forbiddenContrast = structuredClone(draft);
forbiddenContrast.judgmentMarkdown = "该结果不是随机波动，而是稳定差异。";
assert.match(validateCheckpointDraft(forbiddenContrast, artifacts, 2).errors.join("\n"), /禁止使用/);
forbiddenContrast.judgmentMarkdown = "结果支持稳定差异，而不是随机波动。";
assert.match(validateCheckpointDraft(forbiddenContrast, artifacts, 2).errors.join("\n"), /禁止使用/);

assert.equal(mathTextHtml("成本介于 $5 and $10"), "成本介于 $5 and $10");
assert.equal(mathTextHtml(String.raw`当 $a<b$ 时`), String.raw`当 \(a&lt;b\) 时`);
assert.equal(mathTextHtml(undefined), undefined);

assert.throws(() => new CheckpointStore(project, "."), /subdirectory inside the project/);
const store = new CheckpointStore(project);
const propositions = new PropositionStore(store);
assert.match(describePropositionForPolicy(undefined), /No active proposition/);
const proposition = await propositions.create({
  statement: "实验组在主要指标上优于对照组",
  background: "此前单次运行观察到实验组更好。",
  questions: [
    { question: "差异是否跨随机种子稳定？", rationale: "单次运行可能来自种子波动。" },
    { question: "差异是否跨数据集成立？", rationale: "命题没有限定数据分布。" },
  ],
});
assert.equal(proposition.id, "P1");
let tree = await propositions.tree("P1");
assert.equal(nextQuestionNumber(tree), 3);
assert.equal(nextCheckpointSequence(tree), 1);
const chainFor = (currentTree, questionId, newQuestionCount, predictions) => {
  const question = currentTree.questions.find((item) => item.id === questionId);
  const raisedBy = currentTree.checkpoints.find((item) => item.id === question.raised_by);
  const first = nextQuestionNumber(currentTree);
  return {
    proposition: { id: currentTree.proposition.id, statement: currentTree.proposition.statement },
    question: { id: question.id, question: question.question, origin: question.origin },
    path: questionPath(currentTree, questionId).map((step) => ({
      questionId: step.question.id,
      via: step.via && { sequence: step.via.sequence, answer: step.via.answer },
    })),
    raisedBy: raisedBy && { sequence: raisedBy.sequence, title: raisedBy.title },
    predictions,
    sequence: nextCheckpointSequence(currentTree),
    newQuestionIds: Array.from({ length: newQuestionCount }, (_, index) => `Q${first + index}`),
  };
};
const predictions = [
  { observation: "两个种子都显示实验组更高", implication: "差异跨种子稳定" },
  { observation: "至少一个种子出现反向差异", implication: "差异可能来自种子波动" },
];
const chain = chainFor(tree, "Q1", 1, predictions);
await assert.rejects(new CheckpointStore(project, "escape").write(draft, [], chain), /resolves outside the project/);
const stored = await store.write(draft, artifacts, chain);
const markdown = await readFile(stored.markdownPath, "utf8");
assert.match(markdown, /^---\n\{"schema_version":2,/);
assert.match(markdown, /# C1：实验组在主要指标上稳定优于对照组/);
assert.match(markdown, /> \*\*推理位置\*\*：P1 → \*\*Q1（本轮）\*\*/);
assert.match(markdown, /Q1 来自命题 P1 的拆解：单次运行可能来自种子波动。/);
assert.match(markdown, /## 1\. 为什么做这个实验/);
assert.match(markdown, /\| 预期 2 \| 至少一个种子出现反向差异 \| 差异可能来自种子波动 \|/);
assert.match(markdown, /### 数据集\n\n\*\*合成二分类数据 v1\*\*\n\n\* \*\*选择理由：\*\* 可以精确控制两组的真实差异。/);
assert.match(markdown, /\| 正则化强度 \$\\lambda\$ \| \$10\^\{-2\}\$ \| 与对照组保持一致。 \|/);
assert.match(markdown, /### 设计思路\n\n本实验比较实验组和对照组/);
assert.match(markdown, /## 3\. 实际观察/);
assert.match(markdown, /\| 预期 1 \| 两个种子都显示实验组更高 \| 出现 \|/);
assert.match(markdown, /\*\*对命题的影响：\*\* 支持。/);
assert.match(markdown, /命题修订建议（待用户确认）/);
assert.match(markdown, /### Q3　差异是否来自数据增强？/);
assert.match(markdown, /## 复现信息/);
assert.match(markdown, /\.\.\/\.\.\/results\/figure\.png \"图 1　两个条件的准确率差异\"/);
const storedMetadata = parseCheckpointMarkdown(markdown).metadata;
assert.equal(storedMetadata.title, draft.title);
assert.equal(storedMetadata.question_id, "Q1");
assert.equal(storedMetadata.new_questions[0].id, "Q3");

tree = await propositions.tree("P1");
assert.deepEqual(tree.questions.map((item) => `${item.id}:${item.status}`), ["Q1:answered", "Q2:open", "Q3:open"]);
assert.equal(tree.questions.find((item) => item.id === "Q3").raised_by, stored.metadata.id);
assert.match(describePropositionForPolicy(tree, "Q3"), /Q3 \[raised by C1\]: 差异是否来自数据增强？/);
assert.match(describePropositionForPolicy(tree, "Q3"), /The user selected Q3/);
const followUp = {
  ...structuredClone(draft),
  title: "关闭数据增强后差异保持",
  answer: "差异与数据增强无关。",
  newQuestions: [],
  revisionProposal: undefined,
};
const followUpChain = chainFor(tree, "Q3", 0, [
  { observation: String.raw`$\lvert \Delta \rvert < 0.01$，即 $|g| \approx 0$`, implication: "增强解释了差异" },
  predictions[1],
]);
assert.equal(followUpChain.sequence, 2);
const followUpStored = await store.write(followUp, artifacts, followUpChain);
const followUpMarkdown = await readFile(followUpStored.markdownPath, "utf8");
assert.match(followUpMarkdown, /推理位置\*\*：P1 → Q1（C1：两个随机种子都显示同方向差异。） → \*\*Q3（本轮）\*\*/);
assert.match(followUpMarkdown, /Q3 由 C1（实验组在主要指标上稳定优于对照组）提出：差异稳定存在/);
assert.match(followUpMarkdown, /本轮没有提出新问题。/);
assert.match(followUpMarkdown, /\| 预期 1 \| \$\\lvert \\Delta \\rvert < 0\.01\$，即 \$\|g\| \\approx 0\$ \| 增强解释了差异 \|/);
const added = await propositions.addQuestion("P1", String.raw`差异是否在 $n \approx d$ 附近反转？`, "用户在 C2 之后提出。", "user");
assert.equal(added.id, "Q4");
await propositions.revise("P1", "实验组在同分布数据上优于对照组", "只测试了同分布数据");
assert.equal((await propositions.find("P1")).revisions.length, 1);

const discovered = await store.list();
assert.equal(discovered.length, 3, "proposition files must not be discovered as checkpoints");
assert.equal(discovered[0].metadata.id, followUpStored.metadata.id);
assert.equal(discovered.some((item) => item.metadata.title === "旧格式记录"), true);

const blocker = createServer((_request, response) => response.end("occupied"));
await new Promise((resolveListen, rejectListen) => {
  blocker.once("error", rejectListen);
  blocker.listen(0, "127.0.0.1", resolveListen);
});
const blockedPort = blocker.address().port;
const templatePath = resolve("src/checkpoint-report-template.html");
const previousHost = process.env.RESEARCH_LOOP_CHECKPOINT_HOST;
process.env.RESEARCH_LOOP_CHECKPOINT_HOST = "0.0.0.0";
assert.equal(new CheckpointViewerServer(store, { templatePath }).host, "0.0.0.0");
process.env.RESEARCH_LOOP_CHECKPOINT_HOST = "localhost";
assert.throws(() => new CheckpointViewerServer(store, { templatePath }), /must be 127\.0\.0\.1 or 0\.0\.0\.0/);
if (previousHost === undefined) delete process.env.RESEARCH_LOOP_CHECKPOINT_HOST;
else process.env.RESEARCH_LOOP_CHECKPOINT_HOST = previousHost;

const server = new CheckpointViewerServer(store, {
  basePort: blockedPort,
  host: "127.0.0.1",
  templatePath,
});
try {
  await server.start();
  assert.equal(server.host, "127.0.0.1");
  assert.equal(server.exposedToNetwork, false);
  assert.match(server.latestUrl, /^http:\/\/127\.0\.0\.1:\d+\/latest$/);
  assert.notEqual(new URL(server.latestUrl).port, String(blockedPort));
  const origin = server.origin;

  const viewer = await fetch(`${origin}/`);
  assert.equal(viewer.status, 200);
  const viewerHtml = await viewer.text();
  assert.match(viewerHtml, /class="checkpoint-viewer"/);
  assert.doesNotMatch(viewerHtml, /实验组在主要指标/);

  const history = await fetch(`${origin}/api/checkpoints`).then((response) => response.json());
  assert.equal(history.length, 3);
  assert.equal(history[0].url, `/checkpoints/${encodeURIComponent(followUpStored.metadata.id)}`);
  assert.equal(history[0].proposition_id, "P1");

  const propositionList = await fetch(`${origin}/api/propositions`).then((response) => response.json());
  assert.equal(propositionList.length, 1);
  assert.equal(propositionList[0].checkpoints, 2);
  assert.equal(propositionList[0].open_questions, 2);
  assert.equal((await fetch(`${origin}/propositions/P1`)).status, 200);
  const propositionTree = await fetch(`${origin}/api/propositions/P1`).then((response) => response.json());
  assert.equal(propositionTree.proposition.statement, "实验组在同分布数据上优于对照组");
  assert.equal(propositionTree.checkpoints[1].url, `/checkpoints/${encodeURIComponent(followUpStored.metadata.id)}`);
  assert.equal(
    propositionTree.questions.find((item) => item.id === "Q4").question_html,
    String.raw`差异是否在 \(n \approx d\) 附近反转？`,
  );
  assert.equal(propositionTree.checkpoints[0].answer_html, propositionTree.checkpoints[0].answer);
  assert.ok(propositionTree.proposition.statement_html);
  assert.ok(propositionList[0].statement_html);
  assert.ok(history[0].title_html);
  const followUpPayload = await fetch(`${origin}/api/checkpoints/${encodeURIComponent(followUpStored.metadata.id)}`).then((response) => response.json());
  assert.equal(followUpPayload.metadata.title_text, followUp.title);
  assert.match(followUpPayload.html, /<td>\\\(\\lvert \\Delta \\rvert &lt; 0\.01\\\)，即 \\\(\|g\| \\approx 0\\\)<\/td>/);
  assert.equal((await fetch(`${origin}/api/propositions/P9`)).status, 404);

  const latestShell = await fetch(`${origin}/latest`);
  assert.equal(latestShell.status, 200);
  const newest = await fetch(`${origin}/api/latest`).then((response) => response.json());
  assert.equal(newest.metadata.title, followUp.title);
  const latest = await fetch(`${origin}/api/checkpoints/${encodeURIComponent(stored.metadata.id)}`).then((response) => response.json());
  assert.equal(latest.metadata.title, draft.title);
  assert.match(latest.html, /id="1-为什么做这个实验"/);
  assert.match(latest.html, /\/artifacts\/results\/figure\.png/);
  assert.match(latest.html, /<figcaption>图 1　两个条件的准确率差异<\/figcaption>/);
  assert.doesNotMatch(latest.html, /<p><figure/);
  assert.match(latest.html, /data-preview-kind="json"/);
  assert.match(latest.html, /<figure class="checkpoint-chart"/);
  const tableTitleIndex = latest.html.indexOf('class="table-title"');
  const tableIndex = latest.html.indexOf("<table>", tableTitleIndex);
  assert.equal(tableTitleIndex >= 0 && tableIndex > tableTitleIndex, true);
  assert.doesNotMatch(latest.html.slice(tableTitleIndex, tableIndex), /<p>/);
  assert.match(latest.html, /\$5 and \$10/);
  assert.match(latest.html, /\\\(a\+b=c\\\)/);
  assert.match(latest.html, /<code>\$not_math\$<\/code>/);
  assert.match(latest.html, /class="raw-html"/);
  assert.doesNotMatch(latest.html, /<script>/);
  assert.doesNotMatch(latest.html, /\\\(5 and /);
  assert.equal(latest.toc.some((item) => item.text === "3. 实际观察"), true);

  const checkpointShell = await fetch(`${origin}/checkpoints/${stored.metadata.id}`);
  assert.equal(checkpointShell.status, 200);
  const image = await fetch(`${origin}/artifacts/results/figure.png`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(image.headers.get("content-security-policy"), "default-src 'none'; sandbox");
  assert.equal(image.headers.get("cross-origin-resource-policy"), "same-origin");
  const preview = await fetch(`${origin}/api/artifacts/results/summary.json`).then((response) => response.json());
  assert.equal(preview.kind, "json");
  assert.match(preview.text, /accuracy/);
  const traversal = await fetch(`${origin}/artifacts/%2E%2E/package.json`);
  assert.equal([403, 404].includes(traversal.status), true);
  const symlinkEscape = await fetch(`${origin}/artifacts/escape/secret.json`);
  assert.equal(symlinkEscape.status, 403);

  const networkServer = new CheckpointViewerServer(store, {
    basePort: blockedPort <= 65400 ? blockedPort + 100 : blockedPort - 100,
    host: "0.0.0.0",
    templatePath,
  });
  try {
    await networkServer.start();
    assert.equal(networkServer.host, "0.0.0.0");
    assert.equal(networkServer.exposedToNetwork, true);
    const healthUrl = new URL("/health", networkServer.origin);
    healthUrl.hostname = "127.0.0.1";
    const health = await fetch(healthUrl).then((response) => response.json());
    assert.equal(health.ok, true);
  } finally {
    await networkServer.stop();
  }
} finally {
  await server.stop();
  await new Promise((resolveClose) => blocker.close(resolveClose));
  await rm(project, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
}

console.log("Checkpoint Viewer and persistent Markdown smoke test passed");
