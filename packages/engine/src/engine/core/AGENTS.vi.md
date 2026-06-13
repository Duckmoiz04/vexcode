# `core/` — Logic Phân Tích

**Module phân tích chính.** Mỗi file là một domain độc lập, có external dependency và mock fallback riêng. Các module này được pipeline stage coordinators (`pipeline/`) gọi — chúng không bao giờ gọi nhau trực tiếp.

## Cấu trúc

| File | Export chính | External dependency | Đầu vào → Đầu ra |
|------|-------------|-------------------|------------------|
| `scanner.py` | `run_scan()` | Semgrep CLI (`semgrep`) | `(target, use_mock, files)` → `{scanner, timestamp, target_path, findings[]}` |
| `ast_graph.py` | `is_gitnexus_available()`, `get_repo_info_for_path()`, `resolve_location_to_symbol()`, `get_symbol_context()`, `get_symbol_impact()`, `parse_markdown_table()`, `get_relative_repo_path()` | GitNexus CLI (`gitnexus`) | `(repo, file, line)` → symbol dict với callers/impact/blast_radius |
| `ai_resolver.py` | `resolve_findings()`, `post_with_retry()`, `parse_api_response()`, `safe_json_parse()`, `sanitize_remediation_code()`, `decode_response_text()`, `read_surrounding_code()` | 9router API (HTTP) | `(findings[], use_mock)` → `{rule_id: {suggestion, remediation_code}}` |
| `complexity.py` | `analyze_file_complexity()`, `get_complexity_level()` | `lizard` (thư viện Python) | `(file_path)` → `{complexity, cognitive_complexity, loc, level, functions[]}` |
| `naming_audit.py` | `run_naming_audit()` | 9router API (HTTP) | `(files[], target, use_mock)` → `(findings[], resolutions{})` |

## Chi tiết từng module

### `scanner.py`
- **Mock** (`use_mock=True`): Trả về 2 `MOCK_FINDINGS` (dangerous-exec, hardcoded-password), có thể lọc theo `files` baseline.
- **Thật**: `subprocess.run(["semgrep", "scan", "--json", "--quiet", target])` → parse JSON → trích `path/start.line/check_id/extra.message/extra.severity/extra.lines`. Fallback về `MOCK_FINDINGS` nếu có lỗi (FileNotFoundError, JSON lỗi, exit code != 0 với stdout rỗng).
- Trường hợp `files` được cung cấp (fast scan): chỉ scan các file cụ thể.

### `ast_graph.py`
- **Mock** (`use_mock=True` + GitNexus không khả dụng): Tra `MOCK_AST_CONTEXTS[(file, line)]` — 2 mục cố định cho `(example.py, 12)` và `(db.py, 45)`.
- **Thật**: Ba lần gọi GitNexus CLI cho mỗi finding:
  1. `gitnexus cypher -r <repo> "MATCH (n) WHERE n.filePath..."` — xác định symbol tại (file, line)
  2. `gitnexus context -r <repo> -u <uid> --content` — view 360° (callers, callees, imports)
  3. `gitnexus impact -r <repo> -d upstream --depth 3 <uid>` — blast radius (upstream dependents)
- Chọn symbol cụ thể nhất (Function > Method > Class > others), sau đó theo span nhỏ nhất.
- `get_repo_info_for_path()` phân tích output `gitnexus list`, so khớp target path với các repo đã đăng ký.
- `parse_markdown_table()` xử lý output markdown table từ `gitnexus cypher` fallback.

### `complexity.py`
- Dùng thư viện `lizard` Python (không phải CLI).
- Trả về phân tích từng function: CCN (cyclomatic complexity), cognitive ước lượng (CCN − 1), NLOC, dòng bắt đầu/kết thúc.
- Mức độ phức tạp: `LOW` ≤ 10, `MEDIUM` ≤ 25, `HIGH` > 25.
- Trả về empty/default metrics cho file rỗng, file nhị phân, hoặc file không tồn tại.

### `ai_resolver.py`
- **Mock**: Ánh xạ `rule_id` → `MOCK_AI_RESOLUTIONS` (3 mục: dangerous-exec, hardcoded-password, naming.obscure). Rule lạ → suggestion chung.
- **Thật**: Gọi API tuần tự từng rule:
  1. Khử trùng findings theo `rule_id` (tối đa `MAX_RESOLVE_FINDINGS` = 5)
  2. Với mỗi rule unique, xây prompt: file/line/code + code xung quanh (5 dòng context, đánh dấu `>>>>`) + AST context (callers, risk, impacted count)
  3. POST `{base_url}/chat/completions` với `SYSTEM_PROMPT_RESOLVE` + user prompt
  4. Backoff mũ: 2 lần retry, base 15s (15s, 30s), xử lý 429 Too Many Requests và Timeout
  5. Xử lý response: `decode_response_text()` → `parse_api_response()` (tìm `{` đầu) → `safe_json_parse()` (bỏ markdown fences) → `sanitize_remediation_code()` (bỏ comment-only)
  6. Cooldown 8s giữa các request
- `read_surrounding_code()` đọc `context_lines` (mặc định 5) dòng trên và dưới finding từ file nguồn.

### `naming_audit.py`
- **Mock**: Kiểm tra `example.py` trong danh sách file → tạo 1 finding + mock resolution cho `maintainability.naming.obscure`.
- **Thật**: Với mỗi file (tối đa `MAX_NAMING_AUDIT_FILES` = 3):
  1. Đọc code nguồn (cắt ở `MAX_CODE_CHARS` = 3000 ký tự)
  2. POST tới AI API với `SYSTEM_PROMPT_NAMING_AUDIT`
  3. Parse JSON array `{line, code_text, message, suggestion, remediation_code}`
  4. Tạo `rule_id` duy nhất dạng `maintainability.naming.obscure.{rel_path}_{idx}`
  5. Cooldown 8s giữa các file
- Các tên bị flag vì quá chung chung (`x`, `a`, `temp`, `data`, `obj`, `process`) hoặc gây hiểu nhầm.

## Tra cứu nhanh

| Task | Module |
|------|--------|
| Thay Semgrep bằng scanner khác | `scanner.py` |
| Sửa AST enrichment queries hoặc mock data | `ast_graph.py` |
| Chỉnh prompt AI, retry, hoặc parsing | `ai_resolver.py` + `ai_prompts.py` |
| Sửa thresholds/metrics complexity | `complexity.py` |
| Sửa naming audit rules hoặc prompt | `naming_audit.py` + `ai_prompts.py` |

## Quy ước

- **Mọi module có mock fallback** — `use_mock=True` bỏ qua mọi gọi external. Mọi external dependency (Semgrep, GitNexus, 9router) đều degrade gracefully.
- **Import chéo**: qua `engine.config.*` và `engine.utils.*` — không import sibling giữa các module `core/`.
- **Type hints kiểu cũ**: `typing.Dict`, `typing.Optional`, `typing.List`, `typing.Tuple` — không `dict | None`.
- **Subprocess calls**: luôn dùng `subprocess.run()` với `capture_output=True`, `text=True`, `check=False`, `shell=(sys.platform == 'win32')`.
- **Module-level constants**: thresholds từ `constants.py` được import ở module level trong `ai_resolver.py` — không truyền qua tham số.

## Anti-Patterns

- Không bỏ qua mock fallback — mọi đường dẫn external dependency phải có alternative offline.
- Không import sibling `core/` trực tiếp — luôn qua `engine.config.*` hoặc `engine.utils.*`.
