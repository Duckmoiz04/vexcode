# `pipeline/` — Điều Phối Stage

**Điều phối pipeline.** Mỗi file quản lý một stage của pipeline phân tích. Các stage chạy tuần tự: scanner → enricher → resolver → reporter. Dữ liệu truyền giữa các stage dạng plain Python dict/list, không có custom types.

## Cấu trúc

| File | Export | Stage | Chức năng |
|------|--------|-------|-----------|
| `scanner.py` | `run_scan_phase()`, `get_git_state()`, `_detect_fast_scan_files()` | 1. Scan | Phát hiện git state → fast hoặc full scan → chạy Semgrep hoặc mock |
| `enricher.py` | `enrich_findings()` | 2. Enrich | GitNexus AST context enrichment cho từng finding (symbol, callers, impact) |
| `resolver.py` | `resolve_phase()`, `_collect_source_files()`, `_compute_metrics()`, `_run_naming_audit()` | 3. Resolve | Complexity metrics + naming audit + AI resolution (3 bước con) |
| `reporter.py` | `assemble_report()`, `write_report()` | 4. Report | Tổng hợp report dict + ghi JSON file |

## Chi tiết

### `scanner.py`
- `get_git_state(target_dir) → dict | None`: Chạy `git rev-parse --is-inside-work-tree`, `git rev-parse HEAD`, `git status --porcelain`. Trả về `{commit, is_dirty}` hoặc `None` nếu không phải git repo.
- `_detect_fast_scan_files(target, use_mock) → list | None`: Nếu `--fast`, chạy `git status --porcelain` → lấy danh sách file thay đổi. Mock mode trả về `[target/example.py]`. Trả về `None` (full scan), `[]` (sạch), hoặc `[paths]`.
- `run_scan_phase(target, use_mock, fast) → (scan_results, target_files)`:
  - Nếu `fast` + `target_files == []` (repo sạch): trả về findings rỗng với `scanner: "semgrep-fast"`.
  - Nếu `fast` + `target_files == [paths]`: gọi `run_scan(target, files=paths)`, set scanner `"semgrep-fast"`.
  - Nếu không `fast`: full scan qua `run_scan(target)`.
- Edge cases: thư mục không phải git + `--fast` → fallback full scan. `git status` lỗi → fallback full scan.

### `enricher.py`
- `enrich_findings(findings, target_path, use_mock) → findings` (biến đổi tại chỗ):
  1. Kiểm tra `is_gitnexus_available()` bằng subprocess.
  2. Nếu có GitNexus: `get_repo_info_for_path(target_path)` map target vào repo đã đăng ký.
  3. Với mỗi finding có cả `file` và `line`:
     - `get_relative_repo_path()` chuẩn hóa đường dẫn file.
     - `resolve_location_to_symbol()` chạy Cypher query tìm symbol tại vị trí đó.
     - `get_symbol_context()` + `get_symbol_impact()` lấy context đầy đủ và blast radius.
     - Trích callers từ `context.incoming.*` và blast radius từ `impact.byDepth.*`.
     - Gán `finding["ast_context"]` = `{symbol_id, symbol_name, kind, source_code, callers[], impact{}, blast_radius[]}`.
  4. Nếu GitNexus không khả dụng + `use_mock`: fallback `MOCK_AST_CONTEXTS[(file, line)]` — 2 mục.
- **Mutation**: list đầu vào bị sửa tại chỗ VÀ được trả về — cả tham chiếu gốc lẫn giá trị trả về đều trỏ tới cùng object.

### `resolver.py`
- Module-level `_settings = load_settings()` — cache tại import time.
- Đọc config: `MAX_FILES_FOR_COMPLEXITY` (mặc định 100), `FAST_SCAN_SLEEP_SECONDS` (mặc định 15), `MAX_NAMING_AUDIT_CANDIDATES` (mặc định 5).
- `_collect_source_files(target, target_files) → list`: Nếu có `target_files` thì dùng trực tiếp. Nếu không thì `os.walk()` thu thập `.py/.js/.jsx/.ts/.tsx`, bỏ qua `.git/node_modules/.venv/__pycache__/dist/build/public/.gemini/.gitnexus`, giới hạn `MAX_FILES_FOR_COMPLEXITY`.
- `_compute_metrics(target, source_files) → {files: {rel_path: {complexity, ...}}}`: Duyệt source files, gọi `analyze_file_complexity()` cho từng file.
- `_run_naming_audit(findings, target, source_files, use_mock) → (naming_findings, naming_resolutions, files_to_audit)`: Hợp của finding files + 5 source files đầu, lọc bỏ `.agents/.claude/.codex/process/.venv/node_modules/__pycache__`. Gọi `run_naming_audit()`.
- `resolve_phase(findings, target, use_mock, target_files) → (findings, resolutions, metrics)`:
  1. Thu thập source files → tính complexity metrics.
  2. Chạy naming audit → thêm naming findings vào findings.
  3. Nếu có findings: cooldown 15s (nếu không mock) → `resolve_findings()` → gộp naming resolutions.
- **Mutation**: naming findings được append vào list findings đầu vào.

### `reporter.py`
- `assemble_report(scan_results, findings, resolutions, target, metrics) → dict`:
  ```python
  {
    "scanner": scan_results["scanner"],
    "timestamp": scan_results["timestamp"],
    "target_path": scan_results["target_path"],
    "findings": findings,            # enriched + naming findings
    "ai_resolutions": resolutions,    # per-rule AI suggestions
    "git_state": get_git_state(target),  # {commit, is_dirty} hoặc None
    "metrics": metrics                # complexity per file
  }
  ```
- `get_git_state(target)` được gọi lại tại thời điểm report (dư thừa với scan phase — gọi độc lập).
- `write_report(report, output_path)`: `json.dump(report, f, indent=2)`.
- Không custom serialization — output là plain JSON dict. Mọi giá trị phải JSON-serializable.

## Data Flow

```
┌──────────┐     scan_results({})     ┌──────────┐     findings[] (đã enrich)    ┌──────────┐
│ Scanner  │ ──────────────────────►  │ Enricher │ ───────────────────────────►  │ Resolver │
│          │    target_files (list)   │          │     findings + target_files   │          │
└──────────┘                          └──────────┘                              │          │
       ▲                                                                         │          │
       │                                                                  ┌──────┤          │
       │                                             ┌──────────────────┐ │      └──────────┘
       │                                             │ core/complexity   │◄┤             │
       │                                             │ core/naming_audit │◄┤             │
       │                                             │ core/ai_resolver  │◄┤             │
       │                                             └──────────────────┘ │             │
       │                                                                   │             │
       │                                             (findings, resolutions, metrics)    │
       │                                                                                  │
       │                                                                                  ▼
       │                                                                        ┌──────────┐
       └────────────────────────────────────────────────────────────────────────┤ Reporter │
                                                                                └──────────┘
                                                                                      │
                                                                                      ▼
                                                                                JSON file
```

## Tra cứu nhanh

| Task | File |
|------|------|
| Sửa logic fast scan detection | `scanner.py` |
| Sửa git state collection | `scanner.py` |
| Sửa enrichment flow hoặc thêm AST dimensions | `enricher.py` |
| Sửa phạm vi/giới hạn complexity collection | `resolver.py` |
| Sửa naming audit criteria hoặc file filters | `resolver.py` |
| Sửa cấu trúc report hoặc thêm fields | `reporter.py` |

## Quy ước

- **`use_mock` passthrough**: mỗi stage nhận mock flag và truyền xuống module con. Stage không có việc gì trong mock mode thì return sớm.
- **`resolver.py`** là stage duy nhất có module-level `_settings` cache (`_settings = load_settings()` tại import time).
- **Cross-pipe data flows**: plain dicts/lists — không custom types, không dataclasses, không type-safe wrappers.
- **Mutable findings**: `enrich_findings()` sửa findings tại chỗ (thêm `.ast_context`). `resolve_phase()` sửa list bằng append naming findings. Tham chiếu list gốc được giữ nguyên.
