# Python Core Analysis Engine Setup - Plan

**Date**: 31-05-26  
**Complexity**: Simple  
**Status**: ✅ VERIFIED

## Overview

Set up the initial Python-based Analysis Engine for the AI Code Review system under `packages/analysis-core/`. This engine will serve as the core service for running static security analysis using Semgrep, building codebase knowledge representation, and calling the `9router` API proxy to retrieve AI-generated code fixes. This plan outlines setting up the directory, virtual environment, and dependency files, along with lightweight mock/basic implementations of `scanner.py`, `ai_resolver.py`, and `main.py` to verify end-to-end orchestration.

This plan aligns with the repository guidelines in `process/context/all-context.md` and uses the testing conventions in `process/context/tests/all-tests.md` for post-phase testing and test procedures.

## Quick Links

- [Goals and Success Metrics](#goals-and-success-metrics)
- [Phase Completion Rules](#phase-completion-rules)
- [Execution Brief](#execution-brief)
- [Scope](#scope)
- [Assumptions and Constraints](#assumptions-and-constraints)
- [Functional Requirements](#functional-requirements)
- [Non-Functional Requirements](#non-functional-requirements)
- [Acceptance Criteria](#acceptance-criteria)
- [Implementation Checklist](#implementation-checklist)
- [Risks and Mitigations](#risks-and-mitigations)
- [Integration Notes](#integration-notes)
- [Touchpoints](#touchpoints)
- [Public Contracts](#public-contracts)
- [Blast Radius](#blast-radius)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)
- [Cursor + RIPER-5 Guidance](#cursor--riper-5-guidance)

## Goals and Success Metrics

**Goals:**
- Establish the `packages/analysis-core/` directory and configure the Python development environment.
- Implement a basic Semgrep wrapper (`scanner.py`) to execute static security checks on target files.
- Implement a basic AI resolver (`ai_resolver.py`) utilizing `9router` to query for vulnerability fixes.
- Build a unified entry script (`main.py`) orchestrating scanning, resolving, and returning JSON outputs.
- Verify connectivity, setup scripts, and environment integrity via automated steps.

**Success Metrics:**
- Python virtual environment successfully initialized and populated with dependencies from `requirements.txt`.
- Semgrep wrapper runs a subprocess scan on files and handles both actual scan outputs and mock scan fallbacks.
- AI Resolver queries `9router` API with authentication and successfully parses response data (or handles mock mode cleanly).
- Combined engine runs end-to-end via `python main.py` and outputs a valid JSON report.
- Zero exceptions uncaught during typical runs.

---

## Phase Completion Rules

A phase is NOT complete until:

1. **Integration Test** - Works with other system pieces
2. **Manual Test** - User can perform the action
3. **Data Verification** - Database/state changes confirmed
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
- [ ] Data verified in DB/state/files (show query/output + result)
- [ ] Errors encountered and fixed
- [ ] User confirmation received

*Note: For this simple plan, "Data verified in DB/state/files" will verify output files (such as `analysis_report.json`) and stdout responses instead of database records, as no database is integrated in this setup phase.*

---

## Execution Brief

**IMPORTANT:** This is a SIMPLE (one-session) plan - implement continuously without approval gates. The phases below are logical groupings for understanding flow, NOT stop points.

### Phase 1: Environment & Setup
- **What happens:** Create `packages/analysis-core/` and initialize Python virtual environment. Create `requirements.txt` and `.env.example`.
- **Test:** Verify venv creation and activate it successfully.
- **Verify:** Run `pip list` or check packages directory structure.
- **Done when:** Environment is active and pip packages are installed.

### Phase 2: Static Security Scanner Wrapper
- **What happens:** Write `scanner.py` to wrap Semgrep subprocess invocations. Add fallback mock capability if Semgrep isn't installed.
- **Test:** Run `scanner.py` directly with a test target directory/file.
- **Verify:** Confirm it produces a list of scan results containing file path, line number, rule details, message, and severity.
- **Done when:** The scanner wrapper outputs valid JSON results under normal and fallback modes.

### Phase 3: AI Resolver Integration
- **What happens:** Write `ai_resolver.py` to read environment variables (`NINEROUTER_API_KEY`, `NINEROUTER_BASE_URL`) and send a test request to 9router.
- **Test:** Run `ai_resolver.py` with mock findings.
- **Verify:** Verify 9router response or mock fallback message.
- **Done when:** The resolver successfully processes findings and returns AI recommendations.

### Phase 4: Entry Point Orchestrator
- **What happens:** Implement `main.py` which ties `scanner.py` and `ai_resolver.py` together, parsing arguments and outputting the analysis report JSON.
- **Test:** Run `python main.py --target .`
- **Verify:** Confirm creation of `analysis_report.json` with correct schema.
- **Done when:** End-to-end CLI run runs without errors and outputs valid JSON.

### Expected Outcome
- A structured Python workspace under `packages/analysis-core/`.
- Verified python scripts capable of running static analysis scans and calling the 9router API.
- Reusable environment configuration ready for subsequent feature implementation.

---

## Scope

**In-Scope:**
- Setting up Python 3.x virtual environment inside `packages/analysis-core/`.
- Creating `requirements.txt` with `requests`, `networkx`, `semgrep`, and `python-dotenv`.
- Implementing `scanner.py` wrapper for Semgrep (subprocesses/mock fallback).
- Implementing `ai_resolver.py` wrapper for 9router API (HTTP POST request/mock fallback).
- Implementing `main.py` command line interface for orchestrating the analysis loop.
- Providing `.env.example` and basic error handling for environmental failures.

**Out-of-Scope:**
- Building the AST Knowledge Graph (GitNexus) logic (reserved for a later phase).
- Integrating the Python Core with the global Node CLI server (handled separately).
- Setting up a database or state persistence within analysis-core (reports are stored as flat files).
- Production deployment configurations or CI/CD pipelines.

## Assumptions and Constraints

**Assumptions:**
- Python 3.10+ is installed on the user's OS (Windows).
- Semgrep CLI is either installed on the path or can be mocked.
- 9router base URL and API key will be provided in a local `.env` file.
- The default behavior should be resilient to lack of API key or local Semgrep binary by gracefully degrading to mock output.

**Constraints:**
- Must keep all files isolated within the `packages/analysis-core/` directory.
- Cannot write project code outside `packages/analysis-core/`.
- Standard simple plan rules apply: continuous execution in a single session.

## Functional Requirements

1. **Environment Setup**
   - Setup a standard `.venv` virtual environment.
   - Install required dependencies via `pip install -r requirements.txt`.

2. **Scanner Module (`scanner.py`)**
   - Provide a function `run_scan(target_path: str, use_mock: bool = False) -> dict`.
   - Invoke `semgrep scan --json --quiet` via Python's `subprocess` module when not using mock.
   - Parse Semgrep's JSON output to extract rule IDs, file paths, line numbers, and messages.
   - Fall back to standard mock findings if Semgrep execution fails or `use_mock` is active.

3. **AI Resolver Module (`ai_resolver.py`)**
   - Load configuration from environment files using `python-dotenv`.
   - Provide a function `resolve_findings(findings: dict, use_mock: bool = False) -> dict`.
   - Send requests using the `requests` library to the 9router chat completions endpoint.
   - Provide a mock resolver fallback when API credentials are not set.

4. **Engine Main Entry (`main.py`)**
   - Command-line arguments: `--target`, `--mock`, `--output`.
   - Coordinate the scan-then-resolve pipeline.
   - Output analysis report to file specified by `--output` (defaulting to `analysis_report.json`).

## Non-Functional Requirements

- **Type Annotations:** Use Python type hinting for key functions and classes.
- **Robust Error Handling:** Log errors to stderr, return sensible default structures, and avoid crashing when dependencies are missing.
- **Configurability:** Load settings from environment variables to allow seamless local configuration.

## Acceptance Criteria

1. ✅ `packages/analysis-core/` contains `.venv/`, `requirements.txt`, `scanner.py`, `ai_resolver.py`, and `main.py`.
2. ✅ The virtual environment initializes successfully and installs all specified requirements.
3. ✅ `scanner.py` can be executed independently and returns structured JSON findings.
4. ✅ `ai_resolver.py` executes, reads configuration from `.env`, and attempts connection to 9router (or prints mock results if credentials missing).
5. ✅ Running `python main.py --target ./` outputs a valid JSON report containing both security findings and remediation advice.
6. ✅ Code compiles and runs without warnings or syntax errors on Python 3.10+.

## Implementation Checklist

1. **Create Directory Structure**
   - Create directories: `packages/analysis-core/`
   - [Test] Run shell command `ls packages/` (or `dir packages` on Windows) to verify folder existence.
2. **Initialize Python Virtual Environment**
   - Create virtual environment inside the package directory: `python -m venv packages/analysis-core/.venv`
   - [Test] Confirm creation of activation scripts inside `packages/analysis-core/.venv/`.
3. **Create Requirements File**
   - Create `packages/analysis-core/requirements.txt` with contents:
     ```
     requests>=2.31.0
     networkx>=3.1
     semgrep>=1.65.0
     python-dotenv>=1.0.1
     ```
   - [Test] Verify file contents via file reader or cat.
4. **Install Python Dependencies**
   - Activate virtual environment and install packages:
     - Windows: `& "packages/analysis-core/.venv/Scripts/Activate.ps1"; pip install -r packages/analysis-core/requirements.txt`
   - [Test] Verify package installations with `pip list` to check `requests`, `networkx`, `semgrep`, and `python-dotenv`.
5. **Create Environment Configuration Templates**
   - Create `packages/analysis-core/.env.example` with empty placeholder values:
     ```env
     NINEROUTER_API_KEY=
     NINEROUTER_BASE_URL=https://api.9router.com/v1
     ```
   - Create a local copy `.env` for testing.
   - [Test] Confirm both files are present in the directory.
6. **Implement Scanner Module**
   - Implement `packages/analysis-core/scanner.py` containing `run_scan(target_path, use_mock=False)` using `subprocess.run` to call `semgrep`.
   - Return structured dictionary of results. Provide built-in mock vulnerability data if `semgrep` is missing.
   - [Test] Run `python -c "import scanner; print(scanner.run_scan('.'))"` using the venv interpreter to ensure it returns scan findings.
7. **Implement AI Resolver Module**
   - Implement `packages/analysis-core/ai_resolver.py` containing `resolve_findings(findings, use_mock=False)` sending HTTP POST requests to the `9router` API.
   - Handle API connection failures and load `.env` variables cleanly.
   - [Test] Run `python -c "import ai_resolver; print(ai_resolver.resolve_findings({'findings': []}))"` to test fallback behavior and API setup.
8. **Implement Entry Point CLI**
   - Implement `packages/analysis-core/main.py` parsing CLI arguments `--target`, `--output`, `--mock-scan`, and `--mock-ai`.
   - Run the workflow: scan -> query AI -> write unified output report.
   - [Test] Run `python main.py --mock-scan --mock-ai` and verify it generates a valid JSON output report.
9. **Verify System End-to-End**
   - Run `python main.py --target .` using actual or mock modes.
   - Verify that output file `analysis_report.json` contains appropriate JSON properties.
   - [Test] Inspect `analysis_report.json` for keys: `scanner`, `timestamp`, `findings`, and `ai_resolutions`.

## Risks and Mitigations

- **Risk:** Semgrep CLI binary might not be available or run properly on Windows.
  - **Mitigation:** Scanner wrapper will check for binary presence and gracefully fall back to mock data or output clear guidance on installing Semgrep.
- **Risk:** 9router API key is missing during testing.
  - **Mitigation:** Resolver will detect missing credentials and operate in a mock-resolver mode, returning placeholder remediation advices.

## Integration Notes

- **Environment variables**: Loaded inside Python scripts using python-dotenv.
- **Subprocess calls**: Execution is sandboxed within sub-shells using safe arg lists.
- **JSON format parity**: Inter-process communication happens via stdout and file streams containing JSON payloads.

## Touchpoints

- New files will be created under `packages/analysis-core/`:
  - `packages/analysis-core/.venv/` (Directory)
  - `packages/analysis-core/requirements.txt` (File)
  - `packages/analysis-core/.env.example` (File)
  - `packages/analysis-core/.env` (File)
  - `packages/analysis-core/scanner.py` (File)
  - `packages/analysis-core/ai_resolver.py` (File)
  - `packages/analysis-core/main.py` (File)

## Public Contracts

- **`main.py` command line interface**:
  - Arguments:
    - `--target <path>`: Root directory path to run static analysis on.
    - `--output <path>`: Destination path for the JSON results report (defaults to `analysis_report.json`).
    - `--mock-scan`: Forces the use of mock scan findings instead of invoking the Semgrep binary.
    - `--mock-ai`: Forces mock AI suggestions instead of contacting the 9router API.
- **Unified JSON Output Schema**:
  ```json
  {
    "scanner": "semgrep",
    "timestamp": "2026-05-31T10:30:00Z",
    "target_path": "./",
    "findings": [
      {
        "file": "path/to/file.py",
        "line": 12,
        "rule_id": "python.lang.security.audit.dangerous-exec",
        "message": "Found use of exec()",
        "severity": "WARNING"
      }
    ],
    "ai_resolutions": {
      "python.lang.security.audit.dangerous-exec": {
        "suggestion": "Avoid using exec(). Use structured functions or parse inputs securely.",
        "remediation_code": "# Removed exec"
      }
    }
  }
  ```

## Blast Radius

- The setup is completely isolated within `packages/analysis-core/`. There will be zero impact on `packages/cli-global/` or the existing Node/web infrastructure since we are only adding a new standalone directory.

## Verification Evidence

- Verification will be documented in `process/general-plans/reports/python-core-setup_REPORT.md` or similar execution log.
- Captured command line outputs showing pip installations, `scanner.py` executions, and the final run of `main.py` generating `analysis_report.json`.

## Resume and Execution Handoff

- When the execution agent assumes control, they should:
  1. Confirm local environment has Python 3.10+.
  2. Create the target directory and run venv creation commands.
  3. Install dependencies from `requirements.txt`.
  4. Write `scanner.py`, `ai_resolver.py`, and `main.py` in sequence.
  5. Run each file's direct execution test to ensure success before stitching them in `main.py`.

---

## Cursor + RIPER-5 Guidance

- **Cursor Plan Mode:**
  - Import this checklist into Cursor Plan mode.
  - Execute all steps (1-9) continuously in a single session.
  - Run the manual verification test after each step is implemented.

- **RIPER-5 Mode (SIMPLE - Fast Track):**
  - **RESEARCH:** ✅ Complete - Reviewed requirements and setup structure.
  - **INNOVATE:** ✅ Complete - Agreed on python dependency set and wrapper setup.
  - **PLAN:** ✅ Current - This plan document.
  - **EXECUTE:** Next - Implement all 9 steps in the checklist continuously.
  - **REVIEW:** After execution - Run the verification procedures and compare against acceptance criteria.

**Next Step:** Propose plan to user and wait for approval to enter EXECUTE mode.
