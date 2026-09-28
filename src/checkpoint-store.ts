import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import type { ArtifactRecord } from "./artifacts.js";
import type { ExperimentPrediction } from "./core/types.js";
import { latexToUnicode } from "./latex-text.js";

export type CheckpointIntent = "reproduction" | "diagnostic" | "exploratory" | "ablation";
export type CheckpointSourceKind = "paper" | "readme" | "issue";
export type CheckpointSourceStatus = "consulted" | "not-found" | "inaccessible";
export type CheckpointArtifactRole = "evidence" | "diagnostic" | "dataset" | "intermediate";
export type CheckpointVerdict = "supports" | "weakens" | "refutes" | "inconclusive";
export type PredictionOutcomeKind = "observed" | "partial" | "not-observed";

export const VERDICT_LABELS: Record<CheckpointVerdict, string> = {
  supports: "支持",
  weakens: "削弱",
  refutes: "否定",
  inconclusive: "尚无定论",
};
const OUTCOME_LABELS: Record<PredictionOutcomeKind, string> = {
  observed: "出现",
  partial: "部分出现",
  "not-observed": "未出现",
};

/** Reader-facing design facts rendered in a fixed place so the user can check them; audit detail stays in reproduction. */
export interface CheckpointDataset {
  name: string;
  reason: string;
  description: string;
}

export interface CheckpointHyperparameter {
  name: string;
  value: string;
  reason: string;
}

export interface PredictionOutcome {
  outcome: PredictionOutcomeKind;
  note: string;
}

export interface CheckpointNewQuestionInput {
  question: string;
  whyItArose: string;
  proposedExperiment: string;
  predictions: ExperimentPrediction[];
}

export interface CheckpointNewQuestion {
  id: string;
  question: string;
  why_it_arose: string;
  proposed_experiment: string;
  predictions: ExperimentPrediction[];
}

export interface PropositionRevisionProposal {
  statement: string;
  reason: string;
}

export interface CheckpointSource {
  kind: CheckpointSourceKind;
  status: CheckpointSourceStatus;
  reference?: string;
  summary: string;
}

export interface CheckpointDeviation {
  field: string;
  reference: string;
  actual: string;
  reason: string;
  approvedByUser: boolean;
}

export interface CheckpointProtocol {
  title: string;
  intent: CheckpointIntent;
  reference?: string;
  dataScope: string;
  sources: CheckpointSource[];
  deviations: CheckpointDeviation[];
}

export interface ReproductionParameter {
  name: string;
  value: string;
}

export interface CheckpointReproduction {
  model: string;
  modelRevision: string;
  dataset: string;
  dataRevision: string;
  codeCommit: string;
  seeds: string[];
  parameters: ReproductionParameter[];
  environment?: string;
}

export interface CheckpointArtifactInput {
  path: string;
  title: string;
  role: CheckpointArtifactRole;
  description: string;
  takeaway?: string;
  columns?: string[];
}

export interface PreparedCheckpointArtifact extends CheckpointArtifactInput {
  artifact: ArtifactRecord;
  absolutePath: string;
}

export interface CheckpointDraft {
  title: string;
  experimentId?: string;
  answer: string;
  verdict: CheckpointVerdict;
  verdictReason: string;
  whyMarkdown: string;
  dataset: CheckpointDataset;
  keyHyperparameters: CheckpointHyperparameter[];
  designMarkdown: string;
  observationsMarkdown: string;
  judgmentMarkdown: string;
  predictionOutcomes: PredictionOutcome[];
  newQuestions: CheckpointNewQuestionInput[];
  revisionProposal?: PropositionRevisionProposal;
  protocols: CheckpointProtocol[];
  reproduction: CheckpointReproduction;
}

/** Where this checkpoint sits in the proposition's chain of reasoning; resolved by the plugin, not written by the agent. */
export interface CheckpointChain {
  proposition: { id: string; statement: string };
  question: { id: string; question: string; origin: string };
  path: Array<{ questionId: string; via?: { sequence: number; answer: string } }>;
  raisedBy?: { sequence: number; title: string };
  predictions: ExperimentPrediction[];
  sequence: number;
  newQuestionIds: string[];
}

export interface CheckpointMetadata {
  schema_version: 1 | 2;
  id: string;
  title: string;
  created_at: string;
  experiment_id?: string;
  /** The one-line answer to the checkpoint's question; kept under its v1 name for older readers. */
  short_conclusion: string;
  artifact_paths: string[];
  proposition_id?: string;
  question_id?: string;
  question?: string;
  sequence?: number;
  verdict?: CheckpointVerdict;
  verdict_reason?: string;
  new_questions?: CheckpointNewQuestion[];
  revision_proposal?: PropositionRevisionProposal;
}

export interface StoredCheckpoint {
  metadata: CheckpointMetadata;
  directory: string;
  markdownPath: string;
  relativeMarkdownPath: string;
}

export interface DiscoveredCheckpoint extends StoredCheckpoint {
  markdown: string;
}

const FRONTMATTER = /^---\s*\r?\n([^]*?)\r?\n---\s*\r?\n?/;
const CHECKPOINT_ROOT_ENV = "RESEARCH_LOOP_CHECKPOINT_DIR";

export class CheckpointStore {
  readonly projectRoot: string;
  readonly checkpointRoot: string;

  constructor(projectRoot: string, configuredRoot = process.env[CHECKPOINT_ROOT_ENV] ?? "checkpoints") {
    this.projectRoot = resolve(projectRoot);
    this.checkpointRoot = resolveInside(this.projectRoot, configuredRoot);
  }

  async write(
    draft: CheckpointDraft,
    artifacts: PreparedCheckpointArtifact[],
    chain: CheckpointChain,
  ): Promise<StoredCheckpoint> {
    await mkdir(this.checkpointRoot, { recursive: true });
    await assertCheckpointRootSafe(this.projectRoot, this.checkpointRoot);
    const createdAt = new Date();
    const baseId = `checkpoint-${compactTimestamp(createdAt)}-${slugify(latexToUnicode(draft.title))}`;
    const { id, directory } = await reserveDirectory(this.checkpointRoot, baseId);

    const metadata: CheckpointMetadata = {
      schema_version: 2,
      id,
      title: draft.title.trim(),
      created_at: createdAt.toISOString(),
      experiment_id: draft.experimentId?.trim() || undefined,
      short_conclusion: draft.answer.trim(),
      artifact_paths: artifacts.map((item) => item.artifact.path),
      proposition_id: chain.proposition.id,
      question_id: chain.question.id,
      question: chain.question.question,
      sequence: chain.sequence,
      verdict: draft.verdict,
      verdict_reason: draft.verdictReason.trim(),
      new_questions: draft.newQuestions.map((item, index) => ({
        id: chain.newQuestionIds[index]!,
        question: item.question.trim(),
        why_it_arose: item.whyItArose.trim(),
        proposed_experiment: item.proposedExperiment.trim(),
        predictions: item.predictions,
      })),
      revision_proposal: draft.revisionProposal,
    };
    const markdownPath = resolve(directory, "checkpoint.md");
    const markdown = buildCheckpointMarkdown(draft, metadata, chain, artifacts, directory);
    const temporaryPath = `${markdownPath}.tmp-${process.pid}-${Date.now()}`;
    try {
      await writeFile(temporaryPath, markdown, "utf8");
      await rename(temporaryPath, markdownPath);
      return {
        metadata,
        directory,
        markdownPath,
        relativeMarkdownPath: toPosix(relative(this.projectRoot, markdownPath)),
      };
    } catch (error) {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  async list(): Promise<DiscoveredCheckpoint[]> {
    let files: string[];
    try {
      await assertCheckpointRootSafe(this.projectRoot, this.checkpointRoot);
      files = await collectMarkdownFiles(this.checkpointRoot, 3, new Set([resolve(this.checkpointRoot, "propositions")]));
    } catch {
      return [];
    }
    const checkpoints = await Promise.all(files.map((path) => this.readDiscovered(path)));
    return checkpoints
      .filter((item): item is DiscoveredCheckpoint => item !== undefined)
      .sort((left, right) => Date.parse(right.metadata.created_at) - Date.parse(left.metadata.created_at));
  }

  async latest(): Promise<DiscoveredCheckpoint | undefined> {
    return (await this.list())[0];
  }

  async find(id: string): Promise<DiscoveredCheckpoint | undefined> {
    return (await this.list()).find((item) => item.metadata.id === id);
  }

  private async readDiscovered(markdownPath: string): Promise<DiscoveredCheckpoint | undefined> {
    try {
      const [markdown, fileStat] = await Promise.all([readFile(markdownPath, "utf8"), stat(markdownPath)]);
      const parsed = parseCheckpointMarkdown(markdown);
      const directory = dirname(markdownPath);
      const relativeSource = relative(this.checkpointRoot, markdownPath);
      const fallbackSource = basename(markdownPath).toLowerCase() === "checkpoint.md"
        ? dirname(relativeSource)
        : relativeSource.replace(/\.md$/i, "");
      const fallbackId = slugify(toPosix(fallbackSource));
      const title = parsed.metadata?.title || extractTitle(parsed.body) || fallbackId;
      const createdAt = validDate(parsed.metadata?.created_at) ?? fileStat.mtime.toISOString();
      const metadata: CheckpointMetadata = {
        ...parsed.metadata,
        schema_version: parsed.metadata?.schema_version === 2 ? 2 : 1,
        id: parsed.metadata?.id || fallbackId,
        title,
        created_at: createdAt,
        experiment_id: parsed.metadata?.experiment_id,
        short_conclusion: parsed.metadata?.short_conclusion || extractShortConclusion(parsed.body),
        artifact_paths: Array.isArray(parsed.metadata?.artifact_paths) ? parsed.metadata.artifact_paths : [],
        new_questions: Array.isArray(parsed.metadata?.new_questions) ? parsed.metadata.new_questions : undefined,
      };
      return {
        metadata,
        directory,
        markdownPath,
        relativeMarkdownPath: toPosix(relative(this.projectRoot, markdownPath)),
        markdown: parsed.body,
      };
    } catch {
      return undefined;
    }
  }
}

export function buildCheckpointMarkdown(
  draft: CheckpointDraft,
  metadata: CheckpointMetadata,
  chain: CheckpointChain,
  artifacts: PreparedCheckpointArtifact[],
  checkpointDirectory: string,
): string {
  const rewrite = (text: string) => rewriteArtifactReferences(text.trim(), artifacts, checkpointDirectory);
  const observations = rewrite(draft.observationsMarkdown);
  const newQuestions = metadata.new_questions ?? [];
  const sections = [
    `---\n${JSON.stringify(metadata)}\n---`,
    `# C${chain.sequence}：${draft.title.trim()}`,
    formatChainSummary(draft, chain, newQuestions),
    `## 1. 为什么做这个实验\n\n${formatOrigin(chain)}\n\n${rewrite(draft.whyMarkdown)}`,
    "---",
    `## 2. 实验设计与事先预期\n\n${formatDesign(draft, rewrite)}\n\n${formatPredictionTable(chain.predictions)}`,
    "---",
    `## 3. 实际观察\n\n${observations}`,
    ...(/^\s*---+\s*$/.test(observations.split(/\r?\n/).at(-1) ?? "") ? [] : ["---"]),
    `## 4. 对照预期的判断\n\n${formatJudgment(draft, chain, rewrite)}`,
    "---",
    `## 5. 新问题与下一步实验\n\n${formatNewQuestions(newQuestions)}`,
    "---",
    `## 复现信息\n\n${formatReproduction(draft, artifacts, checkpointDirectory)}`,
  ];
  return `${sections.join("\n\n")}\n`;
}

function formatChainSummary(
  draft: CheckpointDraft,
  chain: CheckpointChain,
  newQuestions: CheckpointNewQuestion[],
): string {
  const path = [
    chain.proposition.id,
    ...chain.path.map((step) => step.via
      ? `${step.questionId}（C${step.via.sequence}：${step.via.answer}）`
      : `**${step.questionId}（本轮）**`),
  ].join(" → ");
  return [
    `> **命题 ${chain.proposition.id}**：${chain.proposition.statement}  `,
    `> **推理位置**：${path}  `,
    `> **本轮问题 ${chain.question.id}**：${chain.question.question}  `,
    `> **一句话答案**：${draft.answer.trim()}  `,
    `> **对命题的影响**：${VERDICT_LABELS[draft.verdict]}。${draft.verdictReason.trim()}  `,
    `> **新问题**：${newQuestions.length ? newQuestions.map((item) => item.id).join("、") : "无"}`,
  ].join("\n");
}

function formatOrigin(chain: CheckpointChain): string {
  const origin = chain.question.origin.trim();
  return chain.raisedBy
    ? `${chain.question.id} 由 C${chain.raisedBy.sequence}（${chain.raisedBy.title}）提出：${origin}`
    : `${chain.question.id} 来自命题 ${chain.proposition.id} 的拆解：${origin}`;
}

function formatDesign(draft: CheckpointDraft, rewrite: (text: string) => string): string {
  const { dataset } = draft;
  return [
    "### 数据集",
    "",
    `**${dataset.name.trim()}**`,
    "",
    `* **选择理由：** ${dataset.reason.trim()}`,
    `* **基本信息：** ${dataset.description.trim()}`,
    "",
    "### 关键超参数",
    "",
    "| 参数 | 取值 | 选择理由 |",
    "| --- | --- | --- |",
    ...draft.keyHyperparameters.map((item) => `| ${tableCell(item.name)} | ${tableCell(item.value)} | ${tableCell(item.reason)} |`),
    "",
    "### 设计思路",
    "",
    rewrite(draft.designMarkdown),
  ].join("\n");
}

function formatPredictionTable(predictions: ExperimentPrediction[]): string {
  return [
    "**事先预期**（进入实验前登记，之后未修改）",
    "",
    "| 预期 | 若观察到 | 则说明 |",
    "| --- | --- | --- |",
    ...predictions.map((prediction, index) => `| 预期 ${index + 1} | ${tableCell(prediction.observation)} | ${tableCell(prediction.implication)} |`),
  ].join("\n");
}

function formatJudgment(
  draft: CheckpointDraft,
  chain: CheckpointChain,
  rewrite: (text: string) => string,
): string {
  const rows = chain.predictions.map((prediction, index) => {
    const outcome = draft.predictionOutcomes[index];
    const label = outcome ? OUTCOME_LABELS[outcome.outcome] : "未判断";
    return `| 预期 ${index + 1} | ${tableCell(prediction.observation)} | ${label} | ${tableCell(outcome?.note ?? "")} |`;
  });
  const lines = [
    "| 预期 | 若观察到 | 实际 | 依据 |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    rewrite(draft.judgmentMarkdown),
    "",
    `**对命题的影响：** ${VERDICT_LABELS[draft.verdict]}。${draft.verdictReason.trim()}`,
  ];
  if (draft.revisionProposal) {
    lines.push(
      "",
      `**命题修订建议（待用户确认）：** ${draft.revisionProposal.statement.trim()}。理由：${draft.revisionProposal.reason.trim()}`,
    );
  }
  return lines.join("\n");
}

function formatNewQuestions(questions: CheckpointNewQuestion[]): string {
  if (questions.length === 0) return "本轮没有提出新问题。";
  return questions.map((item) => [
    `### ${item.id}　${item.question}`,
    "",
    `* **为什么出现：** ${item.why_it_arose}`,
    `* **建议实验：** ${item.proposed_experiment}`,
    `* **事先预期：** ${item.predictions.map((prediction) => `若${prediction.observation}，则${prediction.implication}`).join("；")}`,
  ].join("\n")).join("\n\n");
}

function tableCell(value: string): string {
  // TeX segments are protected before table parsing, so only pipes outside them need escaping.
  return value.trim().replace(/\r?\n+/g, " ")
    .split(/(\$\$[^]*?\$\$|\$[^$\n]+\$)/)
    .map((part, index) => index % 2 === 1 ? part : part.replace(/\|/g, "\\|"))
    .join("");
}

export function parseCheckpointMarkdown(markdown: string): {
  metadata?: Partial<CheckpointMetadata>;
  body: string;
} {
  const match = markdown.match(FRONTMATTER);
  if (!match) return { body: markdown };
  try {
    const metadata = JSON.parse(match[1].trim()) as Partial<CheckpointMetadata>;
    return { metadata, body: markdown.slice(match[0].length) };
  } catch {
    return { body: markdown };
  }
}

export function validateCheckpointDraft(
  draft: CheckpointDraft,
  artifacts: PreparedCheckpointArtifact[],
  predictionCount: number,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const bodies = [
    ["为什么做这个实验", draft.whyMarkdown],
    ["实验设计", draft.designMarkdown],
    ["实际观察", draft.observationsMarkdown],
    ["对照预期的判断", draft.judgmentMarkdown],
  ] as const;
  if (!draft.title.trim()) errors.push("Checkpoint title 不能为空。");
  if (/\r|\n/.test(draft.title)) errors.push("Checkpoint title 必须保持为单行。");
  const userText = [
    ...collectStrings(draft),
    ...artifacts.flatMap((item) => collectStrings({
      path: item.path,
      title: item.title,
      description: item.description,
      takeaway: item.takeaway,
    })),
  ];
  if (userText.some(containsForbiddenContrast)) {
    errors.push("Checkpoint 禁止使用“不是……而是……”或同类转折句式；请直接陈述观察和结论。");
  }
  for (const [label, body] of bodies) {
    if (!body.trim()) errors.push(`${label}正文不能为空。`);
    if (/^#{1,2}\s+/m.test(body)) warnings.push(`${label}正文包含一级或二级标题；Viewer 会保留，但建议只使用三级以下小标题。`);
  }
  for (const [field, value] of [["answer", draft.answer], ["verdictReason", draft.verdictReason]] as const) {
    if (!value.trim()) errors.push(`${field} 不能为空。`);
    if (/\r|\n/.test(value)) errors.push(`${field} 必须保持为单行。`);
  }
  if (draft.predictionOutcomes.length !== predictionCount) {
    errors.push(`predictionOutcomes 必须按顺序逐条对应进入实验时登记的 ${predictionCount} 条预期，当前为 ${draft.predictionOutcomes.length} 条。`);
  }
  draft.predictionOutcomes.forEach((outcome, index) => {
    if (!outcome.note.trim()) errors.push(`预期 ${index + 1} 的判断依据不能为空。`);
  });
  draft.newQuestions.forEach((item, index) => {
    if (![item.question, item.whyItArose, item.proposedExperiment].every((value) => value.trim())) {
      errors.push(`新问题 ${index + 1} 的 question、whyItArose 和 proposedExperiment 不能为空。`);
    }
    if (item.predictions.some((prediction) => !prediction.observation.trim() || !prediction.implication.trim())) {
      errors.push(`新问题 ${index + 1} 的预期必须同时写明观察和含义。`);
    }
  });
  if (draft.revisionProposal && (!draft.revisionProposal.statement.trim() || !draft.revisionProposal.reason.trim())) {
    errors.push("命题修订建议必须同时包含修订后的 statement 和 reason。");
  }
  const reproductionFields = [
    ["model", draft.reproduction.model],
    ["modelRevision", draft.reproduction.modelRevision],
    ["dataset", draft.reproduction.dataset],
    ["dataRevision", draft.reproduction.dataRevision],
    ["codeCommit", draft.reproduction.codeCommit],
  ] as const;
  if (![draft.dataset.name, draft.dataset.reason, draft.dataset.description].every((value) => value.trim())) {
    errors.push("dataset 的 name、reason 和 description 不能为空；合成数据请描述生成过程。");
  }
  if (draft.keyHyperparameters.length === 0) {
    errors.push("keyHyperparameters 至少需要一项会影响结论的参数。");
  }
  draft.keyHyperparameters.forEach((item, index) => {
    if (![item.name, item.value, item.reason].every((value) => value.trim())) {
      errors.push(`关键超参数 ${index + 1} 的 name、value 和 reason 不能为空。`);
    }
  });
  reproductionFields.forEach(([field, value]) => {
    if (!value.trim()) errors.push(`复现信息 ${field} 不能为空；不适用时请填写 not-applicable。`);
  });
  if (draft.protocols.length === 0) errors.push("至少需要一个 protocol record。");
  draft.protocols.forEach((protocol, index) => {
    const label = `Protocol ${index + 1} (${protocol.title || "未命名"})`;
    if (!protocol.title.trim()) errors.push(`${label} title 不能为空。`);
    if (!protocol.dataScope.trim()) errors.push(`${label} dataScope 不能为空。`);
    if (protocol.intent === "reproduction") {
      for (const kind of ["paper", "readme", "issue"] as const) {
        if (!protocol.sources.some((source) => source.kind === kind)) {
          errors.push(`${label} 缺少 ${kind} source coverage。`);
        }
      }
    }
    protocol.sources.forEach((source) => {
      if (!source.summary.trim()) errors.push(`${label} 的 ${source.kind} source summary 不能为空。`);
    });
    protocol.deviations.forEach((deviation) => {
      if (![deviation.field, deviation.reference, deviation.actual, deviation.reason].every((value) => value.trim())) {
        errors.push(`${label} 的 protocol deviation 字段不能为空。`);
      }
      if (!deviation.approvedByUser) warnings.push(`${label} 包含未批准的协议偏差：${deviation.field}。`);
    });
  });
  draft.reproduction.parameters.forEach((parameter) => {
    if (!parameter.name.trim() || !parameter.value.trim()) errors.push("复现参数 name 和 value 不能为空。");
  });
  validateCheckpointCharts(draft.observationsMarkdown, errors, warnings);
  validateVisualNarrative(draft.observationsMarkdown, errors);
  const artifactPaths = new Set<string>();
  for (const item of artifacts) {
    if (!item.title.trim() || !item.description.trim()) errors.push(`Artifact ${item.artifact.path} 的 title 和 description 不能为空。`);
    if (artifactPaths.has(item.artifact.path)) errors.push(`Artifact 重复登记：${item.artifact.path}。`);
    artifactPaths.add(item.artifact.path);
    if (item.role !== "evidence" || !isImage(item.artifact.extension)) continue;
    const referenced = referencesMarkdownImage(draft.observationsMarkdown, item.path)
      || referencesMarkdownImage(draft.observationsMarkdown, item.artifact.path);
    if (!referenced) {
      errors.push(`重要图片 ${item.artifact.path} 必须直接引用在 observationsMarkdown 中，而不能只作为附件。`);
    }
  }
  return { errors, warnings };
}

function validateCheckpointCharts(markdown: string, errors: string[], warnings: string[]): void {
  const blocks = markdown.matchAll(/```checkpoint-chart\s*\r?\n([^]*?)```/gi);
  let index = 0;
  for (const match of blocks) {
    index += 1;
    let config: unknown;
    try {
      config = JSON.parse(match[1].trim());
    } catch {
      errors.push(`checkpoint-chart ${index} 必须包含有效 JSON。`);
      continue;
    }
    if (!config || typeof config !== "object") {
      errors.push(`checkpoint-chart ${index} 配置必须是 JSON object。`);
      continue;
    }
    const chart = config as Record<string, unknown>;
    if (typeof chart.title !== "string" || !isFormalVisualTitle(chart.title, "图")) {
      errors.push(`checkpoint-chart ${index} 的 title 必须使用“图 N　标题”格式。`);
    }
    if (chart.type === "bar") {
      if (!Array.isArray(chart.items) || chart.items.length === 0) {
        errors.push(`checkpoint-chart ${index} 的 bar chart 必须包含 items。`);
        continue;
      }
      if (chart.items.some((item) => !item || typeof item !== "object" || !isFiniteNumber((item as Record<string, unknown>).value))) {
        errors.push(`checkpoint-chart ${index} 的每个 bar item 都必须包含有限数值 value。`);
      }
      if (chart.items.length > 24) warnings.push(`checkpoint-chart ${index} 只会显示前 24 个 bar items。`);
    } else if (chart.type === "line") {
      if (!Array.isArray(chart.series) || chart.series.length === 0) {
        errors.push(`checkpoint-chart ${index} 的 line chart 必须包含 series。`);
        continue;
      }
      const invalid = chart.series.some((series) => {
        if (!series || typeof series !== "object") return true;
        const points = (series as Record<string, unknown>).points;
        return !Array.isArray(points) || points.length === 0 || points.some((point) => {
          if (!point || typeof point !== "object") return true;
          const value = point as Record<string, unknown>;
          return !isFiniteNumber(value.x) || !isFiniteNumber(value.y);
        });
      });
      if (invalid) errors.push(`checkpoint-chart ${index} 的每个 line series 都必须包含有限数值 x/y points。`);
      if (chart.series.length > 12) warnings.push(`checkpoint-chart ${index} 只会显示前 12 个 line series。`);
      if (chart.series.some((series) => Array.isArray((series as Record<string, unknown> | undefined)?.points) && ((series as Record<string, unknown>).points as unknown[]).length > 500)) {
        warnings.push(`checkpoint-chart ${index} 的每条 line series 只会显示前 500 个 points。`);
      }
    } else {
      errors.push(`checkpoint-chart ${index} 的 type 必须是 bar 或 line。`);
    }
  }
}

interface VisualBlock {
  kind: "图" | "表";
  start: number;
  end: number;
  title?: string;
}

function validateVisualNarrative(markdown: string, errors: string[]): void {
  const lines = markdown.split(/\r?\n/);
  const visuals: VisualBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    const fence = trimmed.match(/^(```+|~~~+)\s*([^\s]*)/);
    if (fence) {
      const marker = fence[1];
      let end = index + 1;
      while (end < lines.length && !lines[end].trim().startsWith(marker)) end += 1;
      if (fence[2].toLowerCase() === "checkpoint-chart") {
        let title: string | undefined;
        try {
          const config = JSON.parse(lines.slice(index + 1, end).join("\n")) as { title?: unknown };
          if (typeof config.title === "string") title = config.title;
        } catch {
          // Chart JSON errors are reported by validateCheckpointCharts.
        }
        visuals.push({ kind: "图", start: index, end: Math.min(end, lines.length - 1), title });
      }
      index = Math.min(end, lines.length - 1);
      continue;
    }

    const image = trimmed.match(/!\[([^\]]*)\]\([^)]*\)/);
    if (image) {
      const explicitTitle = trimmed.match(/\s+["']([^"']+)["']\s*\)$/)?.[1];
      const title = explicitTitle || image[1].trim();
      const previous = previousNonEmptyLine(lines, index - 1);
      if (previous && /^#{3,6}\s+图\s*/.test(previous.text)) {
        errors.push(`${title || "Markdown 图片"} 的标题必须位于图下方；请删除图片上方的图标题。`);
      }
      visuals.push({ kind: "图", start: index, end: index, title });
      continue;
    }

    if (index + 1 < lines.length && looksLikeTableHeader(trimmed, lines[index + 1].trim())) {
      let end = index + 1;
      while (end + 1 < lines.length && lines[end + 1].includes("|") && lines[end + 1].trim()) end += 1;
      const previous = previousNonEmptyLine(lines, index - 1);
      const title = previous?.text.match(/^#{3,6}\s+(.+)$/)?.[1]?.trim();
      visuals.push({ kind: "表", start: previous && title ? previous.index : index, end, title });
      index = end;
    }
  }

  const seenTitles = new Set<string>();
  visuals.forEach((visual, index) => {
    const label = visual.title || `${visual.kind} ${index + 1}`;
    if (!visual.title || !isFormalVisualTitle(visual.title, visual.kind)) {
      const position = visual.kind === "表" ? "表格上方" : "图下方的 Markdown caption";
      errors.push(`${label} 缺少正式标题；请在${position}使用“${visual.kind} N　标题”格式。`);
    } else {
      const normalized = visual.title.replace(/\s+/g, "");
      if (seenTitles.has(normalized)) errors.push(`图表标题重复：${visual.title}。`);
      seenTitles.add(normalized);
    }
    const nextStart = visuals[index + 1]?.start ?? lines.length;
    let separator = -1;
    for (let line = visual.end + 1; line < nextStart; line += 1) {
      if (/^\s*---+\s*$/.test(lines[line])) {
        separator = line;
        break;
      }
    }
    if (separator < 0) {
      errors.push(`${label} 的解析后必须添加一条独立的浅色分隔线“---”，再继续下一个图表或结论。`);
      return;
    }
    const analysis = lines.slice(visual.end + 1, separator)
      .join(" ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`#>]/g, "")
      .trim();
    if (analysis.length < 16 || !/(?:表明|说明|意味着|支持|提示|反映|揭示|指向|符合)/.test(analysis)) {
      errors.push(`${label} 后需要单独的解析段落，说明图表内容及其研究含义。`);
    }
  });
}

function looksLikeTableHeader(header: string, divider: string): boolean {
  return header.includes("|") && /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(divider);
}

function previousNonEmptyLine(lines: string[], start: number): { index: number; text: string } | undefined {
  for (let index = start; index >= 0; index -= 1) {
    const text = lines[index].trim();
    if (text) return { index, text };
  }
  return undefined;
}

function isFormalVisualTitle(value: string, kind: "图" | "表"): boolean {
  return new RegExp(`^${kind}\\s*[0-9一二三四五六七八九十百]+[\\s　.:：、—-]+\\S`).test(value.trim());
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
}

function containsForbiddenContrast(value: string): boolean {
  return /(?:并非|并不是|不是|并没有|没有)[^。！？；\n]{0,120}(?:而是|而在于)/.test(value)
    || /不在于[^。！？；\n]{0,120}而在于/.test(value)
    || /(?:而不是|而非)/.test(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatReproduction(
  draft: CheckpointDraft,
  artifacts: PreparedCheckpointArtifact[],
  checkpointDirectory: string,
): string {
  const reproduction = draft.reproduction;
  const parameters = reproduction.parameters.length
    ? reproduction.parameters.map((item) => `${item.name}=${item.value}`).join("；")
    : "未记录";
  const lines = [
    `**模型：** ${inlineCode(reproduction.model)}  `,
    `**模型版本：** ${inlineCode(reproduction.modelRevision)}  `,
    `**数据集：** ${inlineCode(reproduction.dataset)}  `,
    `**数据版本：** ${inlineCode(reproduction.dataRevision)}  `,
    `**代码版本：** ${inlineCode(reproduction.codeCommit)}  `,
    `**随机种子：** ${inlineCode(reproduction.seeds.join(", ") || "未记录")}  `,
    `**主要参数：** ${inlineCode(parameters)}  `,
  ];
  if (reproduction.environment?.trim()) lines.push(`**运行环境：** ${reproduction.environment.trim()}  `);
  lines.push("", "**主要结果文件：**", "");
  if (artifacts.length === 0) lines.push("* 本次 checkpoint 未登记结果文件。");
  else {
    artifacts.forEach((item) => {
      const explanation = `${item.title}：${item.description}${item.takeaway?.trim() ? `；要点：${item.takeaway.trim()}` : ""}`;
      if (item.artifact.kind === "dataset") {
        lines.push(`* ${inlineCode(`${item.artifact.path}/`)}：${explanation}`);
        return;
      }
      const target = toPosix(relative(checkpointDirectory, item.absolutePath));
      lines.push(`* [${inlineCode(item.artifact.path)}](${encodeMarkdownDestination(target)})：${explanation}`);
    });
  }
  lines.push("", "### Protocol 审计", "");
  draft.protocols.forEach((protocol) => {
    lines.push(`**${protocol.title}**（${protocol.intent}）  `);
    lines.push(`数据范围：${protocol.dataScope}  `);
    if (protocol.reference) lines.push(`参考协议：${protocol.reference}  `);
    if (protocol.sources.length) {
      lines.push("来源：");
      protocol.sources.forEach((source) => {
        lines.push(`* ${source.kind} / ${source.status}：${source.reference ?? "未提供引用"}；${source.summary}`);
      });
    }
    if (protocol.deviations.length) {
      lines.push("协议偏差：");
      protocol.deviations.forEach((deviation) => {
        lines.push(`* ${deviation.field}：参考值 ${deviation.reference}；实际值 ${deviation.actual}；${deviation.reason}；${deviation.approvedByUser ? "已批准" : "未批准"}`);
      });
    }
    lines.push("");
  });
  return lines.join("\n").trim();
}

function rewriteArtifactReferences(
  markdown: string,
  artifacts: PreparedCheckpointArtifact[],
  checkpointDirectory: string,
): string {
  let rewritten = markdown;
  for (const item of artifacts) {
    const rawCandidates = new Set([item.path, item.artifact.path]);
    const target = encodeMarkdownDestination(toPosix(relative(checkpointDirectory, item.absolutePath)));
    for (const rawCandidate of rawCandidates) {
      const candidates = new Set([rawCandidate, encodeMarkdownDestination(toPosix(rawCandidate))]);
      for (const candidate of candidates) {
        const linkTarget = new RegExp(`(\\]\\(<?)(?:artifact:\\/\\/)?${escapeRegExp(candidate)}(?=>?(?:\\s+["'][^)]*["'])?\\))`, "g");
        rewritten = rewritten.replace(linkTarget, (_match, prefix: string) => `${prefix}${target}`);
      }
    }
  }
  return rewritten;
}

function inlineCode(value: string): string {
  const longestRun = Math.max(0, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);
  const padded = longestRun > 0 || /^\s|\s$/.test(value) ? ` ${value} ` : value;
  return `${fence}${padded}${fence}`;
}

function encodeMarkdownDestination(path: string): string {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

async function reserveDirectory(root: string, baseId: string): Promise<{ id: string; directory: string }> {
  for (let index = 1; index < 10_000; index += 1) {
    const id = index === 1 ? baseId : `${baseId}-${index}`;
    const directory = resolve(root, id);
    try {
      await mkdir(directory, { recursive: false });
      return { id, directory };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error("无法为 checkpoint 分配唯一目录。");
}

async function collectMarkdownFiles(root: string, depth: number, excluded: Set<string>): Promise<string[]> {
  if (depth < 0) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(path);
    else if (entry.isDirectory() && !excluded.has(path)) files.push(...await collectMarkdownFiles(path, depth - 1, excluded));
  }
  return files;
}

function resolveInside(root: string, configured: string): string {
  const target = isAbsolute(configured) ? resolve(configured) : resolve(root, configured);
  if (target === root || !target.startsWith(`${root}${sep}`)) {
    throw new Error(`Checkpoint directory must be a subdirectory inside the project: ${configured}`);
  }
  return target;
}

async function assertCheckpointRootSafe(projectRoot: string, checkpointRoot: string): Promise<void> {
  const [realProjectRoot, realCheckpointRoot] = await Promise.all([realpath(projectRoot), realpath(checkpointRoot)]);
  if (!realCheckpointRoot.startsWith(`${realProjectRoot}${sep}`)) {
    throw new Error("Checkpoint directory resolves outside the project.");
  }
}

function compactTimestamp(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "research-note";
}

function extractTitle(markdown: string): string | undefined {
  return markdown.match(/^#\s+(?:Checkpoint[：:]\s*)?(.+)$/m)?.[1]?.trim();
}

function extractShortConclusion(markdown: string): string {
  const conclusion = markdown.match(/^##\s+4\.\s*结论与下一步\s*$([^]*?)(?=^---\s*$|^##\s+|$)/m)?.[1]
    ?? markdown.match(/^##\s+结论[^\n]*$([^]*?)(?=^##\s+|$)/m)?.[1]
    ?? "";
  const paragraph = conclusion.split(/\r?\n\s*\r?\n/).map((item) => item.trim()).find(Boolean);
  return paragraph?.replace(/^>\s*/, "").replace(/[*_`]/g, "").slice(0, 300) || "未提供简短结论。";
}

function validDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function referencesMarkdownImage(markdown: string, path: string): boolean {
  const candidates = new Set([path, encodeMarkdownDestination(toPosix(path))]);
  return [...candidates].some((candidate) => {
    const target = escapeRegExp(candidate);
    return new RegExp(`!\\[[^\\]]*\\]\\((?:<)?(?:artifact:\\/\\/)?${target}(?:>)?(?:\\s+["'][^)]*["'])?\\)`).test(markdown);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isImage(extension: string): boolean {
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(extension.toLowerCase());
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}
