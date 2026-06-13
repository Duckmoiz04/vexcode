# Python Core Analysis Engine — `src/engine/`

**Gốc package.** Entry điểm CLI điều phối pipeline 4 giai đoạn: Scan → Enrich → Resolve → Report. Có 2 luồng vào: pipeline đầy đủ (`--target`) và chạy lại AI (`--re-resolve`).

## Cấu trúc

```
src/engine/
├── __main__.py      # CLI argparser + điều phối pipeline
├── core/            # Logic phân tích (Semgrep, GitNexus, AI, complexity, naming)
├── config/          # Cấu hình AI provider, prompt templates, thresholds
├── utils/           # Tiện ích dùng chung (logger stderr)
└── pipeline/        # Điều phối stage (scanner → enricher → resolver → reporter)
```

## Luồng thực thi

```
__main__.main()
│
├── [--re-resolve] ──► core/ai_resolver.resolve_findings()
│                       └── Đọc report cũ → chạy lại AI → ghi đè
│
└── [pipeline mặc định]
     │
     ├── 1. SCAN ──► pipeline/scanner.run_scan_phase()
     │                ├── --fast → _detect_fast_scan_files() → `git status --porcelain`
     │                └── core/scanner.run_scan() → semgrep scan --json (hoặc mock)
     │
     ├── 2. ENRICH ──► pipeline/enricher.enrich_findings()
     │                  └── core/ast_graph.* → gitnexus cypher/context/impact (hoặc mock)
     │
     ├── 3. RESOLVE ──► pipeline/resolver.resolve_phase()
     │                   ├── core/complexity.analyze_file_complexity() → Lizard
     │                   ├── core/naming_audit.run_naming_audit() → AI đánh giá tên
     │                   └── core/ai_resolver.resolve_findings() → 9router LLM
     │
     └── 4. REPORT ──► pipeline/reporter.assemble_report() + write_report()
                        └── JSON dict → file
```

## Luồng dữ liệu (từng stage)

| Stage | Nhận đầu vào | Tạo ra | Tác dụng phụ |
|-------|-------------|--------|-------------|
| Scan | `target, use_mock, fast` | `{scanner, timestamp, target_path, findings}` | Danh sách `target_files` |
| Enrich | `findings[], target, use_mock` | `findings[]` cũ + thêm `.ast_context` | Không |
| Resolve | `findings[], target, use_mock, target_files` | `(findings[], resolutions{}, metrics{})` | Thêm naming findings vào findings |
| Report | `scan_results, findings, resolutions, target, metrics` | File JSON trên ổ đĩa | Thêm `git_state` vào report |

## Tra cứu nhanh

| Task | Đường dẫn |
|------|-----------|
| CLI flags / pipeline wiring | `__main__.py` |
| Thêm pipeline stage mới | `pipeline/*.py` + wire trong `__main__.py` |
| Thay scan backend (Semgrep → khác) | `core/scanner.py` |
| Đổi cấu hình AI provider | `config/ai_config.py` |
| Đổi thresholds phân tích | `config/constants.py` + `conf/settings.toml` |
| Sửa prompt AI resolution | `config/ai_prompts.py` |
| Thêm enrichment dimension mới | `pipeline/enricher.py` + module `core/` |

## Quy ước

- **Src-layout**: mọi import dùng prefix `engine.xxx.yyy` (vd `from engine.core.scanner import run_scan`)
- **Lazy imports** trong `__main__.py` — pipeline modules chỉ load khi cần scan, không load ở luồng `--re-resolve`
- **Chuỗi fallback**: thiếu Semgrep → mock scan. Thiếu GitNexus → bỏ qua enrichment. Thiếu AI → mock resolutions.
- **Subprocess pattern**: luôn `subprocess.run(capture_output=True, text=True, check=False, shell=(sys.platform == 'win32'))`
- **Mọi output → stderr**: qua `utils/logger.get_logger()`; stdout chỉ dùng cho JSON report
- **Type hints kiểu cũ**: `typing.Dict`, `typing.Optional`, `typing.List` — không dùng `dict | None`
- **Không custom types**: dữ liệu qua module là plain `dict`/`list` — không dataclasses, không Pydantic
- **Feature flags**: `--mock-scan` bỏ qua Semgrep, `--mock-ai` bỏ qua AI, `--fast` chỉ scan file thay đổi, `--re-resolve` bỏ qua pipeline
