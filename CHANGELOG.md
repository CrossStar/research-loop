# Changelog

All notable changes to Research Loop are documented in this file.

## Unreleased

## 0.6.0 - 2026-09-28

### Proposition-driven research chain

- Add propositions stored in `checkpoints/propositions/P{n}.md` and the `research_proposition` tool (create, revise, add_question, activate). Creating or revising a proposition requires user confirmation.
- Require Experiment Mode to answer one registered question of the active proposition and to register at least two predictions before the run.
- Restructure checkpoints around the chain of reasoning: plugin-written proposition summary and reasoning path, why the experiment was run, design with the verbatim predictions, observations, judgment against each prediction, the verdict on the proposition, and new questions with proposed experiments. Checkpoint frontmatter moves to `schema_version: 2`.
- After each checkpoint, present a handoff menu to choose the next question, add a question, or adopt a proposed proposition revision, then send an editable next-round instruction.
- Inject the active proposition, open questions, and recent checkpoints into the policy; show the proposition and question in the footer.
- Add `/proposition`, a proposition question-tree page and API to the Viewer, a proposition link on chained checkpoints, and a collapsed reproduction section.

### Experiment design

- Require every checkpoint to state its dataset (name, why it was chosen, basic facts or the synthetic generating process) and its key hyperparameters (value and reason). The plugin renders them at the start of the design section as a dataset block and a hyperparameter table, followed by the design thinking and the registered predictions.

### Mathematics and visuals

- Ask the agent to write every mathematical expression as LaTeX in replies and all research tool fields, to define symbols at first use, and to show numeric results as figures or tables.
- Render LaTeX with MathJax everywhere in the Viewer: proposition statements, question trees, answers, history, sidebar, and table cells containing `|`.
- Convert common LaTeX to Unicode for terminal display in checkpoint results, handoff menus, confirmation dialogs, and `/proposition`; files and agent-facing text keep the original LaTeX.
- Ask experiment code to save one labeled figure per main comparison under the run's `figures/` directory.

### Research governance

- Inject a Soft Review reminder into the Experiment Mode policy every six actions, asking the agent to checkpoint when the evidence already answers the question; previously it only appeared in the footer.
- Apply the reproduction scope-reduction approval to experiments declared with `intent: reproduction` instead of guessing from the user prompt wording.
- Narrow the scope-reduction patterns so ordinary slicing such as `print(logits[:5])` and file inspection such as `head -n 20 results.csv` no longer trigger approval; data slicing and `head -n N ... >` subsets still do.

### Removed

- Remove the Claude Code adapter: plugin manifest, hooks, MCP server, status line, subagents, skill, and their tests. Research Loop now targets Pi only.

## 0.5.4 - 2026-08-28

### Pi startup and artifact hygiene

- Return from `session_start` immediately after restoring compact control state; run artifact rediscovery and Radar startup in a generation-guarded, abortable background task.
- Prevent stale scans from a previous session from mutating the runtime after resume, switch, or shutdown.
- Disable Artifact Radar when Experiment Mode has no explicit artifact roots instead of recursively watching the complete project.
- Detect Python environments through `pyvenv.cfg`, project-local `VIRTUAL_ENV` and `CONDA_PREFIX`, plus a virtualenv-name fallback, and sanitize polluted roots during state restore and legacy migration.
- Add gitignore-compatible `.research-loopignore` rules for project-specific artifact exclusions and apply one path policy to root normalization, watcher events, and rediscovery traversal.
- Keep project-root artifact files as exact file roots instead of collapsing them to `.`.

## 0.5.3 - 2026-08-28

### Pi package installation

- Remove the package `prepare` hook so Pi installations that omit development dependencies do not try to import the development-only `esbuild` package.
- Continue loading the checked-in `dist/pi/index.js`; `npm run build:pi` remains an explicit contributor command.

## 0.5.2 - 2026-08-28

### Pi session performance

- Stop embedding the complete artifact inventory in append-only Pi session state; persist only compact `artifactRoots` and rebuild metadata from those project-local paths on demand.
- Restore the latest Research Loop state by walking from the current leaf instead of allocating and filtering the complete active branch.
- Run Artifact Radar only during Experiment Mode, prefer declared output roots, and stop its recursive watchers immediately on checkpoint, abort, mode exit, or Research Loop shutdown.
- Render Pi status without cloning the complete artifact inventory and migrate the latest legacy artifact snapshot to a roots-only control entry.
- Keep terminal evidence-image bytes out of persisted checkpoint tool details; load them from the original file only when an expanded TUI result needs a preview.
- Start the Checkpoint Viewer lazily on the first checkpoint or `/checkpoint-viewer` command instead of during session initialization.
- Load Pi from the checked-in `dist/pi/index.js` ESM bundle, generated by `npm run build:pi`, to avoid the TypeScript/Jiti module-graph cost on every session start.

## 0.5.1 - 2026-08-22

### Pi experiment code

- Inject a focused Experiment Mode code contract that prioritizes researcher readability, direct execution, Rich phase summaries, tqdm progress, centralized parameters, explicit randomness, inspectable intermediate results, predictable artifacts, and restrained architecture.
- Document the same contract in `docs/experiment-code.md` without adding a framework or runtime abstraction layer.

### Viewer binding

- Add `RESEARCH_LOOP_CHECKPOINT_HOST` with strict `127.0.0.1` (default) and opt-in `0.0.0.0` values.
- Warn when the unauthenticated Viewer is exposed on all IPv4 interfaces while retaining loopback plus SSH forwarding as the recommended remote workflow.

### Research execution

- Allow long-running, distributed, and scheduled Experiment Mode commands to start without a separate cost confirmation.
- Retain explicit approval for reproduction protocol deviations such as reduced samples, steps, seeds, or repeats.

### Documentation

- Refocus the repository README on the Pi plugin, including installation, updates, removal, work modes, checkpoints, artifacts, configuration, development, and security guidance.

## 0.5.0 - 2026-08-21

### Persistent Checkpoint Viewer

- Separate Pi checkpoint content from presentation: write long-lived `checkpoints/*/checkpoint.md` research notes and keep one plugin-owned Viewer.
- Replace the Pi checkpoint schema with a hybrid writer interface: four continuous Chinese Markdown sections plus structured protocol, reproduction and artifact metadata.
- Add filesystem discovery with JSON-compatible frontmatter and tolerant fallback for ordinary legacy Markdown.
- Add stable `/latest`, history `/`, per-checkpoint routes, API metadata, and symlink-aware project-bounded artifact serving without per-experiment HTML files.
- Render Markdown, currency-safe MathJax, GFM tables, figures, dynamic bar/line `checkpoint-chart` blocks, JSON key search, Raw JSON and CSV previews in the unified academic Viewer.
- Enforce formal visual units with titles above tables, titles below figures, a dedicated interpretation paragraph, and a light separator after each visual; reject “不是……而是……” and equivalent contrast constructions.
- Use TeX Main for Latin text and SimSun/Songti for Chinese checkpoint prose, with restrained non-synthetic weights.
- Print the complete SSH port-forward command on one copyable line.
- Keep real experiment artifacts in their original locations and rewrite project-relative Markdown references instead of copying or base64-embedding them.
- Keep this persistent writer/Viewer Pi-only for now; Claude MCP checkpoint behavior remains unchanged.

## 0.4.1 - 2026-08-21

### Checkpoint report fixes

- Omit the Formula-aware analysis section and navigation entry when a checkpoint contains no TeX math, and render only formula-bearing checkpoint passages when it does.
- Add a ready-to-copy SSH port-forward command below the rendered checkpoint URL, with `RESEARCH_LOOP_SSH_HOST` support for local SSH aliases.
- Add case-insensitive JSON key-name search in Tree mode while preserving raw key/value search in Raw mode.
- Render Pi checkpoint images through Chafa Sixel when available; retain Chafa symbols for `/artifacts` and native Pi image protocols as fallback.

## 0.4.0 - 2026-08-21

### Checkpoint presentation

- Start a session-scoped, localhost-only Pi checkpoint server on the first available port from a configurable base and append the rendered report URL to every checkpoint output.
- Render reports from the approved LaTeX-like HTML layout with formulas, tables, images, progressive experiment details, and an inspectable large-JSON viewer.
- Keep current-session checkpoint history in memory and clear it when the Pi session shuts down.
- Prefer Chafa for Pi terminal image previews, with Pi's native terminal-image protocols as the automatic fallback.

## 0.3.1 - 2026-08-20

### User decisions

- Detect the optional `ask_user_question` Pi tool and inject balanced guidance at material protocol, cost/scope trade-off, and next-experiment branch decisions.
- Surface questionnaire waits in the Pi footer without making the third-party package a hard dependency; cancelling the questionnaire aborts the current turn.
- Replace advisory cost and protocol blocks in Pi with real host confirmation dialogs; approval permits the exact action, while decline aborts the current turn.
- Stop the Pi agent turn when it repeats an unchanged blocked tool call, returning control instead of allowing an automatic retry loop.

## 0.3.0 - 2026-08-20

### Work modes

- Remove Normal Mode; Research Loop now exposes Brainstorming, Exploration, and Experiment.
- Start enabled sessions in Exploration and return there after checkpoint or abort.
- Treat ordinary implementation work as Research Loop OFF and migrate saved Normal state to Exploration.

## 0.2.0 - 2026-08-20

### Claude subagent support

- Add parent-owned read-only Subagent leases for built-in Explore and Plugin explorer/reviewer agents.
- Add dedicated `research-explorer` and `research-reviewer` Agent definitions.
- Split dispatch, lease, and append-only artifact event persistence for concurrent Subagents.
- Add Subagent lifecycle hooks, lifecycle ownership gates, and active-agent Status Line projection.
- Keep lifecycle transitions in MCP handlers and wait for active Subagents before changing state.
- Prevent Research Subagents from mutating parent lifecycle state.

### Agent guidance

- Replace governance-heavy mode, Skill, and Subagent prompts with concise task-oriented guidance.
- Stop reinjecting the full policy before every allowed tool call while retaining tool restrictions.
- Keep reproduction-setting reminders specific to active reproduction experiments.

### Pi footer status

- Move Pi Research Loop state from a full-width below-editor widget into the native footer status area.
- Match the Claude Terminal Rail semantics with compact lowercase labels and hollow/solid markers.
- Use Pi theme colors for OFF, modes, Experiment, Checkpoint, and soft-review states.

## 0.1.3 - 2026-08-19

### Changed

- Replace the verbose uppercase Claude Status Line with the approved Terminal Rail design.
- Keep a low-contrast OFF rail and use mode-specific Tokyo Night colors.
- Use hollow markers for passive modes and solid markers for Experiment and Checkpoint.
- Show concise mode semantics, pluralized counters, experiment intent and soft-review state.

Version 0.1.2 was withdrawn before stable distribution and is intentionally not reused.

## 0.1.1 - 2026-08-19

### Fixed

- Automatically install the Research Loop Status Line on the first Plugin session.
- Migrate the pre-rename `pi-research-loop` Status Line without losing the user's previous command.
- Preserve an explicit Status Line uninstall through a user opt-out marker.

## 0.1.0 - 2026-08-19

### Added

- Harness-neutral Research Core with shared state, Work Modes, Governor, Research Policy,
  Experiment lifecycle, Checkpoint normalization and Artifact metadata.
- Claude Code Plugin with Skill, lifecycle MCP tools and deterministic Hooks.
- Persistent Claude Research State and structured evidence Checkpoints.
- Composable Claude Status Line with installation and restoration support.
- Pi adapter backed by the shared Research Core.
- Self-hosted Claude Code Marketplace manifest.
