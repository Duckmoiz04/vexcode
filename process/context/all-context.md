# AI Code Review - All Context

Last updated: 2026-06-11

This file is the root context entrypoint for the repo.

Use it for two things:

1. quick routing to the right context pack or root file
2. broad architecture and repository understanding

Start here before loading deeper context files.

---

## How This File Works (the `all-*.md` Convention)

Every `process/context/` directory has one `all-*.md` entrypoint that acts as an attachable quick router for that domain. This root file (`all-context.md`) is the top-level router. Context groups each have their own `all-{group}.md` entrypoint.

**The pattern:**

```
process/context/
  all-context.md                      <-- THIS FILE: root router
  planning/
    all-planning.md                   <-- group router for planning
    example-simple-prd.md             <-- deep doc within the group
    example-complex-prd.md            <-- deep doc within the group
  tests/
    all-tests.md                      <-- group router for tests
```

**How agents use it:**

1. Agent reads `all-context.md` first (this file)
2. Finds the relevant context group from the routing tables below
3. Reads that group's `all-{group}.md` entrypoint
4. Only then loads the specific deep doc needed

This layered routing keeps context windows small. Never load the whole `process/context/` tree.

---

## Quick Start

For most substantial tasks:

1. read this file first
2. choose the smallest relevant root file or context group from the tables below
3. only then load deeper files

---

## Current Root Entry Points

| File | Read when |
|---|---|---|
| `process/context/all-context.md` | any substantial planning, research, review, or implementation task |
| `process/context/architecture-overview.md` | understanding the full system architecture, execution flow, component relationships, or API reference |
| `process/context/tests/all-tests.md` | testing, verification, debugging test failures, execution planning |
| `process/context/planning/all-planning.md` | plan-shape calibration, planning examples, SIMPLE vs COMPLEX reference docs |
| `process/context/uxui/all-uxui.md` | UI styling guidelines, design system rules, or component architecture |

## Current Context Groups

| Group | Entry point | Scope |
|---|---|---|
| `planning/` | `process/context/planning/all-planning.md` | plan-shape calibration, planning examples, SIMPLE vs COMPLEX reference docs |
| `tests/` | `process/context/tests/all-tests.md` | test runners, commands, debugging, gaps |
| `uxui/` | `process/context/uxui/all-uxui.md` | UI styling, HSL palette tokens, animations, layout structure |

## Task Routing Table

| If the task involves... | Start with | Then load |
|---|---|---|
| architecture or stack questions | this file | - |
| testing or verification | `process/context/tests/all-tests.md` | `process/context/tests/browser-automation.md` for E2E details |
| creating a new plan | `process/context/planning/all-planning.md` | - |
| UI/UX work | `process/context/uxui/all-uxui.md` | `process/context/uxui/uiux.md` |

## Context Group Lifecycle

Context groups are durable knowledge domains, not feature folders.

Create a group when:

- a topic has 3+ durable docs
- a single doc exceeds roughly 800 lines with separable subtopics
- multiple agents repeatedly need only one slice of a large context file
- the topic maps to a stable operational domain (tests, infra, database, auth, UI, workflows, etc.)

Do not create a group when:

- the content is a temporary report
- the content is a plan or execution artifact
- the topic is feature-specific and belongs in `process/features/...`

Move or split one group at a time. Use `all-{group}.md` entrypoints. Run the `audit-context` skill after every context organization change.

## Naming Convention

There are no `README.md` files inside `process/context/`.

Canonical entrypoints use `all-*.md`:

- root: `process/context/all-context.md`
- group: `process/context/{group}/all-{group}.md`

Each `all-{group}.md` file should act as the attachable quick router for that domain:

- tell the agent what the group covers
- give quick procedures and decision rules
- route to smaller deeper files

## Context Update Protocol

When durable project knowledge changes:

1. update the smallest relevant context file
2. update this file if routing, ownership, naming, or groups changed
3. update the owning `all-{group}.md` entrypoint when a group exists
4. run `audit-context`

---

## Repository Structure

```
DATN2/
  .agents/            -- Symlink to .claude/skills (facilitates agent skill discovery)
  .claude/            -- Claude Code config, hooks, and agent definitions
    agents/           -- VC agent prompts/configurations
    hooks/            -- Lifecycle hooks (session-init, post-edit, block lists)
    settings.json     -- Hook triggers and matcher configurations
    skills/           -- Specialized skills (vc-setup, vc-update, etc.)
  .codex/             -- Codex IDE configurations and parity definitions
  packages/
    cli/       -- Node.js ESM CLI binary + Express server (75 tests)
    web/              -- React 19 + Tailwind v4 + TypeScript 5 frontend (138 tests)
    engine/    -- Python 3.12 analysis engine (Semgrep, GitNexus, 9router AI)
  process/            -- The RIPER-5 process directory
    context/          -- Durable repository knowledge (all-context, tests, planning)
    development-protocols/ -- Developer guidelines and workflow protocols
    features/         -- Feature-scoped storage
    general-plans/    -- Generic active, completed, and backlog plans
  resolve-manifest.mjs -- Glob-based manifest resolver
  vc-manifest.json     -- Harness file versioning and manifest config
```

## Current Features

- **vexcode** (`process/features/vexcode/`): Main hybrid Node/Python static code scanner & AI code reviewer.

## Technology Stack

- **Project Type:** Hybrid Local CLI + Web UI (Node.js/npm) with Python Analysis Core
- **Static Security Scanner:** Semgrep (static security checks)
- **Knowledge Graph:** GitNexus (AST Knowledge Graph generator)
- **AI Model Proxy/Router:** 9router (multi-model proxy for processing findings)
- **Frontend UI:** React 19 + Tailwind v4 + TypeScript 5 (built with Vite 6, served by Express)
- **CLI & Local Server:** Node.js ESM (command orchestration, Express server, and file-apply endpoint)
- **Analysis Engine:** Python Core (runs AST knowledge graph build, Semgrep integration, and AI logic)

## Key Patterns and Conventions

**System Workflow:**
1. Run Semgrep static security scanning on the target local codebase.
2. Generate AST Knowledge Graph using GitNexus.
3. Ingest Semgrep findings and the AST Knowledge Graph into the AI model via the `9router` proxy.
4. AI model processes the findings (including scanning for potential errors missed by static analysis) and generates fixes.
5. Present the findings and fixes on the local Web UI.
6. Allow user to review and apply code fixes directly to the local files via a single click on the Web UI.

**Web UI Requirements:**
- Premium visual styling with rich aesthetics, custom CSS, and responsive layouts.
- Fast execution running locally.
- Configuration section to connect and authenticate with various AI platforms and routers.

## Reference Projects

- **GitNexus**:
  - Absolute Path: `D:\GitNexus`
  - Web UI Path: `D:\GitNexus\gitnexus-web`
  - Purpose: Reference project and model template. Access this directory to inspect implementation details, compare patterns, and study its web interface when requested.

## Environment and Configuration

**Config files:**
- `vc-manifest.json` (harness configuration)
- `.claude/settings.json` (agent hook settings)

**Env var groups (names only, never values):**
- AI Proxy Settings: `NINEROUTER_API_KEY`, `NINEROUTER_BASE_URL`
- Scanner Settings: `SEMGREP_RULES_PATH`

---

## Current Project Status (2026-06-11)

### ✅ Dự án hoàn thiện sau architecture-cleanup
- 15 commits trên master — toàn bộ kế hoạch "architecture-cleanup" hoàn thành
- **Kiến trúc modular**: Web monolith (`App.tsx` state center) → Context + hooks + services + 12 component modules
- **138 web tests** (từ 0 lên 138), 75 CLI tests — tất cả pass
- Build web: **pass**, TypeScript **0 errors**
- Python: pre-existing issue thiếu `lizard` trong system Python (đã có trong `.venv`)
- Không còn active plan — dự án sẵn sàng cho feature mới

### Test Health
| Package | Tests | Status |
|---|---|---|
| Web | 138 (23 files) | ✅ All pass |
| CLI | 75 (3 files) | ✅ All pass |
| Python | 6 failures | ⚠️ Pre-existing: `lizard` chưa cài trong test subprocess |
