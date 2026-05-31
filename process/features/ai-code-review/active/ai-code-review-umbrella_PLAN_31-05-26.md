# AI Code Review Tool - Phase Program Umbrella Plan

**Date**: 31-05-26
**Complexity**: Complex
**Status**: ⏳ PLANNED

## Overview

This document serves as the master orchestration/umbrella plan for the development of the DATN2 AI Code Review tool. It manages the multi-phase lifecycle of this hybrid Node.js CLI & Python Analysis Core codebase reviewer, setting clear boundaries, status tracking, and verification expectations for each milestone.

Our global context is outlined in [process/context/all-context.md](file:///d:/DATN2/process/context/all-context.md), and our testing protocols are based on [process/context/tests/all-tests.md](file:///d:/DATN2/process/context/tests/all-tests.md).

---

## Quick Links
- [Context and Goals](#context-and-goals)
- [Phase Completion Rules](#phase-completion-rules)
- [Phased Delivery Plan](#phased-delivery-plan)
- [Architecture Decisions](#architecture-decisions)
- [Touchpoints](#touchpoints)
- [Public Contracts](#public-contracts)
- [Blast Radius](#blast-radius)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)
- [Cursor and RIPER-5 Integration](#cursor-and-riper-5-integration)

---

## Context and Goals

The DATN2 AI Code Review tool is designed to review local source codebases for security and logical bugs by combining:
1. **Semgrep** static analysis checks.
2. **GitNexus** AST (Abstract Syntax Tree) Knowledge Graphs to capture architectural and cross-file relationships.
3. **9router AI** proxy models to refine scan findings and generate ready-to-apply patches.
4. **Local Web UI Dashboard** allowing developers to review findings and apply fixes with a single click.

To manage the complexity of this hybrid architecture, the project is structured as a 5-phase program.

---

## Phase Completion Rules

A phase is NOT complete until:

1. **Integration Test** - Works with other system pieces
2. **Manual Test** - User can perform the action
3. **Data Verification** - Database/state/file changes confirmed
4. **Error Handling** - Failure cases handled gracefully
5. **User Confirmation** - User says "it works"

Status meanings:
- ⏳ PLANNED - Not started
- 🔨 CODE DONE - Written but not E2E tested
- 🧪 TESTING - Currently being tested
- ✅ VERIFIED - Tested AND confirmed working
- 🚧 BLOCKED - Has issues

After each phase, the executor must document:
- [ ] What was tested manually
- [ ] Data verified (show file outputs, API responses)
- [ ] Errors encountered and fixed
- [ ] User confirmation received

---

## Acceptance Criteria

For the overall AI Code Review program:
- [ ] Command line tool is registered globally and invokes the scanner cleanly.
- [ ] A local REST server is running, exposing scanning, config management, and patch application.
- [ ] Vulnerability patches can be applied with single-click actions from a clean local dashboard.
- [ ] AST knowledge graphs are generated via GitNexus and sent to the 9router AI proxy for contextual suggestions.
- [ ] Code changes verify successfully with zero linting or parsing issues after applying remediation.

---

## Phased Delivery Plan

| Phase | Title | Target Artifacts | Status |
|-------|-------|------------------|--------|
| **Phase 1** | Foundation Setup | `packages/cli-global/` & `packages/analysis-core/` basic layouts | ✅ VERIFIED |
| **Phase 2** | Bridge & Express Server | Node-Python Bridge process spawner & Express REST API | ⏳ PLANNED |
| **Phase 3** | AST Graph & AI Resolving | GitNexus AST integration & AI Prompt Context Construction | ⏳ PLANNED |
| **Phase 4** | Web UI Dashboard | HTML/JS local glassmorphic dashboard UI | ⏳ PLANNED |
| **Phase 5** | Integration & Hardening | CLI wrapper command mapping & E2E verification | ⏳ PLANNED |

### Phase 1: Foundation Setup (Status: ✅ VERIFIED)
- **Objective**: Establish separate development environments for Node.js CLI and Python Analysis Core.
- **Done**: Created the global CLI workspace under `packages/cli-global/` and Python Core under `packages/analysis-core/`. Implemented mock scan capabilities and validated standalone script runs.
- **Report Path**: `process/features/ai-code-review/reports/python-core-setup_REPORT.md`

### Phase 2: Node-Python Bridge & Express Server (Status: ⏳ PLANNED - ACTIVE)
- **Objective**: Establish the communication bridge between Node.js CLI and Python Core and run a local REST API.
- **Execution Plan**: [phase-02-bridge-and-server_PLAN_31-05-26.md](file:///d:/DATN2/process/features/ai-code-review/active/phase-02-bridge-and-server_PLAN_31-05-26.md)
- **Report Path**: `process/features/ai-code-review/reports/phase-02-bridge-and-server_REPORT.md`

### Phase 3: AST Knowledge Graph Integration & AI Resolving (Status: ⏳ PLANNED)
- **Objective**: Build the codebase AST Knowledge Graph via GitNexus and use it to feed rich context into 9router AI queries.
- **Report Path**: `process/features/ai-code-review/reports/phase-03-ast-graph_REPORT.md`

### Phase 4: Web UI Dashboard (Status: ⏳ PLANNED)
- **Objective**: Implement a high-performance local dashboard UI for reviewing static analysis reports and applying suggested code modifications.
- **Report Path**: `process/features/ai-code-review/reports/phase-04-web-ui_REPORT.md`

### Phase 5: Integration & Hardening (Status: ⏳ PLANNED)
- **Objective**: Stitch CLI flags (e.g. `ai-code-review ui` to start local web server and auto-launch the browser) and implement automated E2E verification suites.
- **Report Path**: `process/features/ai-code-review/reports/phase-05-hardening_REPORT.md`

---

## Architecture Decisions

### Decision 1: Process Separation with JSON Handshake
- **Rationale**: Keeps CLI runtime (Node.js) fast and modular, while keeping AST processing and AI integration in Python where libraries like networkx and LLM utilities are highly robust.
- **Implication**: CLI runs a Node child process executing the Python venv environment. Input arguments and output results are exchanged via JSON file streams (`analysis_report.json`) to decouple memory models.

---

## Touchpoints
- `packages/cli-global/package.json`
- `packages/cli-global/bin/cli.js`
- `packages/analysis-core/main.py`
- `process/context/all-context.md`

---

## Public Contracts
- **CLI Commands**:
  - `ai-code-review --help`
  - `ai-code-review --version`
- **Server Ports**: Local Express server runs on `http://localhost:3000` (configurable via env).
- **REST Endpoints**:
  - `POST /api/scan`: Trigger Python Core scanner.
  - `POST /api/apply`: Single-click file modifications.
  - `GET /api/report`: Fetch generated scanner results.
  - `POST /api/config`: Get and set environment parameters.

---

## Blast Radius
- Linking the CLI globally with `npm link` only registers the command for the local Node environment.
- The Python virtual environment is fully isolated in `packages/analysis-core/.venv` and does not leak to the host.
- Express server runs locally and listens exclusively to localhost interface.

---

## Verification Evidence
Verification proof will be preserved inside feature reports under `process/features/ai-code-review/reports/`.
- Verification of CLI execution logs.
- Validation of Express route responses (HTTP statuses and payloads).
- Test execution outputs conforming to [process/context/tests/all-tests.md](file:///d:/DATN2/process/context/tests/all-tests.md).

---

## Resume and Execution Handoff
- The primary execute anchor for Phase 2 is the Phase 2 plan: [phase-02-bridge-and-server_PLAN_31-05-26.md](file:///d:/DATN2/process/features/ai-code-review/active/phase-02-bridge-and-server_PLAN_31-05-26.md).
- To resume development, verify Phase 1 reports under `reports/` and then open Phase 2 plan.

---

## Cursor and RIPER-5 Integration

- **Cursor Plan Mode**: Focus on one phase plan at a time. Do not attempt to run steps from multiple phase plans simultaneously.
- **RIPER-5 Mode**: Follow RESEARCH → INNOVATE → PLAN → EXECUTE → VERIFY. The next action is to approve Phase 2 execution.

**Next Step Instructions**:
Review the Phase 2 Plan at `process/features/ai-code-review/active/phase-02-bridge-and-server_PLAN_31-05-26.md` and type `ENTER EXECUTE MODE` to begin development.
