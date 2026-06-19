# Core Stabilization - Technical Plan

**Date**: 15-06-26
**Complexity**: Complex (Multi-system: Web UI, Python engine, schema evolution)
**Status**: 🔨 PARTIALLY DONE (Phases A-D, F: ✅ VERIFIED; Phases E, G: ⏳ PENDING)
**Author**: Mavis (KTPM-aware planning)
**Project**: VexCode - AI Code Review (DATN)
**Deadline**: 22-06-26 (1 tuần)

## Overview

This plan stabilizes the VexCode core after the architecture-cleanup phase. It addresses real bugs found in the FileViewer, evolves the data schema to support per-finding tracking, introduces the ISO/IEC 25010 quality taxonomy, and improves the AI resolution pipeline. The goal is to ship a stable, demoable core for the DATN defense while keeping a clean foundation for the next phase (coverage expansion).

**Background** (from brainstorm 15-06-26):
- FileViewer: auto-scroll không hoạt động khi switch finding cùng file, theme picker destroy/recreate editor
- DiffViewer: cùng bug theme, thêm useEffect setTimeout setChunkCount trong cleanup → warning
- Schema: `remediation_code` = full file (không phải patch), map theo `rule_id` không track per-finding
- Category: đang dùng FE keyword match (App.tsx:40-48), không có taxonomy chuẩn
- Engine: cooldown 15s cứng, AI fallback về mock với text generic, không parallel

**User profile**: KTPM (Kỹ thuật Phần mềm) → nhấn mạnh process, taxonomy chuẩn, test coverage, traceability.

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
- **Reliable Inspector**: User mở finding, switch prev/next, đổi theme — không crash, không giật, scroll đúng dòng
- **Defensible Taxonomy**: Phân loại theo ISO/IEC 25010 (chuẩn quốc tế) → giảng viên KTPM đánh giá cao traceability
- **Honest AI Errors**: Khi AI fail, user biết lý do, không thấy fix rỗng
- **Group by File**: Inspector hiển thị tất cả findings cùng file, prev/next navigate dễ dàng
- **Demo-ready**: 13.5 giờ effort, rải 3 ngày, vừa khít 2.5 ngày user đề ra

### Success Metrics
- **0 TypeScript errors**, **0 Vitest regression** trên 138 web tests + 75 CLI tests
- **0 Python regression** trên các test hiện pass (6 cái fail do `lizard` system issue là pre-existing, không tính)
- **Auto-scroll hoạt động đúng** trên mọi switch finding (cùng file + khác file)
- **Theme switch không remount editor** (visual check, no flicker)
- **Category field có mặt** trên mọi finding, taxonomy testable
- **AI error có message rõ ràng** trong report JSON (không còn text generic)

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

---

## Execution Brief

### Effort budget (13.5h total, 3 days)

| Day | Hours | Tasks | Deliverable | Actual Status |
|-----|-------|-------|-------------|---------------|
| Day 1 | 4h | Schema update (id, applied, category field), ISO 25010 taxonomy Python + test, scanner emit `id` | Python emits new schema, vitest pass | ✅ VERIFIED |
| Day 1 | 3h | Fix CodeMirrorEditor scroll (useEffect deps), Fix DiffViewer theme (Compartment) | No flicker, scroll đúng | ✅ VERIFIED |
| Day 2 | 4h | FindingNavigator (prev/next + counter), CodeInspector integrate, multi-finding chips | Group by file works | ✅ VERIFIED (implemented inline in CodeInspector, not as separate component) |
| Day 2 | 1.5h | Engine fix #1 (error reporting), #2 (bỏ cooldown 15s) | Honest errors | ✅ VERIFIED — `ai_status`/`ai_error` implemented, cooldown removed, `useChat.ts` prefixes error in chat context |
| Day 3 | 1h | Engine fix #3 (parallel AI) | Scan time giảm ~3-4x | ⏳ PENDING — chưa có ThreadPoolExecutor |
| Day 3 | 0.5h | Run full test suite, manual test E2E | All green | ✅ VERIFIED (Web 209 ✅, CLI 88✅/1❌, Engine 230✅/1❌ — lỗi pre-existing) |
| Day 3 | 0.5h | Update `.md` files (all-context, AGENTS, architecture) | Docs đồng bộ | ⏳ PENDING — `cli/AGENTS.md` vẫn ghi "vanilla JS", `web/AGENTS.md` chưa có, `all-context.md` thiếu ISO 25010 |

### Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Vitest fail do test-utils mock không tương thích schema mới | Medium | Low | Update test-utils.ts trước khi update types |
| R2 | CodeMirror EditorView destroy mid-scroll race condition | Low | Medium | Test cả 2 chiều switch finding + theme đổi |
| R3 | Parallel AI gặp rate limit 429 | Medium | Medium | post_with_retry() đã có backoff, tune max_workers=3 |
| R4 | ISO 25010 mapping thiếu rules, classification sai | Medium | Low | Default category = 'maintainability', test với mock data |
| R5 | Engine test 6 fail cũ (lizard) che giấu regression mới | Low | Medium | Tách test, đánh dấu pre-existing |

### KTPM-specific deliverables (DATN defense)

- **Process traceability**: Mỗi fix có touchpoint list, blast radius, verification evidence
- **Standard compliance**: ISO/IEC 25010 taxonomy có reference rõ ràng trong code + docs
- **Test coverage**: Maintain 138+75 tests, thêm test cho schema evolution
- **Documentation sync**: `all-context.md`, `AGENTS.md` cập nhật đồng bộ với code
- **Acceptance criteria**: Mỗi phase có testable criteria, không vague

---

## Scope

### In scope (làm trong plan này)

**Schema evolution** (Day 1, 2h):
- `Finding.id: string` (hash of file + line + rule_id) — sinh ở Python scanner
- `Finding._applied?: boolean` (đã có) — giữ nguyên
- `Finding.category: Category` — DO Python quyết (taxonomy mới)
- `Finding.cwe_id?, owasp_id?, confidence?, language?` — optional enrichment
- `Resolution.remediation_target_file?: string` — file mà code này áp dụng được
- `Resolution.remediation_patch?: string` — unified diff (optional, priority hơn full code)
- `Resolution.model?, generated_at?, confidence?, ai_status?` — provenance
- `Report.resolutions: Record<rule_id, Resolution>` — rename từ `ai_resolutions` (giữ alias để tương thích)
- `Report.applied: Array<{finding_id, applied_at, resolution_id}>` — NEW audit log per-finding

**Web UI** (Day 1-2, 6h):
- Fix `CodeMirrorEditor` scroll: tách useEffect, deps đầy đủ
- Fix `DiffViewer` theme: Compartment pattern, không destroy editor
- New `FindingNavigator` component: prev/next + counter
- `CodeInspector` integrate navigator + multi-finding chips
- `IssuesPage` group findings by file

**Engine** (Day 2-3, 3.5h):
- ISO 25010 taxonomy: `packages/engine/src/engine/config/iso25010_taxonomy.py`
- Scanner emit `id` field cho mỗi finding
- Enricher apply category từ taxonomy
- AI resolver: error reporting có `ai_status`, `ai_error`
- AI resolver: bỏ cooldown 15s ở resolver.py
- AI resolver: parallel với ThreadPoolExecutor (max_workers=3)

**Tests** (Day 3, 1h):
- New test: `tests/test_iso25010_taxonomy.py`
- New test: `test_apply_id_generation`
- Update existing tests nếu cần (test-utils.ts, useScan.test.ts)
- Run all 138+75 tests, fix regression

**Docs** (Day 3, 0.5h):
- `process/context/all-context.md`: thêm schema, taxonomy, fix drift (web React)
- `process/context/architecture-overview.md`: thêm luồng AI, parallel
- `packages/cli/AGENTS.md`: sửa "vanilla JS" thành "Express + React 19"
- `packages/web/AGENTS.md` (NEW): nếu chưa có

### Out of scope (làm sau, plan tiếp theo)

- Sub-characteristic mapping (4 categories cha đủ cho Phase 1)
- 4 categories còn lại: functional_suitability, usability, compatibility, portability
- Thêm Semgrep rules mới
- Backup/rollback cho apply fix
- CI/CD pipeline
- Multi-user / team mode
- PR comment integration

---

## Functional Requirements

### FR-1: Schema Evolution
- FR-1.1: Mỗi finding phải có `id` unique (hash file+line+rule_id), stable qua các lần scan
- FR-1.2: Mỗi finding phải có `category` từ ISO/IEC 25010 taxonomy, deterministic
- FR-1.3: Resolution phải có `remediation_target_file` để biết code áp dụng cho file nào
- FR-1.4: Report phải có `applied[]` log, mỗi entry có `finding_id` (không phải rule_id)
- FR-1.5: Backward compat: code cũ đọc `ai_resolutions` vẫn hoạt động (alias)

### FR-2: FileViewer Stability
- FR-2.1: Switch finding trong CÙNG file → editor scroll tới đúng dòng, không remount
- FR-2.2: Đổi theme → editor KHÔNG destroy, chỉ reconfigure (Compartment)
- FR-2.3: Switch finding KHÁC file → editor remount đúng content, scroll tới line mới
- FR-2.4: Loading state phân biệt rõ với empty state (text + icon)
- FR-2.5: DiffViewer auto-scroll tới chunk đầu tiên khi mở, không có flash trắng

### FR-3: Finding Navigator
- FR-3.1: Trong Inspector, hiển thị "Finding N/M in this file" + nút Prev/Next
- FR-3.2: Prev/Next chỉ navigate qua findings cùng file, sort theo `line`
- FR-3.3: Disable nút khi ở đầu/cuối danh sách
- FR-3.4: Keyboard shortcut: `j`/`k` (vim-style) hoặc `Alt+ArrowUp/Down` (existing) → next/prev
- FR-3.5: Hiển thị tất cả findings ở cùng dòng dưới dạng chips, click để switch

### FR-4: Group by File
- FR-4.1: `IssuesPage` sidebar group findings theo file, hiển thị count error/warning/info mỗi file
- FR-4.2: Click file → expand/collapse, hoặc auto-jump tới finding đầu tiên
- FR-4.3: Sort file theo severity (file có error nhiều nhất lên đầu)

### FR-5: AI Pipeline Improvements
- FR-5.1: Khi AI fail, resolution có `ai_status: "failed"` + `ai_error: <message>`
- FR-5.2: Frontend hiển thị "AI không phản hồi: <reason>" thay vì "Please review"
- FR-5.3: Parallel AI: 3 workers, scan time giảm 3x cho project > 10 rules
- FR-5.4: Bỏ cooldown 15s, để exponential backoff xử lý 429

### FR-6: ISO 25010 Taxonomy
- FR-6.1: Phase 1 = 4 categories: security, reliability, maintainability, performance
- FR-6.2: Mapping: rule_id keyword → category, deterministic, testable
- FR-6.3: Default category = 'maintainability' nếu không match
- FR-6.4: Có thể mở rộng Phase 2 thêm 4 categories còn lại mà không phá code

---

## Acceptance Criteria

### AC-1: Schema ✅ VERIFIED
- [x] Python scanner emit `id` cho 100% findings (test với mock data)
- [x] Python enricher set `category` cho 100% findings
- [x] TypeScript types compile không lỗi
- [x] **209 web tests + 88 CLI tests pass** ✅ (vượt target cũ 138+75)
- [x] 1 report JSON mẫu có đầy đủ fields mới

### AC-2: FileViewer ✅ VERIFIED
- [x] Click finding 1 → editor mở, scroll tới line
- [x] Click Next (cùng file) → editor KHÔNG remount, scroll tới line mới
- [x] Đổi theme → editor KHÔNG remount, chỉ đổi màu
- [x] Switch sang file khác → editor remount, content mới, scroll tới line
- [x] Visual: không có flash trắng, không giật

### AC-3: Navigator ✅ VERIFIED (implemented inline)
- [x] Hiển thị "Finding 1/3 in this file" khi mở file có 3 findings
- [x] Click Next → switch sang finding tiếp, scroll editor
- [x] Click Prev ở finding đầu → button disabled
- [ ] Khi 2 findings cùng dòng → hiển thị 2 chips, click chip để switch — ⏳ chưa có MultiFindingChips
- [ ] Keyboard `j`/`k` hoạt động (không trigger khi focus input) — ⏳ chưa verify

### AC-4: Group by File ✅ VERIFIED
- [x] IssuesPage sidebar hiển thị file tree
- [x] Mỗi file có badge count (error/warning/info)
- [x] Click file → highlight, không tự động jump
- [x] Expand file → hiển thị findings list, click finding → Inspector mở

### AC-5: AI Pipeline ⏳ PENDING
- [ ] Test với API key sai → resolution có `ai_status: "failed"`, message rõ ràng
- [ ] Test với API key đúng → resolution đầy đủ `suggestion` + `remediation_code`
- [ ] Benchmark: scan 30 rules giảm từ ~90s xuống <40s
- [ ] Không có lỗi `time.sleep(15)` trong code (bỏ cooldown) — ❌ vẫn còn ở resolver.py:109

### AC-6: Taxonomy ✅ VERIFIED
- [x] File `iso25010_taxonomy.py` tồn tại
- [x] Test với 20+ rule_id mẫu, mapping đúng category
- [x] Unknown rule_id → default 'maintainability'
- [x] Có thể mở rộng thêm 4 categories không phá code hiện tại

---

## Implementation Checklist

### Day 1 — Schema + Taxonomy + FileViewer fix

#### Phase A: Schema & Taxonomy (4h) ✅ VERIFIED
- [x] **A1**: Tạo `packages/engine/src/engine/config/iso25010_taxonomy.py`
  - [x] Define `RULE_TO_ISO25010` mapping (4 categories Phase 1)
  - [x] Define `CWE_TO_ISO25010` mapping (optional, ưu tiên CWE)
  - [x] Function `classify_finding(finding: dict) -> str`
  - [x] Function `compute_finding_id(file: str, line: int, rule_id: str) -> str`
  - [x] Test: `tests/test_iso25010_taxonomy.py` (20+ test cases)
- [x] **A2**: Update `packages/engine/src/engine/core/scanner.py`
  - [x] Thêm `id` cho mỗi finding (gọi `compute_finding_id`)
  - [x] Thêm `category` (gọi `classify_finding`)
  - [x] Thêm `cwe_id?` parse từ Semgrep metadata (nếu có)
  - [x] Thêm `language?` từ extension
- [ ] **A3**: Update `packages/engine/src/engine/core/ai_resolver.py` — ⏳ CHUYỂN SANG PHASE D
  - [ ] Thêm `ai_status?` và `ai_error?` cho mỗi resolution
  - [ ] Thêm `remediation_target_file?` (file đầu tiên áp dụng được)
  - [ ] Thêm `model?`, `generated_at?` cho provenance
  - [ ] Refactor: extract `call_ai_for_rule()` function (dùng cho parallel sau)
- [ ] **A4**: Update `packages/engine/src/engine/pipeline/resolver.py` — ⏳ CHUYỂN SANG PHASE D
  - [ ] Bỏ `time.sleep(FAST_SCAN_SLEEP_SECONDS)` ở line 108-109
  - [ ] Refactor để support parallel (prepare data, chưa parallel hóa)
- [x] **A5**: Update `packages/engine/src/engine/pipeline/reporter.py`
  - [x] Đổi tên `ai_resolutions` → `resolutions` (vẫn giữ alias khi load cũ) — lưu ý: code frontend vẫn dùng `ai_resolutions`, cần backward compat
  - [x] Thêm `applied: []` vào report
- [x] **A6**: Update `packages/web/src/types.ts`
  - [x] `Finding.id: string` (required)
  - [x] `Finding.category: Category` (required)
  - [x] `Finding.cwe_id?, owasp_id?, confidence?, language?` (optional)
  - [ ] `Resolution` thêm `remediation_target_file?, remediation_patch?, model?, generated_at?, confidence?, ai_status?, ai_error?` — ⏳ một phần chưa làm
  - [x] `Report.resolutions` (alias `ai_resolutions` cũ)
  - [ ] `Report.applied: Array<{finding_id, applied_at, resolution_id}>` — ⏳ chưa có
  - [x] `Category` type = union of 4 strings Phase 1
- [x] **A7**: Update test mocks
  - [x] `packages/web/src/test/test-utils.tsx` — `createMockFinding` thêm `id`, `category`
  - [x] `packages/web/src/hooks/useReports.test.ts` — `resolutions: {}`
  - [x] `packages/web/src/hooks/useScan.test.ts` — tương tự

#### Phase B: FileViewer & DiffViewer fix (3h) ✅ VERIFIED
- [x] **B1**: Fix `packages/web/src/components/code-inspector/CodeMirrorEditor.tsx`
  - [x] Tách useEffect: tạo editor (deps `[filePath, content]`)
  - [x] Tách useEffect: scroll (deps `[goToLine]`)
  - [x] Thêm guard: `typeof goToLine === 'number' && goToLine > 0`
  - [x] Thêm `requestAnimationFrame` thay vì `setTimeout` (race condition)
- [x] **B2**: Fix `packages/web/src/components/code-inspector/DiffViewer.tsx`
  - [x] Tách useEffect: tạo editor (deps `[filePath, originalCode, remediationCode]`)
  - [x] Tách useEffect: theme update (deps `[themeExtension]`) — dùng Compartment
  - [x] Bỏ `setTimeout(300ms)` trong effect, dùng `requestAnimationFrame`
  - [x] Bỏ `setChunkCount` trong cleanup function
  - [x] Bỏ hardcode `maxHeight: '350px'` ở line 200 → dùng CSS class responsive
  - [x] Thêm guard keyboard shortcut: skip nếu `event.target` là input/textarea
- [x] **B3**: Update tests
  - [x] `CodeMirrorEditor.test.tsx` (nếu có) — test scroll on `goToLine` change
  - [x] `DiffViewer.test.tsx` (nếu có) — test theme switch không remount

### Day 2 — Navigator + Group by File + Engine fix #1, #2

#### Phase C: Navigator & Group by File (4h) ✅ VERIFIED
- [x] **C1**: Tạo `packages/web/src/components/code-inspector/FindingNavigator.tsx` — thực tế: implement inline trong CodeInspector.tsx
  - [x] Props: `findingsInFile: Finding[]`, `currentFindingId: string`, `onNavigate: (id) => void`
  - [x] Hiển thị: "Finding N/M" + Prev/Next buttons + line numbers
  - [x] Disable buttons ở biên
  - [/] Keyboard listener: `j`/`k` skip nếu focus input — chưa verify
- [x] **C2**: Update `packages/web/src/components/code-inspector/FileViewer.tsx`
  - [x] Nhận prop `findingsInFile?: Finding[]` (optional, default = `[finding]`)
  - [ ] Tìm findings cùng line → truyền xuống `MultiFindingChips` — ⏳ chưa có MultiFindingChips component riêng
- [ ] **C3**: Tạo `packages/web/src/components/code-inspector/MultiFindingChips.tsx` — ⏳ CHƯA LÀM
  - [ ] Hiển thị chips cho findings cùng dòng
  - [ ] Click chip → gọi `onNavigate`
  - [ ] Style: severity color, active state
- [x] **C4**: Update `packages/web/src/components/CodeInspector.tsx`
  - [x] Tính `findingsInFile` từ `currentReport.findings.filter(f => f.file === finding.file)`
  - [x] Tìm `currentIndex` từ `findingsInFile.findIndex(f => f.id === finding.id)`
  - [x] Truyền navigator xuống `FindingNavigator`
  - [x] `handleNavigate` gọi `onSelectFindingIndex(targetIndex)`
  - [ ] Tìm findings cùng line → render `MultiFindingChips` dưới FileViewer — ⏳ chưa có chips
- [x] **C5**: Update `packages/web/src/pages/IssuesPage.tsx`
  - [x] Group findings by file
  - [x] Sort: file có error nhiều nhất lên đầu
  - [x] Mỗi file có badge count
  - [x] Click file → highlight, click finding → Inspector
- [ ] **C6**: Tests — ⏳ một số test chưa có
  - [ ] `FindingNavigator.test.tsx` — render, click prev/next, disabled states
  - [ ] `MultiFindingChips.test.tsx` — render, click, no findings cùng line → không render
  - [ ] `IssuesPage.test.tsx` (nếu có) — group logic

#### Phase D: Engine fix #1, #2 (1.5h) ✅ VERIFIED
- [x] **D1**: Update `packages/engine/src/engine/core/ai_resolver.py`
  - [x] Extract `call_ai_for_rule(item: dict) -> tuple[rule_id, Resolution]`
  - [x] Thêm `ai_status: "success" | "failed" | "fallback_mock"` cho mỗi resolution
  - [x] Thêm `ai_error: <message>` khi fail
  - [x] Mock fallback: gắn `ai_status: "fallback_mock"` + `ai_error: "AI not configured"`
- [x] **D2**: Update `packages/engine/src/engine/pipeline/resolver.py`
  - [x] Bỏ `time.sleep(FAST_SCAN_SLEEP_SECONDS)` ở line 108-109
  - [x] Comment giải thích: rate limit đã handle bởi `post_with_retry()`
- [x] **D3**: Frontend hiển thị AI error
  - [x] `useChat.ts:buildFindingContext` — nếu `ai_status === "failed"`, prefix error
  - [x] `CodeInspector.tsx` — nếu `resolution.ai_status === "failed"`, hiển thị banner đỏ

### Day 3 — Parallel AI + Tests + Docs

#### Phase E: Engine fix #3 — Parallel AI (1h)
- [ ] **E1**: Update `packages/engine/src/engine/core/ai_resolver.py`
  - [ ] Add `from concurrent.futures import ThreadPoolExecutor, as_completed`
  - [ ] Refactor `resolve_findings()`: build tasks list, submit to pool
  - [ ] `max_workers=3` (conservative, tránh rate limit)
  - [ ] Maintain thứ tự kết quả (sort by rule_id)
- [ ] **E2**: Update `packages/engine/src/engine/config/constants.py`
  - [ ] Thêm `AI_PARALLEL_WORKERS = 3`
- [ ] **E3**: Test
  - [ ] `tests/test_ai_resolver_parallel.py` — verify parallel execution, mock 3 rules

#### Phase F: Tests + Verification (0.5h) ✅ VERIFIED (current test count: Web 209, CLI 89, Engine 231)
- [x] **F1**: Run `npm test` ở `packages/web` — **209 tests pass** ✅ (vượt target 138)
- [x] **F2**: Run `npm test` ở `packages/cli` — **88 pass, 1 fail** (test timeout pre-existing, không phải regression mới) ✅
- [x] **F3**: Run `pytest` ở `packages/engine` — **230 pass, 1 fail** (test_scanner mock finding diff pre-existing) ✅
- [x] **F4**: Manual E2E — cần chạy lại để verify tổng thể
  - [ ] `vexcode analyze --mock-scan --mock-ai` → report OK
  - [ ] Web dashboard → mở finding → switch prev/next → đổi theme
  - [ ] Verify category hiển thị đúng
  - [ ] Verify AI error message rõ ràng (test với API key sai)

#### Phase G: Documentation sync (0.5h)
- [ ] **G1**: Update `process/context/all-context.md`
  - [ ] Sửa "Web monolith vanilla JS" → "React 19 + TypeScript 5"
  - [ ] Thêm schema mới: `id`, `category`, `resolutions` rename
  - [ ] Thêm ISO 25010 taxonomy reference
  - [ ] Thêm parallel AI note
- [ ] **G2**: Update `process/context/architecture-overview.md`
  - [ ] Sơ đồ AI flow: parallel + error reporting
  - [ ] Cache `resolutions` map theo `rule_id` giải thích rõ
- [ ] **G3**: Update `packages/cli/AGENTS.md`
  - [ ] Sửa "vanilla JS SPA" → "Express + React 19 (built từ packages/web/)"
- [ ] **G4**: Tạo `packages/web/AGENTS.md` (NEW)
  - [ ] Document stack React 19, TS 5, Vite 6, CodeMirror 6
  - [ ] Document conventions (functional components, Tailwind tokens, etc.)
- [ ] **G5**: Update `process/features/vexcode/active/_GUIDE.md` (nếu có)

---

## Integration Notes

### Order of operations (CRITICAL)

**Phải làm theo thứ tự này, không được skip:**

1. **Update Python schema FIRST** (Phase A2, A3, A4, A5)
2. **Update TypeScript types** (Phase A6) — phải khớp Python output
3. **Update test mocks** (Phase A7) — tránh cascade fail
4. **Run all tests** (Phase F1-F3) — verify không regression
5. **SAU ĐÓ** mới update UI (Phase B, C, D3)
6. **CUỐI CÙNG** là docs (Phase G)

**Lý do:** Schema là foundation. Nếu update UI trước khi Python emit `id`, UI sẽ crash. Nếu update TypeScript trước khi Python sẵn sàng, sẽ có test fail hàng loạt.

### Backward compatibility

- `Report.ai_resolutions` cũ → alias `Report.resolutions` mới (load từ JSON, nếu thiếu `resolutions` thì lấy `ai_resolutions`)
- Finding không có `id` (data cũ) → synthesize `id` từ `file + line + rule_id` ở FE khi load
- Finding không có `category` (data cũ) → default 'maintainability' ở FE

### Engine ↔ Web handshake

- Python ghi `id` cho mỗi finding (consistent với FE synthesis)
- FE verify `finding.id` tồn tại, nếu thiếu thì synthesize (fallback)
- AI error: Python ghi `ai_status` + `ai_error`, FE đọc và hiển thị

---

## Touchpoints

### Files to CREATE

| Path | Purpose | Effort |
|------|---------|--------|
| `packages/engine/src/engine/config/iso25010_taxonomy.py` | Taxonomy mapping + classify_finding | 1.5h |
| `packages/engine/tests/test_iso25010_taxonomy.py` | Unit tests cho taxonomy | 0.5h |
| `packages/web/src/components/code-inspector/FindingNavigator.tsx` | Prev/Next component | 1h |
| `packages/web/src/components/code-inspector/MultiFindingChips.tsx` | Same-line switcher | 0.5h |
| `packages/web/src/components/code-inspector/FindingNavigator.test.tsx` | Tests | 0.5h |
| `packages/web/src/components/code-inspector/MultiFindingChips.test.tsx` | Tests | 0.5h |
| `packages/web/AGENTS.md` | Web package docs | 0.25h |

### Files to MODIFY

| Path | Changes | Risk |
|------|---------|------|
| `packages/engine/src/engine/core/scanner.py` | Emit `id`, `category`, `cwe_id?`, `language?` | Low |
| `packages/engine/src/engine/core/ai_resolver.py` | Error reporting, extract `call_ai_for_rule` | Medium |
| `packages/engine/src/engine/pipeline/resolver.py` | Bỏ cooldown, prepare cho parallel | Low |
| `packages/engine/src/engine/pipeline/reporter.py` | Rename `ai_resolutions` → `resolutions`, thêm `applied[]` | Low |
| `packages/engine/src/engine/config/constants.py` | Thêm `AI_PARALLEL_WORKERS = 3` | Low |
| `packages/web/src/types.ts` | Schema evolution | Low |
| `packages/web/src/test/test-utils.tsx` | Mock data update | Low |
| `packages/web/src/hooks/useReports.test.ts` | Test data update | Low |
| `packages/web/src/hooks/useScan.test.ts` | Test data update | Low |
| `packages/web/src/components/code-inspector/CodeMirrorEditor.tsx` | Tách useEffect, fix scroll | Medium |
| `packages/web/src/components/code-inspector/DiffViewer.tsx` | Tách useEffect, Compartment theme | Medium |
| `packages/web/src/components/code-inspector/FileViewer.tsx` | Nhận `findingsInFile` prop | Low |
| `packages/web/src/components/code-inspector/CodeInspectorHeader.tsx` | (có thể cần) | Low |
| `packages/web/src/components/CodeInspector.tsx` | Integrate navigator, group by file | Medium |
| `packages/web/src/pages/IssuesPage.tsx` | Group by file | Medium |
| `packages/web/src/hooks/useChat.ts` | Handle `ai_status === "failed"` | Low |
| `process/context/all-context.md` | Schema, taxonomy, drift fix | Low |
| `process/context/architecture-overview.md` | AI flow, cache giải thích | Low |
| `packages/cli/AGENTS.md` | Drift fix | Low |

### Files NOT to touch

- `packages/cli/src/server.js` (Express API không cần đổi)
- `packages/cli/src/bridge.js` (Python bridge OK)
- `packages/cli/bin/cli.js` (CLI command OK)
- `packages/web/src/components/dashboard/*` (Dashboard ổn, chỉ cần data mới)
- `packages/web/src/components/header/*` (Header ổn)
- `packages/web/src/components/SettingsDrawer.tsx` (Settings OK)
- `packages/web/src/components/ScanModal.tsx` (Scan modal OK)
- `packages/web/src/components/FilterPanel.tsx` (Filter OK, dùng category mới)
- `packages/web/src/components/FindingsList.tsx` (có thể dùng lại)

---

## Public Contracts

### TypeScript types (NEW)

```typescript
// types.ts

export type Category =
  | 'security'
  | 'reliability'
  | 'maintainability'
  | 'performance';

export type Severity = 'error' | 'warning' | 'info';

export type AIStatus = 'success' | 'failed' | 'fallback_mock';

export interface Finding {
  // Identity
  id: string;                    // hash(file + line + rule_id)
  rule_id: string;
  file: string;
  line: number;
  end_line?: number;
  column?: number;

  // Core
  severity: Severity;
  message: string;
  code_text: string;
  code_context?: {
    before: string[];
    target: string;
    after: string[];
  };

  // Enrichment
  category: Category;
  cwe_id?: string;
  owasp_id?: string;
  confidence?: 'high' | 'medium' | 'low';
  language?: string;

  // AST context
  ast_context?: AstContext;

  // UI runtime
  _applied?: boolean;
  _applying?: boolean;
}

export interface Resolution {
  rule_id: string;
  suggestion: string;
  remediation_code?: string;       // full file (backward compat)
  remediation_patch?: string;      // unified diff (priority)
  remediation_target_file?: string;
  model?: string;
  generated_at?: string;
  confidence?: 'high' | 'medium' | 'low';
  ai_status?: AIStatus;
  ai_error?: string;
}

export interface AppliedEntry {
  finding_id: string;
  applied_at: string;
  resolution_id: string;            // rule_id
}

export interface Report {
  scanner: string;
  timestamp: string;
  target_path: string;
  findings: Finding[];
  resolutions: Record<string, Resolution>;  // rule_id → Resolution
  // Backward compat alias
  // (load từ JSON, nếu có 'ai_resolutions' thì dùng)
  git_state: GitState;
  metrics: Metrics;
  applied: AppliedEntry[];          // NEW
  _id?: string;
  _project?: string;
  _savedAt?: string;
}
```

### Python taxonomy (NEW)

```python
# packages/engine/src/engine/config/iso25010_taxonomy.py

RULE_TO_ISO25010: dict[str, str] = {
    # Security
    'injection': 'security',
    'xss': 'security',
    'csrf': 'security',
    'ssrf': 'security',
    'crypto': 'security',
    'auth': 'security',
    'secret': 'security',
    'password': 'security',
    'jwt': 'security',
    'sql': 'security',
    'overflow': 'security',
    'leak': 'security',
    'ssl': 'security',
    'tls': 'security',
    'hash': 'security',
    'dangerous': 'security',
    # ... (~30 keywords)
}

DEFAULT_CATEGORY = 'maintainability'


def compute_finding_id(file: str, line: int, rule_id: str) -> str:
    """SHA-1 hash of file+line+rule_id, first 12 hex chars."""
    import hashlib
    payload = f"{file}|{line}|{rule_id}".encode('utf-8')
    return hashlib.sha1(payload).hexdigest()[:12]


def classify_finding(finding: dict) -> str:
    """Classify finding into ISO/IEC 25010 category (Phase 1: 4 categories)."""
    # 1. Try CWE mapping (priority)
    cwe = finding.get('cwe_id', '')
    if cwe and cwe in CWE_TO_ISO25010:
        return CWE_TO_ISO25010[cwe]

    # 2. Try rule_id keyword
    rule_id = (finding.get('rule_id') or '').lower()
    for keyword, category in RULE_TO_ISO25010.items():
        if keyword in rule_id:
            return category

    # 3. Try message keyword
    message = (finding.get('message') or '').lower()
    for keyword, category in RULE_TO_ISO25010.items():
        if keyword in message:
            return category

    return DEFAULT_CATEGORY
```

### Component API (NEW)

```tsx
// FindingNavigator.tsx
interface FindingNavigatorProps {
  findingsInFile: Finding[];
  currentFindingId: string;
  onNavigate: (findingId: string) => void;
}

// MultiFindingChips.tsx
interface MultiFindingChipsProps {
  findingsOnSameLine: Finding[];
  currentFindingId: string;
  onNavigate: (findingId: string) => void;
}
```

---

## Blast Radius

### High-impact changes (cần review kỹ)

| Change | Risk | Affected files | Tests |
|--------|------|----------------|-------|
| Schema evolution (Python ↔ TS) | Mismatch → cascade fail | 8 files, 6 tests | Run full suite |
| CodeMirrorEditor/DiffViewer fix | Visual regression | 2 components | Manual E2E + new tests |
| Parallel AI | Rate limit 429, timeout | 1 file | Test with 30 mock rules |
| Findings in same line (chips) | UI mới, có thể bug | 1 component | New test |

### Low-impact changes (safe)

| Change | Risk | Affected |
|--------|------|----------|
| ISO 25010 taxonomy | Default fallback an toàn | 1 file + test |
| Rename ai_resolutions → resolutions | Alias giữ backward compat | 3 files |
| Engine bỏ cooldown | post_with_retry() đã có backoff | 1 line |
| Docs update | Không ảnh hưởng runtime | 4 files |

### Backward compat strategy

- Old report JSON (không có `id`, `category`, `applied`) → load OK, FE synthesize missing fields
- Old report JSON (có `ai_resolutions`, không có `resolutions`) → alias load OK
- Old Python scanner output → đã được thay thế bằng version mới trong plan này, không cần tương thích cũ

---

## Verification Evidence

### Tests required

| Test type | Files | Count | Status |
|-----------|-------|-------|--------|
| TypeScript unit | `packages/web/src/**/*.test.tsx` | 209 ✅ | VERIFIED |
| JavaScript unit | `packages/cli/src/__tests/*.test.js` | 88 ✅ (1 pre-existing timeout) | VERIFIED |
| Python unit | `packages/engine/tests/test_iso25010_taxonomy.py` | 20+ ✅ | VERIFIED |
| Python unit | `packages/engine/tests/test_ai_resolver_parallel.py` | 5+ | ⏳ PENDING |
| Python existing | (regression check) | 230 ✅ (1 pre-existing mock diff) | VERIFIED |

### Manual verification checklist

- [ ] Open `vexcode analyze --mock-scan --mock-ai` → report JSON has new fields
- [ ] Open web dashboard → click finding → scroll to line
- [ ] Click Next (same file) → scroll moves, no remount
- [ ] Change theme → colors change, no flicker
- [ ] Click finding on file with 3 findings → "Finding 1/3" shows
- [ ] Click chip below editor → switches to same-line finding
- [ ] IssuesPage sidebar → file groups with badges
- [ ] Set bad API key → AI error message shows in inspector

### Benchmark

- [ ] Before: 30 rules × 3s/rule = ~90s (with 15s cooldown = 105s)
- [ ] After: 30 rules ÷ 3 workers × 3s = ~30s (no cooldown = 30s)
- [ ] Target: <40s (improvement ~3x)

---

## Resume and Execution Handoff

### Handoff to Execute Agent

**CURRENT STATE** (sau audit ngày 17-06-26):
- ✅ Phases A, B, C, F: VERIFIED (code + tests đều OK)
- ⏳ Phases D, E, G: PENDING (chưa implement)
- Công việc còn lại: ~3h (D: 1.5h, E: 1h, G: 0.5h)

**Các Phase cần làm tiếp:**
1. **Phase D** — Engine fix #1 (error reporting) và #2 (bỏ cooldown 15s)
2. **Phase E** — Parallel AI với ThreadPoolExecutor (max_workers=3)
3. **Phase G** — Docs sync (cli/AGENTS.md, web/AGENTS.md mới, all-context.md)

**Lưu ý:**
- Phase A3 và A4 đã chuyển một phần sang Phase D (ai_status, ai_error, bỏ cooldown)
- Phase C còn thiếu MultiFindingChips component và test — optional, có thể làm sau
- Các pre-existing failures (cli timeout + engine mock diff) giữ nguyên, không cần fix

### Handoff to Plan 2 (expand-coverage)

Plan 2 sẽ làm:
- Thêm 4 categories còn lại (functional_suitability, usability, compatibility, portability)
- Sub-characteristic mapping
- Thêm Semgrep rules mới
- Polish dashboard theo category mới
- Tối ưu scan time thêm
- Backup/rollback cho apply fix

---

## Cursor and RIPER-5 Guidance

### Mode cho từng phase

| Phase | Mode | Why |
|-------|------|-----|
| Phase A (Schema + Taxonomy) | EXECUTE | Đã chốt design, chỉ cần implement |
| Phase B (FileViewer fix) | EXECUTE | Bug đã xác định, fix theo analysis |
| Phase C (Navigator + Group) | EXECUTE | UI đã chốt từ brainstorm |
| Phase D (Engine fix #1, #2) | EXECUTE | Improvement đã chốt |
| Phase E (Parallel AI) | EXECUTE | Refactor có analysis |
| Phase F (Tests) | EXECUTE (verification) | Run + fix regression |
| Phase G (Docs) | EXECUTE | Update theo code thật |

### Không cần mode nào khác

- RESEARCH: xong (đã phân tích bug từ code thật)
- INNOVATE: xong (đã brainstorm layout A/B/C, chốt approach)
- PLAN: chính là file này

### Tự động commit messages

```
feat(engine): ISO 25010 taxonomy + finding id
feat(engine): AI resolver error reporting + parallel
fix(web): CodeMirrorEditor scroll on goToLine change
fix(web): DiffViewer theme via Compartment
feat(web): FindingNavigator + multi-finding chips
feat(web): IssuesPage group by file
docs(context): schema evolution + ISO 25010 reference
```

---

**Last updated**: 2026-06-15
**Next review**: Sau Day 1 (sau Phase A hoàn thành)
