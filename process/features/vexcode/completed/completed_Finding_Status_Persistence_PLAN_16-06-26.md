# Per-Finding Status Persistence (Option A)

**Date**: 16-06-26
**Complexity**: COMPLEX (multi-layer; engine Python + CLI Node.js + web React)
**Execution Model**: Sequential RFCs, 1-1.5 days, 1 developer
**Author**: vc-generate-plan (research already completed in this session)

## Overview

Add a persistent `status` field to each finding so users can mark findings as **false positive** or **reopen** them, with the status surviving page reload. Currently the "Pending/Applied" filter in the web UI is client-side ephemeral only (`_applied` flag in React state, not written to the report JSON on disk), and the AI's "False positive:" prefix in the suggestion text is just a string, not a structured field. This plan introduces structured `status` persistence, a new per-finding API endpoint, UI controls, a new "Unaddressed" filter, and SARIF sidecar alignment. No cross-scan diff, no per-finding AI retry — those are explicitly Option B/C, deferred.

**Status**: ⏳ PLANNED

---

## Quick Links

- [Context and Goals](#1-context-and-goals)
- [Execution Brief](#15-execution-brief)
- [Phased Execution Workflow](#175-phased-execution-workflow)
- [Non-Goals and Constraints](#2-non-goals-and-constraints)
- [Architecture Decisions](#3-architecture-decisions-final)
- [High-level Data Flow](#5-high-level-data-flow)
- [Touchpoints](#7-touchpoints)
- [Public Contracts](#8-public-contracts)
- [Blast Radius](#9-blast-radius)
- [RFCs (RFC-001 ... RFC-007)](#10-rfcs)
- [Implementation Checklist](#implementation-checklist)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)
- [Migration Path: A → B → C](#migration-path-a--b--c)
- [Cursor + RIPER-5 Guidance](#cursor--riper-5-guidance)

---

## 1. Context and Goals

VexCode scans a codebase, runs AI remediation, and renders findings in a web dashboard. The user reported: *"Tôi không biết lỗi nào còn tồn đọng từ lần scan trước."* This plan delivers the minimum viable answer:

**In-scope (this plan)**:
- Add `status: "open" | "applied" | "false_positive" | "ignored"` to each finding (Python + TypeScript types)
- Persist `_applied` AND `status` to JSON on the existing Apply Fix flow (smallest change that survives reload)
- New API endpoint `POST /api/finding/:reportPath/:findingId/status` to set status for one finding
- UI: "Mark FP" / "Reopen" buttons + status badge in `FindingsList`
- New "Unaddressed" filter in `FilterPanel` (shows only `status === "open"`)
- SARIF sidecar: include `status` in `properties`
- Tests for all three layers

**Out-of-scope (deferred to Option B/C)**:
- Per-finding AI retry (Option B)
- Cross-scan diff / NEW / PERSISTENT / FIXED / REGRESSED classification (Option C)
- Trend dashboard
- Bulk status changes (mark-all-ignored)
- Status history / audit log
- Status propagation to SARIF baselines

---

## 1.5 Execution Brief

### Phase Completion Rules

A phase is NOT complete until:

1. **Integration Test** - Works with other system pieces
2. **Manual Test** - User can perform the action
3. **Data Verification** - Database/state changes confirmed
4. **Error Handling** - Failure cases handled gracefully
5. **User Confirmation** - User confirms it works (User Confirmation step at end of each RFC gate)

Status meanings:
- ⏳ PLANNED - Not started
- 🔨 CODE DONE - Written but not E2E tested
- 🧪 TESTING - Currently being tested
- ✅ VERIFIED - Tested AND user confirmed working
- 🚧 BLOCKED - Has issues

After each phase, document:
- [ ] What was tested manually
- [ ] Data verified in JSON file (show content + finding.id)
- [ ] Errors encountered and fixed
- [ ] User confirmation received

### Phase Execution

### Phase 1: Type System Foundation (RFC-001)
**What happens**: Add `status` to Python + TypeScript types; default to `"open"` when missing. No runtime behavior change yet.
**Test**: TypeScript compiles, Python tests still pass, no findings have a `status` field set (yet).

### Phase 2: Persistence on Apply (RFC-002)
**What happens**: Modify `POST /api/apply` to write `finding._applied = true` and `finding.status = "applied"` back to JSON after a successful file edit.
**Test**: Apply a fix → reload page → finding still shows as applied; status survives in the JSON file on disk.

### Phase 3: Per-Finding Status API (RFC-003)
**What happens**: Add `POST /api/finding/:reportPath/:findingId/status` with body `{ status }`. Idempotent.
**Test**: Mark a finding FP via curl → reload report → status persists; reopen → status reverts.

### Phase 4: SARIF Sidecar Alignment (RFC-006)
**What happens**: Include `status` in SARIF `properties` bag.
**Test**: SARIF download contains `properties.status` for findings that have a status.

### Phase 5: UI — Buttons + Badge (RFC-004)
**What happens**: Add 2 buttons + 1 badge in `FindingsList`. Add `useFindingStatus` hook that calls new API and updates local state.
**Test**: Click "Mark FP" → badge appears; refresh page → badge persists; reload from disk → still persists.

### Phase 6: UI — Unaddressed Filter (RFC-005)
**What happens**: New "Unaddressed" option in existing "Fix Status" filter group. Keep "Applied" working. Update `App.tsx` filter logic to use `status` instead of `_applied`.
**Test**: Filter "Unaddressed" shows only `status === "open"`; filter "Applied" shows only `status === "applied"`; combined with severity works.

### Phase 7: Tests (RFC-007)
**What happens**: Add tests for all three layers.
**Test**: All test suites green.

### Expected Outcome
- A user can mark a finding as False Positive, reload the page, and see the badge persist
- The "Unaddressed" filter shows only findings that have not been addressed
- AI's "False positive:" suggestion can be promoted to a structured `status: "false_positive"` (manually, by clicking the button)
- All 209+ engine tests, 75+ CLI tests, 138+ web tests still pass + new tests added

---

## 1.75 Phased Execution Workflow

**IMPORTANT**: This plan uses sequential RFCs. Each RFC has a **Definition of Done** and a **Verification Gate**. The executor must STOP after each RFC and run the gate before proceeding.

### Workflow Pattern

1. **Read RFC's Acceptance Criteria** — what must be true
2. **Implement** — exactly as specified, no scope creep
3. **Run RFC's Verification Gate** — concrete commands + expected output
4. **STOP and report** — present "What's Functional Now" + "What You Can Test Manually"
5. **Wait for user approval** before next RFC (only if multi-day; otherwise batch the 1-day plan)

For this 1-1.5 day plan, executor may run RFCs 1-7 sequentially and present one consolidated verification report at the end. If any RFC's gate fails, STOP and fix.

### Example Workflow Snippet

```
RFC-002 done. Verified:
✓ apply.js now writes _applied + status back to JSON
✓ Manual: applied a fix, restarted CLI, status="applied" persisted
✓ Vitest: 75 passed (1 new test added)

Ready for RFC-003.
```

---

## 2. Non-Goals and Constraints

**Non-Goals**:
- No cross-scan comparison
- No per-finding AI retry
- No bulk operations
- No status history / audit trail (just current status)
- No status sync across users (single-user local app)
- No new dependency on a database (use existing JSON file as storage)

**Constraints**:
- Must not break existing 209+ engine tests, 75 CLI tests, 138 web tests
- Must follow existing patterns (reports.js route pattern, useFindingStatus hook mirrors useReports pattern)
- Single user, single machine — no concurrency, no transactions needed
- JSON file write must be atomic (write to .tmp, rename) to avoid corruption on crash
- Web `apply` route runs in Express; existing flow uses `writeFile` not `rename` — RFC-002 will add atomic write for the status update path only

---

## 3. Architecture Decisions (Final)

### AD-001: Status enum values
- **Decision**: `"open" | "applied" | "false_positive" | "ignored"`
- **Rationale**: Open is the default (matches "I haven't touched this yet"). Applied replaces the existing `_applied: true` (semantically equivalent). false_positive is a structured upgrade of the AI text prefix. Ignored is for "I know about it, don't bother me."
- **Implication**: All 4 values have UI meaning; no need for nullable status (missing = open by convention).

### AD-002: Storage location — JSON report file only
- **Decision**: Persist `status` in the same report JSON file, no separate database
- **Rationale**: Single-user, local app; no need for SQLite/Postgres; keeping it in JSON means scan history is self-contained
- **Implication**: A re-scan overwrites the JSON, but the new scan will have a fresh `status` field for all findings; old `status` is lost. This is acceptable for Option A. (Cross-scan persistence is Option C.)

### AD-003: Per-finding API endpoint with path parameter, not body
- **Decision**: `POST /api/finding/:reportPath/:findingId/status` with `{ status }` in body
- **Rationale**: RESTful, idempotent, easy to test
- **Implication**: New route file `findings.js` registered in `server.js`

### AD-004: Atomic JSON write
- **Decision**: Use `writeFile(tmp) + rename` for status updates
- **Rationale**: Crash mid-write would corrupt the entire report and lose the user's previous scan
- **Implication**: Apply a small helper in `reportService.js` for atomic write

### AD-005: Web uses TanStack Query-style optimistic update
- **Decision**: After click, immediately update local state; on API error, revert
- **Rationale**: Faster UX, matches existing `useReports` pattern
- **Implication**: `useFindingStatus` hook needs `setCurrentReport` access (passed from parent or via context)

### AD-006: Status field is opt-in (missing = "open")
- **Decision**: Don't write `status` to JSON unless user explicitly marks a non-open status (or applies)
- **Rationale**: Smaller JSON files; backward compatible with old reports
- **Implication**: UI filter for "Unaddressed" treats `!status || status === "open"` as unaddressed

---

## 5. High-level Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks "Apply Fix" in Web UI                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. POST /api/apply { reportPath, findingId, fix }          │
│    CLI applies edit, returns success                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CLI (NEW in RFC-002): re-read report JSON,              │
│    set finding._applied = true, status = "applied",         │
│    write atomically back to disk                            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Response includes updated finding; web setCurrentReport  │
│    User sees "Applied" badge appear                         │
└─────────────────────────────────────────────────────────────┘

----- OR -----

┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks "Mark FP" button in Web UI                   │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. POST /api/finding/:reportPath/:findingId/status          │
│    body: { status: "false_positive" }                       │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CLI re-reads report JSON, sets finding.status,          │
│    write atomically back to disk                            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Response includes updated finding; web setCurrentReport  │
│    User sees "False positive" badge appear                  │
│    Reload page → status persists from disk                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Touchpoints

| Layer | File | Change |
|---|---|---|
| Engine (Python) | `src/engine/pipeline/sarif_builder.py` | Add `status` to SARIF `properties` |
| Engine types | (new) `src/engine/core/finding_status.py` | Python enum/constant for status values |
| CLI | `src/routes/apply.js` | After successful apply, persist `_applied` + `status` to JSON |
| CLI | (new) `src/routes/findings.js` | New route for `POST /api/finding/.../status` |
| CLI | `src/server.js` | Register findings route |
| CLI | `src/services/reportService.js` | Add `updateFindingStatus(reportPath, findingId, status)` helper with atomic write |
| CLI | `src/services/reportService.js` | Add `markFindingApplied(reportPath, findingId)` helper |
| Web types | `src/types.ts` | Add `status: FindingStatus` to `Finding` |
| Web | (new) `src/hooks/useFindingStatus.ts` | Hook that calls new API and updates report state |
| Web | `src/components/FindingsList.tsx` | Add 2 buttons + status badge |
| Web | `src/components/FilterPanel.tsx` | Add "Unaddressed" option to "Fix Status" filter group |
| Web | `src/App.tsx` | Update filter logic to use `status` field instead of `_applied` |
| Tests | `packages/engine/tests/test_sarif_builder.py` | Test SARIF `properties.status` |
| Tests | `packages/cli/tests/routes/findings.test.js` | New test file for the route |
| Tests | `packages/cli/tests/routes/apply.test.js` (or similar) | Test persistence in apply route |
| Tests | `packages/web/tests/hooks/useFindingStatus.test.ts` | New hook test |
| Tests | `packages/web/tests/components/FilterPanel.test.tsx` | Test new filter option |
| Tests | `packages/web/tests/components/FindingsList.test.tsx` | Test buttons + badge |

---

## Public Contracts

### 8.1 Finding TypeScript Type (delta)
```ts
// packages/web/src/types.ts
export type FindingStatus = 'open' | 'applied' | 'false_positive' | 'ignored';

export interface Finding {
  // ... existing fields ...
  status?: FindingStatus;        // NEW: optional, defaults to 'open' when missing
  _applied?: boolean;            // DEPRECATED but kept for backward compat — derived from status === 'applied'
}
```

### 8.2 Finding Python TypedDict (delta)
```python
# packages/engine/src/engine/core/finding_status.py (new)
from typing import Literal, TypedDict

FindingStatus = Literal["open", "applied", "false_positive", "ignored"]

DEFAULT_STATUS: FindingStatus = "open"
```

### 8.3 New API Endpoint
```
POST /api/finding/:reportPath/:findingId/status
Content-Type: application/json

Request body:
{ "status": "false_positive" | "open" | "applied" | "ignored" }

Response 200:
{
  "success": true,
  "finding": { /* updated finding object */ }
}

Response 404:
{ "success": false, "error": "Finding not found" }

Response 400:
{ "success": false, "error": "Invalid status. Must be one of: open, applied, false_positive, ignored" }
```

### 8.4 Modified API Response: POST /api/apply
No breaking change. The endpoint already returns the updated finding. The only new behavior is the CLI also writes `_applied` and `status` to the JSON file. Web still receives the same response shape.

---

## Blast Radius

**Low risk.** Changes are additive:
- New `status` field is optional; old reports without it work fine
- New API endpoint is new code; existing endpoints unchanged
- UI changes are 2 buttons + 1 filter option; existing filters still work
- SARIF `properties.status` is additive; consumers that ignore unknown properties are unaffected
- Engine `scanner.py` is NOT modified — only the SARIF builder

**Affected areas**:
- 4 existing test files (apply.test.js, FindingsList.test.tsx, FilterPanel.test.tsx, possibly App.test.tsx) may need to be updated to include `status` in test fixtures
- The 1 pre-existing failing test (`test_scanner.py::test_run_scan_mock_returns_mock_findings`) is unrelated and stays failing

**NOT affected**:
- Engine scan pipeline
- Engine AI resolver logic
- CLI `serve` command behavior (besides new route registration)
- Web build / TypeScript compilation (only adds types)
- SARIF consumers (additive property)

---

## Context References

- `process/context/all-context.md` — root context router; sections "Repository Structure" and "Current Project Status" were used to identify the 3-layer architecture
- `process/context/tests/all-tests.md` — testing context (outdated, so we use the actual test commands: `pytest -q` for engine, `npm test` for cli/web)
- `process/context/planning/example-complex-prd.md` — calibrated depth for this COMPLEX plan
- `process/development-protocols/all-development-protocols.md` — RIPER-5 mode guidance

## 10. RFCs (RFC-001 ... RFC-007)

### RFC-001: Type System Foundation

**Summary**: Add `status` to Python + TypeScript types. Default to `"open"`. No runtime change.

**Files**:
- `packages/web/src/types.ts` — add `FindingStatus` type + `status?: FindingStatus` to `Finding`
- `packages/engine/src/engine/core/finding_status.py` (new) — define `FindingStatus` Literal and `DEFAULT_STATUS`

**Stages**:
1. Create `finding_status.py` with Literal + constant
2. Add to `types.ts`

**Acceptance Criteria**:
- TypeScript compiles (`npm run typecheck` in web)
- Python imports work
- No file content change in `scanner.py` or `ai_resolver.py`

**Verification Gate**:
```bash
cd packages/web && npm run typecheck
cd packages/engine && .venv/Scripts/python.exe -c "from engine.core.finding_status import FindingStatus, DEFAULT_STATUS; print(DEFAULT_STATUS)"
```

---

### RFC-002: Persist `_applied` + `status` on Apply

**Summary**: Modify `POST /api/apply` to write `finding._applied = true` and `finding.status = "applied"` to JSON after a successful file edit. Use atomic write.

**Files**:
- `packages/cli/src/services/reportService.js` — add `markFindingApplied(reportPath, findingId)` helper using `writeFile(tmp) + rename`
- `packages/cli/src/routes/apply.js` — call helper after successful apply

**Stages**:
1. Add `markFindingApplied()` to `reportService.js` (atomic write)
2. Wire into `apply.js` after the existing success path

**Acceptance Criteria**:
- After successful apply, the report JSON on disk has `_applied: true` and `status: "applied"` for that finding
- Page reload preserves the status
- No regression in existing `apply.js` test (if any)

**Verification Gate**:
```bash
cd packages/cli && npm test
# Manual:
# 1. Start CLI: node bin/cli.js serve --port 3000
# 2. Open browser, apply a fix
# 3. Check the report JSON file: should have status: "applied"
# 4. Reload page: badge still shows applied
```

---

### RFC-003: Per-Finding Status API Endpoint

**Summary**: New endpoint to set status for one finding, idempotent.

**Files**:
- `packages/cli/src/services/reportService.js` — add `updateFindingStatus(reportPath, findingId, status)` helper (atomic write, validation)
- `packages/cli/src/routes/findings.js` (new) — POST `/api/finding/:reportPath/:findingId/status`
- `packages/cli/src/server.js` — register the new route

**Stages**:
1. Add `updateFindingStatus()` to `reportService.js` with status validation
2. Create `findings.js` route
3. Register in `server.js`

**Acceptance Criteria**:
- POST with valid status → 200, JSON updated
- POST with invalid status → 400
- POST with non-existent findingId → 404
- Idempotent: re-calling with same status returns 200, no error

**Verification Gate**:
```bash
cd packages/cli && npm test
# Manual:
curl -X POST http://localhost:3000/api/finding/<encoded-path>/<findingId>/status \
  -H "Content-Type: application/json" \
  -d '{"status":"false_positive"}'
# Should return 200 with updated finding
```

---

### RFC-004: UI — Buttons + Badge

**Summary**: Add 2 buttons + 1 status badge in `FindingsList`. Hook calls new API and updates state optimistically.

**Files**:
- `packages/web/src/hooks/useFindingStatus.ts` (new) — hook with `setStatus(findingId, status)` that POSTs + updates `currentReport`
- `packages/web/src/components/FindingsList.tsx` — add buttons + badge near existing actions

**Stages**:
1. Create `useFindingStatus.ts` hook
2. Update `FindingsList.tsx` to show badge + 2 buttons
3. Buttons: "Mark FP" (only enabled if status !== "false_positive") and "Reopen" (only enabled if status !== "open")

**Acceptance Criteria**:
- Clicking "Mark FP" → badge "False positive" appears immediately
- Clicking "Reopen" → badge reverts to "Open" or disappears
- Reloading the page preserves the status
- API error → revert + show error toast (or log)

**Verification Gate**:
```bash
cd packages/web && npm test
# Manual: see Verification Evidence section
```

---

### RFC-005: UI — Unaddressed Filter

**Summary**: Add "Unaddressed" filter option. Update `App.tsx` filter logic to use `status` field.

**Files**:
- `packages/web/src/components/FilterPanel.tsx` — add "Unaddressed" option to existing "Fix Status" group
- `packages/web/src/App.tsx` — update filter logic (was `f._applied ? 'applied' : 'pending'`, becomes `f.status === 'applied' ? 'applied' : 'unaddressed'`)

**Stages**:
1. Update `FilterPanel.tsx` to add new option
2. Update `App.tsx` filter logic
3. Backward compat: `f._applied === true` with no `status` → still treated as "applied" (one-time migration path)

**Acceptance Criteria**:
- Filter "Unaddressed" shows only findings where `!status || status === "open"`
- Filter "Applied" shows only findings where `status === "applied"` OR `_applied === true` (legacy)
- Other filter combinations work as before

**Verification Gate**:
```bash
cd packages/web && npm test
# Manual: see Verification Evidence section
```

---

### RFC-006: SARIF Sidecar `properties.status`

**Summary**: Include `status` in SARIF `properties` bag so external tools see it.

**Files**:
- `packages/engine/src/engine/pipeline/sarif_builder.py` — add `status` to properties (1 line)

**Stages**:
1. Locate where `properties` is built (around `properties._applied` line)
2. Add `status` field conditionally (only if present)

**Acceptance Criteria**:
- SARIF sidecar contains `properties.status` for findings that have a status
- Findings without status don't have a `status` property (not null, not missing-key — actually omitted)
- No regression in other SARIF fields

**Verification Gate**:
```bash
cd packages/engine && .venv/Scripts/python.exe -m pytest tests/test_sarif_builder.py -v
```

---

### RFC-007: Tests

**Summary**: Add tests for all RFCs that lack them.

**Files**:
- `packages/engine/tests/test_sarif_builder.py` (new or extend) — test status in properties
- `packages/cli/tests/routes/findings.test.js` (new) — test new endpoint (4 scenarios: valid, invalid status, missing finding, idempotency)
- `packages/cli/tests/routes/apply.test.js` (new or extend) — test persistence
- `packages/web/tests/hooks/useFindingStatus.test.ts` (new) — test hook with mocked fetch
- `packages/web/tests/components/FilterPanel.test.tsx` — verify "Unaddressed" option renders and triggers filter
- `packages/web/tests/components/FindingsList.test.tsx` — verify buttons + badge

**Acceptance Criteria**:
- All new tests pass
- No regression in existing tests

**Verification Gate**:
```bash
cd packages/engine && .venv/Scripts/python.exe -m pytest -q
cd packages/cli && npm test
cd packages/web && npm test
```

---

## Implementation Checklist

The full atomic checklist a developer can copy-paste into Cursor Plan mode or work through linearly.

- [ ] **RFC-001.1**: Create `packages/engine/src/engine/core/finding_status.py` with `FindingStatus` Literal and `DEFAULT_STATUS = "open"`
- [ ] **RFC-001.2**: Add `FindingStatus` type + `status?: FindingStatus` to `Finding` in `packages/web/src/types.ts`
- [ ] **RFC-001.GATE**: `cd packages/web && npm run typecheck` passes; `cd packages/engine && python -c "from engine.core.finding_status import ..."` works
- [ ] **RFC-002.1**: Add `markFindingApplied(reportPath, findingId)` to `packages/cli/src/services/reportService.js` with atomic write
- [ ] **RFC-002.2**: Wire into `packages/cli/src/routes/apply.js` after existing success path
- [ ] **RFC-002.GATE**: `cd packages/cli && npm test` passes; manual apply test (see Verification Evidence)
- [ ] **RFC-003.1**: Add `updateFindingStatus(reportPath, findingId, status)` to `reportService.js` with status validation
- [ ] **RFC-003.2**: Create `packages/cli/src/routes/findings.js` with POST handler
- [ ] **RFC-003.3**: Register route in `packages/cli/src/server.js`
- [ ] **RFC-003.GATE**: `npm test` passes; manual curl test
- [ ] **RFC-006.1**: Locate properties bag in `packages/engine/src/engine/pipeline/sarif_builder.py`
- [ ] **RFC-006.2**: Add `status` to properties (conditional, only if present)
- [ ] **RFC-006.GATE**: `pytest tests/test_sarif_builder.py` passes
- [ ] **RFC-004.1**: Create `packages/web/src/hooks/useFindingStatus.ts` with `setStatus(findingId, status)` that POSTs + updates `currentReport`
- [ ] **RFC-004.2**: Update `packages/web/src/components/FindingsList.tsx` to add 2 buttons + status badge
- [ ] **RFC-004.GATE**: `cd packages/web && npm test` passes; manual click test
- [ ] **RFC-005.1**: Update `packages/web/src/components/FilterPanel.tsx` to add "Unaddressed" option to "Fix Status" group
- [ ] **RFC-005.2**: Update `packages/web/src/App.tsx` filter logic to use `status` field
- [ ] **RFC-005.GATE**: `npm test` passes; manual filter test
- [ ] **RFC-007.1**: Add engine test for SARIF `properties.status`
- [ ] **RFC-007.2**: Add CLI test for `/api/finding/.../status` (4 scenarios)
- [ ] **RFC-007.3**: Add CLI test for apply route persistence
- [ ] **RFC-007.4**: Add web test for `useFindingStatus` hook
- [ ] **RFC-007.5**: Add web test for FilterPanel "Unaddressed" option
- [ ] **RFC-007.6**: Add web test for FindingsList buttons + badge
- [ ] **RFC-007.GATE**: All 3 test suites pass: `pytest -q`, `npm test` (cli), `npm test` (web)

---

## Verification Evidence

### Automated Tests
```bash
# Engine
cd packages/engine && .venv/Scripts/python.exe -m pytest -q
# Expected: 209+ passed (or same as before + new tests)

# CLI
cd packages/cli && npm test
# Expected: 75+ passed (or same as before + new tests)

# Web
cd packages/web && npm test
# Expected: 138+ passed (or same as before + new tests)
```

### Manual E2E Test (Demo Script for DATN defense)

1. **Start CLI**: `node bin/cli.js serve --port 3000`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Trigger a scan** (or use existing report)
4. **Mark a finding as False Positive**:
   - Click "Mark FP" button on a finding
   - Verify badge "False positive" appears
5. **Apply a fix on another finding**:
   - Click "Apply Fix"
   - Verify badge "Applied" appears
6. **Reload the page** (Ctrl+R):
   - Both statuses persist
7. **Filter "Unaddressed"**:
   - Click the filter
   - Only `status === "open"` findings show
8. **Open the report JSON file directly** in a text editor:
   - Find the finding you marked FP
   - Confirm `"status": "false_positive"` is in the JSON
9. **Download SARIF**:
   - Click "Download SARIF"
   - Open the `.sarif` file
   - Confirm `properties.status` is present

### Demo Talking Points (for thesis defense)
- "I added a status field so users can track which findings are unaddressed between sessions"
- "The status survives page reload and is stored in the same JSON file — no separate database needed"
- "Future work (Option B) would add per-finding AI retry; future work (Option C) would add cross-scan diff. The status field I added is the foundation for both."

---

## Resume and Execution Handoff

A future executor (or a continuation of this session) should:

1. **Read this plan first** — start with "Quick Links" to jump to relevant section
2. **Read RFC-001** — types are the foundation; without them, no other RFC compiles
3. **Implement in RFC order** — each builds on the previous (RFC-001 → RFC-002 → RFC-003 → RFC-006 → RFC-004 → RFC-005 → RFC-007)
4. **After each RFC, run its Verification Gate** — do NOT skip
5. **If a gate fails, STOP and fix** — don't proceed with broken foundation
6. **Final report should include**:
   - Which RFCs are ✅ VERIFIED
   - Test count delta (before vs after)
   - Screenshots or copy-paste of manual E2E test
   - Any deviations from the plan (with rationale)

### Files to read first when resuming
- `process/general-plans/active/Finding_Status_Persistence_PLAN_16-06-26.md` (this file)
- `packages/cli/src/routes/apply.js` (existing pattern to mirror)
- `packages/cli/src/routes/reports.js` (existing pattern for new findings route)
- `packages/web/src/hooks/useReports.ts` (existing hook pattern)
- `packages/web/src/components/FindingsList.tsx` (UI host for new buttons)
- `packages/engine/src/engine/pipeline/sarif_builder.py` (1-line change)

### Known context from prior session
- The Option B refactor (Full SARIF migration) was just completed
- The "Robust AI response parsing for missing 'content' key" fix was just applied to `ai_resolver.py` and `naming_audit.py`
- Current test counts: Engine 209, CLI 75, Web 138 (with 1 pre-existing failure in test_scanner.py unrelated to this plan)

---

## Migration Path: A → B → C

This plan implements **Option A**. Future options build on it:

### A → B (Per-Finding AI Retry) — +1-1.5 days
- New endpoint: `POST /api/re-resolve-finding` with `{ reportPath, findingId }`
- UI: "Retry AI" button on findings with `status === "false_positive"` or AI failure
- Reuses: `status` field as input for retry decision; existing `run_refresh_ai` engine logic
- Backward compatible: yes (additive)

### B → C (Cross-Scan Diff) — +3-4 days
- New endpoint: `GET /api/diff?from=<reportId>&to=<reportId>`
- On each new scan, engine reads previous report (`.latest`), diffs by `id`, classifies findings:
  - **NEW**: id in new, not in old
  - **PERSISTENT**: id in both, `status === "open"`
  - **FIXED**: id was in old with `status === "applied"`, not in new
  - **REGRESSED**: id was in old with `status === "applied"`, back in new
- Reuses: `status` field + finding `id`
- Backward compatible: yes (additive)

---

## Cursor + RIPER-5 Guidance

### Cursor Plan mode
- Import the Implementation Checklist into Cursor
- Execute by RFC; after each RFC, update the plan file's status strip and "What's Functional Now" section (in the Resume and Execution Handoff)

### RIPER-5 mode
- **RESEARCH** ✅ (done in this session — see prior research output)
- **INNOVATE** ✅ (done — three options A/B/C were brainstormed and A was chosen)
- **PLAN** ✅ (this file)
- **EXECUTE**: Run RFCs 1-7 sequentially, presenting one consolidated verification report at the end (this is a 1-1.5 day plan, not a multi-day plan requiring per-RFC approval)
- **VERIFY**: Run all 3 test suites + manual E2E from "Verification Evidence" section
- **REVIEW**: Compare implementation vs plan; flag any deviations

### Reminder
- Each RFC has a Definition of Done; do NOT proceed to next RFC until current RFC's gate passes
- This plan is 1-1.5 days; do NOT scope-creep into Option B or C
- If a blocker is discovered, STOP and report — don't try to "fix" by adding scope

---

## Acceptance Criteria (Versioned)

### v1.0 (this plan, Option A)

1. ✅ `status` field exists on `Finding` in TypeScript and Python
2. ✅ Apply Fix persists `_applied = true` AND `status = "applied"` to JSON
3. ✅ POST `/api/finding/:reportPath/:findingId/status` works for all 4 status values
4. ✅ UI has "Mark FP" / "Reopen" buttons + status badge
5. ✅ UI has "Unaddressed" filter that shows only `status === "open"`
6. ✅ SARIF sidecar includes `properties.status` when set
7. ✅ All existing tests still pass
8. ✅ New tests cover the new functionality
9. ✅ Manual E2E test from "Verification Evidence" section passes
10. ✅ User can demo the feature to thesis committee

### Deferred to v2.0 (Option B)
- Per-finding AI retry
- Retry counter / last retry timestamp

### Deferred to v3.0 (Option C)
- Cross-scan diff
- NEW / PERSISTENT / FIXED / REGRESSED classification
- Trend dashboard
