# AGENTS.md

This file is the Codex compatibility layer for the existing `.claude/` system.

Keep this file aligned with [CLAUDE.md](CLAUDE.md) as much as possible while adapting Claude-native concepts to Codex-native constructs.

Codex discovers project-local skills from `.agents/skills/`. In this repo, `.agents/skills/` is a symlink to `.claude/skills/` so Codex and Claude share the same underlying skill tree:

- `.claude/skills/` is the canonical source for shared skills and command-style workflows
- `.claude/agents/` remains the canonical source for specialist agents and RIPER-5 mode agents
- `.codex/agents/` mirrors `.claude/agents/` for Codex subagent roles
- shared reusable skills that Codex should discover must live under `.claude/skills/` as real `SKILL.md` files with YAML frontmatter; agent wrappers should not exist

Prefer updating `.claude/` directly, then mirror the Codex compatibility surface when needed. Because `.agents/skills/` resolves to the same folder, new skills added in either path appear in both places automatically.

## Project Overview

**AI Code Review** — Hybrid Node.js/Python static code scanner & AI code reviewer.

- **CLI + Web UI** (`packages/cli-global/`): Node.js ESM CLI (`ai-code-review` command), Express REST server, and vanilla JS dashboard
- **Analysis Engine** (`packages/analysis-core/`): Python 3.12 pipeline — Semgrep scanning → GitNexus AST enrichment → 9router AI remediation
- **Process Framework**: RIPER-5 spec-driven development (agents, protocols, plans in `process/` and `.claude/`)
- **Stack**: Node.js >= 18.3 (ESM, no TypeScript), Python 3.12 (unittest, no pyproject.toml), Express 4.x, Vitest, vanilla JS/CSS frontend

See `process/context/all-context.md` for full project context and conventions.

## RIPER-5 Spec-Driven Development System

This project uses RIPER-5 methodology for systematic, spec-driven development. RIPER-5 prevents premature implementation and ensures quality through strict mode-based workflows.

### Shared Development Protocols

Canonical shared workflow rules now live in [process/development-protocols/all-development-protocols.md](process/development-protocols/all-development-protocols.md).

Read these files as needed:

- [orchestration.md](process/development-protocols/orchestration.md)
- [implementation-standards.md](process/development-protocols/implementation-standards.md)
- [plan-lifecycle.md](process/development-protocols/plan-lifecycle.md)
- [phase-programs.md](process/development-protocols/phase-programs.md)
- [context-maintenance.md](process/development-protocols/context-maintenance.md)
- [parallel-fan-out.md](process/development-protocols/parallel-fan-out.md)
- [intent-clarification.md](process/development-protocols/intent-clarification.md)

### Orchestrator Role (Main Codex Session)

Delegation rules, subagent status codes (`DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, `NEEDS_CONTEXT`), and context isolation protocol live in [process/development-protocols/orchestration.md](process/development-protocols/orchestration.md).

You are the orchestrator, not the worker.

Your responsibilities:

1. Detect user intent (feature request, question, trivial fix)
2. Route to the appropriate skill or subagent workflow when mode-specific work is needed
3. Pass context efficiently (attach relevant files, summarize request)
4. Monitor protocol compliance (ensure mode workflows follow RIPER-5)

You do NOT:

- Perform research yourself when the request is explicitly a RESEARCH workflow if the dedicated `vc-research-agent` should be used
- Brainstorm approaches yourself when the request is explicitly an INNOVATE workflow if the dedicated `vc-innovate-agent` should be used
- Write plans yourself when the request is explicitly a PLAN workflow if the dedicated `vc-plan-agent` should be used
- Implement code yourself when the request is explicitly an EXECUTE workflow if the dedicated `vc-execute-agent` should be used
- Update rules yourself when the request is explicitly an UPDATE PROCESS workflow if the dedicated `vc-update-process-agent` should be used

Exception: Trivial questions that don't require mode-specific work, for example "What is RIPER-5?", can be answered directly.

### Repository Context

Authoritative context for this repository:

[process/context/all-context.md](process/context/all-context.md)

Contains:

- Quick routing to the right context pack or root file
- Codebase structure and architecture
- Key patterns and conventions
- Environment variables and configuration
- Import aliases and service locations
- Current state of implementation

Before substantial planning or implementation work, consult:

- [process/context/all-context.md](process/context/all-context.md)
- [process/development-protocols/all-development-protocols.md](process/development-protocols/all-development-protocols.md)
- [.claude/memory/MEMORY.md](.claude/memory/MEMORY.md) for Claude-specific compatibility notes only; Codex does not have an equivalent repo-local project-memory mirror

**Context routing discipline:** `all-*.md` entrypoints are routers, not the full knowledge. Agents MUST follow the routing tables in `all-*.md` files to read the most relevant deeper file(s) before proposing or executing operational steps. Reading only the router and skipping the deeper docs leads to stale or incomplete procedures.

### Core Protocol

The complete RIPER-5 protocol is defined in the real agent files at `.claude/agents/` and mirrored for Codex through `.codex/agents/`:

- [.claude/agents/vc-research-agent.md](.claude/agents/vc-research-agent.md)
- [.claude/agents/vc-innovate-agent.md](.claude/agents/vc-innovate-agent.md)
- [.claude/agents/vc-plan-agent.md](.claude/agents/vc-plan-agent.md)
- [.claude/agents/vc-execute-agent.md](.claude/agents/vc-execute-agent.md)
- [.claude/agents/vc-fast-mode-agent.md](.claude/agents/vc-fast-mode-agent.md)
- [.claude/agents/vc-update-process-agent.md](.claude/agents/vc-update-process-agent.md)
- `.codex/agents/*.toml` mirrors the same agent roster for Codex

The orchestrator operates outside the RIPER-5 phase modes. It routes, delegates, and monitors. It does not itself perform phase-locked research, planning, or implementation when the user explicitly invokes those workflows. Mode prefix is informational for the orchestrator.

Key Requirements:

- Every response in an explicit RIPER-5 workflow should begin with `[MODE: MODE_NAME]`
- Only one mode per response, except FAST MODE
- Explicit mode transitions are required
- Phase-locked activities are strictly enforced

### Mode Detection & Auto-Orchestration

Auto-Detection Patterns:

- Feature requests -> Step 0 skill discovery -> vc-research-agent -> INNOVATE -> PLAN -> EXECUTE
- Questions -> vc-research-agent for non-trivial investigation or direct answer for trivial conceptual questions
- Trivial fixes -> vc-execute-agent directly with no plan required
- Bug/debug -> vc-debugger as the default actor; helper skills like `vc-scout`, `vc-sequential-thinking`, and `vc-problem-solving` may assist
- UI/frontend -> surface vc-frontend-design skill plus vc-research-agent
- Refactor/simplify -> vc-code-simplifier for pure style or RESEARCH -> PLAN -> EXECUTE for behavioral refactors
- Missing context -> suggest the `vc-generate-context` skill
- Existing plan file -> scan `process/general-plans/active/` and `process/features/*/active/`, confirm with user, resume from last phase

Large program rule:

- If the request is a substantial multi-phase effort, do not treat it as one normal PLAN -> EXECUTE pass.
- Use `process/development-protocols/phase-programs.md`.
- First recommend the plan shape, sequencing, and next actions.
- Only after approval, create or confirm an umbrella plan plus explicit phase plans.
- Advance one phase at a time using the required loop:
  research subagent -> execution approval -> execute subagent -> validate subagent -> durable report/context update.
- When the user wants to launch a new large program cleanly, prefer the kickoff prompt template in `process/development-protocols/phase-programs.md` rather than freehanding the structure.

Intent clarification: Before auto-routing, the orchestrator scores request ambiguity per `process/development-protocols/intent-clarification.md`. Clear requests (score 0-1) auto-route silently. Ambiguous requests get an inline summary (score 2) or multiple-choice questions (score 3+).

When the user explicitly invokes one of the mode names or command names from the previous `.claude` workflow, prefer the corresponding real agent definition in `.claude/agents/` / `.codex/agents/` or the surviving real skill in `.agents/skills/`.

### Engineering Standards

Global best practices and coding conventions apply:

- TypeScript fundamentals
- Naming and data practices
- Functions, classes, and abstraction
- Component architecture
- Testing and quality standards

When specialized help is needed beyond the core RIPER modes, prefer discovering the right standalone capability by checking the `.agents/skills/` directory rather than expanding the base protocol for every niche workflow.

### Technology Stack

See `process/context/all-context.md` for project technology stack, structure, and key technologies.

## Shared Process Folder

Codex and Claude share the `process/` directory:

### `process/general-plans/`

Default new feature plans use date-stamped naming: `[feature]_PLAN_[dd-mm-yy].md`

- Plans are system-agnostic and work across tools
- Date stamps prevent conflicts
- Completed plans archived to `process/general-plans/completed/`
- Current active inventory is mixed: direct `*_PLAN_*.md` files are the default, but legacy `PLAN.md`, `plan.md`, and `phase-*.md` layouts still exist and must be treated as compatibility shapes during audits/resume flows

### `process/context/`

Source of truth for project-specific knowledge. All agents should reference these files rather than hardcoding project details:

- `all-context.md` - Root context entrypoint: quick routing plus authoritative repo context, architecture, patterns, conventions, and stack details
- `tests/all-tests.md` - Testing quick-start, runner selection, commands, debugging procedures, and routing to deeper testing docs
- `planning/example-simple-prd.md` - Reference for simple plan structure
- `planning/example-complex-prd.md` - Reference for complex plan depth

Context discovery rule: read `process/context/all-context.md` first, then load only the relevant root file or context group. Context groups are durable knowledge domains, not feature folders. Every group must have an `all-{group}.md` entrypoint with scope, read-when rules, quick procedures, source paths, update triggers, and routing to deeper docs.

Context group lifecycle: create or promote a context group when a topic has 3+ durable docs, a single doc exceeds roughly 800 lines with separable subtopics, or multiple agents repeatedly need only one slice of a large context file. Move/split one group at a time, use `all-*.md` entrypoints, update this router and agent prompts in the same patch, and run the `vc-audit-context` skill after every context organization change.

### `process/features/`

Feature-scoped storage for large feature clusters. Each feature folder contains:

- `active/` - In-progress plans
- `completed/` - Archived completed plans
- `backlog/` - Deferred/future plans
- `reports/` - Feature-specific operational reports
- `references/` - Feature-specific research and reference documents

See `process/context/all-context.md` for current feature list.

Routing rule: When a feature has 5+ artifacts, store new plans/reports in `process/features/{feature}/`. General or cross-cutting items go in `process/general-plans/` with `reports/` and `references/` inside.

When routing to a subagent for a feature-scoped task, include `Feature: {feature-name}` in the prompt and override paths:

- `Reports: {work_context}/process/features/{feature}/reports/`
- `Plans: {work_context}/process/features/{feature}/active/`

#### Feature Folder Lifecycle

At plan creation time, use this decision logic:

| Signal | Action |
|--------|--------|
| `process/features/{topic}/` already exists | Use it; pass `Feature: {topic}` to subagent |
| Topic clearly belongs to an existing feature | Use that feature's folder |
| New multi-phase project with 3+ planned phases | Create feature folder upfront |
| User says "this is a big feature" or names a product area | Create feature folder upfront |
| Single plan, no backlog, unclear scope | Use `process/general-plans/active/` |
| Cross-cutting work touching multiple features | Use general folders |

Promotion protocol from general to feature folder:

1. Create `process/features/{new-feature}/` with subdirs: `active/`, `completed/`, `backlog/`, `reports/`, `references/`
2. Move related artifacts from `process/general-plans/`, including reports and references, into the new feature's subdirs
3. Update the Current features list in `process/context/all-context.md`
4. Inform subagents of the new feature scope going forward

Feature list maintenance: The Current features list in `process/context/all-context.md` must be updated whenever a new feature folder is created or an empty one is removed.

---

## Repository Structure

```
./
  .agents/           → .claude/skills/ (junction)
  .claude/
    agents/          – 12 RIPER-5 agent definitions
    skills/          – 32 skill directories (SKILL.md + refs/scripts)
    hooks/           – Session lifecycle hooks
  .codex/            – Codex mirror of .claude/ agents + hooks
  packages/
    cli-global/      – Node.js ESM CLI + Express API + Web UI
    analysis-core/   – Python 3.12 security analysis engine
  process/
    context/         – Durable repo knowledge (all-context.md)
    development-protocols/ – Workflow rules (orchestration, implementation-standards, etc.)
    features/        – Feature-scoped clusters ({feature}/active/, completed/, etc.)
    general-plans/   – Cross-cutting plans (active/, completed/, backlog/)
  AGENTS.md           – This file
  CLAUDE.md           – Claude-specific orchestrator rules
  opencode.json       – OpenCode/Codex config
  vc-manifest.json    – Kit manifest
  resolve-manifest.mjs – Manifest resolver
```

## Where to Look

| Task | Start Here |
|------|------------|
| Agent harness, RIPER-5 modes, skills, hooks | `.claude/agents/`, `.claude/skills/`, `process/development-protocols/` |
| Python analysis engine | `packages/analysis-core/` ([AGENTS.md](packages/analysis-core/AGENTS.md)) |
| Node.js CLI + Express + Web UI | `packages/cli-global/` ([AGENTS.md](packages/cli-global/AGENTS.md)) |
| Project context & conventions | `process/context/all-context.md` |
| Active plans | `process/general-plans/active/`, `process/features/*/active/` |
| Test docs | `process/context/tests/all-tests.md` |
| UI/UX guidelines | `process/context/uxui/all-uxui.md` |
| Plan format examples | `process/context/planning/all-planning.md` |

## Commands

```bash
# --- Node.js CLI (packages/cli-global) ---
cd packages/cli-global
npm install                # Install deps (Node >= 18.3)
npm test                   # vitest run (3 test suites)

# CLI usage (via npm link or directly):
node bin/cli.js scan --target <dir>          # Full scan
node bin/cli.js scan --target <dir> --mock-scan --mock-ai  # Offline mode
node bin/cli.js serve --port 3000            # Express dashboard

# --- Python analysis engine (packages/analysis-core) ---
cd packages/analysis-core
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt  # Windows
python -m unittest test_ast_graph.py         # Run Python tests

python main.py --target <dir> --output report.json           # Full pipeline
python main.py --target <dir> --mock-scan --mock-ai          # Offline
```

**No CI/CD pipeline configured.** No linter/formatter configured.

## Anti-Patterns (This Project)

| Rule | Source |
|------|--------|
| **NEVER** commit secrets or credentials | implementation-standards.md |
| **NEVER** paper over a regression — classify and record it | phase-programs.md |
| **NEVER** ignore BLOCKED or NEEDS_CONTEXT subagent status | orchestration.md |
| **NEVER** retry the exact same blocked approach 3+ times | orchestration.md |
| **NEVER** wave away failing tests to force green status | implementation-standards.md |
| **NEVER** auto-archive a plan without user-visible action | orchestration.md |
| **NEVER** silently widen scope across phases | phase-programs.md |
| **NEVER** load whole `process/context/` tree — read router first | all-context.md |
| **DO NOT** jump from phase plan to implementation without fresh research | phase-programs.md |
| **DO NOT** run a multi-phase program as one giant EXECUTE pass | phase-programs.md |
| **DO NOT** assume every feature folder has active plans | plan-lifecycle.md |
| **DO NOT** add features not in the approved plan (scope creep) | example-complex-prd.md |
| **MUST** keep TS/JS source files under ~200 lines (markdown exempt) | implementation-standards.md |
| **MUST** use result objects over throwing for recoverable errors | implementation-standards.md |
# AGENTS.md

This file is the Codex compatibility layer for the existing `.claude/` system.

Keep this file aligned with [CLAUDE.md](CLAUDE.md) as much as possible while adapting Claude-native concepts to Codex-native constructs.

Codex discovers project-local skills from `.agents/skills/`. In this repo, `.agents/skills/` is a symlink to `.claude/skills/` so Codex and Claude share the same underlying skill tree:

- `.claude/skills/` is the canonical source for shared skills and command-style workflows
- `.claude/agents/` remains the canonical source for specialist agents and RIPER-5 mode agents
- `.codex/agents/` mirrors `.claude/agents/` for Codex subagent roles
- shared reusable skills that Codex should discover must live under `.claude/skills/` as real `SKILL.md` files with YAML frontmatter; agent wrappers should not exist

Prefer updating `.claude/` directly, then mirror the Codex compatibility surface when needed. Because `.agents/skills/` resolves to the same folder, new skills added in either path appear in both places automatically.

## Project Overview

**AI Code Review** — Hybrid Node.js/Python static code scanner & AI code reviewer.

- **CLI + Web UI** (`packages/cli-global/`): Node.js ESM CLI (`ai-code-review` command), Express REST server, and vanilla JS dashboard
- **Analysis Engine** (`packages/analysis-core/`): Python 3.12 pipeline — Semgrep scanning → GitNexus AST enrichment → 9router AI remediation
- **Process Framework**: RIPER-5 spec-driven development (agents, protocols, plans in `process/` and `.claude/`)
- **Stack**: Node.js >= 18.3 (ESM, no TypeScript), Python 3.12 (unittest, no pyproject.toml), Express 4.x, Vitest, vanilla JS/CSS frontend

See `process/context/all-context.md` for full project context and conventions.

## RIPER-5 Spec-Driven Development System

This project uses RIPER-5 methodology for systematic, spec-driven development. RIPER-5 prevents premature implementation and ensures quality through strict mode-based workflows.

### Shared Development Protocols

Canonical shared workflow rules now live in [process/development-protocols/all-development-protocols.md](process/development-protocols/all-development-protocols.md).

Read these files as needed:

- [orchestration.md](process/development-protocols/orchestration.md)
- [implementation-standards.md](process/development-protocols/implementation-standards.md)
- [plan-lifecycle.md](process/development-protocols/plan-lifecycle.md)
- [phase-programs.md](process/development-protocols/phase-programs.md)
- [context-maintenance.md](process/development-protocols/context-maintenance.md)
- [parallel-fan-out.md](process/development-protocols/parallel-fan-out.md)
- [intent-clarification.md](process/development-protocols/intent-clarification.md)

### Orchestrator Role (Main Codex Session)

Delegation rules, subagent status codes (`DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, `NEEDS_CONTEXT`), and context isolation protocol live in [process/development-protocols/orchestration.md](process/development-protocols/orchestration.md).

You are the orchestrator, not the worker.

Your responsibilities:

1. Detect user intent (feature request, question, trivial fix)
2. Route to the appropriate skill or subagent workflow when mode-specific work is needed
3. Pass context efficiently (attach relevant files, summarize request)
4. Monitor protocol compliance (ensure mode workflows follow RIPER-5)

You do NOT:

- Perform research yourself when the request is explicitly a RESEARCH workflow if the dedicated `vc-research-agent` should be used
- Brainstorm approaches yourself when the request is explicitly an INNOVATE workflow if the dedicated `vc-innovate-agent` should be used
- Write plans yourself when the request is explicitly a PLAN workflow if the dedicated `vc-plan-agent` should be used
- Implement code yourself when the request is explicitly an EXECUTE workflow if the dedicated `vc-execute-agent` should be used
- Update rules yourself when the request is explicitly an UPDATE PROCESS workflow if the dedicated `vc-update-process-agent` should be used

Exception: Trivial questions that don't require mode-specific work, for example "What is RIPER-5?", can be answered directly.

### Repository Context

Authoritative context for this repository:

[process/context/all-context.md](process/context/all-context.md)

Contains:

- Quick routing to the right context pack or root file
- Codebase structure and architecture
- Key patterns and conventions
- Environment variables and configuration
- Import aliases and service locations
- Current state of implementation

Before substantial planning or implementation work, consult:

- [process/context/all-context.md](process/context/all-context.md)
- [process/development-protocols/all-development-protocols.md](process/development-protocols/all-development-protocols.md)
- [.claude/memory/MEMORY.md](.claude/memory/MEMORY.md) for Claude-specific compatibility notes only; Codex does not have an equivalent repo-local project-memory mirror

**Context routing discipline:** `all-*.md` entrypoints are routers, not the full knowledge. Agents MUST follow the routing tables in `all-*.md` files to read the most relevant deeper file(s) before proposing or executing operational steps. Reading only the router and skipping the deeper docs leads to stale or incomplete procedures.

### Core Protocol

The complete RIPER-5 protocol is defined in the real agent files at `.claude/agents/` and mirrored for Codex through `.codex/agents/`:

- [.claude/agents/vc-research-agent.md](.claude/agents/vc-research-agent.md)
- [.claude/agents/vc-innovate-agent.md](.claude/agents/vc-innovate-agent.md)
- [.claude/agents/vc-plan-agent.md](.claude/agents/vc-plan-agent.md)
- [.claude/agents/vc-execute-agent.md](.claude/agents/vc-execute-agent.md)
- [.claude/agents/vc-fast-mode-agent.md](.claude/agents/vc-fast-mode-agent.md)
- [.claude/agents/vc-update-process-agent.md](.claude/agents/vc-update-process-agent.md)
- `.codex/agents/*.toml` mirrors the same agent roster for Codex

The orchestrator operates outside the RIPER-5 phase modes. It routes, delegates, and monitors. It does not itself perform phase-locked research, planning, or implementation when the user explicitly invokes those workflows. Mode prefix is informational for the orchestrator.

Key Requirements:

- Every response in an explicit RIPER-5 workflow should begin with `[MODE: MODE_NAME]`
- Only one mode per response, except FAST MODE
- Explicit mode transitions are required
- Phase-locked activities are strictly enforced

### Mode Detection & Auto-Orchestration

Auto-Detection Patterns:

- Feature requests -> Step 0 skill discovery -> vc-research-agent -> INNOVATE -> PLAN -> EXECUTE
- Questions -> vc-research-agent for non-trivial investigation or direct answer for trivial conceptual questions
- Trivial fixes -> vc-execute-agent directly with no plan required
- Bug/debug -> vc-debugger as the default actor; helper skills like `vc-scout`, `vc-sequential-thinking`, and `vc-problem-solving` may assist
- UI/frontend -> surface vc-frontend-design skill plus vc-research-agent
- Refactor/simplify -> vc-code-simplifier for pure style or RESEARCH -> PLAN -> EXECUTE for behavioral refactors
- Missing context -> suggest the `vc-generate-context` skill
- Existing plan file -> scan `process/general-plans/active/` and `process/features/*/active/`, confirm with user, resume from last phase

Large program rule:

- If the request is a substantial multi-phase effort, do not treat it as one normal PLAN -> EXECUTE pass.
- Use `process/development-protocols/phase-programs.md`.
- First recommend the plan shape, sequencing, and next actions.
- Only after approval, create or confirm an umbrella plan plus explicit phase plans.
- Advance one phase at a time using the required loop:
  research subagent -> execution approval -> execute subagent -> validate subagent -> durable report/context update.
- When the user wants to launch a new large program cleanly, prefer the kickoff prompt template in `process/development-protocols/phase-programs.md` rather than freehanding the structure.

Intent clarification: Before auto-routing, the orchestrator scores request ambiguity per `process/development-protocols/intent-clarification.md`. Clear requests (score 0-1) auto-route silently. Ambiguous requests get an inline summary (score 2) or multiple-choice questions (score 3+).

When the user explicitly invokes one of the mode names or command names from the previous `.claude` workflow, prefer the corresponding real agent definition in `.claude/agents/` / `.codex/agents/` or the surviving real skill in `.agents/skills/`.

### Engineering Standards

Global best practices and coding conventions apply:

- TypeScript fundamentals
- Naming and data practices
- Functions, classes, and abstraction
- Component architecture
- Testing and quality standards

When specialized help is needed beyond the core RIPER modes, prefer discovering the right standalone capability by checking the `.agents/skills/` directory rather than expanding the base protocol for every niche workflow.

### Technology Stack

See `process/context/all-context.md` for project technology stack, structure, and key technologies.

## Shared Process Folder

Codex and Claude share the `process/` directory:

### `process/general-plans/`

Default new feature plans use date-stamped naming: `[feature]_PLAN_[dd-mm-yy].md`

- Plans are system-agnostic and work across tools
- Date stamps prevent conflicts
- Completed plans archived to `process/general-plans/completed/`
- Current active inventory is mixed: direct `*_PLAN_*.md` files are the default, but legacy `PLAN.md`, `plan.md`, and `phase-*.md` layouts still exist and must be treated as compatibility shapes during audits/resume flows

### `process/context/`

Source of truth for project-specific knowledge. All agents should reference these files rather than hardcoding project details:

- `all-context.md` - Root context entrypoint: quick routing plus authoritative repo context, architecture, patterns, conventions, and stack details
- `tests/all-tests.md` - Testing quick-start, runner selection, commands, debugging procedures, and routing to deeper testing docs
- `planning/example-simple-prd.md` - Reference for simple plan structure
- `planning/example-complex-prd.md` - Reference for complex plan depth

Context discovery rule: read `process/context/all-context.md` first, then load only the relevant root file or context group. Context groups are durable knowledge domains, not feature folders. Every group must have an `all-{group}.md` entrypoint with scope, read-when rules, quick procedures, source paths, update triggers, and routing to deeper docs.

Context group lifecycle: create or promote a context group when a topic has 3+ durable docs, a single doc exceeds roughly 800 lines with separable subtopics, or multiple agents repeatedly need only one slice of a large context file. Move/split one group at a time, use `all-*.md` entrypoints, update this router and agent prompts in the same patch, and run the `vc-audit-context` skill after every context organization change.

### `process/features/`

Feature-scoped storage for large feature clusters. Each feature folder contains:

- `active/` - In-progress plans
- `completed/` - Archived completed plans
- `backlog/` - Deferred/future plans
- `reports/` - Feature-specific operational reports
- `references/` - Feature-specific research and reference documents

See `process/context/all-context.md` for current feature list.

Routing rule: When a feature has 5+ artifacts, store new plans/reports in `process/features/{feature}/`. General or cross-cutting items go in `process/general-plans/` with `reports/` and `references/` inside.

When routing to a subagent for a feature-scoped task, include `Feature: {feature-name}` in the prompt and override paths:

- `Reports: {work_context}/process/features/{feature}/reports/`
- `Plans: {work_context}/process/features/{feature}/active/`

#### Feature Folder Lifecycle

At plan creation time, use this decision logic:

| Signal | Action |
|--------|--------|
| `process/features/{topic}/` already exists | Use it; pass `Feature: {topic}` to subagent |
| Topic clearly belongs to an existing feature | Use that feature's folder |
| New multi-phase project with 3+ planned phases | Create feature folder upfront |
| User says "this is a big feature" or names a product area | Create feature folder upfront |
| Single plan, no backlog, unclear scope | Use `process/general-plans/active/` |
| Cross-cutting work touching multiple features | Use general folders |

Promotion protocol from general to feature folder:

1. Create `process/features/{new-feature}/` with subdirs: `active/`, `completed/`, `backlog/`, `reports/`, `references/`
2. Move related artifacts from `process/general-plans/`, including reports and references, into the new feature's subdirs
3. Update the Current features list in `process/context/all-context.md`
4. Inform subagents of the new feature scope going forward

Feature list maintenance: The Current features list in `process/context/all-context.md` must be updated whenever a new feature folder is created or an empty one is removed.

---

## Repository Structure

```
./
  .agents/           → .claude/skills/ (junction)
  .claude/
    agents/          – 12 RIPER-5 agent definitions
    skills/          – 32 skill directories (SKILL.md + refs/scripts)
    hooks/           – Session lifecycle hooks
  .codex/            – Codex mirror of .claude/ agents + hooks
  packages/
    cli-global/      – Node.js ESM CLI + Express API + Web UI
    analysis-core/   – Python 3.12 security analysis engine
  process/
    context/         – Durable repo knowledge (all-context.md)
    development-protocols/ – Workflow rules (orchestration, implementation-standards, etc.)
    features/        – Feature-scoped clusters ({feature}/active/, completed/, etc.)
    general-plans/   – Cross-cutting plans (active/, completed/, backlog/)
  AGENTS.md           – This file
  CLAUDE.md           – Claude-specific orchestrator rules
  opencode.json       – OpenCode/Codex config
  vc-manifest.json    – Kit manifest
  resolve-manifest.mjs – Manifest resolver
```

## Where to Look

| Task | Start Here |
|------|------------|
| Agent harness, RIPER-5 modes, skills, hooks | `.claude/agents/`, `.claude/skills/`, `process/development-protocols/` |
| Python analysis engine | `packages/analysis-core/` ([AGENTS.md](packages/analysis-core/AGENTS.md)) |
| Node.js CLI + Express + Web UI | `packages/cli-global/` ([AGENTS.md](packages/cli-global/AGENTS.md)) |
| Project context & conventions | `process/context/all-context.md` |
| Active plans | `process/general-plans/active/`, `process/features/*/active/` |
| Test docs | `process/context/tests/all-tests.md` |
| UI/UX guidelines | `process/context/uxui/all-uxui.md` |
| Plan format examples | `process/context/planning/all-planning.md` |

## Commands

```bash
# --- Node.js CLI (packages/cli-global) ---
cd packages/cli-global
npm install                # Install deps (Node >= 18.3)
npm test                   # vitest run (3 test suites)

# CLI usage (via npm link or directly):
node bin/cli.js scan --target <dir>          # Full scan
node bin/cli.js scan --target <dir> --mock-scan --mock-ai  # Offline mode
node bin/cli.js serve --port 3000            # Express dashboard

# --- Python analysis engine (packages/analysis-core) ---
cd packages/analysis-core
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt  # Windows
python -m unittest test_ast_graph.py         # Run Python tests

python main.py --target <dir> --output report.json           # Full pipeline
python main.py --target <dir> --mock-scan --mock-ai          # Offline
```

**No CI/CD pipeline configured.** No linter/formatter configured.

## Anti-Patterns (This Project)

| Rule | Source |
|------|--------|
| **NEVER** commit secrets or credentials | implementation-standards.md |
| **NEVER** paper over a regression — classify and record it | phase-programs.md |
| **NEVER** ignore BLOCKED or NEEDS_CONTEXT subagent status | orchestration.md |
| **NEVER** retry the exact same blocked approach 3+ times | orchestration.md |
| **NEVER** wave away failing tests to force green status | implementation-standards.md |
| **NEVER** auto-archive a plan without user-visible action | orchestration.md |
| **NEVER** silently widen scope across phases | phase-programs.md |
| **NEVER** load whole `process/context/` tree — read router first | all-context.md |
| **DO NOT** jump from phase plan to implementation without fresh research | phase-programs.md |
| **DO NOT** run a multi-phase program as one giant EXECUTE pass | phase-programs.md |
| **DO NOT** assume every feature folder has active plans | plan-lifecycle.md |
| **DO NOT** add features not in the approved plan (scope creep) | example-complex-prd.md |
| **MUST** keep TS/JS source files under ~200 lines (markdown exempt) | implementation-standards.md |
| **MUST** use result objects over throwing for recoverable errors | implementation-standards.md |
# AGENTS.md

This file is the Codex compatibility layer for the existing `.claude/` system.

Keep this file aligned with [CLAUDE.md](CLAUDE.md) as much as possible while adapting Claude-native concepts to Codex-native constructs.

Codex discovers project-local skills from `.agents/skills/`. In this repo, `.agents/skills/` is a symlink to `.claude/skills/` so Codex and Claude share the same underlying skill tree:

- `.claude/skills/` is the canonical source for shared skills and command-style workflows
- `.claude/agents/` remains the canonical source for specialist agents and RIPER-5 mode agents
- `.codex/agents/` mirrors `.claude/agents/` for Codex subagent roles
- shared reusable skills that Codex should discover must live under `.claude/skills/` as real `SKILL.md` files with YAML frontmatter; agent wrappers should not exist

Prefer updating `.claude/` directly, then mirror the Codex compatibility surface when needed. Because `.agents/skills/` resolves to the same folder, new skills added in either path appear in both places automatically.

## Project Overview

**AI Code Review** — Hybrid Node.js/Python static code scanner & AI code reviewer.

- **CLI + Web UI** (`packages/cli-global/`): Node.js ESM CLI (`ai-code-review` command), Express REST server, and vanilla JS dashboard
- **Analysis Engine** (`packages/analysis-core/`): Python 3.12 pipeline — Semgrep scanning → GitNexus AST enrichment → 9router AI remediation
- **Process Framework**: RIPER-5 spec-driven development (agents, protocols, plans in `process/` and `.claude/`)
- **Stack**: Node.js >= 18.3 (ESM, no TypeScript), Python 3.12 (unittest, no pyproject.toml), Express 4.x, Vitest, vanilla JS/CSS frontend

See `process/context/all-context.md` for full project context and conventions.

## RIPER-5 Spec-Driven Development System

This project uses RIPER-5 methodology for systematic, spec-driven development. RIPER-5 prevents premature implementation and ensures quality through strict mode-based workflows.

### Shared Development Protocols

Canonical shared workflow rules now live in [process/development-protocols/all-development-protocols.md](process/development-protocols/all-development-protocols.md).

Read these files as needed:

- [orchestration.md](process/development-protocols/orchestration.md)
- [implementation-standards.md](process/development-protocols/implementation-standards.md)
- [plan-lifecycle.md](process/development-protocols/plan-lifecycle.md)
- [phase-programs.md](process/development-protocols/phase-programs.md)
- [context-maintenance.md](process/development-protocols/context-maintenance.md)
- [parallel-fan-out.md](process/development-protocols/parallel-fan-out.md)
- [intent-clarification.md](process/development-protocols/intent-clarification.md)

### Orchestrator Role (Main Codex Session)

Delegation rules, subagent status codes (`DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, `NEEDS_CONTEXT`), and context isolation protocol live in [process/development-protocols/orchestration.md](process/development-protocols/orchestration.md).

You are the orchestrator, not the worker.

Your responsibilities:

1. Detect user intent (feature request, question, trivial fix)
2. Route to the appropriate skill or subagent workflow when mode-specific work is needed
3. Pass context efficiently (attach relevant files, summarize request)
4. Monitor protocol compliance (ensure mode workflows follow RIPER-5)

You do NOT:

- Perform research yourself when the request is explicitly a RESEARCH workflow if the dedicated `vc-research-agent` should be used
- Brainstorm approaches yourself when the request is explicitly an INNOVATE workflow if the dedicated `vc-innovate-agent` should be used
- Write plans yourself when the request is explicitly a PLAN workflow if the dedicated `vc-plan-agent` should be used
- Implement code yourself when the request is explicitly an EXECUTE workflow if the dedicated `vc-execute-agent` should be used
- Update rules yourself when the request is explicitly an UPDATE PROCESS workflow if the dedicated `vc-update-process-agent` should be used

Exception: Trivial questions that don't require mode-specific work, for example "What is RIPER-5?", can be answered directly.

### Repository Context

Authoritative context for this repository:

[process/context/all-context.md](process/context/all-context.md)

Contains:

- Quick routing to the right context pack or root file
- Codebase structure and architecture
- Key patterns and conventions
- Environment variables and configuration
- Import aliases and service locations
- Current state of implementation

Before substantial planning or implementation work, consult:

- [process/context/all-context.md](process/context/all-context.md)
- [process/development-protocols/all-development-protocols.md](process/development-protocols/all-development-protocols.md)
- [.claude/memory/MEMORY.md](.claude/memory/MEMORY.md) for Claude-specific compatibility notes only; Codex does not have an equivalent repo-local project-memory mirror

**Context routing discipline:** `all-*.md` entrypoints are routers, not the full knowledge. Agents MUST follow the routing tables in `all-*.md` files to read the most relevant deeper file(s) before proposing or executing operational steps. Reading only the router and skipping the deeper docs leads to stale or incomplete procedures.

### Core Protocol

The complete RIPER-5 protocol is defined in the real agent files at `.claude/agents/` and mirrored for Codex through `.codex/agents/`:

- [.claude/agents/vc-research-agent.md](.claude/agents/vc-research-agent.md)
- [.claude/agents/vc-innovate-agent.md](.claude/agents/vc-innovate-agent.md)
- [.claude/agents/vc-plan-agent.md](.claude/agents/vc-plan-agent.md)
- [.claude/agents/vc-execute-agent.md](.claude/agents/vc-execute-agent.md)
- [.claude/agents/vc-fast-mode-agent.md](.claude/agents/vc-fast-mode-agent.md)
- [.claude/agents/vc-update-process-agent.md](.claude/agents/vc-update-process-agent.md)
- `.codex/agents/*.toml` mirrors the same agent roster for Codex

The orchestrator operates outside the RIPER-5 phase modes. It routes, delegates, and monitors. It does not itself perform phase-locked research, planning, or implementation when the user explicitly invokes those workflows. Mode prefix is informational for the orchestrator.

Key Requirements:

- Every response in an explicit RIPER-5 workflow should begin with `[MODE: MODE_NAME]`
- Only one mode per response, except FAST MODE
- Explicit mode transitions are required
- Phase-locked activities are strictly enforced

### Mode Detection & Auto-Orchestration

Auto-Detection Patterns:

- Feature requests -> Step 0 skill discovery -> vc-research-agent -> INNOVATE -> PLAN -> EXECUTE
- Questions -> vc-research-agent for non-trivial investigation or direct answer for trivial conceptual questions
- Trivial fixes -> vc-execute-agent directly with no plan required
- Bug/debug -> vc-debugger as the default actor; helper skills like `vc-scout`, `vc-sequential-thinking`, and `vc-problem-solving` may assist
- UI/frontend -> surface vc-frontend-design skill plus vc-research-agent
- Refactor/simplify -> vc-code-simplifier for pure style or RESEARCH -> PLAN -> EXECUTE for behavioral refactors
- Missing context -> suggest the `vc-generate-context` skill
- Existing plan file -> scan `process/general-plans/active/` and `process/features/*/active/`, confirm with user, resume from last phase

Large program rule:

- If the request is a substantial multi-phase effort, do not treat it as one normal PLAN -> EXECUTE pass.
- Use `process/development-protocols/phase-programs.md`.
- First recommend the plan shape, sequencing, and next actions.
- Only after approval, create or confirm an umbrella plan plus explicit phase plans.
- Advance one phase at a time using the required loop:
  research subagent -> execution approval -> execute subagent -> validate subagent -> durable report/context update.
- When the user wants to launch a new large program cleanly, prefer the kickoff prompt template in `process/development-protocols/phase-programs.md` rather than freehanding the structure.

Intent clarification: Before auto-routing, the orchestrator scores request ambiguity per `process/development-protocols/intent-clarification.md`. Clear requests (score 0-1) auto-route silently. Ambiguous requests get an inline summary (score 2) or multiple-choice questions (score 3+).

When the user explicitly invokes one of the mode names or command names from the previous `.claude` workflow, prefer the corresponding real agent definition in `.claude/agents/` / `.codex/agents/` or the surviving real skill in `.agents/skills/`.

### Engineering Standards

Global best practices and coding conventions apply:

- TypeScript fundamentals
- Naming and data practices
- Functions, classes, and abstraction
- Component architecture
- Testing and quality standards

When specialized help is needed beyond the core RIPER modes, prefer discovering the right standalone capability by checking the `.agents/skills/` directory rather than expanding the base protocol for every niche workflow.

### Technology Stack

See `process/context/all-context.md` for project technology stack, structure, and key technologies.

## Shared Process Folder

Codex and Claude share the `process/` directory:

### `process/general-plans/`

Default new feature plans use date-stamped naming: `[feature]_PLAN_[dd-mm-yy].md`

- Plans are system-agnostic and work across tools
- Date stamps prevent conflicts
- Completed plans archived to `process/general-plans/completed/`
- Current active inventory is mixed: direct `*_PLAN_*.md` files are the default, but legacy `PLAN.md`, `plan.md`, and `phase-*.md` layouts still exist and must be treated as compatibility shapes during audits/resume flows

### `process/context/`

Source of truth for project-specific knowledge. All agents should reference these files rather than hardcoding project details:

- `all-context.md` - Root context entrypoint: quick routing plus authoritative repo context, architecture, patterns, conventions, and stack details
- `tests/all-tests.md` - Testing quick-start, runner selection, commands, debugging procedures, and routing to deeper testing docs
- `planning/example-simple-prd.md` - Reference for simple plan structure
- `planning/example-complex-prd.md` - Reference for complex plan depth

Context discovery rule: read `process/context/all-context.md` first, then load only the relevant root file or context group. Context groups are durable knowledge domains, not feature folders. Every group must have an `all-{group}.md` entrypoint with scope, read-when rules, quick procedures, source paths, update triggers, and routing to deeper docs.

Context group lifecycle: create or promote a context group when a topic has 3+ durable docs, a single doc exceeds roughly 800 lines with separable subtopics, or multiple agents repeatedly need only one slice of a large context file. Move/split one group at a time, use `all-*.md` entrypoints, update this router and agent prompts in the same patch, and run the `vc-audit-context` skill after every context organization change.

### `process/features/`

Feature-scoped storage for large feature clusters. Each feature folder contains:

- `active/` - In-progress plans
- `completed/` - Archived completed plans
- `backlog/` - Deferred/future plans
- `reports/` - Feature-specific operational reports
- `references/` - Feature-specific research and reference documents

See `process/context/all-context.md` for current feature list.

Routing rule: When a feature has 5+ artifacts, store new plans/reports in `process/features/{feature}/`. General or cross-cutting items go in `process/general-plans/` with `reports/` and `references/` inside.

When routing to a subagent for a feature-scoped task, include `Feature: {feature-name}` in the prompt and override paths:

- `Reports: {work_context}/process/features/{feature}/reports/`
- `Plans: {work_context}/process/features/{feature}/active/`

#### Feature Folder Lifecycle

At plan creation time, use this decision logic:

| Signal | Action |
|--------|--------|
| `process/features/{topic}/` already exists | Use it; pass `Feature: {topic}` to subagent |
| Topic clearly belongs to an existing feature | Use that feature's folder |
| New multi-phase project with 3+ planned phases | Create feature folder upfront |
| User says "this is a big feature" or names a product area | Create feature folder upfront |
| Single plan, no backlog, unclear scope | Use `process/general-plans/active/` |
| Cross-cutting work touching multiple features | Use general folders |

Promotion protocol from general to feature folder:

1. Create `process/features/{new-feature}/` with subdirs: `active/`, `completed/`, `backlog/`, `reports/`, `references/`
2. Move related artifacts from `process/general-plans/`, including reports and references, into the new feature's subdirs
3. Update the Current features list in `process/context/all-context.md`
4. Inform subagents of the new feature scope going forward

Feature list maintenance: The Current features list in `process/context/all-context.md` must be updated whenever a new feature folder is created or an empty one is removed.

---

## Repository Structure

```
./
  .agents/           → .claude/skills/ (junction)
  .claude/
    agents/          – 12 RIPER-5 agent definitions
    skills/          – 32 skill directories (SKILL.md + refs/scripts)
    hooks/           – Session lifecycle hooks
  .codex/            – Codex mirror of .claude/ agents + hooks
  packages/
    cli-global/      – Node.js ESM CLI + Express API + Web UI
    analysis-core/   – Python 3.12 security analysis engine
  process/
    context/         – Durable repo knowledge (all-context.md)
    development-protocols/ – Workflow rules (orchestration, implementation-standards, etc.)
    features/        – Feature-scoped clusters ({feature}/active/, completed/, etc.)
    general-plans/   – Cross-cutting plans (active/, completed/, backlog/)
  AGENTS.md           – This file
  CLAUDE.md           – Claude-specific orchestrator rules
  opencode.json       – OpenCode/Codex config
  vc-manifest.json    – Kit manifest
  resolve-manifest.mjs – Manifest resolver
```

## Where to Look

| Task | Start Here |
|------|------------|
| Agent harness, RIPER-5 modes, skills, hooks | `.claude/agents/`, `.claude/skills/`, `process/development-protocols/` |
| Python analysis engine | `packages/analysis-core/` ([AGENTS.md](packages/analysis-core/AGENTS.md)) |
| Node.js CLI + Express + Web UI | `packages/cli-global/` ([AGENTS.md](packages/cli-global/AGENTS.md)) |
| Project context & conventions | `process/context/all-context.md` |
| Active plans | `process/general-plans/active/`, `process/features/*/active/` |
| Test docs | `process/context/tests/all-tests.md` |
| UI/UX guidelines | `process/context/uxui/all-uxui.md` |
| Plan format examples | `process/context/planning/all-planning.md` |

## Commands

```bash
# --- Node.js CLI (packages/cli-global) ---
cd packages/cli-global
npm install                # Install deps (Node >= 18.3)
npm test                   # vitest run (3 test suites)

# CLI usage (via npm link or directly):
node bin/cli.js scan --target <dir>          # Full scan
node bin/cli.js scan --target <dir> --mock-scan --mock-ai  # Offline mode
node bin/cli.js serve --port 3000            # Express dashboard

# --- Python analysis engine (packages/analysis-core) ---
cd packages/analysis-core
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt  # Windows
python -m unittest test_ast_graph.py         # Run Python tests

python main.py --target <dir> --output report.json           # Full pipeline
python main.py --target <dir> --mock-scan --mock-ai          # Offline
```

**No CI/CD pipeline configured.** No linter/formatter configured.

## Anti-Patterns (This Project)

| Rule | Source |
|------|--------|
| **NEVER** commit secrets or credentials | implementation-standards.md |
| **NEVER** paper over a regression — classify and record it | phase-programs.md |
| **NEVER** ignore BLOCKED or NEEDS_CONTEXT subagent status | orchestration.md |
| **NEVER** retry the exact same blocked approach 3+ times | orchestration.md |
| **NEVER** wave away failing tests to force green status | implementation-standards.md |
| **NEVER** auto-archive a plan without user-visible action | orchestration.md |
| **NEVER** silently widen scope across phases | phase-programs.md |
| **NEVER** load whole `process/context/` tree — read router first | all-context.md |
| **DO NOT** jump from phase plan to implementation without fresh research | phase-programs.md |
| **DO NOT** run a multi-phase program as one giant EXECUTE pass | phase-programs.md |
| **DO NOT** assume every feature folder has active plans | plan-lifecycle.md |
| **DO NOT** add features not in the approved plan (scope creep) | example-complex-prd.md |
| **MUST** keep TS/JS source files under ~200 lines (markdown exempt) | implementation-standards.md |
| **MUST** use result objects over throwing for recoverable errors | implementation-standards.md |
# AGENTS.md

This file is the Codex compatibility layer for the existing `.claude/` system.

Keep this file aligned with [CLAUDE.md](CLAUDE.md) as much as possible while adapting Claude-native concepts to Codex-native constructs.

Codex discovers project-local skills from `.agents/skills/`. In this repo, `.agents/skills/` is a symlink to `.claude/skills/` so Codex and Claude share the same underlying skill tree:

- `.claude/skills/` is the canonical source for shared skills and command-style workflows
- `.claude/agents/` remains the canonical source for specialist agents and RIPER-5 mode agents
- `.codex/agents/` mirrors `.claude/agents/` for Codex subagent roles
- shared reusable skills that Codex should discover must live under `.claude/skills/` as real `SKILL.md` files with YAML frontmatter; agent wrappers should not exist

Prefer updating `.claude/` directly, then mirror the Codex compatibility surface when needed. Because `.agents/skills/` resolves to the same folder, new skills added in either path appear in both places automatically.

## Project Overview

**AI Code Review** — Hybrid Node.js/Python static code scanner & AI code reviewer.

- **CLI + Web UI** (`packages/cli-global/`): Node.js ESM CLI (`ai-code-review` command), Express REST server, and vanilla JS dashboard
- **Analysis Engine** (`packages/analysis-core/`): Python 3.12 pipeline — Semgrep scanning → GitNexus AST enrichment → 9router AI remediation
- **Process Framework**: RIPER-5 spec-driven development (agents, protocols, plans in `process/` and `.claude/`)
- **Stack**: Node.js >= 18.3 (ESM, no TypeScript), Python 3.12 (unittest, no pyproject.toml), Express 4.x, Vitest, vanilla JS/CSS frontend

See `process/context/all-context.md` for full project context and conventions.

## RIPER-5 Spec-Driven Development System

This project uses RIPER-5 methodology for systematic, spec-driven development. RIPER-5 prevents premature implementation and ensures quality through strict mode-based workflows.

### Shared Development Protocols

Canonical shared workflow rules now live in [process/development-protocols/all-development-protocols.md](process/development-protocols/all-development-protocols.md).

Read these files as needed:

- [orchestration.md](process/development-protocols/orchestration.md)
- [implementation-standards.md](process/development-protocols/implementation-standards.md)
- [plan-lifecycle.md](process/development-protocols/plan-lifecycle.md)
- [phase-programs.md](process/development-protocols/phase-programs.md)
- [context-maintenance.md](process/development-protocols/context-maintenance.md)
- [parallel-fan-out.md](process/development-protocols/parallel-fan-out.md)
- [intent-clarification.md](process/development-protocols/intent-clarification.md)

### Orchestrator Role (Main Codex Session)

Delegation rules, subagent status codes (`DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, `NEEDS_CONTEXT`), and context isolation protocol live in [process/development-protocols/orchestration.md](process/development-protocols/orchestration.md).

You are the orchestrator, not the worker.

Your responsibilities:

1. Detect user intent (feature request, question, trivial fix)
2. Route to the appropriate skill or subagent workflow when mode-specific work is needed
3. Pass context efficiently (attach relevant files, summarize request)
4. Monitor protocol compliance (ensure mode workflows follow RIPER-5)

You do NOT:

- Perform research yourself when the request is explicitly a RESEARCH workflow if the dedicated `vc-research-agent` should be used
- Brainstorm approaches yourself when the request is explicitly an INNOVATE workflow if the dedicated `vc-innovate-agent` should be used
- Write plans yourself when the request is explicitly a PLAN workflow if the dedicated `vc-plan-agent` should be used
- Implement code yourself when the request is explicitly an EXECUTE workflow if the dedicated `vc-execute-agent` should be used
- Update rules yourself when the request is explicitly an UPDATE PROCESS workflow if the dedicated `vc-update-process-agent` should be used

Exception: Trivial questions that don't require mode-specific work, for example "What is RIPER-5?", can be answered directly.

### Repository Context

Authoritative context for this repository:

[process/context/all-context.md](process/context/all-context.md)

Contains:

- Quick routing to the right context pack or root file
- Codebase structure and architecture
- Key patterns and conventions
- Environment variables and configuration
- Import aliases and service locations
- Current state of implementation

Before substantial planning or implementation work, consult:

- [process/context/all-context.md](process/context/all-context.md)
- [process/development-protocols/all-development-protocols.md](process/development-protocols/all-development-protocols.md)
- [.claude/memory/MEMORY.md](.claude/memory/MEMORY.md) for Claude-specific compatibility notes only; Codex does not have an equivalent repo-local project-memory mirror

**Context routing discipline:** `all-*.md` entrypoints are routers, not the full knowledge. Agents MUST follow the routing tables in `all-*.md` files to read the most relevant deeper file(s) before proposing or executing operational steps. Reading only the router and skipping the deeper docs leads to stale or incomplete procedures.

### Core Protocol

The complete RIPER-5 protocol is defined in the real agent files at `.claude/agents/` and mirrored for Codex through `.codex/agents/`:

- [.claude/agents/vc-research-agent.md](.claude/agents/vc-research-agent.md)
- [.claude/agents/vc-innovate-agent.md](.claude/agents/vc-innovate-agent.md)
- [.claude/agents/vc-plan-agent.md](.claude/agents/vc-plan-agent.md)
- [.claude/agents/vc-execute-agent.md](.claude/agents/vc-execute-agent.md)
- [.claude/agents/vc-fast-mode-agent.md](.claude/agents/vc-fast-mode-agent.md)
- [.claude/agents/vc-update-process-agent.md](.claude/agents/vc-update-process-agent.md)
- `.codex/agents/*.toml` mirrors the same agent roster for Codex

The orchestrator operates outside the RIPER-5 phase modes. It routes, delegates, and monitors. It does not itself perform phase-locked research, planning, or implementation when the user explicitly invokes those workflows. Mode prefix is informational for the orchestrator.

Key Requirements:

- Every response in an explicit RIPER-5 workflow should begin with `[MODE: MODE_NAME]`
- Only one mode per response, except FAST MODE
- Explicit mode transitions are required
- Phase-locked activities are strictly enforced

### Mode Detection & Auto-Orchestration

Auto-Detection Patterns:

- Feature requests -> Step 0 skill discovery -> vc-research-agent -> INNOVATE -> PLAN -> EXECUTE
- Questions -> vc-research-agent for non-trivial investigation or direct answer for trivial conceptual questions
- Trivial fixes -> vc-execute-agent directly with no plan required
- Bug/debug -> vc-debugger as the default actor; helper skills like `vc-scout`, `vc-sequential-thinking`, and `vc-problem-solving` may assist
- UI/frontend -> surface vc-frontend-design skill plus vc-research-agent
- Refactor/simplify -> vc-code-simplifier for pure style or RESEARCH -> PLAN -> EXECUTE for behavioral refactors
- Missing context -> suggest the `vc-generate-context` skill
- Existing plan file -> scan `process/general-plans/active/` and `process/features/*/active/`, confirm with user, resume from last phase

Large program rule:

- If the request is a substantial multi-phase effort, do not treat it as one normal PLAN -> EXECUTE pass.
- Use `process/development-protocols/phase-programs.md`.
- First recommend the plan shape, sequencing, and next actions.
- Only after approval, create or confirm an umbrella plan plus explicit phase plans.
- Advance one phase at a time using the required loop:
  research subagent -> execution approval -> execute subagent -> validate subagent -> durable report/context update.
- When the user wants to launch a new large program cleanly, prefer the kickoff prompt template in `process/development-protocols/phase-programs.md` rather than freehanding the structure.

Intent clarification: Before auto-routing, the orchestrator scores request ambiguity per `process/development-protocols/intent-clarification.md`. Clear requests (score 0-1) auto-route silently. Ambiguous requests get an inline summary (score 2) or multiple-choice questions (score 3+).

When the user explicitly invokes one of the mode names or command names from the previous `.claude` workflow, prefer the corresponding real agent definition in `.claude/agents/` / `.codex/agents/` or the surviving real skill in `.agents/skills/`.

### Engineering Standards

Global best practices and coding conventions apply:

- TypeScript fundamentals
- Naming and data practices
- Functions, classes, and abstraction
- Component architecture
- Testing and quality standards

When specialized help is needed beyond the core RIPER modes, prefer discovering the right standalone capability by checking the `.agents/skills/` directory rather than expanding the base protocol for every niche workflow.

### Technology Stack

See `process/context/all-context.md` for project technology stack, structure, and key technologies.

## Shared Process Folder

Codex and Claude share the `process/` directory:

### `process/general-plans/`

Default new feature plans use date-stamped naming: `[feature]_PLAN_[dd-mm-yy].md`

- Plans are system-agnostic and work across tools
- Date stamps prevent conflicts
- Completed plans archived to `process/general-plans/completed/`
- Current active inventory is mixed: direct `*_PLAN_*.md` files are the default, but legacy `PLAN.md`, `plan.md`, and `phase-*.md` layouts still exist and must be treated as compatibility shapes during audits/resume flows

### `process/context/`

Source of truth for project-specific knowledge. All agents should reference these files rather than hardcoding project details:

- `all-context.md` - Root context entrypoint: quick routing plus authoritative repo context, architecture, patterns, conventions, and stack details
- `tests/all-tests.md` - Testing quick-start, runner selection, commands, debugging procedures, and routing to deeper testing docs
- `planning/example-simple-prd.md` - Reference for simple plan structure
- `planning/example-complex-prd.md` - Reference for complex plan depth

Context discovery rule: read `process/context/all-context.md` first, then load only the relevant root file or context group. Context groups are durable knowledge domains, not feature folders. Every group must have an `all-{group}.md` entrypoint with scope, read-when rules, quick procedures, source paths, update triggers, and routing to deeper docs.

Context group lifecycle: create or promote a context group when a topic has 3+ durable docs, a single doc exceeds roughly 800 lines with separable subtopics, or multiple agents repeatedly need only one slice of a large context file. Move/split one group at a time, use `all-*.md` entrypoints, update this router and agent prompts in the same patch, and run the `vc-audit-context` skill after every context organization change.

### `process/features/`

Feature-scoped storage for large feature clusters. Each feature folder contains:

- `active/` - In-progress plans
- `completed/` - Archived completed plans
- `backlog/` - Deferred/future plans
- `reports/` - Feature-specific operational reports
- `references/` - Feature-specific research and reference documents

See `process/context/all-context.md` for current feature list.

Routing rule: When a feature has 5+ artifacts, store new plans/reports in `process/features/{feature}/`. General or cross-cutting items go in `process/general-plans/` with `reports/` and `references/` inside.

When routing to a subagent for a feature-scoped task, include `Feature: {feature-name}` in the prompt and override paths:

- `Reports: {work_context}/process/features/{feature}/reports/`
- `Plans: {work_context}/process/features/{feature}/active/`

#### Feature Folder Lifecycle

At plan creation time, use this decision logic:

| Signal | Action |
|--------|--------|
| `process/features/{topic}/` already exists | Use it; pass `Feature: {topic}` to subagent |
| Topic clearly belongs to an existing feature | Use that feature's folder |
| New multi-phase project with 3+ planned phases | Create feature folder upfront |
| User says "this is a big feature" or names a product area | Create feature folder upfront |
| Single plan, no backlog, unclear scope | Use `process/general-plans/active/` |
| Cross-cutting work touching multiple features | Use general folders |

Promotion protocol from general to feature folder:

1. Create `process/features/{new-feature}/` with subdirs: `active/`, `completed/`, `backlog/`, `reports/`, `references/`
2. Move related artifacts from `process/general-plans/`, including reports and references, into the new feature's subdirs
3. Update the Current features list in `process/context/all-context.md`
4. Inform subagents of the new feature scope going forward

Feature list maintenance: The Current features list in `process/context/all-context.md` must be updated whenever a new feature folder is created or an empty one is removed.

---

## Repository Structure

```
./
  .agents/           → .claude/skills/ (junction)
  .claude/
    agents/          – 12 RIPER-5 agent definitions
    skills/          – 32 skill directories (SKILL.md + refs/scripts)
    hooks/           – Session lifecycle hooks
  .codex/            – Codex mirror of .claude/ agents + hooks
  packages/
    cli-global/      – Node.js ESM CLI + Express API + Web UI
    analysis-core/   – Python 3.12 security analysis engine
  process/
    context/         – Durable repo knowledge (all-context.md)
    development-protocols/ – Workflow rules (orchestration, implementation-standards, etc.)
    features/        – Feature-scoped clusters ({feature}/active/, completed/, etc.)
    general-plans/   – Cross-cutting plans (active/, completed/, backlog/)
  AGENTS.md           – This file
  CLAUDE.md           – Claude-specific orchestrator rules
  opencode.json       – OpenCode/Codex config
  vc-manifest.json    – Kit manifest
  resolve-manifest.mjs – Manifest resolver
```

## Where to Look

| Task | Start Here |
|------|------------|
| Agent harness, RIPER-5 modes, skills, hooks | `.claude/agents/`, `.claude/skills/`, `process/development-protocols/` |
| Python analysis engine | `packages/analysis-core/` ([AGENTS.md](packages/analysis-core/AGENTS.md)) |
| Node.js CLI + Express + Web UI | `packages/cli-global/` ([AGENTS.md](packages/cli-global/AGENTS.md)) |
| Project context & conventions | `process/context/all-context.md` |
| Active plans | `process/general-plans/active/`, `process/features/*/active/` |
| Test docs | `process/context/tests/all-tests.md` |
| UI/UX guidelines | `process/context/uxui/all-uxui.md` |
| Plan format examples | `process/context/planning/all-planning.md` |

## Commands

```bash
# --- Node.js CLI (packages/cli-global) ---
cd packages/cli-global
npm install                # Install deps (Node >= 18.3)
npm test                   # vitest run (3 test suites)

# CLI usage (via npm link or directly):
node bin/cli.js scan --target <dir>          # Full scan
node bin/cli.js scan --target <dir> --mock-scan --mock-ai  # Offline mode
node bin/cli.js serve --port 3000            # Express dashboard

# --- Python analysis engine (packages/analysis-core) ---
cd packages/analysis-core
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt  # Windows
python -m unittest test_ast_graph.py         # Run Python tests

python main.py --target <dir> --output report.json           # Full pipeline
python main.py --target <dir> --mock-scan --mock-ai          # Offline
```

**No CI/CD pipeline configured.** No linter/formatter configured.

## Anti-Patterns (This Project)

| Rule | Source |
|------|--------|
| **NEVER** commit secrets or credentials | implementation-standards.md |
| **NEVER** paper over a regression — classify and record it | phase-programs.md |
| **NEVER** ignore BLOCKED or NEEDS_CONTEXT subagent status | orchestration.md |
| **NEVER** retry the exact same blocked approach 3+ times | orchestration.md |
| **NEVER** wave away failing tests to force green status | implementation-standards.md |
| **NEVER** auto-archive a plan without user-visible action | orchestration.md |
| **NEVER** silently widen scope across phases | phase-programs.md |
| **NEVER** load whole `process/context/` tree — read router first | all-context.md |
| **DO NOT** jump from phase plan to implementation without fresh research | phase-programs.md |
| **DO NOT** run a multi-phase program as one giant EXECUTE pass | phase-programs.md |
| **DO NOT** assume every feature folder has active plans | plan-lifecycle.md |
| **DO NOT** add features not in the approved plan (scope creep) | example-complex-prd.md |
| **MUST** keep TS/JS source files under ~200 lines (markdown exempt) | implementation-standards.md |
| **MUST** use result objects over throwing for recoverable errors | implementation-standards.md |

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **DATN2** (1553 symbols, 1862 relationships, 22 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/DATN2/context` | Codebase overview, check index freshness |
| `gitnexus://repo/DATN2/clusters` | All functional areas |
| `gitnexus://repo/DATN2/processes` | All execution flows |
| `gitnexus://repo/DATN2/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
