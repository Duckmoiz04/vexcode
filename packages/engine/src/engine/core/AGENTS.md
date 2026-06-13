# `core/` — Analysis Logic

**Core analysis modules.** Each file is a self-contained domain with its own external dependency and mock fallback. These modules are called by the pipeline stage coordinators (`pipeline/`) — they never call each other directly.

## Structure

| File | Key exports | External dependency | Input → Output |
|------|-------------|-------------------|----------------|
| `scanner.py` | `run_scan()` | Semgrep CLI (`semgrep`) | `(target, use_mock, files)` → `{scanner, timestamp, target_path, findings[]}` |
| `ast_graph.py` | `is_gitnexus_available()`, `get_repo_info_for_path()`, `resolve_location_to_symbol()`, `get_symbol_context()`, `get_symbol_impact()`, `parse_markdown_table()`, `get_relative_repo_path()` | GitNexus CLI (`gitnexus`) | `(repo, file, line)` → symbol dict with callers/impact/blast_radius |
| `ai_resolver.py` | `resolve_findings()`, `post_with_retry()`, `parse_api_response()`, `safe_json_parse()`, `sanitize_remediation_code()`, `decode_response_text()`, `read_surrounding_code()` | 9router API (HTTP) | `(findings[], use_mock)` → `{rule_id: {suggestion, remediation_code}}` |
| `complexity.py` | `analyze_file_complexity()`, `get_complexity_level()` | `lizard` (Python lib) | `(file_path)` → `{complexity, cognitive_complexity, loc, level, functions[]}` |
| `naming_audit.py` | `run_naming_audit()` | 9router API (HTTP) | `(files[], target, use_mock)` → `(findings[], resolutions{})` |

## Detailed Module Behavior

### `scanner.py`
- **Mock** (`use_mock=True`): Returns 2 `MOCK_FINDINGS` (dangerous-exec, hardcoded-password), optionally filtered by `files` baseline match.
- **Real**: `subprocess.run(["semgrep", "scan", "--json", "--quiet", target])` → parses JSON results → extracts `path/start.line/check_id/extra.message/extra.severity/extra.lines`. Falls back to `MOCK_FINDINGS` on any error (FileNotFoundError, JSON parse failure, non-zero exit with empty stdout).
- Edge case: when `files` param is provided (fast scan), only specific files are scanned.

### `ast_graph.py`
- **Mock** (`use_mock=True` + GitNexus unavailable): Looks up `MOCK_AST_CONTEXTS[(file, line)]` dict — 2 hardcoded entries for `(example.py, 12)` and `(db.py, 45)`.
- **Real**: Three GitNexus CLI calls per finding:
  1. `gitnexus cypher -r <repo> "MATCH (n) WHERE n.filePath..."` — locates the symbol at (file, line)
  2. `gitnexus context -r <repo> -u <uid> --content` — 360° symbol view (callers, callees, imports)
  3. `gitnexus impact -r <repo> -d upstream --depth 3 <uid>` — blast radius (upstream dependents)
- Resolver picks the most specific enclosing symbol (Function > Method > Class > others), then by smallest span.
- `get_repo_info_for_path()` parses `gitnexus list` output, matching target path against registered repo paths.
- `parse_markdown_table()` handles raw markdown table output from `gitnexus cypher` fallback.

### `complexity.py`
- Uses the `lizard` Python library (not CLI subprocess).
- Returns per-function breakdown: CCN (cyclomatic complexity number), estimated cognitive complexity (CCN − 1), NLOC (net lines of code), start/end lines.
- Complexity level: `LOW` ≤ 10, `MEDIUM` ≤ 25, `HIGH` > 25.
- Returns empty/default metrics for empty files, binary files, or missing files.

### `ai_resolver.py`
- **Mock**: Maps `rule_id` → `MOCK_AI_RESOLUTIONS` (3 entries: dangerous-exec, hardcoded-password, naming.obscure). Unknown rules get a generic suggestion.
- **Real**: Per-rule sequential API calls:
  1. Deduplicates findings by `rule_id` (max `MAX_RESOLVE_FINDINGS` = 5)
  2. For each unique rule, builds a prompt with file/line/code/surrounding code (5 lines context, marked with `>>>>`) + AST context (callers, risk, impacted count)
  3. POST to `{base_url}/chat/completions` with `SYSTEM_PROMPT_RESOLVE` + user prompt
  4. Exponential backoff: 2 retries, base 15s (15s, 30s), handles 429 Too Many Requests and Timeout
  5. Response parsing: `decode_response_text()` → `parse_api_response()` (first `{` scan) → `safe_json_parse()` (strip markdown fences) → `sanitize_remediation_code()` (strip comment-only)
  6. 8s cooldown between requests (`NAMING_AUDIT_SLEEP`)
- `read_surrounding_code()` reads `context_lines` (default 5) above and below the finding line from the actual source file.

### `naming_audit.py`
- **Mock**: Checks for `example.py` in the file list → creates 1 finding + mock resolution for `maintainability.naming.obscure`.
- **Real**: For each file (max `MAX_NAMING_AUDIT_FILES` = 3):
  1. Reads source code (truncated to `MAX_CODE_CHARS` = 3000 chars)
  2. POST to AI API with `SYSTEM_PROMPT_NAMING_AUDIT`
  3. Parses JSON array of `{line, code_text, message, suggestion, remediation_code}`
  4. Generates unique `rule_id` per issue like `maintainability.naming.obscure.{rel_path}_{idx}`
  5. 8s cooldown between files
- Names are flagged for being too generic (`x`, `a`, `temp`, `data`, `obj`, `process`) or misleading.

## Where to Look

| Task | Module |
|------|--------|
| Replace Semgrep with a different scanner | `scanner.py` |
| Change AST enrichment queries or mock data | `ast_graph.py` |
| Tweak AI resolution prompt, retry, or parsing | `ai_resolver.py` + `ai_prompts.py` |
| Change complexity thresholds or metrics | `complexity.py` |
| Change naming audit rules or prompt | `naming_audit.py` + `ai_prompts.py` |

## Conventions

- **Every module has a mock fallback** — set `use_mock=True` to skip all external calls. Every external dependency (Semgrep, GitNexus, 9router) degrades gracefully.
- **Cross-module imports**: through `engine.config.*` and `engine.utils.*` — no sibling imports between `core/` modules.
- **Old-style type hints**: `typing.Dict`, `typing.Optional`, `typing.List`, `typing.Tuple` — not `dict | None`.
- **Subprocess calls**: always use `subprocess.run()` with `capture_output=True`, `text=True`, `check=False`, `shell=(sys.platform == 'win32')`.
- **Module-level constants**: `constants.py` thresholds are imported at module level in `ai_resolver.py` — not passed as parameters.

## Anti-Patterns

- Never skip mock fallback — every external dependency path must have a working offline alternative.
- Never import sibling `core/` modules directly from each other — always go through `engine.config.*` or `engine.utils.*`.
