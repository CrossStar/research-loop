import { evaluateResearchCommand, evaluateResearchFidelity, researchPolicy, } from "./governor.js";
const SOFT_REVIEW_INTERVAL = 6;
const MUTATING_TOOLS = new Set(["edit", "write", "multiedit", "notebookedit", "apply_patch"]);
const EMPIRICAL_COMMAND = /(?:^|\s)(?:pytest|tox|nox|cargo\s+(?:run|test|bench)|go\s+test|(?:npm|pnpm|yarn)\s+(?:test|run\s+(?:test|bench|benchmark|train|eval))|python(?:3)?\s+[^\n]*\.py\b|torchrun|deepspeed|accelerate\s+launch|sbatch|qsub)(?:\s|$)/i;
export class ResearchCore {
    state;
    roundActions = 0;
    nextSoftReviewAt = SOFT_REVIEW_INTERVAL;
    softReviewPending = false;
    softReviewRaisedThisTurn = false;
    checkpointReached = false;
    checkpointResultCount = 0;
    toolCallsThisTurn = 0;
    terminalToolAccepted = false;
    currentUserPrompt = "";
    constructor(initial) {
        this.state = defaultState();
        if (initial && "schemaVersion" in initial)
            this.restoreSnapshot(initial);
        else if (initial)
            this.restoreState(initial);
    }
    get enabled() {
        return this.state.enabled;
    }
    get workMode() {
        return this.state.workMode;
    }
    get lifecycleTransitionPending() {
        return this.terminalToolAccepted;
    }
    get experiment() {
        return this.state.experiment ? cloneExperiment(this.state.experiment) : undefined;
    }
    get artifactRoots() {
        return [...this.state.artifactRoots];
    }
    get artifacts() {
        return this.state.artifacts.map((artifact) => ({ ...artifact }));
    }
    get researchState() {
        return cloneState(this.state);
    }
    get controlState() {
        const { artifacts: _artifacts, ...control } = this.state;
        return {
            ...control,
            experiment: control.experiment ? cloneExperiment(control.experiment) : undefined,
            artifactRoots: [...control.artifactRoots],
        };
    }
    setEnabled(enabled) {
        this.state.enabled = enabled;
        this.state.workMode = "exploration";
        this.state.objective = undefined;
        this.state.experiment = undefined;
        this.resetRound();
    }
    enterMode(mode, objective, experiment) {
        if (!isWorkMode(mode))
            return { block: true, reason: `Unknown Research Work Mode: ${String(mode)}.` };
        if (!this.state.enabled)
            return { block: true, reason: "Research Loop is off." };
        if (this.state.workMode === "experiment") {
            return {
                block: true,
                reason: "Experiment Mode is already active and must end with research_checkpoint or research_abort_experiment.",
            };
        }
        if (mode === "experiment" && !experiment) {
            return { block: true, reason: "Experiment Mode requires a declared experiment plan." };
        }
        this.state.workMode = mode;
        this.state.objective = objective;
        this.state.experiment = mode === "experiment" ? cloneExperiment(experiment) : undefined;
        if (mode === "experiment")
            this.addArtifactRoots(experiment.artifactRoots ?? []);
        this.resetRound();
        return { block: false };
    }
    abortExperiment() {
        if (this.state.workMode !== "experiment") {
            return { block: true, reason: "No Experiment Mode is active." };
        }
        this.state.workMode = "exploration";
        this.state.objective = undefined;
        this.state.experiment = undefined;
        this.resetRound();
        return { block: false };
    }
    reachCheckpoint(resultCount) {
        this.state.workMode = "exploration";
        this.state.objective = undefined;
        this.state.experiment = undefined;
        this.checkpointReached = true;
        this.checkpointResultCount = resultCount;
        this.softReviewPending = false;
    }
    setArtifacts(artifacts) {
        this.state.artifacts = artifacts.map((artifact) => ({ ...artifact }));
    }
    upsertArtifact(artifact) {
        const index = this.state.artifacts.findIndex((candidate) => candidate.kind === artifact.kind && candidate.path === artifact.path);
        if (index >= 0)
            this.state.artifacts[index] = { ...artifact };
        else
            this.state.artifacts.push({ ...artifact });
    }
    setArtifactRoots(roots, currentExperimentRoots) {
        const normalized = compactArtifactRoots(roots);
        let changed = normalized.length !== this.state.artifactRoots.length
            || normalized.some((root, index) => root !== this.state.artifactRoots[index]);
        if (changed)
            this.state.artifactRoots = normalized;
        if (this.state.workMode === "experiment" && this.state.experiment && currentExperimentRoots) {
            const current = compactArtifactRoots(currentExperimentRoots);
            const experimentChanged = current.length !== (this.state.experiment.artifactRoots?.length ?? 0)
                || current.some((root, index) => root !== this.state.experiment.artifactRoots?.[index]);
            if (experimentChanged) {
                this.state.experiment.artifactRoots = current;
                changed = true;
            }
        }
        return changed;
    }
    addArtifactRoots(roots) {
        const compacted = compactArtifactRoots([...this.state.artifactRoots, ...roots]);
        const stateChanged = compacted.length !== this.state.artifactRoots.length
            || compacted.some((root, index) => root !== this.state.artifactRoots[index]);
        if (stateChanged)
            this.state.artifactRoots = compacted;
        let experimentChanged = false;
        if (this.state.workMode === "experiment" && this.state.experiment) {
            const experimentRoots = compactArtifactRoots([
                ...(this.state.experiment.artifactRoots ?? []),
                ...roots,
            ]);
            experimentChanged = experimentRoots.length !== (this.state.experiment.artifactRoots?.length ?? 0)
                || experimentRoots.some((root, index) => root !== this.state.experiment.artifactRoots?.[index]);
            if (experimentChanged)
                this.state.experiment.artifactRoots = experimentRoots;
        }
        return stateChanged || experimentChanged;
    }
    resetRequest(prompt) {
        this.currentUserPrompt = prompt;
        this.resetRound();
    }
    policy() {
        if (!this.state.enabled)
            return undefined;
        return researchPolicy(this.state.workMode, this.roundActions, this.softReviewPending, this.state.objective, this.state.experiment);
    }
    startTurn() {
        this.toolCallsThisTurn = 0;
        this.terminalToolAccepted = false;
        this.softReviewRaisedThisTurn = false;
    }
    completeLifecycleTransition() {
        this.terminalToolAccepted = false;
    }
    evaluateToolCall(toolName, input) {
        if (!this.state.enabled)
            return undefined;
        const researchTool = identifyResearchTool(toolName);
        if (researchTool === "research_state")
            return undefined;
        if (researchTool === "research_checkpoint") {
            if (this.state.workMode !== "experiment") {
                return { block: true, reason: "research_checkpoint is available only in Experiment Mode." };
            }
            return this.acceptTerminalTool("research_checkpoint");
        }
        if (researchTool === "research_abort_experiment") {
            if (this.state.workMode !== "experiment") {
                return { block: true, reason: "No Experiment Mode is active." };
            }
            return this.acceptTerminalTool("research_abort_experiment");
        }
        if (researchTool === "research_mode") {
            if (this.state.workMode === "experiment") {
                return {
                    block: true,
                    reason: "Experiment Mode is already active and must end with research_checkpoint or research_abort_experiment.",
                };
            }
            return this.acceptTerminalTool("research_mode");
        }
        if (researchTool === "research_set_enabled") {
            return this.acceptTerminalTool("research_set_enabled");
        }
        if (this.terminalToolAccepted) {
            return {
                block: true,
                reason: "Wait for the research lifecycle transition to complete before running work or dispatching a subagent.",
            };
        }
        this.toolCallsThisTurn += 1;
        const normalizedTool = toolName.toLowerCase();
        if ((this.state.workMode === "brainstorming" || this.state.workMode === "exploration")
            && MUTATING_TOOLS.has(normalizedTool)) {
            return {
                block: true,
                reason: `${displayMode(this.state.workMode)} is read-oriented. Disable Research Loop before editing code, or enter Experiment Mode for empirical work.`,
            };
        }
        const command = isShellTool(normalizedTool) ? extractCommand(input) : "";
        if (command
            && (this.state.workMode === "brainstorming" || this.state.workMode === "exploration")
            && EMPIRICAL_COMMAND.test(command)) {
            return {
                block: true,
                reason: `${displayMode(this.state.workMode)} cannot run empirical work. Declare an experiment and switch to Experiment Mode first.`,
            };
        }
        const fidelity = evaluateResearchFidelity(normalizedTool, input, this.currentUserPrompt);
        if (fidelity.block)
            return fidelity;
        if (command) {
            const decision = evaluateResearchCommand(command, this.currentUserPrompt);
            if (decision.block)
                return decision;
        }
        this.recordAction();
        return undefined;
    }
    acceptApprovedToolCall() {
        if (this.state.enabled)
            this.recordAction();
    }
    projectStatus() {
        if (!this.state.enabled)
            return { text: "RESEARCH OFF", tone: "dim" };
        if (this.checkpointReached) {
            return {
                text: `RESEARCH ON | CHECKPOINT REACHED | RESULTS ${this.checkpointResultCount}`,
                tone: "success",
            };
        }
        const parts = [
            "RESEARCH ON",
            displayMode(this.state.workMode),
            `ACTIONS ${this.roundActions}`,
            this.softReviewPending ? "SOFT REVIEW" : undefined,
            `OUTPUTS ${this.state.artifacts.length}`,
        ].filter((part) => Boolean(part));
        return {
            text: parts.join(" | "),
            tone: this.softReviewPending
                ? "warning"
                : this.state.workMode === "experiment"
                    ? "success"
                    : "accent",
        };
    }
    snapshot(includeArtifacts = true) {
        return {
            schemaVersion: 1,
            state: includeArtifacts ? cloneState(this.state) : { ...this.controlState, artifacts: [] },
            roundActions: this.roundActions,
            nextSoftReviewAt: this.nextSoftReviewAt,
            softReviewPending: this.softReviewPending,
            checkpointReached: this.checkpointReached,
            checkpointResultCount: this.checkpointResultCount,
            toolCallsThisTurn: this.toolCallsThisTurn,
            terminalToolAccepted: this.terminalToolAccepted,
            currentUserPrompt: this.currentUserPrompt,
            artifactCount: this.state.artifacts.length,
        };
    }
    restoreState(state) {
        const restoredMode = isWorkMode(state.workMode) ? state.workMode : "exploration";
        const mode = restoredMode === "experiment" && !state.experiment ? "exploration" : restoredMode;
        this.state = {
            enabled: state.enabled ?? false,
            workMode: mode,
            objective: state.objective,
            experiment: mode === "experiment" && state.experiment ? cloneExperiment(state.experiment) : undefined,
            artifactRoots: compactArtifactRoots(Array.isArray(state.artifactRoots) ? state.artifactRoots : []),
            artifacts: Array.isArray(state.artifacts)
                ? state.artifacts.map((artifact) => ({ ...artifact }))
                : [],
        };
        this.resetRound();
    }
    restoreSnapshot(snapshot) {
        this.restoreState(snapshot.state);
        this.roundActions = nonNegativeInteger(snapshot.roundActions, 0);
        this.nextSoftReviewAt = Math.max(SOFT_REVIEW_INTERVAL, nonNegativeInteger(snapshot.nextSoftReviewAt, SOFT_REVIEW_INTERVAL));
        this.softReviewPending = snapshot.softReviewPending === true;
        this.checkpointReached = snapshot.checkpointReached === true;
        this.checkpointResultCount = nonNegativeInteger(snapshot.checkpointResultCount, 0);
        this.toolCallsThisTurn = nonNegativeInteger(snapshot.toolCallsThisTurn, 0);
        this.terminalToolAccepted = snapshot.terminalToolAccepted === true;
        this.currentUserPrompt = typeof snapshot.currentUserPrompt === "string" ? snapshot.currentUserPrompt : "";
    }
    acceptTerminalTool(toolName) {
        if (this.terminalToolAccepted) {
            return {
                block: true,
                reason: `${toolName} cannot start while another research lifecycle transition is pending.`,
            };
        }
        this.terminalToolAccepted = true;
        this.toolCallsThisTurn += 1;
        return undefined;
    }
    recordAction() {
        if (this.state.workMode === "experiment" && this.softReviewPending && !this.softReviewRaisedThisTurn) {
            this.softReviewPending = false;
            while (this.nextSoftReviewAt <= this.roundActions) {
                this.nextSoftReviewAt += SOFT_REVIEW_INTERVAL;
            }
        }
        this.roundActions += 1;
        if (this.state.workMode === "experiment" && this.roundActions >= this.nextSoftReviewAt) {
            this.softReviewPending = true;
            this.softReviewRaisedThisTurn = true;
        }
    }
    resetRound() {
        this.roundActions = 0;
        this.nextSoftReviewAt = SOFT_REVIEW_INTERVAL;
        this.softReviewPending = false;
        this.softReviewRaisedThisTurn = false;
        this.checkpointReached = false;
        this.checkpointResultCount = 0;
    }
}
export function isWorkMode(value) {
    return value === "brainstorming" || value === "exploration" || value === "experiment";
}
export function displayMode(mode) {
    return mode.toUpperCase();
}
function identifyResearchTool(toolName) {
    return [
        "research_set_enabled",
        "research_mode",
        "research_checkpoint",
        "research_abort_experiment",
        "research_state",
    ].find((name) => toolName === name || toolName.endsWith(`__${name}`));
}
function isShellTool(toolName) {
    return toolName === "bash" || toolName === "shell" || toolName === "exec";
}
function extractCommand(input) {
    if (!input || typeof input !== "object")
        return "";
    const command = input.command;
    return typeof command === "string" ? command : "";
}
function defaultState() {
    return { enabled: false, workMode: "exploration", artifactRoots: [], artifacts: [] };
}
function cloneState(state) {
    return {
        ...state,
        experiment: state.experiment ? cloneExperiment(state.experiment) : undefined,
        artifactRoots: [...state.artifactRoots],
        artifacts: state.artifacts.map((artifact) => ({ ...artifact })),
    };
}
function cloneExperiment(experiment) {
    return {
        ...experiment,
        artifactRoots: experiment.artifactRoots ? [...experiment.artifactRoots] : undefined,
    };
}
function compactArtifactRoots(roots) {
    const normalized = [...new Set(roots
            .filter((root) => typeof root === "string")
            .map((root) => root.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, ""))
            .filter((root) => Boolean(root)
            && root !== ".."
            && !root.startsWith("../")
            && !root.startsWith("/")
            && !/^[A-Za-z]:\//.test(root)))]
        .sort((a, b) => a.length - b.length || a.localeCompare(b));
    const compacted = [];
    for (const root of normalized) {
        if (compacted.some((parent) => root === parent || root.startsWith(`${parent}/`)))
            continue;
        compacted.push(root);
    }
    return compacted;
}
function nonNegativeInteger(value, fallback) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}
