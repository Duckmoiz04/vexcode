# packages/engine

**Python 3.12 security analysis engine** — src-layout package installable via `pip install -e .`

## Modules

| Module | Responsibility |
|--------|---------------|
| `main.py` | Backward-compat CLI shim — delegates to `engine.__main__` |
| `src/engine/__main__.py` | CLI entry point, argparse orchestrator (3-stage pipeline) |
| `src/engine/scanner.py` | Semgrep subprocess wrapper; `run_scan()` with mock fallback |
| `src/engine/complexity.py` | Lizard-based code complexity analysis |
| `src/engine/ast_graph.py` | GitNexus CLI adapter; Cypher queries for symbol resolution, context, impact |
| `src/engine/ai_resolver.py` | 9router LLM API client; builds structured prompts with AST context |
| `src/engine/ai_config.py` | AI provider config loader (9router, OpenAI, Google, Anthropic) |
| `src/engine/logger.py` | stdout/stderr logging utilities |
| `src/engine/constants.py` | Shared constants and thresholds |
| `src/engine/naming_audit.py` | Naming convention audit utilities |
| `src/engine/ai_prompts.py` | Prompt templates for AI resolution |
| `src/engine/pipeline/` | Pipeline subpackage (scanner, enricher, resolver, reporter) |
| `tests/` | pytest test suite (8 modules, mock-isolated) |

## Pipeline

```
python -m engine → pipeline/scanner.run_scan_phase()
                  → pipeline/enricher.enrich_findings()
                  → pipeline/resolver.resolve_phase()
                  → pipeline/reporter.assemble_report() → JSON report
```

## How to Run

```bash
# Full pipeline
python main.py --target <dir> --output report.json

# Or via module:
python -m engine --target <dir> --output report.json

# Offline (skip Semgrep + AI API calls)
python main.py --target <dir> --mock-scan --mock-ai

# Incremental (modified files only)
python main.py --target <dir> --fast
```

## How to Test

```bash
pip install -e .
pytest
```

## Dependencies

`requests`, `networkx`, `semgrep`, `python-dotenv` — declared in `pyproject.toml`, installed via `pip install -e .`. External CLI deps: GitNexus, Semgrep binary.

## Conventions

- **Src layout**: `src/` package root; imports use `engine.xxx` prefix (e.g. `from engine.scanner import run_scan`)
- **Tests**: pytest with pytest-mock (`mocker` fixture); conftest.py adds `src/` to `sys.path`
- **Editable install**: `pip install -e packages/engine` registers the `engine` namespace package
- **Subprocess calls**: always use `subprocess.run()` with `capture_output=True, text=True, check=False`
- **Windows compat**: `shell = (sys.platform == 'win32')` before every subprocess call
- **Graceful fallback**: every external dependency (Semgrep, GitNexus, 9router) has mock fallback
- **stderr for UI**: all user-facing messages → `sys.stderr`; stdout → JSON only
- **Type hints**: old-style (`typing.Dict`, `typing.Optional`, not `dict | None`)
- **No logging module**: `print(..., file=sys.stderr)` instead of `logging`
- **Env**: `.env` loaded from package dir via `python-dotenv`; keys: `9ROUTER_API_KEY`, `9ROUTER_BASE_URL`, `9ROUTER_MODEL`

## Anti-Patterns

- **Never** commit `.env` with real API keys (`.env` in `.gitignore`)
- **Do not** re-introduce flat-layout patterns — all sources belong under `src/engine/`
