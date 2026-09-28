export type WorkMode = "brainstorming" | "exploration" | "experiment";

export type ExperimentIntent = "reproduction" | "diagnostic" | "exploratory" | "ablation";

/** A prediction registered before the experiment runs; copied verbatim into the checkpoint. */
export interface ExperimentPrediction {
  observation: string;
  implication: string;
}

export interface ExperimentContext {
  title: string;
  /** Proposition and question this experiment answers. Required for new experiments. */
  propositionId?: string;
  questionId?: string;
  question: string;
  rationale?: string;
  predictions?: ExperimentPrediction[];
  intent: ExperimentIntent;
  plannedDataScope: string;
  reference?: string;
  artifactRoots?: string[];
}

export type ArtifactKind = "file" | "dataset";

export interface ArtifactMetadata {
  kind: ArtifactKind;
  path: string;
  name: string;
  extension: string;
  size: number;
  mtimeMs: number;
  discoveredAt: number;
  fileCount?: number;
  fileCountCapped?: boolean;
  samplePath?: string;
}

export interface ResearchState {
  enabled: boolean;
  workMode: WorkMode;
  /** Active proposition; lives in checkpoints/propositions and survives experiment boundaries. */
  propositionId?: string;
  objective?: string;
  experiment?: ExperimentContext;
  /** Small, durable paths used to rediscover artifacts; safe to persist in session entries. */
  artifactRoots: string[];
  /** Ephemeral inventory. Pi rebuilds this from artifactRoots instead of persisting it in session JSONL. */
  artifacts: ArtifactMetadata[];
}

export type ResearchControlState = Omit<ResearchState, "artifacts">;

export type ApprovalKind = "protocol-deviation";

export interface ApprovalRequest {
  kind: ApprovalKind;
  title: string;
  message: string;
  declineReason: string;
}

export interface GateDecision {
  block: boolean;
  reason?: string;
  approval?: ApprovalRequest;
}

export interface ToolGateDecision extends GateDecision {
  terminate?: boolean;
}

export interface StatusProjection {
  text: string;
  tone: "dim" | "success" | "warning" | "accent";
}
