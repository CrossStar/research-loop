import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
  ArtifactRadar,
  createArtifactRootNormalizer,
  discoverArtifactsFromRoots,
  formatSize,
  inferArtifactRoot,
  loadArtifactPreview,
  normalizeArtifactRoots,
  type ArtifactRecord,
} from "./artifacts.js";
import { registerResearchCheckpoint } from "./checkpoint.js";
import { CheckpointViewerServer } from "./checkpoint-server.js";
import { CheckpointStore, type PropositionRevisionProposal } from "./checkpoint-store.js";
import type { ExperimentContext } from "./core/types.js";
import {
  describePropositionForPolicy,
  nextCheckpointSequence,
  nextQuestionNumber,
  PropositionStore,
  questionPath,
  type TreeQuestion,
} from "./proposition-store.js";
import {
  POLICY_MESSAGE,
  ResearchRuntime,
  shouldAbortForCancelledQuestionnaire,
} from "./runtime.js";
import { latexToUnicode } from "./latex-text.js";
import { createTerminalImage } from "./terminal-image.js";

const ASK_USER_BLOCKED_EVENT = "rpiv:ask-user:blocked";

const PREDICTION = Type.Object({
  observation: Type.String({ description: "If this is observed (concrete, ideally with a direction or threshold)" }),
  implication: Type.String({ description: "then it means this for the question or proposition" }),
});

function resultText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.map((part) => part.type === "text" ? part.text ?? "" : "").join("\n");
}

interface CheckpointHandoff {
  generation: number;
  propositionId: string;
  sequence: number;
  newQuestionIds: string[];
  revisionProposal?: PropositionRevisionProposal;
}

export default function researchLoop(pi: ExtensionAPI): void {
  const runtime = new ResearchRuntime(pi);
  let checkpointStore: CheckpointStore | undefined;
  let propositionStore: PropositionStore | undefined;
  let pendingHandoff: CheckpointHandoff | undefined;
  let checkpointServer: CheckpointViewerServer | undefined;
  let radar: ArtifactRadar | undefined;
  let activeContext: ExtensionContext | undefined;
  let viewerExposureWarned = false;
  let loadedArtifactRoots = new Set<string>();
  let artifactLoadTask: { generation: number; promise: Promise<void> } | undefined;
  let artifactAbortController: AbortController | undefined;
  let sessionGeneration = 0;
  let radarRoots = "";
  let artifactRootsDirty = false;
  let artifactRootPersistTimer: NodeJS.Timeout | undefined;

  const getArtifacts = () => {
    const merged = new Map<string, ArtifactRecord>();
    for (const artifact of [...runtime.artifacts, ...(radar?.getArtifacts() ?? [])]) {
      merged.set(`${artifact.kind}:${artifact.path}`, artifact);
    }
    return [...merged.values()].sort((a, b) => a.discoveredAt - b.discoveredAt);
  };
  const mergeArtifacts = (records: ArtifactRecord[], ctx?: ExtensionContext) => {
    const merged = new Map<string, ArtifactRecord>();
    for (const artifact of [...records, ...runtime.artifacts]) {
      merged.set(`${artifact.kind}:${artifact.path}`, artifact);
    }
    runtime.setArtifacts([...merged.values()], ctx);
  };
  const isCurrentSession = (ctx: ExtensionContext, generation: number, signal: AbortSignal) => (
    generation === sessionGeneration && activeContext === ctx && !signal.aborted
  );
  const ensureArtifactInventory = async (
    ctx: ExtensionContext,
    requestedRoots = runtime.artifactRoots,
    generation = sessionGeneration,
    signal = artifactAbortController?.signal,
  ) => {
    if (!signal || !isCurrentSession(ctx, generation, signal)) return;
    if (artifactLoadTask?.generation === generation) await artifactLoadTask.promise;
    if (!isCurrentSession(ctx, generation, signal)) return;
    const pendingRoots = requestedRoots.filter((root) => !loadedArtifactRoots.has(root));
    if (pendingRoots.length === 0) return;

    const promise = (async () => {
      const discovered = await discoverArtifactsFromRoots(ctx.cwd, pendingRoots, signal);
      if (!isCurrentSession(ctx, generation, signal)) return;
      for (const root of pendingRoots) loadedArtifactRoots.add(root);
      mergeArtifacts(discovered, ctx);
    })();
    const task = { generation, promise };
    artifactLoadTask = task;
    try {
      await promise;
    } catch (error) {
      if (isCurrentSession(ctx, generation, signal)) {
        ctx.ui.notify(`Could not rediscover research artifacts: ${String(error)}`, "warning");
      }
    } finally {
      if (artifactLoadTask === task) artifactLoadTask = undefined;
    }
  };
  const flushArtifactRoots = () => {
    if (artifactRootPersistTimer) clearTimeout(artifactRootPersistTimer);
    artifactRootPersistTimer = undefined;
    if (!artifactRootsDirty) return;
    artifactRootsDirty = false;
    runtime.persistControlState();
  };
  const scheduleArtifactRoots = () => {
    artifactRootsDirty = true;
    if (artifactRootPersistTimer) clearTimeout(artifactRootPersistTimer);
    const generation = sessionGeneration;
    artifactRootPersistTimer = setTimeout(() => {
      if (generation === sessionGeneration) flushArtifactRoots();
    }, 1_000);
  };
  const markArtifactRootsPersisted = () => {
    if (artifactRootPersistTimer) clearTimeout(artifactRootPersistTimer);
    artifactRootPersistTimer = undefined;
    artifactRootsDirty = false;
  };
  const stopRadar = () => {
    radar?.stop();
    radar = undefined;
    radarRoots = "";
    flushArtifactRoots();
  };
  const syncRadar = async (
    ctx: ExtensionContext,
    generation = sessionGeneration,
    signal = artifactAbortController?.signal,
  ) => {
    if (!signal || !isCurrentSession(ctx, generation, signal)) return;
    if (!runtime.enabled || runtime.workMode !== "experiment") {
      stopRadar();
      return;
    }
    const normalizeRoots = createArtifactRootNormalizer(ctx.cwd);
    const roots = normalizeRoots(runtime.currentArtifactRoots);
    if (roots.length === 0) {
      stopRadar();
      return;
    }
    await ensureArtifactInventory(ctx, roots, generation, signal);
    if (
      !isCurrentSession(ctx, generation, signal)
      || !runtime.enabled
      || runtime.workMode !== "experiment"
    ) return;
    const currentRoots = normalizeRoots(runtime.currentArtifactRoots);
    const signature = JSON.stringify(currentRoots);
    if (signature !== JSON.stringify(roots)) {
      await syncRadar(ctx, generation, signal);
      return;
    }
    if (radar && radarRoots === signature) return;
    stopRadar();
    if (!isCurrentSession(ctx, generation, signal)) return;
    radar = new ArtifactRadar(ctx.cwd, runtime.artifacts, (artifact, isNew) => {
      if (!isCurrentSession(ctx, generation, signal)) return;
      runtime.upsertArtifact(artifact, ctx);
      const inferredRoot = normalizeRoots([inferArtifactRoot(artifact)]);
      if (runtime.addArtifactRoots(inferredRoot, ctx, false)) scheduleArtifactRoots();
      const summary = artifact.kind === "dataset"
        ? `${artifact.fileCount ?? 0} ${artifact.extension.slice(1).toUpperCase()} files`
        : formatSize(artifact.size);
      ctx.ui.notify(
        `${isNew ? "Indexed" : "Updated"} ${artifact.kind}: ${artifact.path} (${summary})`,
        "info",
      );
    }, currentRoots);
    radarRoots = signature;
    try {
      radar.start();
    } catch (error) {
      stopRadar();
      if (isCurrentSession(ctx, generation, signal)) {
        ctx.ui.notify(`Artifact Radar unavailable: ${String(error)}`, "warning");
      }
    }
  };
  const warnViewerExposure = (server: CheckpointViewerServer, ctx: ExtensionContext) => {
    if (!server.exposedToNetwork || viewerExposureWarned) return;
    viewerExposureWarned = true;
    ctx.ui.notify(
      "Checkpoint Viewer is listening on 0.0.0.0 without authentication. Use this only on a trusted network; SSH forwarding with 127.0.0.1 remains the safer default.",
      "warning",
    );
  };
  const stores = (ctx: ExtensionContext) => {
    checkpointStore ??= new CheckpointStore(ctx.cwd);
    propositionStore ??= new PropositionStore(checkpointStore);
    return { checkpoints: checkpointStore, propositions: propositionStore };
  };
  const refreshPropositionContext = async (ctx: ExtensionContext) => {
    const propositionId = runtime.propositionId;
    const tree = propositionId ? await stores(ctx).propositions.tree(propositionId) : undefined;
    runtime.setPropositionContext(describePropositionForPolicy(tree, runtime.selectedNextQuestionId));
  };
  /** Resume the most recently updated proposition when the session has none, then refresh the policy context. */
  const activateLatestProposition = async (ctx: ExtensionContext) => {
    if (!runtime.propositionId) {
      const latest = await stores(ctx).propositions.latest();
      if (latest) {
        runtime.setProposition(latest.id, ctx);
        ctx.ui.notify(`Research proposition ${latest.id}: ${latexToUnicode(latest.statement)}`, "info");
      }
    }
    await refreshPropositionContext(ctx);
  };
  const resolveExperiment = async (
    params: {
      title?: string;
      questionId?: string;
      rationale?: string;
      predictions?: Array<{ observation: string; implication: string }>;
      intent?: ExperimentContext["intent"];
      plannedDataScope?: string;
      reference?: string;
      artifactRoots?: string[];
    },
    ctx: ExtensionContext,
  ): Promise<ExperimentContext | string> => {
    const missing = (["title", "questionId", "rationale", "intent", "plannedDataScope"] as const)
      .filter((field) => !params[field]?.trim());
    if ((params.predictions?.length ?? 0) < 2) missing.push("predictions (at least 2)" as never);
    if (missing.length) return `Experiment Mode requires: ${missing.join(", ")}.`;
    const propositionId = runtime.propositionId;
    if (!propositionId) {
      return "Experiment Mode requires an active proposition. Agree on it with the user and record it with research_proposition action=create first.";
    }
    const tree = await stores(ctx).propositions.tree(propositionId);
    if (!tree) return `Active proposition ${propositionId} was not found under checkpoints/propositions.`;
    const question = tree.questions.find((item) => item.id === params.questionId!.trim());
    if (!question) {
      const open = tree.questions.filter((item) => item.status === "open").map((item) => item.id);
      return `${params.questionId} is not registered under ${propositionId}. Open questions: ${open.join(", ") || "none"}. Register a new question with research_proposition action=add_question first.`;
    }
    return {
      title: params.title!,
      propositionId,
      questionId: question.id,
      question: question.question,
      rationale: params.rationale!,
      predictions: params.predictions!,
      intent: params.intent!,
      plannedDataScope: params.plannedDataScope!,
      reference: params.reference,
      artifactRoots: normalizeArtifactRoots(ctx.cwd, params.artifactRoots ?? []),
    };
  };
  const runHandoff = async (handoff: CheckpointHandoff, ctx: ExtensionContext) => {
    const { propositions } = stores(ctx);
    let revision = handoff.revisionProposal;
    const chooseQuestion = async (statement: string, question: Pick<TreeQuestion, "id" | "question" | "proposed_experiment">) => {
      runtime.selectNextQuestion(question.id, ctx);
      await refreshPropositionContext(ctx);
      const prefill = [
        `继续验证命题 ${handoff.propositionId}：${statement}`,
        `下一步问题 ${question.id}：${question.question}`,
        question.proposed_experiment ? `建议实验：${question.proposed_experiment}` : undefined,
        "请据此设计实验，登记事先预期后进入 Experiment Mode。",
      ].filter((line): line is string => Boolean(line)).join("\n");
      const message = await ctx.ui.editor("下一轮指令（可修改后提交；取消则只记录选择）", prefill);
      if (message?.trim() && handoff.generation === sessionGeneration) pi.sendUserMessage(message.trim());
    };

    while (handoff.generation === sessionGeneration) {
      const tree = await propositions.tree(handoff.propositionId);
      if (!tree) return;
      const raised = new Set(handoff.newQuestionIds);
      const open = tree.questions.filter((item) => item.status === "open");
      const ordered = [...open.filter((item) => raised.has(item.id)), ...open.filter((item) => !raised.has(item.id))];
      const choices = new Map<string, () => Promise<boolean>>();
      ordered.forEach((question) => {
        choices.set(`${question.id}　${latexToUnicode(question.question)}${raised.has(question.id) ? "（本轮新问题）" : ""}`, async () => {
          await chooseQuestion(tree.proposition.statement, question);
          return true;
        });
      });
      const proposed = revision;
      if (proposed) {
        choices.set(`采纳命题修订：${latexToUnicode(proposed.statement)}`, async () => {
          const approved = await ctx.ui.confirm(
            `修订命题 ${tree.proposition.id}？`,
            latexToUnicode(`原命题：${tree.proposition.statement}\n修订为：${proposed.statement}\n理由：${proposed.reason}`),
          );
          if (approved) {
            await propositions.revise(tree.proposition.id, proposed.statement, proposed.reason);
            await refreshPropositionContext(ctx);
            ctx.ui.notify(`命题 ${tree.proposition.id} 已修订。`, "info");
          }
          revision = undefined;
          return false;
        });
      }
      choices.set("提出新的问题…", async () => {
        const text = await ctx.ui.input("新问题", "一句话描述下一步要验证的问题");
        if (!text?.trim()) return false;
        const question = await propositions.addQuestion(
          tree.proposition.id,
          text,
          `用户在 C${handoff.sequence} 之后提出。`,
          "user",
        );
        await chooseQuestion(tree.proposition.statement, question);
        return true;
      });
      choices.set("暂不决定", async () => true);
      const picked = await ctx.ui.select(
        `C${handoff.sequence} 已完成 · 命题 ${tree.proposition.id}：下一步验证哪个问题？`,
        [...choices.keys()],
      );
      if (!picked || await choices.get(picked)!()) return;
    }
  };
  const startCheckpointViewer = async (ctx: ExtensionContext) => {
    checkpointStore ??= new CheckpointStore(ctx.cwd);
    checkpointServer ??= new CheckpointViewerServer(checkpointStore);
    await checkpointServer.start();
    warnViewerExposure(checkpointServer, ctx);
    return checkpointServer;
  };

  registerResearchCheckpoint(pi, {
    getArtifacts,
    async prepareChain(newQuestionCount, ctx) {
      const experiment = runtime.experiment;
      if (!experiment?.propositionId || !experiment.questionId || !experiment.predictions?.length) {
        return "This experiment was started without a proposition question, so it cannot be linked into a checkpoint chain. Ask the user to end it with /research off and restart it under a proposition.";
      }
      const tree = await stores(ctx).propositions.tree(experiment.propositionId);
      if (!tree) return `Proposition ${experiment.propositionId} was not found under checkpoints/propositions.`;
      const question = tree.questions.find((item) => item.id === experiment.questionId);
      if (!question) return `Question ${experiment.questionId} is no longer registered under ${experiment.propositionId}.`;
      const raisedBy = tree.checkpoints.find((checkpoint) => checkpoint.id === question.raised_by);
      const firstQuestion = nextQuestionNumber(tree);
      return {
        proposition: { id: tree.proposition.id, statement: tree.proposition.statement },
        question: { id: question.id, question: question.question, origin: question.origin },
        path: questionPath(tree, question.id).map((step) => ({
          questionId: step.question.id,
          via: step.via && { sequence: step.via.sequence, answer: step.via.answer },
        })),
        raisedBy: raisedBy && { sequence: raisedBy.sequence, title: raisedBy.title },
        predictions: experiment.predictions,
        sequence: nextCheckpointSequence(tree),
        newQuestionIds: Array.from({ length: newQuestionCount }, (_, index) => `Q${firstQuestion + index}`),
      };
    },
    async save(draft, artifacts, chain, ctx) {
      const stored = await stores(ctx).checkpoints.write(draft, artifacts, chain);
      const registeredRoots = normalizeArtifactRoots(
        ctx.cwd,
        artifacts.map((item) => inferArtifactRoot(item.artifact)),
      );
      runtime.addArtifactRoots(registeredRoots, undefined, false);
      try {
        const server = await startCheckpointViewer(ctx);
        return { stored, viewerUrl: server.latestUrl };
      } catch (error) {
        ctx.ui.notify(`Checkpoint saved, but Viewer is unavailable: ${String(error)}`, "warning");
        return { stored };
      }
    },
    onReached: ({ stored, draft, resultCount }, ctx) => {
      runtime.reachCheckpoint(resultCount, ctx);
      markArtifactRootsPersisted();
      void syncRadar(ctx);
      void refreshPropositionContext(ctx);
      const { proposition_id: propositionId, sequence } = stored.metadata;
      if (propositionId && sequence) {
        pendingHandoff = {
          generation: sessionGeneration,
          propositionId,
          sequence,
          newQuestionIds: (stored.metadata.new_questions ?? []).map((item) => item.id),
          revisionProposal: draft.revisionProposal,
        };
      }
    },
  });

  pi.registerTool({
    name: "research_mode",
    label: "Research Work Mode",
    description:
      "Set the current Research Loop mode. Use Brainstorming to compare options, Exploration to read and understand code or materials, and Experiment before empirical execution. Experiment Mode answers one registered question of the active proposition and requires predictions registered before the run. Disable Research Loop for ordinary implementation work. Call this alone, then proceed with the work.",
    parameters: Type.Object({
      mode: StringEnum(["brainstorming", "exploration", "experiment"] as const),
      objective: Type.String({ description: "Current objective that justifies this mode" }),
      title: Type.Optional(Type.String({ description: "Experiment phase title; required for Experiment Mode" })),
      questionId: Type.Optional(Type.String({ description: "Registered question of the active proposition, such as Q3; required for Experiment Mode" })),
      rationale: Type.Optional(Type.String({ description: "Why this experiment can answer the question; required for Experiment Mode" })),
      predictions: Type.Optional(Type.Array(PREDICTION, {
        minItems: 2,
        maxItems: 4,
        description: "Outcomes predicted before the run, covering supporting and non-supporting results; copied verbatim into the checkpoint. Required for Experiment Mode",
      })),
      intent: Type.Optional(
        StringEnum(["reproduction", "diagnostic", "exploratory", "ablation"] as const, {
          description: "Scientific intent; required for Experiment Mode",
        }),
      ),
      plannedDataScope: Type.Optional(
        Type.String({ description: "Planned dataset, split, sample count, and scope; required for Experiment Mode" }),
      ),
      reference: Type.Optional(Type.String({ description: "Reference paper, result, or protocol when applicable" })),
      artifactRoots: Type.Optional(Type.Array(
        Type.String({ description: "Project-relative experiment output directory" }),
        { maxItems: 16, description: "Stable output directories to watch and rescan for artifacts" },
      )),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      let experiment: ExperimentContext | undefined;
      if (params.mode === "experiment") {
        const resolved = await resolveExperiment(params, ctx);
        if (typeof resolved === "string") {
          return { content: [{ type: "text" as const, text: resolved }], details: { accepted: false, mode: params.mode } };
        }
        experiment = resolved;
      }
      const decision = runtime.enterMode(params.mode, params.objective, experiment, ctx);
      if (!decision.block) {
        await syncRadar(ctx);
        await refreshPropositionContext(ctx);
      }
      const text = decision.block
        ? decision.reason ?? "Mode transition rejected."
        : [
            `Research Work Mode: ${params.mode.toUpperCase()}`,
            `Objective: ${params.objective}`,
            ...(experiment ? [`Question ${experiment.questionId}: ${experiment.question}`] : []),
          ].join("\n");
      return { content: [{ type: "text" as const, text }], details: { accepted: !decision.block, mode: params.mode } };
    },
    renderCall(args, theme) {
      const mode = (args as { mode?: string }).mode?.toUpperCase() ?? "MODE";
      return new Text(theme.fg("toolTitle", theme.bold(`Research ${mode}`)), 0, 0);
    },
    renderResult(result) {
      return new Text(latexToUnicode(resultText(result)), 0, 0);
    },
  });

  pi.registerTool({
    name: "research_proposition",
    label: "Research Proposition",
    description:
      "Manage the proposition that experiments test. create records a falsifiable proposition with 1-5 initial questions; revise restates it; both require the user's confirmation. add_question registers another question before experimenting on it. activate switches to an existing proposition. Not available in Experiment Mode.",
    parameters: Type.Object({
      action: StringEnum(["create", "revise", "add_question", "activate"] as const),
      propositionId: Type.Optional(Type.String({ description: "Target proposition such as P2; defaults to the active proposition" })),
      statement: Type.Optional(Type.String({ description: "create/revise: the proposition as one falsifiable sentence" })),
      background: Type.Optional(Type.String({ description: "create: the observation or motivation behind the proposition" })),
      questions: Type.Optional(Type.Array(
        Type.Object({
          question: Type.String({ description: "One question whose answer bears on the proposition" }),
          rationale: Type.String({ description: "Why answering it tests the proposition" }),
        }),
        { minItems: 1, maxItems: 5, description: "create: initial decomposition of the proposition" },
      )),
      reason: Type.Optional(Type.String({ description: "revise: the evidence that requires the revision" })),
      question: Type.Optional(Type.String({ description: "add_question: the question" })),
      rationale: Type.Optional(Type.String({ description: "add_question: why it bears on the proposition" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const reply = (text: string, accepted: boolean) => ({
        content: [{ type: "text" as const, text }],
        details: { accepted, action: params.action },
      });
      if (runtime.workMode === "experiment") {
        return reply("Finish the experiment with research_checkpoint before changing propositions.", false);
      }
      const { propositions } = stores(ctx);
      const confirm = async (title: string, message: string) => {
        if (!ctx.hasUI) return false;
        runtime.setUserDecisionPending(true, ctx);
        try {
          return await ctx.ui.confirm(title, message);
        } catch {
          return false;
        } finally {
          runtime.setUserDecisionPending(false, ctx);
        }
      };
      const declined = (what: string) => {
        ctx.abort();
        return reply(`The user did not confirm the ${what}. The turn was stopped; do not retry. Ask the user what should change.`, false);
      };

      if (params.action === "create") {
        const questions = params.questions ?? [];
        if (!params.statement?.trim() || questions.length === 0) {
          return reply("create requires statement and at least one initial question.", false);
        }
        const summary = [
          `命题：${params.statement.trim()}`,
          ...(params.background?.trim() ? [`背景：${params.background.trim()}`] : []),
          "",
          ...questions.map((item, index) => `Q${index + 1}　${item.question}：${item.rationale}`),
        ].join("\n");
        if (!await confirm("建立研究命题？", latexToUnicode(summary))) return declined("proposition");
        const record = await propositions.create({ statement: params.statement, background: params.background, questions });
        runtime.setProposition(record.id, ctx);
        await refreshPropositionContext(ctx);
        return reply(`Proposition ${record.id} recorded and active.\n${record.questions.map((item) => `${item.id}: ${item.question}`).join("\n")}`, true);
      }

      const propositionId = params.propositionId?.trim() || runtime.propositionId;
      const record = propositionId ? await propositions.find(propositionId) : undefined;
      if (!record) return reply(`Proposition ${propositionId ?? "(none active)"} was not found.`, false);

      if (params.action === "activate") {
        runtime.setProposition(record.id, ctx);
        await refreshPropositionContext(ctx);
        return reply(`Proposition ${record.id} is active: ${record.statement}`, true);
      }
      if (params.action === "revise") {
        if (!params.statement?.trim() || !params.reason?.trim()) return reply("revise requires statement and reason.", false);
        const message = `原命题：${record.statement}\n修订为：${params.statement.trim()}\n理由：${params.reason.trim()}`;
        if (!await confirm(`修订命题 ${record.id}？`, latexToUnicode(message))) return declined("revision");
        await propositions.revise(record.id, params.statement, params.reason);
        await refreshPropositionContext(ctx);
        return reply(`Proposition ${record.id} revised.`, true);
      }
      if (!params.question?.trim() || !params.rationale?.trim()) {
        return reply("add_question requires question and rationale.", false);
      }
      const added = await propositions.addQuestion(record.id, params.question, params.rationale, "agent");
      await refreshPropositionContext(ctx);
      return reply(`Registered ${added.id} under ${record.id}: ${added.question}`, true);
    },
    renderCall(args, theme) {
      const action = (args as { action?: string }).action ?? "proposition";
      return new Text(theme.fg("toolTitle", theme.bold(`Research Proposition · ${action}`)), 0, 0);
    },
    renderResult(result) {
      return new Text(latexToUnicode(resultText(result)), 0, 0);
    },
  });

  pi.registerTool({
    name: "research_abort_experiment",
    label: "Abort Experiment",
    description:
      "Leave Experiment Mode only when no interpretable empirical evidence was produced. If negative, failed, or diagnostic evidence exists, use research_checkpoint instead. Call this alone.",
    parameters: Type.Object({
      reason: Type.String({ description: "Why the phase produced no interpretable evidence" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const decision = runtime.abortExperiment(params.reason, ctx);
      if (!decision.block) {
        markArtifactRootsPersisted();
        await syncRadar(ctx);
      }
      return {
        content: [{
          type: "text" as const,
          text: decision.block ? decision.reason ?? "Abort rejected." : `Experiment aborted: ${params.reason}`,
        }],
        details: { accepted: !decision.block },
      };
    },
    renderCall(_args, theme) {
      return new Text(theme.fg("warning", theme.bold("Abort Experiment")), 0, 0);
    },
  });

  pi.registerCommand("research", {
    description: "Turn Research Loop on or off",
    getArgumentCompletions(prefix) {
      return ["on", "off"]
        .filter((value) => value.startsWith(prefix))
        .map((value) => ({ value, label: value }));
    },
    handler: async (args, ctx) => {
      const value = args.trim().toLowerCase();
      if (value === "on" || value === "off") {
        runtime.setEnabled(value === "on", ctx);
        markArtifactRootsPersisted();
        await syncRadar(ctx);
        if (value === "on") await activateLatestProposition(ctx);
        return;
      }
      ctx.ui.notify(`Research Loop: ${runtime.enabled ? "ON" : "OFF"}. Usage: /research on|off`, "info");
    },
  });

  pi.registerCommand("proposition", {
    description: "Show or switch the active research proposition",
    handler: async (_args, ctx) => {
      const records = await stores(ctx).propositions.list();
      if (records.length === 0) {
        ctx.ui.notify("No propositions yet. Describe the proposition to the agent with Research Loop on.", "info");
        return;
      }
      const labels = records.map((record) => `${record.id}　${latexToUnicode(record.statement)}${record.id === runtime.propositionId ? "（当前）" : ""}`);
      if (ctx.mode !== "tui") {
        ctx.ui.notify(labels.join("\n"), "info");
        return;
      }
      if (runtime.workMode === "experiment") {
        ctx.ui.notify(labels.join("\n"), "info");
        return;
      }
      const selected = await ctx.ui.select("Research propositions", labels);
      const record = records[labels.indexOf(selected ?? "")];
      if (!record) return;
      runtime.setProposition(record.id, ctx);
      await refreshPropositionContext(ctx);
    },
  });

  pi.registerCommand("artifacts", {
    description: "List and preview artifacts from the current research session",
    handler: async (_args, ctx) => {
      await ensureArtifactInventory(ctx);
      const artifacts = getArtifacts();
      if (artifacts.length === 0) {
        ctx.ui.notify("No research artifacts discovered in this session.", "info");
        return;
      }

      const labels = artifacts.map((artifact, index) => {
        const summary = artifact.kind === "dataset"
          ? `${artifact.fileCountCapped ? ">=" : ""}${artifact.fileCount ?? 0} files, ${formatSize(artifact.size)} sampled`
          : formatSize(artifact.size);
        return `${index + 1}. ${artifact.name} [${artifact.kind}] (${summary}) - ${artifact.path}`;
      });

      if (ctx.mode !== "tui") {
        ctx.ui.notify(labels.join("\n"), "info");
        return;
      }

      const selected = await ctx.ui.select("Research artifacts", labels);
      if (!selected) return;
      const index = Number.parseInt(selected, 10) - 1;
      const artifact = artifacts[index];
      if (!artifact) return;

      try {
        const preview = await loadArtifactPreview(pi, ctx.cwd, artifact);
        await ctx.ui.custom<void>((_tui, theme, _keybindings, done) => {
          const container = new Container();
          container.addChild(new Text(theme.fg("accent", theme.bold(preview.title)), 0, 0));
          container.addChild(new Text(preview.text, 0, 1));
          if (preview.image) {
            container.addChild(
              createTerminalImage(
                preview.image.data,
                preview.image.mimeType,
                { fallbackColor: (text) => theme.fg("muted", text) },
                { maxWidthCells: 80, maxHeightCells: 28, filename: artifact.name },
              ),
            );
          }
          container.addChild(new Text(theme.fg("dim", "Enter/Esc to close"), 0, 1));

          return {
            render: (width) => container.render(width),
            invalidate: () => container.invalidate(),
            handleInput: (data) => {
              if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) done(undefined);
            },
          };
        });
      } catch (error) {
        ctx.ui.notify(`Could not preview ${artifact.path}: ${String(error)}`, "warning");
      }
    },
  });

  pi.registerCommand("checkpoint-viewer", {
    description: "Start the persistent Checkpoint Viewer and show its latest URL",
    handler: async (_args, ctx) => {
      try {
        const server = await startCheckpointViewer(ctx);
        ctx.ui.notify(`Checkpoint Viewer: ${server.latestUrl ?? server.origin}`, "info");
      } catch (error) {
        ctx.ui.notify(`Checkpoint Viewer unavailable: ${String(error)}`, "warning");
      }
    },
  });

  pi.events.on(ASK_USER_BLOCKED_EVENT, (payload: unknown) => {
    if (!activeContext || !payload || typeof payload !== "object") return;
    const active = (payload as { active?: unknown }).active;
    if (typeof active === "boolean") runtime.setUserDecisionPending(active, activeContext);
  });

  pi.on("session_start", (_event, ctx) => {
    artifactAbortController?.abort();
    radar?.stop();
    radar = undefined;
    radarRoots = "";
    if (artifactRootPersistTimer) clearTimeout(artifactRootPersistTimer);
    artifactRootPersistTimer = undefined;
    artifactRootsDirty = false;

    const generation = ++sessionGeneration;
    const controller = new AbortController();
    artifactAbortController = controller;
    activeContext = ctx;
    viewerExposureWarned = false;
    loadedArtifactRoots = new Set();
    artifactLoadTask = undefined;

    const restored = runtime.startSession(ctx);
    const normalizeRoots = createArtifactRootNormalizer(ctx.cwd);
    const sanitizedRoots = normalizeRoots(runtime.artifactRoots);
    const sanitizedCurrentRoots = normalizeRoots(runtime.currentArtifactRoots);
    const controlStateChanged = runtime.setArtifactRoots(sanitizedRoots, sanitizedCurrentRoots, false);
    if (restored.embeddedArtifacts || controlStateChanged) runtime.persistControlState();
    checkpointStore = undefined;
    propositionStore = undefined;
    checkpointServer = undefined;
    pendingHandoff = undefined;

    setImmediate(() => {
      void (async () => {
        if (!isCurrentSession(ctx, generation, controller.signal)) return;
        if (runtime.enabled) await activateLatestProposition(ctx);
        if (!isCurrentSession(ctx, generation, controller.signal)) return;
        if (restored.embeddedArtifacts) {
          const sanitizedArtifacts: ArtifactRecord[] = [];
          for (let index = 0; index < restored.legacyArtifacts.length; index += 1) {
            if (index % 200 === 0) {
              await new Promise<void>((resolveYield) => setImmediate(resolveYield));
              if (!isCurrentSession(ctx, generation, controller.signal)) return;
            }
            const artifact = restored.legacyArtifacts[index];
            if (artifact && normalizeRoots([inferArtifactRoot(artifact)]).length > 0) {
              sanitizedArtifacts.push(artifact);
            }
          }
          if (!isCurrentSession(ctx, generation, controller.signal)) return;
          runtime.setArtifacts(sanitizedArtifacts, ctx);
          const migratedRoots = normalizeRoots(sanitizedArtifacts.map(inferArtifactRoot));
          if (runtime.addArtifactRoots(migratedRoots, undefined, false)) runtime.persistControlState();
          if (sanitizedArtifacts.length >= 100) {
            ctx.ui.notify(
              "Legacy artifact state was migrated to roots-only persistence. Existing JSONL history is unchanged; start a new session once to remove its previous startup cost.",
              "warning",
            );
          }
        }
        await syncRadar(ctx, generation, controller.signal);
      })().catch((error) => {
        if (isCurrentSession(ctx, generation, controller.signal)) {
          ctx.ui.notify(`Artifact background initialization failed: ${String(error)}`, "warning");
        }
      });
    });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    runtime.clearStatus(ctx);
    stopRadar();
    artifactAbortController?.abort();
    artifactAbortController = undefined;
    sessionGeneration += 1;
    loadedArtifactRoots.clear();
    artifactLoadTask = undefined;
    if (artifactRootPersistTimer) clearTimeout(artifactRootPersistTimer);
    artifactRootPersistTimer = undefined;
    artifactRootsDirty = false;
    activeContext = undefined;
    await checkpointServer?.stop();
    checkpointServer = undefined;
    checkpointStore = undefined;
    propositionStore = undefined;
    pendingHandoff = undefined;
  });

  pi.on("agent_settled", async (_event, ctx) => {
    const handoff = pendingHandoff;
    pendingHandoff = undefined;
    if (!handoff || handoff.generation !== sessionGeneration || !ctx.hasUI || !runtime.enabled) return;
    try {
      await runHandoff(handoff, ctx);
    } catch (error) {
      ctx.ui.notify(`Research handoff failed: ${String(error)}`, "warning");
    }
  });

  pi.on("before_agent_start", (event, ctx) => {
    runtime.resetRequest(event.prompt, ctx);
  });

  pi.on("context", (event) => {
    const messages = event.messages.filter(
      (message) => !(message.role === "custom" && "customType" in message && message.customType === POLICY_MESSAGE),
    );
    const policy = runtime.policy();
    if (!policy) return { messages };

    const policyMessage = {
      role: "custom" as const,
      customType: POLICY_MESSAGE,
      content: policy,
      display: false,
      timestamp: Date.now(),
    } as (typeof event.messages)[number];
    return { messages: [...messages, policyMessage] };
  });

  pi.on("turn_start", () => runtime.startTurn());

  pi.on("tool_call", (event, ctx) => {
    return runtime.evaluateToolCall(event.toolName, event.input, ctx);
  });

  pi.on("tool_execution_start", () => {
    if (runtime.enabled) radar?.beginCapture();
  });

  pi.on("tool_result", (event, ctx) => {
    if (!runtime.enabled || !shouldAbortForCancelledQuestionnaire(event.toolName, event.details)) return;
    ctx.abort();
    ctx.ui.notify("Research decision questionnaire was cancelled; the current turn was stopped.", "info");
  });

  pi.on("tool_execution_end", () => {
    if (runtime.enabled) radar?.endCapture();
  });
}
