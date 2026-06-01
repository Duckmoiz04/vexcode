# AI Code Review Tool - Phase 4 Plan (Web UI Dashboard)

**Date**: 31-05-26
**Complexity**: COMPLEX (Multi-phase)
**Status**: ✅ COMPLETED

## Overview

This plan specifies the design, implementation, and verification steps for **Phase 4** of the AI Code Review tool. The goal is to build a premium, highly responsive local Web UI Dashboard to visualize static scanning findings, inspect codebase relationships, compare code differences, and apply AI-suggested security patches with a single click.

This plan aligns with the main repository context defined in [process/context/all-context.md](file:///d:/DATN2/process/context/all-context.md), the design rules in [process/context/uxui/uiux.md](file:///d:/DATN2/process/context/uxui/uiux.md), and our verification standards in [process/context/tests/all-tests.md](file:///d:/DATN2/process/context/tests/all-tests.md).

---

## Quick Links
- [Context and Goals](#context-and-goals)
- [Phase Completion Rules](#phase-completion-rules)
- [Acceptance Criteria](#acceptance-criteria)
- [Visual Identity Design System](#visual-identity-design-system)
- [Dashboard Wireframe & Component Layout](#dashboard-wireframe--component-layout)
- [Interaction Workflows](#interaction-workflows)
- [Implementation Checklist](#implementation-checklist)
- [Touchpoints](#touchpoints)
- [Public Contracts](#public-contracts)
- [Blast Radius](#blast-radius)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)
- [Cursor and RIPER-5 Integration](#cursor-and-riper-5-integration)

---

## Context and Goals

We have successfully established the Python Analysis Core (Semgrep + GitNexus AST + 9router AI) and the Node.js CLI & local Express server.

In Phase 4, we build the visual frontend to control this hybrid engine:
1. Update the Express server (`server.js`) to serve the static frontend directory.
2. Develop a premium Web UI using HTML5, Vanilla JS (ESM), and Vanilla CSS (no framework wrappers or Tailwind dependencies) placed in `packages/cli-global/src/public/`.
3. Provide interactive scan controls, findings list grouping, side-by-side or inline code diff visualization, dynamic call-tree context representation, and an environment configurations editor modal.

### In-scope
- Serving static files under `packages/cli-global/src/public/` from Express.
- Building the glassmorphic dark-mode dashboard (HTML, CSS, JS).
- Fetching and displaying the current env config (`GET /api/config`) and scanning report (`GET /api/report`).
- Tracing and rendering the `ast_context` fields (symbol code, direct callers list, blast radius risk analysis).
- Constructing an interactive CSS code diff viewer comparing the original code snippet and the patch.
- Triggering scans (`POST /api/scan`) with rotating micro-animations.
- Applying file fixes (`POST /api/apply`) with UI success checkmark triggers.

### Out-of-scope
- Multi-user authentication or session persistence (the dashboard is local-only, single-tenant).
- Code editing fields in the UI (files are only modified by applying AI-generated patches).
- Hosting the server in a public cloud.

---

## Phase Completion Rules

A phase is NOT complete until:

1. **Integration Test** - Works with other system pieces
2. **Manual Test** - User can perform the action
3. **Data Verification** - File changes verified on disk after apply
4. **Error Handling** - Connection errors or mismatched line states handled gracefully
5. **User Confirmation** - User says "it works"

After each phase, the executor must document:
- [ ] What was tested manually
- [ ] Data verified (show API payloads and file diffs on disk)
- [ ] Errors encountered and fixed
- [ ] User confirmation received

---

## Acceptance Criteria

- [ ] Express server successfully hosts and serves `index.html` at `http://localhost:3000`.
- [ ] Visual styling follows the HSL Glassmorphic theme: midnight slate background, translucent cards with frosted blur, and glowing gradient accents.
- [ ] Layout is responsive and runs on major browsers (Chrome, Edge, Firefox).
- [ ] Trigger button executes a scan, displays a rotating scanning animation, and refreshes the report.
- [ ] Findings cards display severity badges (crimson for error, yellow for warning, blue for info).
- [ ] Selecting a card displays:
  - Enclosing function signature and code block.
  - Direct calling symbols and blast radius risk summaries.
  - Color-coded code diff viewer (red deleted lines, green added lines).
- [ ] Click on "Apply Remediation" writes modifications directly to disk and refreshes the file state.
- [ ] Settings modal successfully views and updates environment variables in the Analysis Core `.env` file.

---

## Visual Identity Design System

### 1. Color Palette (HSL based)
- **Background**: `hsl(220, 25%, 10%)` (Deep midnight slate)
- **Surface (Glass Panels)**: `hsla(220, 20%, 15%, 0.65)` with `backdrop-filter: blur(12px)` and `border: 1px solid hsla(0, 0%, 100%, 0.08)`
- **Accents**:
  - Primary / Trigger: `linear-gradient(135deg, hsl(190, 100%, 50%), hsl(220, 100%, 55%))` (Cyan-Blue glow)
  - Success / Apply: `hsl(145, 80%, 45%)` (Neon emerald)
  - Error / High: `hsl(350, 85%, 55%)` (Vibrant crimson)
  - Warning / Med: `hsl(38, 95%, 55%)` (Vibrant amber)
  - Info / Low: `hsl(200, 85%, 55%)` (Vibrant sky blue)

### 2. Typography
- **Headings**: 'Outfit', sans-serif (imported from Google Fonts)
- **Body UI**: 'Inter', sans-serif (imported from Google Fonts)
- **Code & Diff**: 'JetBrains Mono' or 'Fira Code', monospace

### 3. Key Visual Effects
- **Frosted Blur**: `backdrop-filter: blur(12px) saturate(180%)`
- **Ambient Glows**: Two absolute-positioned blurred background elements:
  - Top-left glow: `200px` radial-gradient cyan at 10% opacity.
  - Bottom-right glow: `200px` radial-gradient purple at 10% opacity.
- **Micro-transitions**: `transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)` for hover scales and color changes.

---

## Dashboard Wireframe & Component Layout

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  🌐 AI Code Review Dashboard                          [🔧 Config] [Status: OK] │
├───────────────────────────┬────────────────────────────────────────────────────┤
│ 🔍 SCAN CONTROLLER        │ 📝 REMEDIATION & DIFF VIEW PANEL                   │
│ ┌───────────────────────┐ │ File: example.py (Line 12)                         │
│ │   (Scan Project)      │ │ Rule: dangerous-exec                              │
│ └───────────────────────┘ │                                                    │
│ 📋 FINDINGS LIST          │ ┌────────────────────────────────────────────────┐ │
│ ┌───────────────────────┐ │ │ - exec(user_input)                 [DELETION]  │ │
│ │ 🔴 example.py:12      │ │ │ + import subprocess                [ADDITION]  │ │
│ │    Found use of exec()│ │ │ + subprocess.run(['echo', ...])                │ │
│ ├───────────────────────┤ │ └────────────────────────────────────────────────┘ │
│ │ 🟡 db.py:45           │ │                                                    │
│ │    Hardcoded password │ │ 🛡️ AST CONTEXT: Enclosing Function                 │
│ └───────────────────────┘ │ ┌────────────────────────────────────────────────┐ │
│                           │ │ Function: execute_query                        │ │
│                           │ │ Callers: main.py:40, route.js:15               │ │
│                           │ │ Blast Radius Upstream Risk: LOW                │ │
│                           │ └────────────────────────────────────────────────┘ │
│                           │                                                    │
│                           │                          ┌───────────────────────┐ │
│                           │                          │   Apply Remediation   │ │
│                           │                          └───────────────────────┘ │
└───────────────────────────┴────────────────────────────────────────────────────┘
```

---

## Interaction Workflows

### 1. Startup
1. Dashboard loads and triggers `GET /api/config` to check if API keys are configured (displays warning banner if missing).
2. Triggers `GET /api/report` to fetch and render the last completed analysis.

### 2. Scanning Execution
1. User clicks the primary "Scan Project" button.
2. UI adds `.spinning` class to a concentric scanning rings graphic and disables the button.
3. Express server invokes `POST /api/scan`.
4. Upon successful response (200), UI retrieves the fresh report via `GET /api/report`, updates findings, and plays a fade-in animation.

### 3. Diff Inspection & Patch Application
1. User clicks a finding card from the Sidebar list.
2. Main panel compiles the file diff:
   - Split original code by line and wrap in `<div class="diff-line removed">`.
   - Split AI remediation code by line and wrap in `<div class="diff-line added">`.
3. Renders the callers list and blast-radius upstream call paths in a tree list.
4. User clicks "Apply Remediation".
5. App triggers `POST /api/apply` with the code replacement parameters.
6. Upon success, UI triggers a success green checkmark banner, disables the applied finding card, and updates its badge status to "Resolved".

---

## Implementation Checklist

### Stage 1: Express Server Updates
- [ ] 1. Update `packages/cli-global/src/server.js` to serve static assets from a `public` subfolder using `express.static`.
- [ ] 2. Update server tests in `packages/cli-global/src/__tests__/server.test.js` to verify `/` returns the index page.
  - *Verification Command*: `npx vitest run src/__tests__/server.test.js` passes.

### Stage 2: Public Folder Scaffolding & Core Shell
- [ ] 3. Create public directories: `packages/cli-global/src/public/`, `packages/cli-global/src/public/css/`, `packages/cli-global/src/public/js/`.
- [ ] 4. Implement `packages/cli-global/src/public/index.html` referencing Google Fonts, FontAwesome (or basic SVG icons), `css/style.css`, and ESM module `js/app.js`.
- [ ] 5. Implement the main grid layout with:
  - Sidebar: Active project path, Scanning controller (trigger button, status badge), Findings list.
  - Content Panel: Enclosing rule card, Code Diff Viewer, AST Context Viewer, Apply button.
  - Modals: Config modal with key forms.

### Stage 3: CSS Glassmorphic Styling
- [ ] 6. Implement `packages/cli-global/src/public/css/style.css` defining HSL variables, dark mode styles, scrollbars, and fonts.
- [ ] 7. Implement glassmorphic card classes: `backdrop-filter: blur(12px)`, translucent background, and borders.
- [ ] 8. Implement the code diff viewer CSS highlighting lines: removed lines `-` with light red background, added lines `+` with light green background.
- [ ] 9. Add keyframe animations: `.pulse-rings` scanner rotation, fade-in transition on loading findings, and modal scale-in.

### Stage 4: Javascript Client Orchestration
- [ ] 10. Implement `packages/cli-global/src/public/js/app.js` using ESM module patterns.
- [ ] 11. Implement API client helpers: `fetchConfig()`, `saveConfig()`, `triggerScan()`, `fetchReport()`, `applyRemediation()`.
- [ ] 12. Implement the UI state manager:
  - Render findings cards with matching severity colors.
  - Compile inline code diff visualization from finding content.
  - Format call-tree listings using AST callers lists and impact trees.
  - Trigger and animate scan loading rings.
  - Toggle Config Modal visibility and load/save `.env` parameters.

### Stage 5: Manual End-to-End Verification
- [ ] 13. Globally link CLI via `npm link` inside `packages/cli-global/`.
- [ ] 14. Start the server: `ai-code-review --server --port 3000`.
- [ ] 15. Open Chrome/Edge at `http://localhost:3000`.
- [ ] 16. Verify:
  - Last scan results load automatically.
  - Settings button opens the config dialog, reads key, and saves it.
  - Clicking "Scan Project" triggers spinner, runs python scan, and refreshes cards.
  - Selecting a finding compiles code diffs, displays AST call-chains, and clicking "Apply Remediation" writes to file.
- [ ] 17. Unlink CLI and restore workspace.

---

## Touchpoints

- `packages/cli-global/src/server.js` (Serving static assets)
- `packages/cli-global/package.json` (Verify dependencies/scripts)
- `packages/cli-global/src/public/index.html` (New)
- `packages/cli-global/src/public/css/style.css` (New)
- `packages/cli-global/src/public/js/app.js` (New)

---

## Public Contracts

- **Static serving directory**: `packages/cli-global/src/public/`
- **Express static endpoint**: `GET /` -> serves `packages/cli-global/src/public/index.html`
- **Dashboard UI URL**: `http://localhost:3000`

---

## Blast Radius

- Changes affect static HTML/CSS/JS frontend files. Node.js backend updates are confined solely to mounting `express.static` in `server.js`.
- There is zero impact on the Python Core files (`packages/analysis-core/`).

---

## Verification Evidence

- Verification will be manually verified by:
  - Starting the local server and navigating to `http://localhost:3000` in a browser.
  - Inspecting the console logs for any network failures or javascript errors.
  - Verifying the file content change after clicking "Apply Remediation".
- Manual validation screenshot and verified logs will be written to `process/features/ai-code-review/reports/phase-04-web-ui_REPORT.md` during execution.

---

## Resume and Execution Handoff

- **Primary Execute Anchor**: This file (`process/features/ai-code-review/active/phase-04-web-ui_PLAN_31-05-26.md`) acts as the primary execute anchor for Phase 4 implementation.
- **Supporting Phase Files**: Developers should refer to the general umbrella plan [ai-code-review-umbrella_PLAN_31-05-26.md](file:///d:/DATN2/process/features/ai-code-review/active/ai-code-review-umbrella_PLAN_31-05-26.md) as the main supporting phase file.
- **Reference Material**:
  - `packages/cli-global/src/server.js` (API endpoints).
  - `process/context/uxui/uiux.md` (Design guidelines).
  - `process/context/tests/all-tests.md` (Tests environment configuration).

---

## Cursor and RIPER-5 Integration

- **Cursor Plan Mode**: Focus on the implementation checklist in this plan.
- **RIPER-5 Mode**: Proceed sequentially. Write code only when approved.

**Next Step Instructions**:
Review this plan, and type `ENTER EXECUTE MODE` to begin development.
