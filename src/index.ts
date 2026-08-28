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
import { CheckpointStore } from "./checkpoint-store.js";
import {
  POLICY_MESSAGE,
  ResearchRuntime,
  shouldAbortForCancelledQuestionnaire,
} from "./runtime.js";
import { createTerminalImage } from "./terminal-image.js";

const ASK_USER_BLOCKED_EVENT = "rpiv:ask-user:blocked";

export default function researchLoop(pi: ExtensionAPI): void {
  const runtime = new ResearchRuntime(pi);
  let checkpointStore: CheckpointStore | undefined;
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
  const startCheckpointViewer = async (ctx: ExtensionContext) => {
    checkpointStore ??= new CheckpointStore(ctx.cwd);
    checkpointServer ??= new CheckpointViewerServer(checkpointStore);
    await checkpointServer.start();
    warnViewerExposure(checkpointServer, ctx);
    return checkpointServer;
  };

  registerResearchCheckpoint(pi, {
    getArtifacts,
    async save(draft, artifacts, ctx) {
      checkpointStore ??= new CheckpointStore(ctx.cwd);
      const stored = await checkpointStore.write(draft, artifacts);
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
    onReached: (resultCount, ctx) => {
      runtime.reachCheckpoint(resultCount, ctx);
      markArtifactRootsPersisted();
      void syncRadar(ctx);
    },
  });

  pi.registerTool({
    name: "research_mode",
    label: "Research Work Mode",
    description:
      "Set the current Research Loop mode. Use Brainstorming to compare options, Exploration to read and understand code or materials, and Experiment before empirical execution. Disable Research Loop for ordinary implementation work. Call this alone, then proceed with the work.",
    parameters: Type.Object({
      mode: StringEnum(["brainstorming", "exploration", "experiment"] as const),
      objective: Type.String({ description: "Current objective that justifies this mode" }),
      title: Type.Optional(Type.String({ description: "Experiment phase title; required for Experiment Mode" })),
      question: Type.Optional(Type.String({ description: "Research Question; required for Experiment Mode" })),
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
      const experiment = params.mode === "experiment"
        && params.title
        && params.question
        && params.intent
        && params.plannedDataScope
        ? {
            title: params.title,
            question: params.question,
            intent: params.intent,
            plannedDataScope: params.plannedDataScope,
            reference: params.reference,
            artifactRoots: normalizeArtifactRoots(ctx.cwd, params.artifactRoots ?? []),
          }
        : undefined;
      const decision = runtime.enterMode(params.mode, params.objective, experiment, ctx);
      if (!decision.block) await syncRadar(ctx);
      const text = decision.block
        ? decision.reason ?? "Mode transition rejected."
        : `Research Work Mode: ${params.mode.toUpperCase()}\nObjective: ${params.objective}`;
      return { content: [{ type: "text" as const, text }], details: { accepted: !decision.block, mode: params.mode } };
    },
    renderCall(args, theme) {
      const mode = (args as { mode?: string }).mode?.toUpperCase() ?? "MODE";
      return new Text(theme.fg("toolTitle", theme.bold(`Research ${mode}`)), 0, 0);
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
        return;
      }
      ctx.ui.notify(`Research Loop: ${runtime.enabled ? "ON" : "OFF"}. Usage: /research on|off`, "info");
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
    checkpointServer = undefined;

    setImmediate(() => {
      void (async () => {
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
