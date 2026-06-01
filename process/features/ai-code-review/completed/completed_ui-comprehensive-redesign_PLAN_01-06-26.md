# UI Comprehensive Redesign - Technical Plan

**Date**: 01-06-26  
**Complexity**: Simple (Single-session UI layout and visual enhancement)  
**Status**: ✅ VERIFIED

## Overview

This document outlines the technical plan to redesign the local Web UI dashboard of the AI Code Review tool. The goal is to make the dashboard significantly more comprehensive ("bao quát hơn") by transitioning to a GitNexus-inspired HSL dark design, introducing a multi-tab panel container in the detail view, rendering a weighted Project Health Score radial progress indicator, showing counts for the four engineering pillars (Security, Quality, Architecture, Maintainability), displaying a leaderboard of top risky symbols based on AST blast radius, and structuring the Code Inspector with a side-by-side metadata/chat panel and split code diff viewer.

---

## Quick Links
- [Goals and Success Metrics](#goals-and-success-metrics)
- [Phase Completion Rules](#phase-completion-rules)
- [Execution Brief](#execution-brief)
- [Scope](#scope)
- [Functional Requirements](#functional-requirements)
- [Acceptance Criteria](#acceptance-criteria)
- [Implementation Checklist](#implementation-checklist)
- [Integration Notes](#integration-notes)
- [Touchpoints](#touchpoints)
- [Public Contracts](#public-contracts)
- [Blast Radius](#blast-radius)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)
- [Cursor and RIPER-5 Guidance](#cursor-and-riper-5-guidance)

---

## Goals and Success Metrics

### Business and UX Goals
- **Holistic Visibility**: Give developers an immediate, intuitive summary of codebase quality and risk hotspots upon loading a scan version.
- **Improved Usability**: Provide a tab-based view to toggle cleanly between the high-level project overview and deep-dive code inspection.
- **Premium GitNexus Aesthetic**: Apply a unified, gorgeous midnight-void HSL color palette featuring subtle glows, semi-transparent card borders, and clear accents.

### Success Metrics
- **0 build errors** and **0 Vitest regression failures** on the global CLI server.
- **Zero latency impact** on local dashboard load times (pure vanilla CSS & JS).
- **Responsive tab state management**: Clicking findings immediately switches tabs and retains navigation context.

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
- [ ] Data verified (show file outputs, UI rendering snapshots, or CLI responses)
- [ ] Errors encountered and fixed
- [ ] User confirmation received

---

## Execution Brief

This project is divided into 4 logical phases to maintain incremental progress and clear verification gates.

### Phase 1: HTML & CSS Structure Redesign
- **What happens**: Update `index.html` to add the tab header bar, structure the new overview dashboard grids, and configure the Code Inspector containers. Modify `styles.css` to introduce GitNexus HSL variables and glowing border animations.
- **Test**: Open index.html in the browser; verify layout matches design wireframes.
- **Verify**: Confirm browser parses the updated stylesheet without errors and displays HSL variable mappings correctly.
- **Done when**: UI mock layout is verified visually by the user.

### Phase 2: Tab Controller & Navigation State
- **What happens**: Add tab selection handlers and transition logic in `app.js`. Keep tabs visible when a project is loaded, select "Overview Dashboard" by default, and auto-transition to "Code Inspector" when a finding is clicked in the sidebar.
- **Test**: Click tabs to verify switching, click findings in the sidebar to verify auto-switch.
- **Verify**: Inspect `selectedFindingIndex` state in dev tools; confirm proper class list toggling (`active` class).
- **Done when**: Tab controller operates seamlessly under all project load and click states.

### Phase 3: Overview Dashboard Metrics & Calculations
- **What happens**: Implement the mathematical weighted Project Health Score in `app.js`. Render the radial progress SVG dynamically based on findings. Display counts for Security, Quality, Architecture, and Maintainability, and compute the top 5 risky symbols leaderboard using AST blast radius length.
- **Test**: Scan a project or load an existing scan. Check if metrics count matches findings and that the leaderboard displays correct ranks.
- **Verify**: Cross-check health score value calculations with mock reports.
- **Done when**: Radial meter is rendered with correct colors corresponding to score levels (Green/Amber/Red).

### Phase 4: Code Inspector Grid & E2E Validation
- **What happens**: Rearrange the Code Inspector details panel into a two-column top section (meta & suggestion left, AI copilot chat right) and full-width split diff bottom section. Conduct full E2E review, check patch applications, and run regression tests.
- **Test**: Run `npm test` to verify Vitest tests run green. Manually verify chat submits, code diff renders, and patch applies.
- **Verify**: Verify modified files are correctly written on disk upon clicking "Apply Fix".
- **Done when**: Redesigned UI is verified locally in the browser and Vitest runs with 100% pass rate.

### Expected Outcome
- A beautiful, highly professional GitNexus-themed web interface showing a detailed radial health progress meter, four distinct pillar metrics, an interactive AST-based blast radius leaderboard, a split-screen diff comparison, and a side-by-side AI chat console.

---

## Scope

### In-Scope
- Styling variables refactor using HSL tokens (midnight void, deep charcoal surfaces, glowing border shadows, blue highlights).
- Interactive Tab Bar in `.detail-panel` containing "Overview Dashboard" and "Code Inspector".
- Radial indicator showing a calculated Project Health Score.
- 4-pillar Metric Cards: Security, Quality, Architecture, Maintainability.
- Top Risky Symbols Leaderboard sorted by AST blast radius length.
- Code Inspector reorganization: 2-column details & chat grid, plus full-width split diff viewer.

### Out-of-Scope
- Changing the Python AST extractor algorithm or Semgrep rules engine.
- Adding third-party JavaScript frameworks (React/Vue) or CSS toolchains (Tailwind/SASS). Everything remains vanilla to guarantee speed and ease of distribution.

---

## Assumptions and Constraints
- **Client environment**: Vanilla HTML5, CSS3, and ES6 ESM Javascript are served directly by the Express server.
- **Operating System**: Windows filesystem paths (using backslashes) must continue to be handled correctly in `app.js` using path helpers.
- **Responsive design**: Although running locally, the layout should scale elegantly on different monitor resolutions.

---

## Functional Requirements

### 1. GitNexus-Inspired HSL Theme
- Midnight Void Background: `hsl(240, 25%, 3%)`
- Deep/Surface Background: `hsl(240, 20%, 7%)`
- Card/Container Surface: `hsla(240, 16%, 12%, 0.75)`
- Border Accent: `hsla(240, 16%, 20%, 0.5)`
- Electric Blue Accent: `hsl(220, 100%, 50%)`
- Glowing Border Effects: `box-shadow: 0 0 12px hsla(220, 100%, 50%, 0.15)`
- Green Success: `hsl(145, 80%, 45%)`
- Red Danger/Error: `hsl(350, 85%, 55%)`
- Yellow Warning: `hsl(35, 90%, 55%)`

### 2. Multi-Tab Navigation
- Container inside `.detail-panel` displays tab controls:
  - `<div class="detail-tabs" id="detailTabs" style="display: none;">`
- Buttons:
  - `Overview Dashboard` (toggles `#detailDashboard`)
  - `Code Inspector` (toggles `#detailContent`)
- Tab bar only shows when a project is selected (active).
- Tab state switches to "Code Inspector" automatically when user clicks a finding in the sidebar findings list or code tree.
- Defaults to "Overview Dashboard" when a project is loaded or reset.

### 3. Overview Dashboard Components
- **Project Health Score Radial Meter**:
  - Radial SVG chart centered in a card.
  - Formula:
    - Deduction per finding: `error` = 15, `warning` = 5, `info` = 1.
    - Pillars category weights: Security = 0.40, Quality = 0.30, Architecture = 0.15, Maintainability = 0.15.
    - `totalDeduction = sum(categoryDeductions[c] * weight[c])`
    - `Health Score = Math.max(0, 100 - totalDeduction)`
  - Stroke color changes according to score ranges:
    - $\ge 90$: Green/Emerald (`hsl(145, 80%, 45%)`)
    - $70 \le \text{score} < 90$: Amber/Orange (`hsl(35, 90%, 55%)`)
    - $< 70$: Crimson/Red (`hsl(350, 85%, 55%)`)
- **Pillar Metrics Cards**:
  - Displays counts for Security, Quality, Architecture, and Maintainability.
- **Top Risky Symbols Leaderboard**:
  - Group and identify symbols using `ast_context` from findings.
  - Sort descending based on blast radius count (`finding.ast_context.blast_radius.length`).
  - Render top 5 symbols including their names, relative paths, and blast radius details.

### 4. Code Inspector Redesign
- Top Section Grid (`.inspector-top-grid`):
  - Left column: Finding metadata, message card, AST details (symbol, callers list, blast radius), and AI Suggestion text block.
  - Right column: AI Copilot Chat console (`.chat-section`), styled with scrolling message bubbles and active input.
- Bottom Section:
  - Split Panel Code Diff Viewer (`.diff-viewer`) stretched to 100% width.
  - Action Panel: "Apply Fix" button with status indicator.

---

## Acceptance Criteria
- [ ] Radial progress indicator renders dynamically with HSL color-coding based on the health score.
- [ ] Tabs are always visible once a project is selected; default state is "Overview Dashboard".
- [ ] Clicking a finding correctly displays the details and immediately transitions active tab view to "Code Inspector".
- [ ] Top Risky Symbols leaderboard updates dynamically with the correct blast radius counts and names.
- [ ] Code Inspector layout renders a two-column top section and full-width split diff viewer with no overflow issues.
- [ ] Vitest regression test suite passes successfully.

---

## Implementation Checklist

```
IMPLEMENTATION CHECKLIST (from ui-comprehensive-redesign_PLAN_01-06-26.md):

1. Update index.html to add the tab container and layout structure [packages/cli-global/src/public/index.html]
2. Define HSL variables, glows, and split grid styling rules in styles.css [packages/cli-global/src/public/styles.css]
3. Refactor selectProject and selectFinding to toggle tab displays [packages/cli-global/src/public/app.js]
4. Implement the weighted Project Health Score formula in app.js [packages/cli-global/src/public/app.js]
5. Add radial indicator SVG stroke rendering animation logic [packages/cli-global/src/public/app.js]
6. Implement the AST blast radius Top Risky Symbols leaderboard list rendering [packages/cli-global/src/public/app.js]
7. Re-style the AI Copilot chat UI to fit inside the right column grid [packages/cli-global/src/public/styles.css]
8. Run the server locally and verify layouts manually in a browser window [packages/cli-global/src/public/index.html]
9. Check that clicking a finding switches the active tab to Code Inspector [packages/cli-global/src/public/app.js]
10. Run 'npm test' in packages/cli-global to ensure vitest regression test suite passes [packages/cli-global]
```

---

## Integration Notes
- **Static Assets**: All frontend modifications occur in the static files served by the Express server.
- **Mock Data Scan**: We can use the mock scan mode (`--mock-scan` or UI checkboxes) to quickly test layout behavior without running slow python dependencies.
- **REST Endpoints**: Endpoints `/api/reports`, `/api/report/:project/:id`, `/api/file-content`, and `/api/apply` must stay intact with identical JSON signatures.

---

## Touchpoints
- `packages/cli-global/src/public/index.html` (tab bar nodes, metric cards, grid structures)
- `packages/cli-global/src/public/styles.css` (GitNexus HSL variables, layout grid rules, glowing animations)
- `packages/cli-global/src/public/app.js` (tab toggle listeners, health score formula, leaderboard compilation, SVG render)

---

## Public Contracts
- **Tabs DOM Bindings**:
  - `#detailTabs` (Tab Container)
  - `[data-tab="dashboard"]` (Overview Button)
  - `[data-tab="inspector"]` (Code Inspector Button)
- **Dashboard DOM Bindings**:
  - `#detailDashboard` (Dashboard content container)
  - `#healthScoreCircle` (SVG circle for radial meter)
  - `#healthScoreText` (Score text placeholder)
  - `#riskySymbolsLeaderboard` (Risky symbols element)
- **Inspector DOM Bindings**:
  - `#detailContent` (Code Inspector container)

---

## Blast Radius
- The changes are strictly confined to the frontend interface (`packages/cli-global/src/public/`).
- No database migrations, CLI flags updates, or network configurations will be changed.
- Risks of regressions are very low and limited to styling overflows or JavaScript runtime errors which will be caught in console logs and E2E checks.

---

## Verification Evidence
Visual and programmatic tests will be performed:
1. **Vitest suite execution**: Run `npm test` under `packages/cli-global` and record output.
2. **Visual review checklist**:
   - Verify HSL variables are active.
   - Verify health score calculation correctness with test fixtures.
   - Confirm tabs correctly display and transition active classes.
   - Inspect top risky symbols table items match actual report data.
   - Confirm split code diff layout alignment.

---

## Resume and Execution Handoff
- Read the Implementation Checklist in this plan.
- The next step is to enter EXECUTE mode, update `index.html` and `styles.css` with the new layouts, followed by `app.js` state integrations.

---

## Cursor and RIPER-5 Guidance
- **Cursor Plan Mode**: Import this plan checklist. Mark each step as complete before moving forward.
- **RIPER-5**: Proceeding to the EXECUTE phase after receiving user approval. Always verify before finalizing.

**Next Step Instruction**:
Please review the plan contents. Type `ENTER EXECUTE MODE` to begin implementing the dashboard redesign.
