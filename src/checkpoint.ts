import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { basename, extname, relative, resolve, sep } from "node:path";
import { Type } from "typebox";
import { resolveArtifactRecord, type ArtifactRecord } from "./artifacts.js";
import { formatSshPortForwardCommand } from "./checkpoint-server.js";
import {
  validateCheckpointDraft,
  VERDICT_LABELS,
  type CheckpointArtifactInput,
  type CheckpointChain,
  type CheckpointDraft,
  type PreparedCheckpointArtifact,
  type StoredCheckpoint,
} from "./checkpoint-store.js";
import { latexToUnicode } from "./latex-text.js";
import { createTerminalImage } from "./terminal-image.js";

interface SavedCheckpoint {
  stored: StoredCheckpoint;
  viewerUrl?: string;
}

interface CheckpointDependencies {
  getArtifacts: () => ArtifactRecord[];
  /** Resolves the proposition chain for the active experiment, or returns an error message. */
  prepareChain: (newQuestionCount: number, ctx: ExtensionContext) => Promise<CheckpointChain | string>;
  save: (
    draft: CheckpointDraft,
    artifacts: PreparedCheckpointArtifact[],
    chain: CheckpointChain,
    ctx: ExtensionContext,
  ) => Promise<SavedCheckpoint>;
  onReached: (checkpoint: { stored: StoredCheckpoint; draft: CheckpointDraft; resultCount: number }, ctx: ExtensionContext) => void;
}

interface CheckpointToolDetails extends SavedCheckpoint {
  draft: CheckpointDraft;
  chain: CheckpointChain;
  artifacts: PreparedCheckpointArtifact[];
  portForwardCommand?: string;
}

const PREDICTION = Type.Object({
  observation: Type.String({ description: "若观察到的具体现象，最好带可比较的数值或方向" }),
  implication: Type.String({ description: "则说明什么，对应到问题或命题" }),
});

export function registerResearchCheckpoint(
  pi: ExtensionAPI,
  dependencies: CheckpointDependencies,
): void {
  pi.registerTool({
    name: "research_checkpoint",
    label: "Research Checkpoint",
    description:
      "Record the completed experiment as one link in the active proposition's chain of reasoning: why this question was asked, what was predicted, what was observed, how it bears on the proposition, and which new questions follow. Saves a Chinese Markdown note under checkpoints/ and returns Research Loop to Exploration Mode. Call this alone as the final tool action.",
    promptSnippet: "Write the completed experiment as a proposition-linked Markdown checkpoint",
    promptGuidelines: [
      "Write for a reader who knows the proposition but has not followed this session. The plugin already prints the proposition, the reasoning path, this round's question, and the registered predictions; do not repeat them, build on them.",
      "Write primarily in natural Chinese. Use Chinese (English term) the first time a necessary technical term appears, then use the Chinese term consistently.",
      "whyMarkdown explains what earlier evidence left unresolved and why this experiment can separate the explanations. dataset names the data, why it suits this question, and its basic facts (size, splits, features or inputs, labels or targets; for synthetic data, the generating process with its parameters). keyHyperparameters lists every setting that could change the conclusion, such as sample sizes, model size, regularization, learning rate, training length and number of seeds, each with its value and why it was chosen. designMarkdown explains the design thinking: conditions and controls, what is held fixed, the metric and the decision rule. Complete audit detail belongs in protocols and reproduction.",
      "observationsMarkdown contains only the evidence needed to answer this round's question. Every visual forms an independent 图（表）→ 正式标题 → 解析 unit followed by a standalone --- separator. Table titles go above tables as ### 表 N　标题; figure titles go below images as the Markdown caption 图 N　标题.",
      "predictionOutcomes judge each registered prediction in order. judgmentMarkdown explains the judgment, including anything unexpected, and states what this result cannot establish.",
      "verdict states how this result bears on the proposition. When the result says the proposition should be narrowed or restated, put it in revisionProposal; only the user can adopt it.",
      "newQuestions lists at most three questions that this result genuinely raised, each with why it arose, the experiment that would answer it, and at least two predictions. Leave it empty when no real question follows.",
      "Never use the Chinese contrast construction 不是……而是…… or close variants such as 并非……而是……、不在于……而在于……、而不是 and 而非 anywhere in a checkpoint. State the observation and conclusion directly.",
      "Write every formula, variable, estimator, metric definition and quantitative relation as LaTeX in every field: inline $...$, and display $$...$$ on its own lines for any equation the reader should study. Define each symbol at first use, for example $n$ 为训练样本数、$d$ 为特征维度. Prefer $\\hat{\\beta} = X^{+} y$ over code-style or plain-text math such as beta_hat = pinv(X) @ y or n/d.",
      "Help the reader see the evidence. Whenever a result involves numbers, show the key comparison as a table or figure in observationsMarkdown: prefer figures the experiment code already saved, use a Markdown table for exact values across conditions, and use a fenced checkpoint-chart block containing JSON for a quick bar or line summary when no figure exists. designMarkdown may add a small conditions table titled ### 表 N, numbered in sequence with the observations. Never create a PNG solely for checkpoint decoration.",
      "For a reproduction, record paper, README and issue coverage plus every approved or unapproved deviation.",
    ],
    parameters: Type.Object({
      title: Type.String({ description: "一句话概括本轮最重要的发现，不加 Checkpoint 或 C 编号前缀" }),
      experimentId: Type.Optional(Type.String({ description: "Stable experiment/run identifier when one exists" })),
      answer: Type.String({ description: "对本轮问题的一句话回答，保守且可被证据支持" }),
      verdict: StringEnum(["supports", "weakens", "refutes", "inconclusive"] as const, {
        description: "本轮结果对命题的影响",
      }),
      verdictReason: Type.String({ description: "一句话说明 verdict 的依据" }),
      whyMarkdown: Type.String({ description: "为什么做这个实验：此前证据留下了什么未决问题，本实验为什么能区分不同解释；不要包含二级标题" }),
      dataset: Type.Object({
        name: Type.String({ description: "数据集名称及版本或 split；合成数据写明生成方式的名称" }),
        reason: Type.String({ description: "为什么这个数据集适合回答本轮问题" }),
        description: Type.String({ description: "基本信息：样本量、划分、特征或输入、标签或目标；合成数据写明生成过程及其参数" }),
      }, { description: "本轮使用的数据集；由插件固定显示在实验设计开头" }),
      keyHyperparameters: Type.Array(
        Type.Object({
          name: Type.String({ description: "参数名，数学量用 LaTeX" }),
          value: Type.String({ description: "实际取值或扫描范围" }),
          reason: Type.String({ description: "为什么取这个值" }),
        }),
        { minItems: 1, maxItems: 12, description: "会影响结论的关键超参数，例如样本量、模型规模、正则化、学习率、训练长度和种子数" },
      ),
      designMarkdown: Type.String({ description: "设计思路：条件与对照、固定不变的量、指标和判断规则；模型、指标和判断规则用 LaTeX 公式写出，条件较多时可用条件表；不要复述数据集、超参数和事先预期" }),
      observationsMarkdown: Type.String({
        description:
          "实际观察：只放回答本轮问题所需的证据，数值结果优先用图或表展示，数学关系用 LaTeX（行内 $...$，独立 $$...$$）。表格使用上方三级标题“### 表 N　标题”；图片 caption 使用“图 N　标题”。每个表格、图片或 checkpoint-chart 后必须单独写解析段落并添加 ---。图片目标使用 artifacts 中的项目相对路径。轻量图表可使用 ```checkpoint-chart 后跟 JSON，其 title 必须是“图 N　标题”；bar 格式为 {type,title,items:[{label,value,color?}]}，line 格式为 {type,title,series:[{name,color?,points:[{x,y}]}]}",
      }),
      predictionOutcomes: Type.Array(
        Type.Object({
          outcome: StringEnum(["observed", "partial", "not-observed"] as const),
          note: Type.String({ description: "判断依据，引用具体数值或图表编号" }),
        }),
        { description: "按顺序逐条判断进入实验时登记的预期" },
      ),
      judgmentMarkdown: Type.String({ description: "对照预期的判断：解释判断、意外现象，以及本结果不能证明的内容" }),
      newQuestions: Type.Array(
        Type.Object({
          question: Type.String({ description: "新问题，一句话" }),
          whyItArose: Type.String({ description: "本轮哪个现象让这个问题出现" }),
          proposedExperiment: Type.String({ description: "能回答它的下一个实验，包含关键对照" }),
          predictions: Type.Array(PREDICTION, { minItems: 2, maxItems: 4 }),
        }),
        { maxItems: 3, description: "本轮结果真正引出的新问题；没有时传空数组" },
      ),
      revisionProposal: Type.Optional(Type.Object({
        statement: Type.String({ description: "建议修订后的命题" }),
        reason: Type.String({ description: "哪些证据要求修订" }),
      }, { description: "仅当证据要求收窄或改写命题时填写；由用户决定是否采纳" })),
      protocols: Type.Array(
        Type.Object({
          title: Type.String({ description: "Protocol/run label" }),
          intent: StringEnum(["reproduction", "diagnostic", "exploratory", "ablation"] as const),
          reference: Type.Optional(Type.String({ description: "Reference protocol, paper, baseline or official run" })),
          dataScope: Type.String({ description: "Actual dataset, split, sample count and sampling scope" }),
          sources: Type.Array(
            Type.Object({
              kind: StringEnum(["paper", "readme", "issue"] as const),
              status: StringEnum(["consulted", "not-found", "inaccessible"] as const),
              reference: Type.Optional(Type.String()),
              summary: Type.String({ description: "Guidance, correction, conflict, bug or documented search outcome" }),
            }),
            { maxItems: 12 },
          ),
          deviations: Type.Array(
            Type.Object({
              field: Type.String(),
              reference: Type.String(),
              actual: Type.String(),
              reason: Type.String(),
              approvedByUser: Type.Boolean(),
            }),
            { maxItems: 12 },
          ),
        }),
        { minItems: 1, maxItems: 6 },
      ),
      reproduction: Type.Object({
        model: Type.String({ description: "Model or system name; use not-applicable when appropriate" }),
        modelRevision: Type.String({ description: "Model revision/checkpoint/tag" }),
        dataset: Type.String({ description: "Dataset, environment or task" }),
        dataRevision: Type.String({ description: "Dataset revision/split/version" }),
        codeCommit: Type.String({ description: "Git commit or exact code version" }),
        seeds: Type.Array(Type.String(), { maxItems: 24 }),
        parameters: Type.Array(
          Type.Object({ name: Type.String(), value: Type.String() }),
          { maxItems: 24, description: "Audit-level key parameters" },
        ),
        environment: Type.Optional(Type.String({ description: "GPU/node/runtime when useful" })),
      }),
      artifacts: Type.Optional(
        Type.Array(
          Type.Object({
            path: Type.String({ description: "Project-relative path to a real experiment artifact" }),
            title: Type.String(),
            role: StringEnum(["evidence", "diagnostic", "dataset", "intermediate"] as const),
            description: Type.String({ description: "One sentence explaining the artifact's research purpose" }),
            takeaway: Type.Optional(Type.String()),
            columns: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
          }),
          { maxItems: 16, description: "Real experiment artifacts only; no checkpoint-only decorative images" },
        ),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const chain = await dependencies.prepareChain(params.newQuestions.length, ctx);
      if (typeof chain === "string") return failure(chain);
      let artifacts: PreparedCheckpointArtifact[];
      try {
        artifacts = await prepareCheckpointArtifacts(
          ctx,
          dependencies.getArtifacts(),
          params.artifacts as CheckpointArtifactInput[] | undefined,
        );
      } catch (error) {
        return failure(`Checkpoint artifacts could not be prepared: ${String(error)}`);
      }
      const draft: CheckpointDraft = {
        title: params.title,
        experimentId: params.experimentId,
        answer: params.answer,
        verdict: params.verdict,
        verdictReason: params.verdictReason,
        whyMarkdown: params.whyMarkdown,
        dataset: params.dataset,
        keyHyperparameters: params.keyHyperparameters,
        designMarkdown: params.designMarkdown,
        observationsMarkdown: params.observationsMarkdown,
        judgmentMarkdown: params.judgmentMarkdown,
        predictionOutcomes: params.predictionOutcomes,
        newQuestions: params.newQuestions,
        revisionProposal: params.revisionProposal,
        protocols: params.protocols,
        reproduction: params.reproduction,
      };
      const validation = validateCheckpointDraft(draft, artifacts, chain.predictions.length);
      if (validation.errors.length) return failure(validation.errors.join("\n"));
      validation.warnings.forEach((warning) => ctx.ui.notify(warning, "warning"));

      let saved: SavedCheckpoint;
      try {
        saved = await dependencies.save(draft, artifacts, chain, ctx);
      } catch (error) {
        return failure(`Checkpoint Markdown could not be saved: ${String(error)}`);
      }
      const portForwardCommand = saved.viewerUrl
        ? formatSshPortForwardCommand(saved.viewerUrl)
        : undefined;
      dependencies.onReached({ stored: saved.stored, draft, resultCount: artifacts.length }, ctx);
      const details: CheckpointToolDetails = { draft, chain, artifacts, ...saved, portForwardCommand };
      const newQuestions = draft.newQuestions.map((item, index) => `  ${chain.newQuestionIds[index]} ${item.question}`);
      const lines = [
        `✓ C${chain.sequence} answered ${chain.question.id}`,
        `Answer: ${draft.answer}`,
        `Proposition ${chain.proposition.id}: ${VERDICT_LABELS[draft.verdict]}`,
        ...(newQuestions.length ? ["New questions:", ...newQuestions] : []),
        "",
        `Saved: ${saved.stored.relativeMarkdownPath}`,
        saved.viewerUrl ? `\nCheckpoint:\n${saved.viewerUrl}` : undefined,
        portForwardCommand ? `\n${portForwardCommand}` : undefined,
      ].filter((line): line is string => line !== undefined);
      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        details,
        terminate: true,
      };
    },
    renderCall(_args, theme) {
      return new Text(theme.fg("toolTitle", theme.bold("Research Checkpoint")), 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      const details = result.details as CheckpointToolDetails | undefined;
      if (!details) return new Text("Research checkpoint reached.", 0, 0);
      return renderCheckpointResult(details, theme, expanded);
    },
  });
}

async function prepareCheckpointArtifacts(
  ctx: ExtensionContext,
  discovered: ArtifactRecord[],
  requested: CheckpointArtifactInput[] | undefined,
): Promise<PreparedCheckpointArtifact[]> {
  const prepared: PreparedCheckpointArtifact[] = [];
  const projectRoot = resolve(ctx.cwd);
  const realProjectRoot = await realpath(projectRoot);
  for (const item of requested ?? []) {
    const requestedPath = item.path.startsWith("@") ? item.path.slice(1) : item.path;
    const requestedAbsolutePath = resolve(projectRoot, requestedPath);
    if (requestedAbsolutePath !== projectRoot && !requestedAbsolutePath.startsWith(`${projectRoot}${sep}`)) {
      throw new Error(`Artifact must stay inside the project: ${item.path}`);
    }
    const resolvedRecord = await resolveCheckpointArtifactRecord(ctx.cwd, requestedPath);
    if (!resolvedRecord) throw new Error(`Artifact does not exist or is not a file/dataset: ${item.path}`);
    const absolutePath = resolve(ctx.cwd, resolvedRecord.path);
    const realArtifactPath = await realpath(absolutePath);
    if (realArtifactPath !== realProjectRoot && !realArtifactPath.startsWith(`${realProjectRoot}${sep}`)) {
      throw new Error(`Artifact must stay inside the project: ${item.path}`);
    }
    const artifact = discovered.find((candidate) => resolve(ctx.cwd, candidate.path) === absolutePath) ?? resolvedRecord;
    prepared.push({ ...item, artifact, absolutePath });
  }
  return prepared;
}

async function resolveCheckpointArtifactRecord(cwd: string, inputPath: string): Promise<ArtifactRecord | undefined> {
  const known = await resolveArtifactRecord(cwd, inputPath);
  if (known) return known;
  const absolutePath = resolve(cwd, inputPath);
  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) return undefined;
    return {
      kind: "file",
      path: relative(cwd, absolutePath).split(sep).join("/"),
      name: basename(absolutePath),
      extension: extname(absolutePath).toLowerCase(),
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      discoveredAt: Date.now(),
    };
  } catch {
    return undefined;
  }
}

function renderCheckpointResult(details: CheckpointToolDetails, theme: Theme, expanded: boolean): Container {
  const container = new Container();
  const { chain, draft } = details;
  container.addChild(new Text(theme.fg("success", theme.bold(`✓ C${chain.sequence} · ${chain.proposition.id} / ${chain.question.id}`)), 0, 0));
  container.addChild(new Text(theme.bold(latexToUnicode(draft.title)), 0, 1));
  container.addChild(new Text(`${theme.fg("muted", "答案")} ${latexToUnicode(draft.answer)}`, 0, 0));
  container.addChild(new Text(`${theme.fg("muted", "命题")} ${VERDICT_LABELS[draft.verdict]}：${latexToUnicode(draft.verdictReason)}`, 0, 0));
  draft.newQuestions.forEach((item, index) => {
    container.addChild(new Text(`${theme.fg("accent", chain.newQuestionIds[index] ?? "Q")} ${latexToUnicode(item.question)}`, 0, 0));
  });
  if (expanded) details.artifacts.filter((item) => item.role === "evidence" && checkpointImageMime(item.artifact.extension)).forEach((item) => {
    try {
      const data = readFileSync(item.absolutePath).toString("base64");
      container.addChild(new Text(`${theme.bold(latexToUnicode(item.title))}\n${latexToUnicode(item.description)}`, 0, 1));
      container.addChild(
        createTerminalImage(
          data,
          checkpointImageMime(item.artifact.extension)!,
          { fallbackColor: (value) => theme.fg("muted", value) },
          { maxWidthCells: 72, maxHeightCells: 24, filename: item.artifact.name, chafaFormat: "sixels" },
        ),
      );
    } catch {
      // The persistent Markdown and Viewer remain authoritative when a historical image is unavailable.
    }
  });
  container.addChild(new Text(`${theme.fg("muted", "Saved")} ${details.stored.relativeMarkdownPath}`, 0, 1));
  if (details.viewerUrl) {
    const command = details.portForwardCommand ? `\n${details.portForwardCommand}` : "";
    container.addChild(
      new Text(
        `${theme.fg("accent", theme.bold("Checkpoint"))}\n${terminalLink(details.viewerUrl, details.viewerUrl)}${command}`,
        0,
        1,
      ),
    );
  }
  return container;
}

function checkpointImageMime(extension: string): string | undefined {
  return ({
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  } as Record<string, string>)[extension.toLowerCase()];
}

function failure(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    details: { accepted: false },
    isError: true,
  };
}

function terminalLink(url: string, label: string): string {
  return `\u001b]8;;${url}\u001b\\${label}\u001b]8;;\u001b\\`;
}
