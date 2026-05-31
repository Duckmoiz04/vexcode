# AI Code Review Tool - Phase 2 Plan (Node-Python Bridge and Local Server)

**Date**: 31-05-26
**Complexity**: Complex
**Status**: ⏳ PLANNED

## Overview

This plan defines the detailed technical design and implementation steps for **Phase 2** of the DATN2 AI Code Review tool. 

Phase 2 focuses on establishing the communication bridge between the global Node.js CLI tool (`packages/cli-global`) and the Python Analysis Core (`packages/analysis-core`), and constructing the local Express.js web server. This server will expose endpoints for triggering static scans, fetching reports, applying code remediations directly, and reading/writing configuration values.

This plan aligns with the repository guidelines in [process/context/all-context.md](file:///d:/DATN2/process/context/all-context.md) and utilizes the testing conventions in [process/context/tests/all-tests.md](file:///d:/DATN2/process/context/tests/all-tests.md) for verification.

---

## Quick Links
- [Context and Goals](#context-and-goals)
- [Phase Completion Rules](#phase-completion-rules)
- [Execution Brief](#execution-brief)
- [Scope](#scope)
- [Assumptions and Constraints](#assumptions-and-constraints)
- [Architecture Decisions](#architecture-decisions)
- [High-level Data Flow](#high-level-data-flow)
- [Security Posture](#security-posture)
- [Component Details](#component-details)
- [API Surface](#api-surface)
- [Phased Delivery Plan](#phased-delivery-plan)
- [Acceptance Criteria](#acceptance-criteria)
- [Implementation Checklist](#implementation-checklist)
- [Touchpoints](#touchpoints)
- [Public Contracts](#public-contracts)
- [Blast Radius](#blast-radius)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)
- [Cursor and RIPER-5 Integration](#cursor-and-riper-5-integration)

---

## Context and Goals

In Phase 1, we set up two isolated workspaces:
1. `packages/cli-global/` - Global CLI shell.
2. `packages/analysis-core/` - Python core which integrates Semgrep scanner and 9router AI API.

In Phase 2, our goals are:
- Build a process bridge (`bridge.js`) in Node.js that locates the Python virtual environment (`.venv`) and spawns the Analysis Core subprocess cross-platform.
- Implement a local Express server in Node.js with the following endpoints:
  - `POST /api/scan`: Run the python scanner on a target path.
  - `GET /api/report`: Load the generated JSON scanner report.
  - `POST /api/apply`: Safely apply code remediations to files.
  - `GET /api/config` & `POST /api/config`: Manage environment variables (`NINEROUTER_API_KEY`, etc.).
- Introduce unit/integration testing for the Node CLI and server using Vitest.

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

## Execution Brief

This phase will be executed across the following stages:
- **Stage 1: Server and Test Tooling Setup**: Add `express`, `cors`, and `dotenv` dependencies to `packages/cli-global`, along with the `vitest` unit-testing framework.
- **Stage 2: Process Bridge (`bridge.js`)**: Create a subprocess wrapper that automatically detects Windows/Unix paths for `.venv/Scripts/python.exe` vs `.venv/bin/python` and runs the python engine.
- **Stage 3: Express REST Server (`server.js`)**: Establish routing and route handlers for `/api/scan`, `/api/report`, `/api/apply`, and `/api/config`.
- **Stage 4: CLI Integration**: Bind a `--server` flag to the entry point `bin/cli.js` to boot the Express instance.
- **Stage 5: Test Execution and Verification**: Write automated unit tests for route and bridge behaviors and execute manual E2E verification.

### Expected Outcome
- The global Node CLI can spawn the Python core scanner seamlessly.
- An Express server is fully functional and testable locally on port 3000.
- Source files can be programmatically updated with code remediations via `/api/apply`.

---

## Scope

**In-Scope:**
- Spawning Python core in Node.js child processes.
- Cross-platform virtual environment path resolution.
- Express server configuration and API routes implementation.
- Safety checks on `/api/apply` to prevent directory traversal and file corruption.
- Configuration loading/writing for `.env` files.
- Vitest configuration and automated testing suites for the global package.

**Out-of-Scope:**
- GitNexus AST Knowledge Graph building (Phase 3).
- Frontend UI dashboard layout construction (Phase 4).
- Production deployment or multi-user session management (server is local-only).

---

## Assumptions and Constraints

- **Windows OS**: Development and initial execution take place on Windows. The bridge must resolve Windows executable paths (`.venv\Scripts\python.exe`) as well as Unix paths (`.venv/bin/python`).
- **Single-User Local**: Express server will bind exclusively to `localhost` / `127.0.0.1` for security.
- **Node.js engine >= 18.3.0**: Native ESM support is required.

---

## Architecture Decisions

### AD-001: Express.js for the Local REST API Server
- **Decision**: Use Express.js as the routing and endpoint framework.
- **Rationale**: Minimal, fast, extremely popular, and integrates well with existing ES modules setup. High-level routing capabilities make adding dashboard API endpoints simple.

### AD-002: Cross-Platform Python Interpreter Path Resolution
- **Decision**: Resolve the venv python interpreter path programmatically using `process.platform` checks.
- **Rationale**: Prevent developer environment mismatch.
  - Windows: `packages/analysis-core/.venv/Scripts/python.exe`
  - Unix/macOS: `packages/analysis-core/.venv/bin/python`

### AD-003: Subprocess spawn over exec
- **Decision**: Use `child_process.spawn` instead of `child_process.exec` to run the python core.
- **Rationale**: `exec` buffers the entire stdout/stderr output in memory and fails if it exceeds 1MB. Large Semgrep JSON report streams can easily exceed buffer limits. `spawn` streams outputs via pipes.

---

## High-level Data Flow

```
+-------------+               +--------------+               +----------------------+
|  Web UI /   | --(HTTP)----> |  Express JS  | --(spawn)---> |    Python Engine     |
|  Local CLI  |               |  Server      |               |  (packages/          |
|  Consumer   | <--(JSON)---- |  (Node.js)   | <--(JSON)---- |   analysis-core)     |
+-------------+               +--------------+               +----------------------+
                                     |                                  |
                                 (reads/writes)                    (reads/writes)
                                     v                                  v
                              Target Codebase                   analysis_report.json
                              File System                       & .env Config File
```

---

## Security Posture

- **Directory Traversal Avoidance**: All file operations (reading config, reading files, applying fixes) must resolve target paths using `path.resolve` and verify that the target path remains within the resolved workspace directory.
- **Apply Validation**: `/api/apply` must perform line checks:
  1. Read the target file.
  2. Locate the line specified by `targetLine`.
  3. Ensure the exact character sequence of `targetContent` matches the target file segment.
  4. Perform the replacement only if they match, avoiding unintended file corruption.

---

## Component Details

### `packages/cli-global/src/bridge.js`
- **Responsibility**: Detects platform, spawns python venv interpreter, passes args (`--target`, `--output`, etc.), resolves promise when execution finishes, and catches process failures.
- **Key Methods**:
  - `runPythonAnalysis(targetPath, reportOutputPath, mockScan = false, mockAi = false): Promise<void>`

### `packages/cli-global/src/server.js`
- **Responsibility**: Boots the Express application, sets up CORS/Body-parser middleware, and configures the API router.
- **Routes**:
  - `POST /api/scan`: Calls `bridge.js` to trigger a new run.
  - `GET /api/report`: Reads `analysis_report.json` and outputs findings.
  - `POST /api/apply`: Modifies target file contents securely.
  - `GET /api/config` & `POST /api/config`: Reads/updates `.env` configuration keys.

---

## API Surface

### 1. `POST /api/scan`
- **Request Body**:
  ```json
  {
    "targetPath": "d:/DATN2",
    "mockScan": true,
    "mockAi": true
  }
  ```
- **Response (Success)**:
  ```json
  {
    "success": true,
    "message": "Scan execution complete",
    "reportPath": "d:/DATN2/packages/analysis-core/analysis_report.json"
  }
  ```

### 2. `GET /api/report`
- **Query Parameter**: `?path=d:/DATN2/packages/analysis-core/analysis_report.json`
- **Response**: The parsed content of `analysis_report.json`.

### 3. `POST /api/apply`
- **Request Body**:
  ```json
  {
    "filePath": "d:/DATN2/example.py",
    "targetLine": 12,
    "targetContent": "exec(user_input)",
    "replacementContent": "import subprocess\nsubprocess.run(['echo', user_input])"
  }
  ```
- **Response (Success)**:
  ```json
  {
    "success": true,
    "message": "Vulnerability resolution applied successfully."
  }
  ```

### 4. `GET /api/config`
- **Response**:
  ```json
  {
    "NINEROUTER_API_KEY": "nr-xxx",
    "NINEROUTER_BASE_URL": "https://api.9router.com/v1"
  }
  ```

### 5. `POST /api/config`
- **Request Body**:
  ```json
  {
    "NINEROUTER_API_KEY": "nr-new-key",
    "NINEROUTER_BASE_URL": "https://api.9router.com/v1"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Configuration updated successfully."
  }
  ```

---

## Phased Delivery Plan

1. **Stage 1**: Dependency configuration (Express & Vitest).
2. **Stage 2**: Process Bridge implementation.
3. **Stage 3**: Server endpoints integration.
4. **Stage 4**: CLI command integration (`bin/cli.js --server`).
5. **Stage 5**: Automated Unit Testing & Manual End-to-End verification.

---

## Acceptance Criteria

- [ ] Node Express server boots on `http://localhost:3000` (or configured port).
- [ ] `POST /api/scan` spawns the Python venv interpreter successfully and generates `analysis_report.json` without process crashes.
- [ ] `GET /api/report` reads and returns the scanner JSON payload.
- [ ] `POST /api/apply` safely replaces target lines in code files, throwing clear errors if contents mismatch or paths escape the workspace.
- [ ] `GET /api/config` and `POST /api/config` read and modify environmental variables inside the Analysis Core's `.env`.
- [ ] Executing `npm run test` inside `packages/cli-global` runs all unit tests successfully.
- [ ] The CLI entry point launches the server when run with `node bin/cli.js --server` or `ai-code-review --server`.

---

## Implementation Checklist

### Stage 1: Tooling and Dependency Setup
- [ ] 1. Add `express`, `cors`, and `dotenv` to `packages/cli-global/package.json` dependencies.
- [ ] 2. Add `vitest` and `supertest` to `packages/cli-global/package.json` devDependencies. Add a `"test": "vitest run"` script.
- [ ] 3. Run `npm install` inside `packages/cli-global` to install the packages.
  - *Verification Command*: Ensure `npm run test` executes (it can fail with 'no tests found' but should run the vitest runner).

### Stage 2: Spawning Process Bridge
- [ ] 4. Create `packages/cli-global/src/bridge.js`. Implement `runPythonAnalysis` resolving path of `.venv` interpreter cross-platform and spawning python processes.
- [ ] 5. Write a unit test `packages/cli-global/src/__tests__/bridge.test.js` verifying that the bridge correctly resolves paths and successfully launches Python.
  - *Verification Command*: `npx vitest run src/__tests__/bridge.test.js` passes.

### Stage 3: Express REST Server
- [ ] 6. Create `packages/cli-global/src/server.js`. Implement Express routing, CORS middleware, and JSON body parsing.
- [ ] 7. Implement `GET /api/config` and `POST /api/config` reading/updating `.env` parameters inside `packages/analysis-core/`.
- [ ] 8. Implement `POST /api/scan` that delegates execution to `bridge.js`.
- [ ] 9. Implement `GET /api/report` reading `analysis_report.json`.
- [ ] 10. Implement `POST /api/apply` with target line safety matching logic.
- [ ] 11. Write API unit tests `packages/cli-global/src/__tests__/server.test.js` using `supertest` to mock route behaviors.
  - *Verification Command*: `npx vitest run src/__tests__/server.test.js` passes.

### Stage 4: CLI Integration
- [ ] 12. Update `packages/cli-global/bin/cli.js` to import `server.js` and add parser options for `--server` (or `-s`) and `--port` (or `-p`).
- [ ] 13. Implement code to start the Express server and log the startup URL when `--server` is supplied.

### Stage 5: Manual End-to-End Verification
- [ ] 14. Link CLI globally: `npm link` inside `packages/cli-global`.
- [ ] 15. Run `ai-code-review --server --port 3000` to start the local backend.
- [ ] 16. Perform curl / Postman calls to verify:
  - `GET http://localhost:3000/api/config` (returns variables)
  - `POST http://localhost:3000/api/scan` with mock scan options (spawns bridge, writes report)
  - `GET http://localhost:3000/api/report` (returns mock scan details)
  - `POST http://localhost:3000/api/apply` on a temporary test file (applies changes successfully)
- [ ] 17. Unlink global command and restore clean workspace state.

---

## Touchpoints

- `packages/cli-global/package.json`
- `packages/cli-global/bin/cli.js`
- `packages/cli-global/src/bridge.js` (new)
- `packages/cli-global/src/server.js` (new)
- `packages/cli-global/src/__tests__/bridge.test.js` (new)
- `packages/cli-global/src/__tests__/server.test.js` (new)

---

## Public Contracts

- **Server Port**: Default `http://localhost:3000`
- **CLI Command**: `ai-code-review --server [--port <number>]`
- **JSON endpoints**:
  - `POST /api/scan`
  - `GET /api/report`
  - `POST /api/apply`
  - `GET /api/config`
  - `POST /api/config`

---

## Blast Radius

- Node dependencies are constrained solely to `packages/cli-global/package.json`. No changes propagate to `packages/analysis-core/` environment (except writing to its `.env` file).
- Spawning Python operates in a separate OS thread context, limiting CPU/memory leakage into the Node.js event loop.

---

## Verification Evidence

- Executing `npm run test` inside `packages/cli-global` will provide automated test evidence.
- Run log output of starting the server, running a scan, and reading the config via curl should be recorded inside `process/features/ai-code-review/reports/phase-02-bridge-and-server_REPORT.md` during execution.

---

## Resume and Execution Handoff

- This plan functions as the primary execute anchor for Phase 2.
- It is supported by the other active phase files (e.g., the umbrella plan).
- Future execution starts at Stage 1 in the Implementation Checklist.
- Key files to view:
  - `packages/cli-global/package.json`
  - `packages/cli-global/bin/cli.js`
  - `packages/analysis-core/main.py`
- Setup commands: `npm install` under `packages/cli-global/`.

---

## Cursor and RIPER-5 Integration

- **Cursor Plan Mode**: Load this checklist. Interleave coding task with Vitest execution.
- **RIPER-5**: Proceed sequentially. If any scope changes mid-flight, update the plan before changing files.

**Next Step Instructions**:
Review this plan, check for errors, and type `ENTER EXECUTE MODE` when ready to start implementation.
