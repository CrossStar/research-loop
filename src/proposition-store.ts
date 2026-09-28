import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  parseCheckpointMarkdown,
  type CheckpointStore,
  type CheckpointVerdict,
  type DiscoveredCheckpoint,
} from "./checkpoint-store.js";
import type { ExperimentPrediction } from "./core/types.js";

export const PROPOSITION_DIRECTORY = "propositions";

export type PropositionQuestionSource = "initial" | "user" | "agent";

export interface PropositionQuestion {
  id: string;
  question: string;
  rationale: string;
  source: PropositionQuestionSource;
  created_at: string;
}

export interface PropositionRevision {
  at: string;
  previous: string;
  statement: string;
  reason: string;
}

/** The proposition file holds only what no checkpoint can: the statement, its revisions, and questions not raised by a checkpoint. */
export interface PropositionRecord {
  schema_version: 1;
  id: string;
  statement: string;
  background?: string;
  created_at: string;
  updated_at: string;
  questions: PropositionQuestion[];
  revisions: PropositionRevision[];
}

export interface TreeCheckpoint {
  id: string;
  sequence: number;
  title: string;
  created_at: string;
  question_id: string;
  answer: string;
  verdict?: CheckpointVerdict;
  verdict_reason?: string;
  new_question_ids: string[];
}

export interface TreeQuestion {
  id: string;
  question: string;
  /** Why the question exists: its decomposition rationale or the finding that raised it. */
  origin: string;
  source: PropositionQuestionSource | "checkpoint";
  raised_by?: string;
  proposed_experiment?: string;
  predictions?: ExperimentPrediction[];
  answered_by: string[];
  status: "open" | "answered";
}

export interface PropositionTree {
  proposition: PropositionRecord;
  questions: TreeQuestion[];
  checkpoints: TreeCheckpoint[];
}

export interface QuestionPathStep {
  question: TreeQuestion;
  /** The checkpoint that answered this step and raised the next question. */
  via?: TreeCheckpoint;
}

export class PropositionStore {
  readonly directory: string;

  constructor(readonly checkpoints: CheckpointStore) {
    this.directory = resolve(checkpoints.checkpointRoot, PROPOSITION_DIRECTORY);
  }

  async list(): Promise<PropositionRecord[]> {
    let names: string[];
    try {
      names = await readdir(this.directory);
    } catch {
      return [];
    }
    const records = await Promise.all(names
      .filter((name) => /^P\d+\.md$/i.test(name))
      .map((name) => this.read(resolve(this.directory, name))));
    return records
      .filter((record): record is PropositionRecord => record !== undefined)
      .sort((left, right) => propositionNumber(left.id) - propositionNumber(right.id));
  }

  async find(id: string): Promise<PropositionRecord | undefined> {
    if (!/^P\d+$/.test(id)) return undefined;
    return this.read(resolve(this.directory, `${id}.md`));
  }

  async latest(): Promise<PropositionRecord | undefined> {
    return (await this.list()).sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))[0];
  }

  async tree(id: string): Promise<PropositionTree | undefined> {
    const proposition = await this.find(id);
    if (!proposition) return undefined;
    return buildPropositionTree(proposition, await this.checkpoints.list());
  }

  async create(input: {
    statement: string;
    background?: string;
    questions: Array<{ question: string; rationale: string }>;
  }): Promise<PropositionRecord> {
    const existing = await this.list();
    const id = `P${Math.max(0, ...existing.map((record) => propositionNumber(record.id))) + 1}`;
    const now = new Date().toISOString();
    const record: PropositionRecord = {
      schema_version: 1,
      id,
      statement: input.statement.trim(),
      background: input.background?.trim() || undefined,
      created_at: now,
      updated_at: now,
      questions: input.questions.map((item, index) => ({
        id: `Q${index + 1}`,
        question: item.question.trim(),
        rationale: item.rationale.trim(),
        source: "initial",
        created_at: now,
      })),
      revisions: [],
    };
    await this.write(record);
    return record;
  }

  async revise(id: string, statement: string, reason: string): Promise<PropositionRecord> {
    const record = await this.require(id);
    const now = new Date().toISOString();
    record.revisions.push({ at: now, previous: record.statement, statement: statement.trim(), reason: reason.trim() });
    record.statement = statement.trim();
    record.updated_at = now;
    await this.write(record);
    return record;
  }

  async addQuestion(
    id: string,
    question: string,
    rationale: string,
    source: PropositionQuestionSource,
  ): Promise<PropositionQuestion> {
    const tree = await this.tree(id);
    if (!tree) throw new Error(`命题 ${id} 不存在。`);
    const now = new Date().toISOString();
    const added: PropositionQuestion = {
      id: `Q${nextQuestionNumber(tree)}`,
      question: question.trim(),
      rationale: rationale.trim(),
      source,
      created_at: now,
    };
    tree.proposition.questions.push(added);
    tree.proposition.updated_at = now;
    await this.write(tree.proposition);
    return added;
  }

  private async require(id: string): Promise<PropositionRecord> {
    const record = await this.find(id);
    if (!record) throw new Error(`命题 ${id} 不存在。`);
    return record;
  }

  private async read(path: string): Promise<PropositionRecord | undefined> {
    try {
      const { metadata } = parseCheckpointMarkdown(await readFile(path, "utf8"));
      const record = metadata as Partial<PropositionRecord> | undefined;
      if (!record || typeof record.id !== "string" || typeof record.statement !== "string") return undefined;
      return {
        schema_version: 1,
        id: record.id,
        statement: record.statement,
        background: record.background,
        created_at: record.created_at ?? new Date(0).toISOString(),
        updated_at: record.updated_at ?? record.created_at ?? new Date(0).toISOString(),
        questions: Array.isArray(record.questions) ? record.questions : [],
        revisions: Array.isArray(record.revisions) ? record.revisions : [],
      };
    } catch {
      return undefined;
    }
  }

  private async write(record: PropositionRecord): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const path = resolve(this.directory, `${record.id}.md`);
    const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporaryPath, formatPropositionMarkdown(record), "utf8");
    await rename(temporaryPath, path);
  }
}

export function buildPropositionTree(
  proposition: PropositionRecord,
  discovered: DiscoveredCheckpoint[],
): PropositionTree {
  const owned = discovered
    .filter((item) => item.metadata.proposition_id === proposition.id && item.metadata.question_id)
    .sort((left, right) => Date.parse(left.metadata.created_at) - Date.parse(right.metadata.created_at));
  const checkpoints: TreeCheckpoint[] = owned.map((item, index) => ({
    id: item.metadata.id,
    sequence: item.metadata.sequence ?? index + 1,
    title: item.metadata.title,
    created_at: item.metadata.created_at,
    question_id: item.metadata.question_id!,
    answer: item.metadata.short_conclusion,
    verdict: item.metadata.verdict,
    verdict_reason: item.metadata.verdict_reason,
    new_question_ids: (item.metadata.new_questions ?? []).map((question) => question.id),
  }));

  const questions: TreeQuestion[] = proposition.questions.map((question) => ({
    id: question.id,
    question: question.question,
    origin: question.rationale,
    source: question.source,
    answered_by: [],
    status: "open",
  }));
  for (const item of owned) {
    for (const raised of item.metadata.new_questions ?? []) {
      questions.push({
        id: raised.id,
        question: raised.question,
        origin: raised.why_it_arose,
        source: "checkpoint",
        raised_by: item.metadata.id,
        proposed_experiment: raised.proposed_experiment,
        predictions: raised.predictions,
        answered_by: [],
        status: "open",
      });
    }
  }
  const byId = new Map(questions.map((question) => [question.id, question]));
  for (const checkpoint of checkpoints) {
    const question = byId.get(checkpoint.question_id);
    if (!question) continue;
    question.answered_by.push(checkpoint.id);
    question.status = "answered";
  }
  questions.sort((left, right) => questionNumber(left.id) - questionNumber(right.id));
  return { proposition, questions, checkpoints };
}

export function nextQuestionNumber(tree: PropositionTree): number {
  return Math.max(0, ...tree.questions.map((question) => questionNumber(question.id))) + 1;
}

export function nextCheckpointSequence(tree: PropositionTree): number {
  return Math.max(0, ...tree.checkpoints.map((checkpoint) => checkpoint.sequence)) + 1;
}

/** Walks from the proposition to a question through the checkpoints that raised each step. */
export function questionPath(tree: PropositionTree, questionId: string): QuestionPathStep[] {
  const questions = new Map(tree.questions.map((question) => [question.id, question]));
  const checkpoints = new Map(tree.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
  const steps: QuestionPathStep[] = [];
  const seen = new Set<string>();
  let question = questions.get(questionId);
  let via: TreeCheckpoint | undefined;
  while (question && !seen.has(question.id)) {
    seen.add(question.id);
    steps.unshift({ question, via });
    via = question.raised_by ? checkpoints.get(question.raised_by) : undefined;
    question = via ? questions.get(via.question_id) : undefined;
  }
  return steps;
}

export function describePropositionForPolicy(tree: PropositionTree | undefined, nextQuestionId?: string): string {
  if (!tree) {
    return [
      "[RESEARCH PROPOSITION]",
      "No active proposition. Before any experiment, agree with the user on the proposition being tested: one falsifiable sentence plus 1-5 initial questions that decompose it. Record it with research_proposition action=create; the user confirms it.",
    ].join("\n");
  }
  const { proposition } = tree;
  const checkpoints = new Map(tree.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
  const open = tree.questions.filter((question) => question.status === "open").slice(0, 8);
  const answered = tree.checkpoints.slice(-5);
  const lines = [
    "[RESEARCH PROPOSITION]",
    `Active proposition ${proposition.id}: ${proposition.statement}`,
  ];
  if (answered.length) {
    lines.push("Recent checkpoints:");
    answered.forEach((checkpoint) => {
      lines.push(`- C${checkpoint.sequence} answered ${checkpoint.question_id} (${checkpoint.verdict ?? "no verdict"}): ${checkpoint.answer}`);
    });
  }
  if (open.length) {
    lines.push("Open questions:");
    open.forEach((question) => {
      const raisedBy = question.raised_by ? checkpoints.get(question.raised_by) : undefined;
      const origin = raisedBy ? ` [raised by C${raisedBy.sequence}]` : "";
      const proposal = question.proposed_experiment ? ` Proposed experiment: ${question.proposed_experiment}` : "";
      lines.push(`- ${question.id}${origin}: ${question.question}${proposal}`);
    });
  } else {
    lines.push("No open questions. Ask the user which question to examine next, then record it with research_proposition action=add_question.");
  }
  if (nextQuestionId) lines.push(`The user selected ${nextQuestionId} as the next question.`);
  lines.push(
    "Every experiment answers exactly one registered question. Enter Experiment Mode with its questionId, a rationale, and at least two predictions (observation -> implication) that cover supporting and non-supporting outcomes. Record any other question with research_proposition action=add_question before experimenting on it. Suggest proposition revisions only through the checkpoint; the user decides whether to adopt them.",
  );
  return lines.join("\n");
}

export function formatPropositionMarkdown(record: PropositionRecord): string {
  const lines = [
    `---\n${JSON.stringify(record)}\n---`,
    "",
    `# 命题 ${record.id}：${record.statement}`,
  ];
  if (record.background) lines.push("", record.background);
  lines.push("", "## 登记的问题", "");
  if (record.questions.length === 0) lines.push("暂无登记问题。");
  record.questions.forEach((question) => {
    lines.push(`* **${question.id}** ${question.question}：${question.rationale}`);
  });
  if (record.revisions.length) {
    lines.push("", "## 修订记录", "");
    record.revisions.forEach((revision) => {
      lines.push(`* ${revision.at.slice(0, 10)}：${revision.previous} → ${revision.statement}。理由：${revision.reason}`);
    });
  }
  lines.push(
    "",
    "> 本文件只保存命题、登记的问题和修订记录。实验结论和后续问题保存在各 checkpoint 中，由 Viewer 组合成问题树。",
    "",
  );
  return lines.join("\n");
}

function propositionNumber(id: string): number {
  return Number.parseInt(id.replace(/^P/i, ""), 10) || 0;
}

function questionNumber(id: string): number {
  return Number.parseInt(id.replace(/^Q/i, ""), 10) || 0;
}
