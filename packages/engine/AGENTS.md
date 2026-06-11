# packages/engine

**Python 3.12 security analysis engine** — flat script collection, not a pip-installable package.

## Modules

| Module | Responsibility |
|--------|---------------|
| `main.py` | CLI entry point, argparse orchestrator (3-stage pipeline) |
| `scanner.py` | Semgrep subprocess wrapper; `run_scan()` with mock fallback |
| `ast_graph.py` | GitNexus CLI adapter; Cypher queries for symbol resolution, context, impact |
| `ai_resolver.py` | 9router LLM API client; builds structured prompts with AST context |
| `test_ast_graph.py` | unittest tests (10 methods, mock-isolated) |

## Pipeline

```
main.py → scanner.run_scan() → ast_graph.* enrichment → ai_resolver.resolve_findings() → JSON report
```

## How to Run

```bash
# Full pipeline
python main.py --target <dir> --output report.json

# Offline (skip Semgrep + AI API calls)
python main.py --target <dir> --mock-scan --mock-ai

# Incremental (modified files only)
python main.py --target <dir> --fast
```

## How to Test

```bash
python -m unittest test_ast_graph.py
```

## Dependencies

`requests`, `networkx`, `semgrep`, `python-dotenv` — installed via `pip install -r requirements.txt`. External CLI deps: GitNexus, Semgrep binary.

## Conventions

- **Flat layout**: no `src/`, no `__init__.py`, no `setup.py`/`pyproject.toml`
- **Subprocess calls**: always use `subprocess.run()` with `capture_output=True, text=True, check=False`
- **Windows compat**: `shell = (sys.platform == 'win32')` before every subprocess call
- **Graceful fallback**: every external dependency (Semgrep, GitNexus, 9router) has mock fallback
- **stderr for UI**: all user-facing messages → `sys.stderr`; stdout → JSON only
- **Type hints**: old-style (`typing.Dict`, `typing.Optional`, not `dict | None`)
- **No logging module**: `print(..., file=sys.stderr)` instead of `logging`
- **Env**: `.env` loaded from package dir via `python-dotenv`; keys: `9ROUTER_API_KEY`, `9ROUTER_BASE_URL`, `9ROUTER_MODEL`

## Anti-Patterns

- **Do not** add `__init__.py` or `pyproject.toml` without explicit request (maintain flat structure)
- **Never** commit `.env` with real API keys (`.env` in `.gitignore`)
- **Do not** switch to pytest without discussion (unittest is established convention)
