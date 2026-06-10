# AI Code Review — Kiến trúc tổng quan

> Ngày tạo: 2026-06-10
> Mục đích: Tài liệu tham khảo về kiến trúc, luồng hoạt động và các thành phần của hệ thống

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Cấu trúc packages](#2-cấu-trúc-packages)
3. [Luồng Scan đầy đủ (6 bước)](#3-luồng-scan-đầy-đủ-6-bước)
4. [API Endpoints](#4-api-endpoints)
5. [AI Provider System](#5-ai-provider-system)
6. [CLI Usage](#6-cli-usage)
7. [Frontend Components](#7-frontend-components)
8. [Data Flow Diagram](#8-data-flow-diagram)
9. [Điểm đáng chú ý trong thiết kế](#9-điểm-đáng-chú-ý-trong-thiết-kế)

---

## 1. Tổng quan hệ thống

**AI Code Review** là hybrid local CLI + Web UI, kết hợp:

| Thành phần | Công nghệ | Vai trò |
|------------|-----------|---------|
| `packages/cli-global/` | Node.js ESM (Express 4, Vitest) | CLI binary + REST API server + Web UI |
| `packages/web/` | React 19, Tailwind v4, TypeScript 5, Vite 6 | Frontend dashboard (build → cli-global/public) |
| `packages/analysis-core/` | Python 3.12 (Semgrep, GitNexus, 9router) | Analysis engine: scan → enrich → resolve → report |

### Kiến trúc tổng thể

```
┌──────────────────────────────────────────────────────────────────┐
│  packages/cli-global/  (Node.js ESM)                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────────┐     │
│  │ bin/cli.js│   │server.js │   │  routes/ (6 files)       │     │
│  │ CLI entry │──▶│ Express  │──▶│  config/scan/reports/    │     │
│  │ scan/serve│   │ :3000    │   │  apply/chat/files        │     │
│  └─────┬─────┘   │          │   └──────────────────────────┘     │
│        │         │          │   ┌──────────────────────────┐     │
│        │         │          │   │ services/ (3 files)       │     │
│        │         │          │   │ fileService/backupService/│     │
│        │         │          │   │ reportService             │     │
│        │         │          │   └──────────────────────────┘     │
│        ▼         └────┬─────┘                                    │
│  ┌──────────┐         │                                          │
│  │ bridge.js│◀────────┘  (spawns Python subprocess)              │
│  └─────┬────┘                                                     │
│        │  spawns + pipes stdout/stderr                            │
└────────┼─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  packages/analysis-core/  (Python 3.12)                          │
│                                                                  │
│  ┌──────────┐                                                     │
│  │ main.py  │──▶ pipeline/ (4 modules)                           │
│  │ CLI entry│    scanner ──▶ enricher ──▶ resolver ──▶ reporter  │
│  └──────────┘                                                     │
│       :                                                           │
│  ast_graph.py   ai_resolver.py   constants.py                    │
│  (GitNexus AST)  (9router AI)    (magic numbers)                 │
│                                                                  │
│  pipeline/                                                       │
│  ├── __init__.py    — module doc                                 │
│  ├── scanner.py     — Semgrep + fast-scan detection              │
│  ├── enricher.py    — GitNexus AST enrichment                    │
│  ├── resolver.py    — Complexity, naming audit, AI resolution    │
│  └── reporter.py    — Report assembly + JSON output              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  packages/web/  (React 19 + TypeScript 5 + Vite 6)              │
│  Build output → cli-global/src/public/                           │
│                                                                  │
│  App.tsx (state center)                                          │
│  ├── Header.tsx          — Navigation, scan button               │
│  ├── Sidebar.tsx         — Project list + history + categories   │
│  ├── SettingsDrawer.tsx  — AI provider config                    │
│  ├── ScanModal.tsx       — 6-step progress overlay (SSE)        │
│  ├── OnboardingPage.tsx  — Welcome screen                        │
│  ├── DashboardPage.tsx   — Overview stats + top findings         │
│  └── IssuesPage.tsx                                              │
│        ├── FilterPanel   — Search + severity/category/status/    │
│        │                    language filters                     │
│        ├── FindingsList  — Scrollable finding list               │
│        └── CodeInspector — File viewer + AI suggestion + Chat    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Cấu trúc packages

### 2.1 `packages/cli-global/` — Node.js ESM CLI + Express

| Module | Lines | Trách nhiệm |
|--------|-------|-------------|
| `bin/cli.js` | ~282 | CLI entry: commands `scan`, `serve`/`ui`, `help` |
| `src/server.js` | ~65 | Express app factory: mount routes, middleware, static files |
| `src/bridge.js` | ~233 | Spawn Python subprocess, pipe stdout/stderr, cancel scan |
| `src/utils.js` | ~50 | Helpers: `getProjectName`, `getProjectReportDir`, `getReportFilename` |
| `src/routes/config.js` | — | `GET/PUT /api/config` — đọc/ghi .env |
| `src/routes/scan.js` | ~99 | `GET /api/scan/stream` (SSE), `POST /api/scan`, `POST /api/scan/cancel` |
| `src/routes/reports.js` | ~94 | `GET /api/reports`, `/api/report`, `POST /api/re-resolve` |
| `src/routes/apply.js` | — | `POST /api/apply` — apply fix vào file + backup |
| `src/routes/chat.js` | — | `POST /api/chat` — hỏi AI về finding |
| `src/routes/files.js` | — | `GET /api/file-content` — đọc file để hiển thị |
| `src/services/fileService.js` | — | `isPathSafe`, `readEnvConfig`, `writeEnvConfig` |
| `src/services/reportService.js` | — | `listProjects`, `listProjectReports`, `getReportContent` |
| `src/services/backupService.js` | — | Backup/restore file trước khi apply |
| `src/__tests__/server.test.js` | — | 55 tests — contract test cho tất cả endpoints |
| `src/__tests__/bridge.test.js` | — | 15 tests — Python bridge + cancel |
| `src/__tests__/cli.test.js` | — | 15 tests — CLI parsing |

### 2.2 `packages/web/` — React 19 + TypeScript 5

| File | Trách nhiệm |
|------|-------------|
| `App.tsx` | State center: `currentReport`, `findings`, `config`, `projects` |
| `types.ts` | TypeScript interfaces: `Finding`, `Report`, `Config`, `ScanResult` |
| `components/Header.tsx` | Navigation header (tabs, scan button) |
| `components/Sidebar.tsx` | Sidebar: project list, scan history, filter counts |
| `components/SettingsDrawer.tsx` | Drawer: AI provider configuration |
| `components/ScanModal.tsx` | Modal overlay: 6-step progress (SSE real-time) |
| `components/ErrorBoundary.tsx` | React error boundary |
| `components/CodeInspector.tsx` | Code viewer + AI suggestion + chat |
| `components/FindingsList.tsx` | Scrollable list of findings |
| `pages/DashboardPage.tsx` | Overview: severity distribution, top files, metrics |
| `pages/IssuesPage.tsx` | Split-view: filter panel + findings + code inspector |
| `pages/OnboardingPage.tsx` | Welcome/getting started |

### 2.3 `packages/analysis-core/` — Python 3.12

| Module | Trách nhiệm |
|--------|-------------|
| `main.py` | CLI entry: argparse, orchestrator (scan/enrich/resolve/report) |
| `constants.py` | Magic numbers: `MAX_FILES_FOR_COMPLEXITY`, `MAX_RESOLVE_FINDINGS`, ... |
| `ast_graph.py` | GitNexus CLI adapter: `is_gitnexus_available()`, `get_symbol_context()`, `compute_impact()` |
| `ai_resolver.py` | 9router LLM API: `get_ai_config()`, `resolve_findings()`, `run_naming_audit()`, `read_surrounding_code()` |
| `pipeline/scanner.py` | Semgrep wrapper + fast-scan git-diff detection |
| `pipeline/enricher.py` | GitNexus AST enrichment |
| `pipeline/resolver.py` | Complexity metrics + naming audit + AI resolution orchestration |
| `pipeline/reporter.py` | Assemble report + write JSON |

---

## 3. Luồng Scan đầy đủ (6 bước)

### Bước 1: UI gửi lệnh
- `App.tsx::handleStartScan()` tạo `EventSource` đến `GET /api/scan/stream`
- Server-Sent Events (SSE) — real-time progress
- Scan Modal hiển thị 6 bước (pending → active → completed)

### Bước 2: Express route → Bridge
- `routes/scan.js`: route `/api/scan/stream`
- Kiểm tra path safety (`isPathSafe`)
- Gọi `bridge.js::runPythonAnalysis()` — spawn Python subprocess

### Bước 3: Python Pipeline (4 phases)

```
main.py
  │
  ├── PHASE 1 — Scanner
  │   scanner.py::run_scan_phase()
  │   ├── Fast mode? → _detect_fast_scan_files (git status --porcelain)
  │   │   - Returns None (full scan) | [] (clean) | [files] (changed)
  │   └── run_scan() → gọi Semgrep binary (hoặc mock data)
  │       result: { scanner, timestamp, target_path, findings }
  │
  ├── PHASE 2 — Enricher
  │   enricher.py::enrich_findings()
  │   ├── ast_graph.py::is_gitnexus_available() → bool
  │   ├── ast_graph.py::get_symbol_context()
  │   │   → symbol_name, kind, source_code, callers, impact
  │   └── ast_graph.py::compute_impact()
  │       → blast_radius (affected symbols grouped by depth)
  │
  ├── PHASE 3 — Resolver
  │   resolver.py::resolve_phase()
  │   ├── _collect_source_files() → [file_paths]
  │   ├── _compute_metrics() → Lizard complexity (LOC, cyclomatic)
  │   ├── _run_naming_audit() → AI kiểm tra tên biến/hàm
  │   └── ai_resolver.py::resolve_findings()
  │       ├── get_ai_config() → đọc provider từ env
  │       ├── Fallback: mock nếu thiếu API key/config
  │       ├── Sequential: gọi 9router từng rule một
  │       │   (batch 5+ rules gây timeout 60s+)
  │       └── Kèm AST context + surrounding code trong prompt
  │
  └── PHASE 4 — Reporter
      reporter.py::assemble_report() + write_report()
      → JSON file → ~/.ai-code-review/reports/{projectName}/
```

### Bước 4: Bridge nhận kết quả
- Python process exit 0 → đọc file JSON
- SSE gửi event `type: "complete"` kèm report data

### Bước 5: Frontend cập nhật state
- `App.tsx` nhận report → `setCurrentReport(report)`
- `loadProjects()` + `loadHistory()` refresh sidebar
- Tự động chuyển tab Issues/Dashboard

### Bước 6: User xem & apply fix
- **IssuesPage**: filter findings (severity, category, language, search)
- **CodeInspector**: xem code + AI suggestion + "Apply Fix"
- **Chat**: hỏi AI thêm về finding cụ thể (`/api/chat`)
- **Re-resolve**: "Ask AI Again" → chạy lại AI không cần re-scan

---

## 4. API Endpoints

| Endpoint | Method | Mục đích |
|----------|--------|----------|
| `/api/config` | GET | Đọc cấu hình AI provider từ `.env` |
| `/api/config` | PUT | Ghi cấu hình AI provider vào `.env` |
| `/api/scan/stream` | GET (SSE) | Scan với real-time progress events |
| `/api/scan` | POST | Scan đồng bộ (polling) |
| `/api/scan/cancel` | POST | Hủy scan đang chạy |
| `/api/reports` | GET | Danh sách project |
| `/api/reports/:project` | GET | Danh sách report của project |
| `/api/report/:project/:id` | GET | Nội dung 1 report |
| `/api/report` | GET | Report mới nhất (hoặc theo `?path=`) |
| `/api/re-resolve` | POST | Chạy lại AI trên report cũ |
| `/api/apply` | POST | Apply fix code vào file (kèm backup) |
| `/api/chat` | POST | Chat với AI về finding cụ thể |
| `/api/file-content` | GET | Đọc nội dung file |
| `/api/backup` | GET | Liệt kê backups |
| `/api/backup` | POST | Restore file từ backup |

---

## 5. AI Provider System

### Config động qua SettingsDrawer

User chọn provider và nhập thông tin:

1. **Provider**: OpenAI, Anthropic, Google, 9router
2. **API Key**, **Base URL**, **Model**
3. **Temperature**, **Max Tokens** (tùy chỉnh)

### Cơ chế đọc config

`ai_resolver.py::get_ai_config()` đọc biến môi trường theo pattern:

```
AI_PROVIDER = "openai"
OPENAI_API_KEY = "sk-..."
OPENAI_BASE_URL = "https://api.openai.com/v1"
OPENAI_MODEL = "gpt-4"
```

Config được lưu vào `.env` file trong `packages/analysis-core/`.

### Fallback behavior

Nếu thiếu config → tự động fallback về mock resolutions:

```
Không có API key     → "API key is required..."
Không có base_url    → "AI config is incomplete..."
Không có AI_PROVIDER → "AI provider is not configured..."
--mock-ai flag       → "Using mock AI resolutions..."
```

---

## 6. CLI Usage

### Commands

```bash
# Full scan
ai-code-review scan --target D:/project

# Offline (skip Semgrep + AI API)
ai-code-review scan --target D:/project --mock-scan --mock-ai

# Fast incremental scan (git changed files only)
ai-code-review scan --target D:/project --fast

# Start web server
ai-code-review serve --port 8080

# Serve + open browser
ai-code-review ui

# Help
ai-code-review help
ai-code-review scan --help
```

### Report storage

Tất cả report lưu tại: `~/.ai-code-review/reports/{projectName}/{timestamp}.json`

---

## 7. Frontend Components

### State Management (App.tsx)

```
App State
├── currentProject: string | null
├── projects: Project[]
├── reports: ReportListItem[]
├── currentReportId: string | null
├── currentReport: Report | null
├── selectedFindingIndex: number | null
├── selectedFilePath: string | null
├── activeTab: 'dashboard' | 'issues'
├── isScanning, scanStatus, scanLogs, elapsedTime
├── isReResolving
└── Filter states
    ├── searchQuery, filterSeverities, filterCategories
    ├── filterStatuses, filterLanguages
    └── expandedFilters
```

### Scan Modal (6 bước)

```
Step 0: Static Security Scan (Semgrep)
Step 1: AST Structural Analysis (GitNexus)
Step 2: Complexity Metrics (Lizard)
Step 3: Obscure Naming Audit (AI)
Step 4: Generate Fix Suggestions (9router AI)
Step 5: Package & Save Report
```

Mỗi bước có trạng thái: `pending` → `active` → `completed`
Cập nhật real-time qua SSE events.

### Finding Classification

Findings tự động phân loại dựa trên `rule_id`:

| Category | Keywords |
|----------|----------|
| `security` | injection, xss, csrf, secret, auth, crypto, ... |
| `architecture` | Có AST context + callers |
| `maintainability` | naming, deprecated, unused, duplicate, ... |
| `quality` | Mặc định (không match category nào) |

---

## 8. Data Flow Diagram

```
USER ACTION                    SYSTEM RESPONSE
─────────────                  ───────────────
                               ┌─────────────────────┐
Open Browser (port 3000) ───▶  │ Express serves       │
                               │ React SPA (public/)  │
                               └─────────────────────┘
                                      │
Click "Scan" ───────────────────────▶ │ GET /api/scan/stream
                                      │ Spawn Python process
                                      │
                                      ├─▶ main.py
                                      │     ├── scanner.py  → Semgrep
                                      │     ├── enricher.py → GitNexus
                                      │     ├── resolver.py → 9router AI
                                      │     └── reporter.py → JSON
                                      │
Progress events ◀── SSE stream ──────┤
                                      │
Scan complete ◀── type: "complete" ───┤
                                      │
Click "Ask AI Again" ──────────────▶  │ POST /api/re-resolve
                                      │ → main.py --re-resolve
                                      │
Click "Apply Fix" ─────────────────▶  │ POST /api/apply
                                      │ → backup file → write fix
                                      │
Chat with AI ──────────────────────▶  │ POST /api/chat
                                      │ → 9router chat completion
```

---

## 9. Điểm đáng chú ý trong thiết kế

### Kiến trúc

- **Không cần restart server** khi đổi AI provider — config đọc từ `.env` mỗi lần scan
- **Graceful fallback ở mọi tầng**: thiếu GitNexus → skip enrichment; thiếu API key → mock AI; lỗi Semgrep → mock scan
- **Rate-limit protection**: gọi AI từng rule một, 15s cooldown giữa các lần
- **Path safety**: mọi đường dẫn đều qua `isPathSafe()` kiểm tra workspace boundary
- **Cross-platform**: `shell = (sys.platform == 'win32')` cho mọi subprocess call

### Pipeline

- Scanner hỗ trợ **fast mode** (chỉ scan file thay đổi trong git)
- AI resolver gửi **surrounding code + AST context** trong prompt để accuracy cao hơn
- `resolve_findings()` gọi **từng rule một** (sequential) thay vì batch để tránh timeout
- Naming audit dùng AI riêng để phát hiện tên biến/hàm khó hiểu

### Frontend

- State tập trung ở `App.tsx`, truyền xuống component qua props
- SSE stream cho real-time progress (không cần polling)
- Filter state lifted lên App để giữa Dashboard và Issues page đồng bộ
- Code inspector tự động scroll đến line bị lỗi
- Chat với AI có context đầy đủ về finding (AST, callers, blast radius)

### An toàn

- `isPathSafe()` — case-insensitive prefix check, chống path traversal
- Backup file trước khi apply fix, có thể restore
- Error boundary React bắt lỗi render
- Tất cả subprocess dùng `check=False` + xử lý lỗi thủ công
