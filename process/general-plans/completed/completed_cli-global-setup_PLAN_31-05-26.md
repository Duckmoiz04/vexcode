# CLI Global Setup Plan

**Date**: 31-05-26
**Complexity**: Simple
**Status**: ✅ VERIFIED

## Overview
This plan defines the steps to set up a Node.js CLI project that can be registered and run globally. This includes configuring the `package.json` for binary execution, designing the folder structure, configuring the shebang `#!/usr/bin/env node`, setting executable permissions (`chmod +x`), parsing CLI arguments, and linking the command globally using `npm link` or `npm install -g .` for testing.

## Execution Brief
This project will be executed in 4 logical phases to ensure complete verification at each boundary:
- **Phase 1: Project Initialization & Folder Structure**: Initialize the Node.js project as an ES module and scaffold folders.
- **Phase 2: Executable Entrypoint & Package Config**: Create the entrypoint script with shebang, set permissions, and configure the `bin` field in `package.json`.
- **Phase 3: CLI Argument Parsing**: Implement basic command line arguments and options handling.
- **Phase 4: Global Linking & Validation**: Link the CLI globally using npm and verify executable behavior.

### Phase 1: Project Initialization & Folder Structure
- **What happens**: Create the base directory structure, initialize a new Node.js package, and configure package options.
- **Test**: Run `node -v` and `npm -v` to ensure Node.js is active.
- **Verify**: Confirm `package.json` exists and features `"type": "module"`.
- **Done when**: File structure matches target layout, and user confirms project folder is ready.

### Phase 2: Executable Entrypoint & Package Config
- **What happens**: Add a binary entrypoint file with the shebang `#!/usr/bin/env node` and declare the command name in the `package.json` `bin` field.
- **Test**: Run `node ./bin/cli.js` directly to ensure it runs without errors.
- **Verify**: Ensure execution permission is set via `git update-index --chmod=+x bin/cli.js` (or Unix `chmod +x`).
- **Done when**: Running the entrypoint directly executes the basic test message, and user confirmation is received.

### Phase 3: CLI Argument Parsing
- **What happens**: Add command-line argument parsing capability (e.g., using `node:util` `parseArgs` or `commander` library) to handle options like `--version`, `--help`, and custom commands.
- **Test**: Execute the CLI script locally with various arguments (e.g. `./bin/cli.js --help`).
- **Verify**: Output stdout matches expected help instructions.
- **Done when**: Option parser correctly handles provided inputs, and user confirms command line responses.

### Phase 4: Global Linking & Validation
- **What happens**: Link the project globally using `npm link` and run the command globally to ensure system-wide availability.
- **Test**: Execute the registered global command from outside the package directory.
- **Verify**: Verify global command executes successfully and returns the correct response.
- **Done when**: Command executes globally, and user confirmed working.

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
- [ ] Data verified in DB (show query + result)
- [ ] Errors encountered and fixed
- [ ] User confirmation received

---

## Scope
- **In Scope**:
  - Scaffolding a standalone Node.js project.
  - Setting up ESM support and package configurations.
  - Specifying the `bin` field in `package.json` for binary registration.
  - Creating a Node.js binary entrypoint with a shebang header.
  - Implementing CLI arguments parser using standard library (`node:util` `parseArgs`) or third-party tool (like `commander`).
  - Proposing commands for linking and unlinking (`npm link`, `npm install -g .`, `npm unlink`).
- **Out Scope**:
  - Creating a full functional business logic application.
  - Publishing the package to the official npm registry.
  - Packaging the CLI into self-contained single binaries (e.g. via `pkg` or `bun build --compile`).

## Assumptions and Constraints
- Environment runs Node.js v18.3+ or v20+ (supporting native `node:util` `parseArgs` if chosen).
- OS is Windows (as specified in user information) but CLI should run cross-platform (Windows / Unix / macOS).
- User has local Node.js and npm installed globally.

## Functional Requirements
- The CLI must run from any terminal using the registered global command (e.g. `sample-cli`).
- The CLI must parse standard flags: `--help` (to output usage details) and `--version` (to output current version).
- The CLI must gracefully handle unknown flags and throw user-friendly error messages.

## Non-Functional Requirements
- Zero-dependency design where possible (using built-in `node:util` `parseArgs`).
- Startup time under 100ms.
- Executable files must be formatted with UNIX line endings (`LF`) to prevent line-ending issues on Unix shells when run globally.

## Acceptance Criteria
- Executable file `bin/cli.js` starts with `#!/usr/bin/env node`.
- `package.json` contains a `bin` entry linking `sample-cli` (or another name) to `./bin/cli.js`.
- Running `npm link` registers the CLI globally.
- Running `sample-cli --version` prints the package version.
- Running `sample-cli --help` outputs CLI helper text.
- Running `sample-cli --name "World"` outputs a greeting `Hello, World!`.
- Verification of test/verification references inside [process/context/all-context.md](file:///d:/DATN2/process/context/all-context.md) and [process/context/tests/all-tests.md](file:///d:/DATN2/process/context/tests/all-tests.md).

## Implementation Checklist

1. [x] Initialize directory `packages/cli-global` and run `npm init -y` to create `package.json`
2. [x] Update `package.json` with `"type": "module"` and custom scripts/metadata
3. [x] Scaffold target directories: `bin/`, `src/`
4. [x] Create binary entrypoint file `bin/cli.js` containing `#!/usr/bin/env node`
5. [x] Update file line-endings of `bin/cli.js` to use LF (Unix format)
6. [ ] Set executable permissions using `git update-index --chmod=+x bin/cli.js` (Skipped: not a git repository)
7. [x] Add `bin` field mapping `ai-code-review` to `./bin/cli.js` in `package.json`
8. [x] Implement command line argument parsing logic using `node:util` `parseArgs` inside `bin/cli.js`
9. [x] Run manual validation of local entrypoint execution: `node bin/cli.js --help`
10. [x] Link project globally via `npm link` in command line
11. [x] Run validation of global command execution: `ai-code-review --help`
12. [x] Verify global version command execution: `ai-code-review --version`
13. [x] Verify custom options execution: `ai-code-review --name "User"`
14. [x] Unlink global command via `npm unlink` or `npm uninstall -g ai-code-review` and verify cleanup

## Risks and Mitigations
- **Unix Line Endings**: Creating the file on Windows might default to CRLF line endings. The shebang `#!/usr/bin/env node\r` fails on Unix systems with `env: node\r: No such file or directory`. *Mitigation*: Ensure editor saves the file with LF line-endings, and document this explicitly in the checklist.
- **Node Version Differences**: Older Node versions may not support `node:util` `parseArgs`. *Mitigation*: Specify Node engine constraints in `package.json` (e.g. `"engines": { "node": ">=18.3.0" }`).
- **Global Command Collision**: Command name could conflict with existing commands. *Mitigation*: Use a unique name for development, like `global-setup-demo`.

## Integration Notes
- This setup depends on the repository's context in [process/context/all-context.md](file:///d:/DATN2/process/context/all-context.md).
- Testing strategies should refer to [process/context/tests/all-tests.md](file:///d:/DATN2/process/context/tests/all-tests.md) for potential future test suites.

## Touchpoints
- `package.json`: Modifying options, adding `bin` mapping and script tasks.
- `bin/cli.js`: Executable entrypoint and argument routing logic.

## Public Contracts
- Global command invocation: `sample-cli [options]`
- Options:
  - `-h`, `--help`: Prints helper manual.
  - `-v`, `--version`: Prints package version.
  - `-n`, `--name <string>`: Custom input parameter.

## Blast Radius
- The project is configured as a standalone package/module. Linking globally impacts the local development environment globally but will not impact other workspaces or repository code packages directly.

## Verification Evidence
- Verification will be manually verified by:
  1. Local run: `node bin/cli.js --help`
  2. Global execution: `sample-cli --version` and `sample-cli --name "Alice"`
  3. Visual screenshot/console log check.

## Resume and Execution Handoff
- Future execution starts with Phase 1 in the checklist.
- To resume work, a developer should open `process/general-plans/active/cli-global-setup_PLAN_31-05-26.md` and begin with Task 1 in the Implementation Checklist.

## Cursor + RIPER-5 Guidance
- **Cursor Plan Mode**: Load this file and reference it to run the steps.
- **RIPER-5**: Proceed sequentially. If a step deviates, pause and update the plan first.
- **Next Step**: Say `ENTER EXECUTE MODE` to start implementation.
