# AI Code Review - Phase 5 Plan (Integration & Hardening)

**Date**: 31-05-26
**Complexity**: Complex
**Status**: ✅ VERIFIED

## Overview
This plan specifies the implementation for Phase 5 (Integration & Hardening) of the AI Code Review tool. It covers CLI command enhancements (adding the `scan` and `ui` subcommands), automatic browser launch upon starting the UI, and comprehensive end-to-end (E2E) integration testing with Vitest. This work builds on the foundations defined in [process/context/all-context.md](file:///d:/DATN2/process/context/all-context.md) and follows the testing procedures outlined in [process/context/tests/all-tests.md](file:///d:/DATN2/process/context/tests/all-tests.md).

---

## Quick Links
- [Acceptance Criteria](#acceptance-criteria)
- [Phase Completion Rules](#phase-completion-rules)
- [Execution Brief](#execution-brief)
- [Implementation Checklist](#implementation-checklist)
- [Touchpoints](#touchpoints)
- [Public Contracts](#public-contracts)
- [Blast Radius](#blast-radius)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)

---

## Acceptance Criteria
- [x] Command line invocation `ai-code-review scan [options]` is supported.
  - Options parsed: `--target <path>`, `--output <path>`, `--mock-scan`, and `--mock-ai`.
  - Spawns the Python bridge directly and outputs the result summary (number of findings) to stdout.
- [x] Command line invocation `ai-code-review ui [options]` (or mapped as default behavior / `--ui` flag) starts the local Express web server.
  - Automatically opens the default web browser pointing to `http://localhost:<port>`.
  - Uses a cross-platform shell executor (`start` on Windows, `open` on macOS, `xdg-open` on Linux).
- [x] A test suite is written in `packages/cli-global/src/__tests__/cli.test.js` verifying:
  - CLI argument parsing for both `scan` and `ui` subcommands.
  - Scan subprocess spawning.
  - Server startup and configuration.
- [x] The existing test timeout issue in `packages/cli-global/src/__tests__/bridge.test.js` is resolved by increasing the Vitest timeout.
- [x] All unit and API tests pass using vitest.

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

After each phase, document:
- [ ] What was tested manually
- [ ] Data verified (show file outputs, API responses)
- [ ] Errors encountered and fixed
- [ ] User confirmation received

---

## Execution Brief

### Phase 1: CLI Subcommand Parsing and Execution
**What happens**: We will enhance `packages/cli-global/bin/cli.js` to parse `scan` and `ui` subcommands and their respective options. We will import `runPythonAnalysis` from `../src/bridge.js` to support the scan command directly.
**Integration points**: CLI interacts with the Python process bridge to run static scans and read the resulting JSON reports.
**Test**: Execute manual scan and check that stdout displays the summary.
**Verify**: Verify that the output report matches the parsed options (e.g. correct output path).
**Done when**: User confirms scan outputs matching findings counts.

### Phase 2: Browser Auto-open
**What happens**: We will implement the browser launch utility in `cli.js` using `child_process.exec`.
**Integration points**: Starts local web server on requested port, then triggers the platform-appropriate browser command.
**Test**: Start CLI without args, verify server starts and browser window opens automatically.
**Verify**: Check that local dashboard is loaded in the browser.
**Done when**: User confirms browser opened on localhost port.

### Phase 3: Testing & Hardening
**What happens**: We will create `packages/cli-global/src/__tests__/cli.test.js` to verify CLI command execution. We will also adjust `bridge.test.js` to avoid timing out on Windows.
**Integration points**: Vitest test runner runs unit and integration tests.
**Test**: `npm run test` executes all test files and passes cleanly.
**Verify**: Verify all test assertions pass.
**Done when**: Test suite passes with 0 failures.

---

## Phased Execution Workflow

**IMPORTANT**: This plan uses a phase-by-phase execution model with built-in approval gates. Each phase/RFC follows this workflow:

### Step 1: Pre-Phase Research
- Read existing code patterns in the codebase.
- Analyze similar implementations and potential blockers.
- Present findings to the user and request approval to proceed.

### Step 2: Detailed Planning
- Based on research, outline precise changes to files.
- Define specific verification steps.
- Get user approval before implementing.

### Step 3: Implementation
- Implement the changes exactly as agreed upon.

### Step 4: Testing & Verification
- Execute automated tests and verify manually.
- Document logs and test results.

### Step 5: User Confirmation
- Present a post-stage summary of what is functional, what was tested, and how to verify it manually.
- Wait for user approval before moving to the next phase.

---

## Implementation Checklist

1. [x] Perform research on CLI argument parsing using `parseArgs` and subcommand implementation. Present findings and obtain approval to implement.
2. [x] Modify `packages/cli-global/bin/cli.js` to parse `scan` and `ui` subcommands using `parseArgs` with `allowPositionals: true`.
3. [x] Implement the `scan` subcommand action in `cli.js`:
    - Call `runPythonAnalysis` with parsed `--target`, `--output`, `--mock-scan`, and `--mock-ai`.
    - Upon completion, read the output report file and log the summary of findings (e.g. `Scan complete. Found X finding(s).`) to stdout.
4. [x] Implement the `ui` subcommand action in `cli.js` and map it as the default fallback and `--ui` flag handler:
    - Start the Express server on the parsed or default port.
    - Implement a cross-platform browser opening command (`start` on Windows, `open` on macOS, `xdg-open` on Linux) and invoke it after the server starts. Ensure the browser launch can be bypassed in test environments using `process.env.NODE_ENV === 'test'` or `process.env.TEST_SKIP_BROWSER === 'true'`.
5. [x] Perform research on E2E integration test approaches using child process spawning. Present findings and obtain approval.
6. [x] Create `packages/cli-global/src/__tests__/cli.test.js` using Vitest to verify argument parsing, scan subcommand spawning, and UI server startup.
7. [x] Modify `packages/cli-global/src/__tests__/bridge.test.js` to add a generous testTimeout (e.g. `20000ms`) to avoid timeout errors in subprocess spawns.
8. [x] Run all tests using `npm run test` and verify that the test suite runs and passes cleanly.

---

## Touchpoints
- `packages/cli-global/bin/cli.js`
- `packages/cli-global/src/__tests__/cli.test.js`
- `packages/cli-global/src/__tests__/bridge.test.js`

---

## Public Contracts
- **CLI Commands**:
  - `ai-code-review scan [options]`
    - `--target <path>` or `-t <path>`
    - `--output <path>` or `-o <path>`
    - `--mock-scan`
    - `--mock-ai`
  - `ai-code-review ui [options]` (or default if no subcommands/flags provided)
    - `--port <number>` or `-p <number>`
- **Environment Variables**:
  - `TEST_SKIP_BROWSER=true` / `NODE_ENV=test`: Disables automatic browser opening during tests.

---

## Blast Radius
- The command-line global interface is modified, affecting `ai-code-review` globally linked execution behavior.
- Express port conflicts will be handled with user-friendly error logs instead of uncaught process crashes.
- Web browser spawning executes OS commands via `child_process.exec`, which could run shell commands if input is not sanitized (url input is hardcoded to localhost port, ensuring safety).

---

## Verification Evidence
All verification reports and logs will be written to:
- `process/features/ai-code-review/reports/phase-05-hardening_REPORT.md`

Verification steps include:
- Executing `npx vitest run` and ensuring all tests (including new E2E and modified bridge tests) pass successfully.
- Manual verification of `ai-code-review scan --mock-scan --mock-ai` to ensure the summary is printed cleanly.
- Manual verification of `ai-code-review ui` to ensure the Express server starts and automatically opens the dashboard in a default web browser window.

---

## Resume and Execution Handoff
- The primary execute anchor is this plan: `process/features/ai-code-review/active/phase-05-hardening_PLAN_31-05-26.md`.
- Supporting reports are stored in `process/features/ai-code-review/reports/`.
- To resume execution, start by researching subcommand parsing in `packages/cli-global/bin/cli.js`.

---

## Cursor + RIPER-5 Guidance
- **Cursor Plan Mode**: Load the Implementation Checklist into your Cursor agent context. Run steps one-by-one.
- **RIPER-5**: Proceed through Phase 5 by executing the pre-phase research, implementing changes, and verifying results.
- **Next Step**: Review the plan and approve to proceed. Type `ENTER EXECUTE MODE` to begin.
