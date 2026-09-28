import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/checkpoint.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  write: false,
});
const source = bundle.outputFiles[0]?.text;
assert.ok(source, "Pi checkpoint bundle was not generated");
const directory = await mkdtemp(join(tmpdir(), "research-loop-pi-checkpoint-"));
const outside = await mkdtemp(join(tmpdir(), "research-loop-pi-checkpoint-outside-"));
try {
  const bundlePath = join(directory, "checkpoint.mjs");
  await writeFile(bundlePath, source, "utf8");
  process.env.RESEARCH_LOOP_SSH_HOST = "moon";
  const { registerResearchCheckpoint } = await import(pathToFileURL(bundlePath).href);
  let tool;
  const pi = { registerTool(value) { tool = value; } };
  let reached;
  let chainError;
  const chain = {
    proposition: { id: "P1", statement: "持久化记录能让研究者追踪论证" },
    question: { id: "Q2", question: "Markdown writer 能否保存 checkpoint？", origin: "C1 发现 Viewer 依赖文件记录。" },
    path: [{ questionId: "Q1", via: { sequence: 1, answer: "Viewer 读取文件。" } }, { questionId: "Q2" }],
    raisedBy: { sequence: 1, title: "Viewer 读取文件记录" },
    predictions: [
      { observation: "文件被写入", implication: "writer 可用" },
      { observation: "文件缺失", implication: "writer 不可用" },
    ],
    sequence: 2,
    newQuestionIds: ["Q5"],
  };
  registerResearchCheckpoint(pi, {
    getArtifacts: () => [],
    async prepareChain(newQuestionCount) {
      if (chainError) return chainError;
      assert.equal(newQuestionCount, 1);
      return chain;
    },
    async save(draft, artifacts, savedChain) {
      assert.equal(savedChain, chain);
      assert.equal(draft.title, "持久化 Markdown 正常生成");
      assert.equal(artifacts.length, 1);
      assert.equal(artifacts[0].artifact.path, "results/run.log");
      return {
        stored: {
          metadata: {
            schema_version: 1,
            id: "checkpoint-test",
            title: draft.title,
            created_at: new Date().toISOString(),
            short_conclusion: draft.answer,
            artifact_paths: [],
          },
          directory,
          markdownPath: join(directory, "checkpoint.md"),
          relativeMarkdownPath: "checkpoints/checkpoint-test/checkpoint.md",
        },
        viewerUrl: "http://127.0.0.1:43119/latest",
      };
    },
    onReached({ resultCount }) { reached = resultCount; },
  });
  assert.equal(tool.name, "research_checkpoint");
  assert.equal(tool.promptGuidelines.some((line) => /as LaTeX in every field/.test(line)), true);
  assert.equal(tool.promptGuidelines.some((line) => /show the key comparison as a table or figure/.test(line)), true);
  const notifications = [];
  const context = {
    cwd: directory,
    ui: { notify(message, level) { notifications.push({ message, level }); } },
  };
  const params = {
    title: "持久化 Markdown 正常生成",
    experimentId: "smoke-1",
    answer: "Viewer 始终读取项目中的最新研究记录。",
    verdict: "supports",
    verdictReason: "文件已写入并可被发现。",
    whyMarkdown: "此前缺少持久化研究记录。本次检查 Markdown writer。",
    dataset: { name: "合成输入", reason: "只检查 writer。", description: "一条合成日志。" },
    keyHyperparameters: [{ name: "epochs", value: "1", reason: "只需一次写入。" }],
    designMarkdown: "使用合成输入检查各段正文。",
    observationsMarkdown: "最重要的结果是 checkpoint 已保存。",
    predictionOutcomes: [
      { outcome: "observed", note: "checkpoint.md 已存在。" },
      { outcome: "not-observed", note: "没有缺失文件。" },
    ],
    judgmentMarkdown: "实现支持持久化记录。",
    newQuestions: [{
      question: "浏览器能否渲染问题树？",
      whyItArose: "文件已写入，但尚未检查浏览器显示。",
      proposedExperiment: "启动 Viewer 并打开命题页。",
      predictions: [
        { observation: "问题树显示", implication: "链条可读" },
        { observation: "问题树为空", implication: "链接字段缺失" },
      ],
    }],
    protocols: [{ title: "smoke", intent: "diagnostic", dataScope: "synthetic", sources: [], deviations: [] }],
    reproduction: {
      model: "not-applicable",
      modelRevision: "not-applicable",
      dataset: "synthetic",
      dataRevision: "v1",
      codeCommit: "test",
      seeds: [],
      parameters: [],
    },
    artifacts: [{
      path: "results/run.log",
      title: "运行日志",
      role: "diagnostic",
      description: "保存原始运行输出。",
    }],
  };
  await mkdir(join(directory, "results"), { recursive: true });
  await writeFile(join(directory, "results", "run.log"), "epoch=1 loss=0.25\n", "utf8");
  const outsidePath = join(outside, "secret.json");
  await writeFile(outsidePath, JSON.stringify({ secret: true }), "utf8");
  const unsafe = await tool.execute("call-unsafe", {
    ...params,
    artifacts: [{
      path: relative(directory, outsidePath),
      title: "outside",
      role: "diagnostic",
      description: "must not escape project",
    }],
  }, undefined, undefined, context);
  assert.equal(unsafe.isError, true);
  assert.match(unsafe.content[0].text, /must stay inside the project/);

  chainError = "Proposition P1 was not found under checkpoints/propositions.";
  const unchained = await tool.execute("call-unchained", params, undefined, undefined, context);
  assert.equal(unchained.isError, true);
  assert.match(unchained.content[0].text, /P1 was not found/);
  chainError = undefined;
  const miscounted = await tool.execute("call-miscounted", {
    ...params,
    predictionOutcomes: params.predictionOutcomes.slice(0, 1),
  }, undefined, undefined, context);
  assert.equal(miscounted.isError, true);
  assert.match(miscounted.content[0].text, /逐条对应/);

  const result = await tool.execute("call-1", params, undefined, undefined, context);
  assert.equal(result.terminate, true);
  assert.equal(reached, 1);
  const text = result.content[0].text;
  assert.match(text, /✓ C2 answered Q2/);
  assert.match(text, /Proposition P1: 支持/);
  assert.match(text, /Q5 浏览器能否渲染问题树？/);
  assert.match(text, /Saved: checkpoints\/checkpoint-test\/checkpoint\.md/);
  assert.match(text, /http:\/\/127\.0\.0\.1:43119\/latest/);
  assert.match(text, /-L 43119:127\.0\.0\.1:43119/);
  assert.match(text, / moon$/);
  assert.equal(JSON.stringify(result.details).includes('"image"'), false);
  assert.equal(notifications.length, 0);
} finally {
  delete process.env.RESEARCH_LOOP_SSH_HOST;
  await rm(directory, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
}

console.log("Pi persistent checkpoint tool smoke test passed");
