# `config/` — Tầng Cấu Hình

**Cấu hình không phải bí mật, prompt templates, và hằng số dùng chung.** Bí mật (API keys) ở `.env` (load bởi `ai_config.py` ở package level, không nằm trong thư mục này).

Ba lớp ưu tiên cấu hình (cao nhất trước):
1. **Biến môi trường** — ghi đè mọi thứ tại runtime
2. **`conf/settings.toml`** — giá trị mặc định cho thresholds, AI settings, tên model provider
3. **Hardcoded defaults** — fallback trong `constants.py` nếu cả env lẫn TOML đều không có

## Cấu trúc

| File | Export | Trách nhiệm |
|------|--------|-------------|
| `ai_config.py` | `get_ai_config()`, `_reload_env_file()` | Phân giải AI provider: đọc env `AI_PROVIDER` → map sang env vars provider (`NINEROUTER_API_KEY`, v.v.) + TOML defaults |
| `ai_prompts.py` | `SYSTEM_PROMPT_RESOLVE`, `SYSTEM_PROMPT_NAMING_AUDIT` | Hai system prompt cho hai loại gọi AI (resolution bảo mật + naming audit) |
| `constants.py` | `load_settings()`, các hằng số module-level: `MAX_CODE_CHARS`, `MAX_NAMING_AUDIT_FILES`, `MAX_RESOLVE_FINDINGS`, `AI_RESOLVE_MAX_TOKENS`, `NAMING_AUDIT_SLEEP`, `AI_MAX_RETRIES`, `AI_RETRY_BASE_WAIT_SECONDS`, `AI_RESOLVE_TIMEOUT_SECONDS`, `AI_NAMING_TIMEOUT_SECONDS` | Thresholds và settings load từ `conf/settings.toml` + ghi đè env var |

## Chi tiết module

### `ai_config.py`
- Load `.env` từ `src/engine/.env` tại import time (qua `load_dotenv()`).
- `get_ai_config()`: đọc env `AI_PROVIDER` → dispatch tới `_get_provider_config(provider)`.
- Provider config: env vars `{PREFIX}_API_KEY`, `{PREFIX}_BASE_URL`, `{PREFIX}_MODEL` ưu tiên cao nhất. Mặc định từ `conf/settings.toml` `[ai.providers.{name}]`. `requires_key` chỉ từ TOML.
- Provider prefix: `"9router"` → `NINEROUTER`. Các provider khác dùng `provider.upper()`.
- `_reload_env_file()`: đọc lại `.env` mà không ghi đè `os.environ` đã tồn tại (an toàn cho test).
- Config cache: `_PROVIDER_CONFIG` được lazy-load từ `load_settings()` ở lần gọi đầu tiên.

### `ai_prompts.py`
- **`SYSTEM_PROMPT_RESOLVE`** (~25 dòng): Persona kỹ sư bảo mật. Hai bước: VERIFY (false positive hay thật?) → EVALUATE & FIX (bảo mật, đúng đắn, side effects, best practices). Output schema: `{"<alias>": {"suggestion": str, "remediation_code": str}}`. Phải dùng alias (vd `r0`) làm JSON key. Remediation phải là code cụ thể — chuỗi rỗng nếu không thể. False positive phải prefix suggestion bằng `"False positive:"`.
- **`SYSTEM_PROMPT_NAMING_AUDIT`** (~20 dòng): Persona kiến trúc sư phần mềm. Phát hiện tên tối nghĩa/chung chung/gây hiểu nhầm (`x`, `a`, `temp`, `data`, `obj`, `process`). Output schema: JSON array `{line, code_text, message, suggestion, remediation_code}`. Mảng rỗng `[]` nếu không có vấn đề.

### `constants.py`
- `load_settings()`: reader có cache cho `conf/settings.toml` dùng `tomllib` (Python 3.11+). Trả về dict rỗng nếu file không tồn tại.
- `_get_engine_root()`: resolve tới `packages/engine/` bằng cách đi lên 3 `.parents` từ file này.
- `_nested_get(d, keys, default)`: duyệt dict lồng nhau an toàn (vd `["ai_settings", "resolve_max_tokens"]`).
- `get_int_env(name, default)`: đọc env var + parse int + fallback.
- Hằng số module-level được tính một lần tại import time. Test cần reload module nếu thay đổi `os.environ`.

| Hằng số | Giá trị thường | Nguồn trong TOML / Env |
|----------|-------------|--------------------------|
| `MAX_CODE_CHARS` | 3000 | `analysis.max_code_chars` |
| `MAX_NAMING_AUDIT_FILES` | 3 | `analysis.max_naming_audit_files` |
| `MAX_RESOLVE_FINDINGS` | 5 | `analysis.max_resolve_findings` |
| `AI_RESOLVE_MAX_TOKENS` | 512 | `AI_RESOLVE_MAX_TOKENS` > `AI_MAX_TOKENS` > `ai_settings.resolve_max_tokens` |
| `NAMING_AUDIT_SLEEP` | 8.0 | `AI_REQUEST_COOLDOWN_SECONDS` > `ai_settings.request_cooldown_seconds` |
| `AI_MAX_RETRIES` | 2 | `AI_MAX_RETRIES` > `ai_settings.max_retries` |
| `AI_RETRY_BASE_WAIT_SECONDS` | 15.0 | `AI_RETRY_BASE_WAIT_SECONDS` > `ai_settings.retry_base_wait_seconds` |
| `AI_RESOLVE_TIMEOUT_SECONDS` | 90 | `AI_RESOLVE_TIMEOUT_SECONDS` > `ai_settings.resolve_timeout_seconds` |
| `AI_NAMING_TIMEOUT_SECONDS` | 90 | `AI_NAMING_TIMEOUT_SECONDS` > `ai_settings.naming_timeout_seconds` |

## Tra cứu nhanh

| Task | File |
|------|------|
| Thêm/sửa AI provider (env vars, TOML config) | `ai_config.py` |
| Sửa nội dung prompt resolution hoặc output schema | `ai_prompts.py` |
| Sửa thresholds phân tích (max files, timeouts, retries) | `constants.py` + `conf/settings.toml` |
| Sửa đường dẫn `.env` hoặc reload behavior | `ai_config.py` |

## Quy ước

- `load_settings()` cache kết quả trong `_SETTINGS` module-level — clear bằng `importlib.reload()` trong test nếu cần.
- `_reload_env_file()` không ghi đè `os.environ` đã tồn tại — không ảnh hưởng giá trị từ test hoặc parent process.
- Provider prefix aliases trong dict `_ENV_PREFIX`: `"9router" → "NINEROUTER"` — không phải provider nào cũng dùng `provider.upper()`.
- Secrets ở `.env` (gitignored), không ở `conf/settings.toml` (committed).
