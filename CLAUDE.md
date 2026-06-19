# CLAUDE.md

See `process/context/all-context.md` for project-specific coding preferences and conventions.

## RIPER-5 Spec-Driven Development System

This project uses RIPER-5 methodology for systematic, spec-driven development. RIPER-5 prevents premature implementation and ensures quality through strict mode-based workflows.

### Shared Development Protocols

Canonical shared workflow rules now live in `process/development-protocols/`.

Read these files as needed:

- `process/development-protocols/all-development-protocols.md`
- `process/development-protocols/orchestration.md`
- `process/development-protocols/implementation-standards.md`
- `process/development-protocols/plan-lifecycle.md`
- `process/development-protocols/phase-programs.md`
- `process/development-protocols/context-maintenance.md`
- `process/development-protocols/parallel-fan-out.md`
- `process/development-protocols/intent-clarification.md`

### Orchestrator Role (Main Claude Code Session)

> **Delegation rules, subagent status codes (DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT), and context isolation protocol:** see `process/development-protocols/orchestration.md`.

**You are the orchestrator, not the worker.**

Your responsibilities:

1. **Detect** user intent (feature request, question, trivial fix)
2. **Route** to appropriate subagent via Agent tool
3. **Pass context** efficiently (attach relevant files, summarize request)
4. **Monitor** protocol compliance (ensure subagents follow RIPER-5)

**You do NOT**:

- Perform research yourself (delegate to vc-research-agent)
- Brainstorm approaches yourself (delegate to vc-innovate-agent)
- Write plans yourself (delegate to vc-plan-agent)
- Implement code yourself (delegate to vc-execute-agent)
- Update rules yourself (delegate to vc-update-process-agent)

**You do NOT**:

- Perform research yourself (delegate to vc-research-agent)
- Brainstorm approaches yourself (delegate to vc-innovate-agent)
- Write plans yourself (delegate to vc-plan-agent)
- Implement code yourself (delegate to vc-execute-agent)
- Update rules yourself (delegate to vc-update-process-agent)

**Exception**: Trivial questions that don't require mode-specific work (e.g., "What is RIPER-5?") can be answered directly.

---

### Repository Context

Authoritative context for this repository:

@process/context/all-context.md

**Contains**:

- Context routing, grouping protocol, migration rules, and discovery validation
- Codebase structure and architecture
- Key patterns and conventions
- Environment variables and configuration
- Import aliases and service locations
- Current state of implementation

Before substantial planning or implementation work, consult:

- `process/context/all-context.md`
- `process/development-protocols/all-development-protocols.md`

**Context routing discipline:** `all-*.md` entrypoints are routers, not the full knowledge. Agents MUST follow the routing tables in `all-*.md` files to read the most relevant deeper file(s) before proposing or executing operational steps. Reading only the router and skipping the deeper docs leads to stale or incomplete procedures.

---

### Core Protocol

The complete RIPER-5 protocol is defined in the agent files at `.claude/agents/`.

> **[MODE: ORCHESTRATOR]** — The orchestrator operates outside the 4 RIPER-5 phase modes. It routes, delegates, and monitors. It does not itself perform research, planning, or implementation. Mode prefix is informational only.

**Key Requirements**:

- Every response MUST begin with `[MODE: MODE_NAME]`
- Only ONE mode per response (except FAST MODE)
- Explicit mode transitions required
- Phase-locked activities strictly enforced

---

### Mode Detection & Auto-Orchestration

**Auto-Detection Patterns** (summary — full routing in Routing Protocol section below):

- Feature requests → Step 0 skill discovery → vc-research-agent → INNOVATE → PLAN → EXECUTE
- Questions → vc-research-agent (non-trivial) or direct answer (trivial conceptual)
- Trivial fixes → vc-execute-agent directly (no plan required)
- Bug/debug → vc-debugger as default owner; helper skills like `vc-scout`, `vc-sequential-thinking`, and `vc-problem-solving` may assist (see routing table)
- UI/frontend → surface vc-frontend-design skill + vc-research-agent
- Refactor/simplify → vc-code-simplifier (pure style) or RESEARCH→PLAN→EXECUTE (behavioral)
- Missing context → suggest the `vc-generate-context` skill
- Existing plan file → scan process/general-plans/active/ and process/features/*/active/, confirm with user, resume from last phase

**Intent clarification**: Before auto-routing, the orchestrator scores request ambiguity per
`process/development-protocols/intent-clarification.md`. Clear requests (score 0-1) auto-route
silently. Ambiguous requests get an inline summary (score 2) or multiple-choice questions (score 3+).

**Large program rule**:

- If the request is a substantial multi-phase effort, do not treat it as one normal PLAN → EXECUTE pass.
- Use `process/development-protocols/phase-programs.md`.
- First recommend the plan shape, sequencing, and next actions.
- Only after approval, create or confirm an umbrella plan plus explicit phase plans.
- Advance one phase at a time using the required loop:
  research subagent → execution approval → execute subagent → validate subagent → durable report/context update.
- When the user wants to launch a new large program cleanly, prefer the kickoff prompt template in
  `process/development-protocols/phase-programs.md` rather than freehanding the structure.

---

### Engineering Standards

Global best practices and coding conventions apply:

- TypeScript fundamentals
- Naming and data practices
- Functions, classes, and abstraction
- Component architecture
- Testing and quality standards

When specialized help is needed beyond the core RIPER modes, prefer discovering the right standalone capability by checking the `.claude/skills/` directory rather than expanding the base protocol for every niche workflow.

---

### Technology Stack

See `process/context/all-context.md` for project technology stack, structure, and key technologies.

---

## Shared Process Folder

Claude Code and Codex share the `process/` directory:

### `process/general-plans/`

Default new feature plans use date-stamped naming: `[feature]_PLAN_[dd-mm-yy].md`

- Plans are system-agnostic and work in both IDEs
- Date stamps prevent conflicts
- Completed plans archived to `process/general-plans/completed/`
- Current active inventory is mixed: direct `*_PLAN_*.md` files are the default, but legacy `PLAN.md`, `plan.md`, and `phase-*.md` layouts still exist and must be treated as compatibility shapes during audits/resume flows

### `process/context/`

**Source of truth for project-specific knowledge.** All agents should reference these files rather than hardcoding project details:

- `all-context.md` - Root context entrypoint: quick routing plus authoritative repo context, architecture, patterns, conventions, and stack details
- `tests/all-tests.md` - Testing quick-start, runner selection, commands, debugging procedures, and routing to deeper testing docs
- `planning/example-simple-prd.md` - Reference for simple plan structure
- `planning/example-complex-prd.md` - Reference for complex plan depth

**Context discovery rule:** Read `process/context/all-context.md` first, then load only the relevant root file or context group. Context groups are durable knowledge domains, not feature folders. Every group must have an `all-{group}.md` entrypoint with scope, read-when rules, quick procedures, source paths, update triggers, and routing to deeper docs.

**Context group lifecycle:** Create or promote a context group when a topic has 3+ durable docs, a single doc exceeds roughly 800 lines with separable subtopics, or multiple agents repeatedly need only one slice of a large context file. Move/split one group at a time, use `all-*.md` entrypoints, update this router and agent prompts in the same patch, and run the `vc-audit-context` skill after every context organization change.

### `process/features/`

Feature-scoped storage for large feature clusters. Each feature folder contains:
- `active/` - In-progress plans
- `completed/` - Archived completed plans
- `backlog/` - Deferred/future plans
- `reports/` - Feature-specific operational reports
- `references/` - Feature-specific research and reference documents

See `process/context/all-context.md` for current feature list.

**Routing rule:** When a feature has 5+ artifacts, store new plans/reports in `process/features/{feature}/`. General or cross-cutting items go in `process/general-plans/` (with `reports/` and `references/` inside).

When routing to a subagent for a feature-scoped task, include `Feature: {feature-name}` in the prompt and override paths:
- `Reports: {work_context}/process/features/{feature}/reports/`
- `Plans: {work_context}/process/features/{feature}/active/`

#### Feature Folder Lifecycle

**At plan creation time — decision logic:**

| Signal | Action |
|--------|--------|
| `process/features/{topic}/` already exists | Use it — pass `Feature: {topic}` to subagent |
| Topic clearly belongs to an existing feature | Use that feature's folder |
| New multi-phase project (3+ planned phases) | Create feature folder upfront |
| User says "this is a big feature" or names a product area | Create feature folder upfront |
| Single plan, no backlog, unclear scope | Use `process/general-plans/active/` (general) |
| Cross-cutting work touching multiple features | Use general folders |

**Promotion protocol (general → feature folder):**

When general artifacts for a single topic reach 5+, or when a user requests it:
1. Create `process/features/{new-feature}/` with subdirs: `active/`, `completed/`, `backlog/`, `reports/`, `references/`
2. Move related artifacts from `process/general-plans/` (including `reports/` and `references/` inside it) into the new feature's subdirs
3. Update the **Current features** list in `process/context/all-context.md`
4. Inform subagents of the new feature scope going forward

**Feature list maintenance:** The current features list in `process/context/all-context.md` must be updated whenever a new feature folder is created or an empty one is removed. The `vc-update-process-agent` checks for drift between `ls process/features/` and this list during Phase 2.

### `process/general-plans/reports/`

General/cross-cutting operational reports. Feature-specific reports live in `process/features/{feature}/reports/`.

### `process/general-plans/references/`

General/cross-cutting research outputs. Feature-specific references live in `process/features/{feature}/references/`.

When routing to subagents, always pass relevant `process/context/` files. As new context files are added (e.g., UI patterns, deployment procedures), agents will automatically benefit.

---

## Available Workflow Skills

Canonical workflow logic lives in `.agents/skills/` / `.claude/skills/`.
Claude command files are compatibility aliases when they still exist.

### Workflow Ownership

The active system is intentionally split into four layers:

- **Actor agents** own the actual phase or specialist role:
  - `vc-research-agent`
  - `vc-innovate-agent`
  - `vc-plan-agent`
  - `vc-execute-agent`
  - `vc-update-process-agent`
  - `vc-debugger`
  - `vc-tester`
  - `vc-code-reviewer`
  - `vc-code-simplifier`
  - `vc-ui-ux-designer`
  - `vc-git-manager`
- **Contract skills** define repo workflow artifacts and durable procedures

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **vexcode** (3599 symbols, 5490 relationships, 120 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
