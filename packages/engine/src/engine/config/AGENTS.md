# `config/` — Configuration Layer

**Non-secret configuration, prompt templates, and shared constants.** Secrets stay in `.env` (loaded by `ai_config.py` at the package level, not in this directory).

Three layers of configuration precedence (highest first):
1. **Environment variables** — override everything at runtime
2. **`conf/settings.toml`** — defaults for thresholds, AI settings, provider model names
3. **Hardcoded defaults** — fallbacks in `constants.py` if neither env nor TOML provides a value

## Structure

| File | Exports | Responsibility |
|------|---------|----------------|
| `ai_config.py` | `get_ai_config()`, `_reload_env_file()` | AI provider resolution: reads `AI_PROVIDER` env → maps to provider env vars (`NINEROUTER_API_KEY`, etc.) + TOML defaults |
| `ai_prompts.py` | `SYSTEM_PROMPT_RESOLVE`, `SYSTEM_PROMPT_NAMING_AUDIT` | Two system prompts for the two AI call types (security resolution + naming audit) |
| `constants.py` | `load_settings()`, module-level constants: `MAX_CODE_CHARS`, `MAX_NAMING_AUDIT_FILES`, `MAX_RESOLVE_FINDINGS`, `AI_RESOLVE_MAX_TOKENS`, `NAMING_AUDIT_SLEEP`, `AI_MAX_RETRIES`, `AI_RETRY_BASE_WAIT_SECONDS`, `AI_RESOLVE_TIMEOUT_SECONDS`, `AI_NAMING_TIMEOUT_SECONDS` | Thresholds and settings loaded from `conf/settings.toml` + env var overrides |

## Module Details

### `ai_config.py`
- Loads `.env` from `src/engine/.env` at import time (via `load_dotenv()`).
- `get_ai_config()`: reads `AI_PROVIDER` env var → dispatches to `_get_provider_config(provider)`.
- Provider config resolution: env vars `{PREFIX}_API_KEY`, `{PREFIX}_BASE_URL`, `{PREFIX}_MODEL` take priority. Provider defaults from `conf/settings.toml` `[ai.providers.{name}]`. The `requires_key` boolean is from TOML only.
- Known provider prefixes: `"9router"` → `NINEROUTER`. All other providers use `provider.upper()`.
- `_reload_env_file()`: re-reads `.env` without overwriting already-set `os.environ` values (test-safe).
- Config cache: `_PROVIDER_CONFIG` is populated lazily from `load_settings()` on first call.

### `ai_prompts.py`
- **`SYSTEM_PROMPT_RESOLVE`** (~25 lines): Security engineer persona. Two-step instruction: VERIFY (false positive or real?) → EVALUATE & FIX (security, correctness, side effects, best practices). Output schema: `{"<alias>": {"suggestion": str, "remediation_code": str}}`. Rule ID alias (e.g., `r0`) must be used as JSON key. Remediation must be concrete code only — empty string if not possible. False positives must prefix suggestion with `"False positive:"`.
- **`SYSTEM_PROMPT_NAMING_AUDIT`** (~20 lines): Software architect persona. Scans for obscure/generic/misleading names (`x`, `a`, `temp`, `data`, `obj`, `process`). Output schema: JSON array of `{line, code_text, message, suggestion, remediation_code}`. Empty array `[]` if no issues.

### `constants.py`
- `load_settings()`: cached reader for `conf/settings.toml` using `tomllib` (Python 3.11+). Returns empty dict if file missing.
- `_get_engine_root()`: resolves to `packages/engine/` by navigating 3 `.parents` up from this file.
- `_nested_get(d, keys, default)`: safe traversal for nested TOML dicts (e.g., `["ai_settings", "resolve_max_tokens"]`).
- `get_int_env(name, default)`: env var reader with int parsing and fallback.
- Module-level constants are evaluated once at import time. Tests that change `os.environ` need to reload the module or re-import after `@patch.dict`.

| Constant | Typical value | Source path in TOML / Env |
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

## Where to Look

| Task | File |
|------|------|
| Add/edit AI provider (env vars, TOML config) | `ai_config.py` |
| Change resolution prompt content or output schema | `ai_prompts.py` |
| Change analysis thresholds (max files, timeouts, retries) | `constants.py` + `conf/settings.toml` |
| Change `.env` path or reload behavior | `ai_config.py` |

## Conventions

- `load_settings()` caches result in module-level `_SETTINGS` — clear it in tests via `importlib.reload()` if needed.
- `_reload_env_file()` respects existing `os.environ` — won't overwrite values set by tests or parent processes.
- Provider prefix aliases in `_ENV_PREFIX` dict: `"9router" → "NINEROUTER"` — not all providers use `provider.upper()`.
- Secrets live in `.env` (gitignored), not in `conf/settings.toml` (committed).
