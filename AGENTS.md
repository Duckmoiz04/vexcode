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

- **CLI + Web UI** (`packages/cli/`): Node.js ESM CLI (`vexcode` command), Express REST server; web dashboard is a React 19 + TypeScript + Vite SPA (`packages/web/`, built into `packages/cli/src/public/`)
- **Analysis Engine** (`packages/engine/`): Python 3.12 pipeline — Semgrep scanning → GitNexus AST enrichment → 9router AI remediation
- **Process Framework**: RIPER-5 spec-driven development (agents, protocols, plans in `process/` and `.claude/`)
- **Stack**: Node.js >= 18.3 (ESM, no TypeScript in CLI), Python 3.12 (unittest, setuptools build), Express 4.x, Vitest, React 19 + TypeScript + Vite SPA (web dashboard)

See `process/context/all-context.md` for full project context and conventions.

## RIPER-5 Spec-Driven Development System

This project uses RIPER-5 methodology. See [process/development-protocols/all-development-protocols.md](process/development-protocols/all-development-protocols.md) for shared workflow rules.

### Orchestrator Role (Main Codex Session)

Delegation rules, subagent status codes (`DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, `NEEDS_CONTEXT`), and context isolation protocol live in [process/development-protocols/orchestration.md](process/development-protocols/orchestration.md).

You are the orchestrator, not the worker. Responsibilities: detect user intent, route to appropriate skill/subagent, pass context efficiently, monitor protocol compliance. You do NOT perform research, brainstorm, write plans, implement code, or update rules when dedicated subagents (`vc-research-agent`, `vc-innovate-agent`, `vc-plan-agent`, `vc-execute-agent`, `vc-update-process-agent`) should be used instead. Trivial questions can be answered directly.

### Repository Context

Authoritative context: [process/context/all-context.md](process/context/all-context.md) — quick routing, codebase structure, architecture, patterns, conventions, env vars, import aliases, current state.

Before substantial work, consult:
- [process/context/all-context.md](process/context/all-context.md)
- [process/development-protocols/all-development-protocols.md](process/development-protocols/all-development-protocols.md)
- [.claude/memory/MEMORY.md](.claude/memory/MEMORY.md) (Claude-specific notes only)

**Context routing discipline:** `all-*.md` files are routers, not the full knowledge. Agents MUST follow the routing tables in deeper files.

### Core Protocol

RIPER-5 agents are defined in `.claude/agents/` and mirrored in `.codex/agents/`:
- [vc-research-agent.md](.claude/agents/vc-research-agent.md)
- [vc-innovate-agent.md](.claude/agents/vc-innovate-agent.md)
- [vc-plan-agent.md](.claude/agents/vc-plan-agent.md)
- [vc-execute-agent.md](.claude/agents/vc-execute-agent.md)
- [vc-fast-mode-agent.md](.claude/agents/vc-fast-mode-agent.md)
- [vc-update-process-agent.md](.claude/agents/vc-update-process-agent.md)

Key requirements: one mode per response (except FAST MODE), explicit mode transitions, phase-locked activities strictly enforced.

### Mode Detection & Auto-Orchestration

See [process/development-protocols/intent-clarification.md](process/development-protocols/intent-clarification.md) for ambiguity scoring. General routing patterns:

| Request Type | Route |
|---|---|
| Feature requests | Research → INNOVATE → PLAN → EXECUTE |
| Questions | Direct answer or research-agent |
| Trivial fixes | execute-agent directly |
| Bug/debug | [vc-debugger](.claude/agents/vc-debugger.md) |
| UI/frontend | vc-frontend-design skill + research-agent |
| Refactor | vc-code-simplifier or full RIPER-5 |
| Existing plan file | Scan `process/general-plans/active/` & `process/features/*/active/`, confirm, resume |

Large programs: use [phase-programs.md](process/development-protocols/phase-programs.md) — advance one phase at a time (research → approve → execute → validate → report).

When the user explicitly invokes a mode name, prefer the corresponding agent definition in `.claude/agents/` / `.codex/agents/` or the skill in `.agents/skills/`.

### Engineering Standards

Global best practices apply (TypeScript fundamentals, naming, abstraction, component architecture, testing). For niche workflows, check `.agents/skills/` first. See `process/context/all-context.md` for technology stack details.

## Shared Process Folder

Codex and Claude share the `process/` directory:

### `process/general-plans/`

Plans use date-stamped naming (`[feature]_PLAN_[dd-mm-yy].md`). Completed plans archived to `process/general-plans/completed/`.

### `process/context/`

Source of truth for project knowledge:
- `all-context.md` — Root entrypoint
- `tests/all-tests.md` — Testing procedures
- `planning/example-simple-prd.md` / `example-complex-prd.md` — Plan format references

Context discovery rule: read `all-context.md` first, then relevant context group. Create a context group when a topic has 3+ durable docs or a doc exceeds ~800 lines. Run `vc-audit-context` after any reorganization.

### `process/features/`

Feature-scoped clusters with `active/`, `completed/`, `backlog/`, `reports/`, `references/` subdirs. See `all-context.md` for current feature list.

**Feature Folder Lifecycle:**

| Signal | Action |
|--------|--------|
| `process/features/{topic}/` exists | Use it |
| Topic belongs to existing feature | Use that feature |
| New multi-phase project (3+ phases) | Create feature folder |
| User names a product area | Create feature folder |
| Single plan, unclear scope | Use `process/general-plans/active/` |
| Cross-cutting work | Use general folders |

Promotion: create feature subdirs → move artifacts from `general-plans/` → update feature list in `all-context.md` → inform subagents.

---

## Repository Structure

```
./
  .agents/           → .claude/skills/ (junction)
  .claude/
    agents/          – RIPER-5 agent definitions
    skills/          – Skill directories (SKILL.md + refs/scripts)
    hooks/           – Session lifecycle hooks
  .codex/            – Codex mirror of .claude/ agents + hooks
  packages/
    cli/      – Node.js ESM CLI + Express API + Web UI
    engine/   – Python 3.12 security analysis engine
  process/
    context/         – Durable repo knowledge (all-context.md)
    development-protocols/ – Workflow rules
    features/        – Feature-scoped clusters
    general-plans/   – Cross-cutting plans
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
| Python analysis engine | `packages/engine/` ([AGENTS.md](packages/engine/AGENTS.md)) |
| Node.js CLI + Express + Web UI | `packages/cli/` ([AGENTS.md](packages/cli/AGENTS.md)) |
| React SPA dashboard | `packages/web/` ([AGENTS.md](packages/web/AGENTS.md)) |
| Project context & conventions | `process/context/all-context.md` |
| Active plans | `process/general-plans/active/`, `process/features/*/active/` |
| Test docs | `process/context/tests/all-tests.md` |
| UI/UX guidelines | `process/context/uxui/all-uxui.md` |
| Plan format examples | `process/context/planning/all-planning.md` |

## Commands

```bash
# --- Node.js CLI (packages/cli) ---
cd packages/cli
npm install                # Install deps (Node >= 18.3)
npm test                   # vitest run (3 test suites)

# CLI usage (via npm link or directly):
node bin/cli.js scan --target <dir>          # Full scan
node bin/cli.js scan --target <dir> --mock-scan --mock-ai  # Offline mode
node bin/cli.js serve --port 3000            # Express dashboard

# --- React SPA dashboard (packages/web) ---
cd packages/web
npm install                # Install deps (Node >= 18.3)
npm run dev                # Vite dev server (HMR at localhost:5173)
npm run build              # tsc -b && vite build → ../cli/src/public/
npm test                   # vitest run (31 test files, jsdom)

# --- Python analysis engine (packages/engine) ---
cd packages/engine
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt  # Windows
pytest                     # pytest (15 test files)

python main.py --target <dir> --output report.json           # Full pipeline
python main.py --target <dir> --mock-scan --mock-ai          # Offline
```

**No CI/CD pipeline configured.** Ruff configured for Python linting (`packages/engine/pyproject.toml`). ESLint + Prettier configured for CLI (`packages/cli/`). No linter/formatter for the web SPA.

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

This project is indexed by GitNexus as **vexcode** (2236 symbols, 3133 relationships, 37 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
| `gitnexus://repo/vexcode/context` | Codebase overview, check index freshness |
| `gitnexus://repo/vexcode/clusters` | All functional areas |
| `gitnexus://repo/vexcode/processes` | All execution flows |
| `gitnexus://repo/vexcode/process/{name}` | Step-by-step execution trace |

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
