# Python Core Analysis Engine — `src/engine/`

**Package root.** CLI entry point that orchestrates the 4-stage pipeline: Scan → Enrich → Resolve → Report. Two entry paths exist: full pipeline (`--target`) and re-resolve only (`--re-resolve`).

## Structure

```
src/engine/
├── __main__.py      # CLI argparser + pipeline orchestrator
├── core/            # Analysis logic (Semgrep, GitNexus, AI, complexity, naming)
├── config/          # AI provider config, prompt templates, settings thresholds
├── utils/           # Shared utilities (stderr logger)
└── pipeline/        # Stage coordinators (scanner → enricher → resolver → reporter)
```

## Execution Flow

```
__main__.main()
│
├── [--re-resolve] ──► core/ai_resolver.resolve_findings()
│                       └── Load existing report → re-run AI → write back
│
└── [default pipeline]
     │
     ├── 1. SCAN ──► pipeline/scanner.run_scan_phase()
     │                ├── --fast → _detect_fast_scan_files() → `git status --porcelain`
     │                └── core/scanner.run_scan() → semgrep scan --json (or mock)
     │
     ├── 2. ENRICH ──► pipeline/enricher.enrich_findings()
     │                  └── core/ast_graph.* → gitnexus cypher/context/impact (or mock)
     │
     ├── 3. RESOLVE ──► pipeline/resolver.resolve_phase()
     │                   ├── core/complexity.analyze_file_complexity() → Lizard
     │                   ├── core/naming_audit.run_naming_audit() → AI naming review
     │                   └── core/ai_resolver.resolve_findings() → 9router LLM
     │
     └── 4. REPORT ──► pipeline/reporter.assemble_report() + write_report()
                        └── JSON dict → file
```

## Data Flow (Stage by Stage)

| Stage | Receives | Produces | Side effects |
|-------|----------|----------|-------------|
| Scan | `target, use_mock, fast` | `{scanner, timestamp, target_path, findings}` | `target_files` list |
| Enrich | `findings[], target, use_mock` | Same `findings[]` with `.ast_context` added | None |
| Resolve | `findings[], target, use_mock, target_files` | `(findings[], resolutions{}, metrics{})` | naming findings appended to findings |
| Report | `scan_results, findings, resolutions, target, metrics` | JSON file on disk | `git_state` added to report |

## Where to Look

| Task | Path |
|------|------|
| CLI flags / pipeline wiring | `__main__.py` |
| Add a new pipeline stage | `pipeline/*.py` + wire in `__main__.py` |
| Replace scan backend (Semgrep → other) | `core/scanner.py` |
| Change AI provider config | `config/ai_config.py` |
| Change analysis thresholds | `config/constants.py` + `conf/settings.toml` |
| Change resolution prompt | `config/ai_prompts.py` |
| Add a new enrichment dimension | `pipeline/enricher.py` + `core/` module |

## Conventions

- **Src-layout**: all imports use `engine.xxx.yyy` prefix (e.g. `from engine.core.scanner import run_scan`)
- **Lazy imports** in `__main__.py` — pipeline modules loaded only on the scan path, never on `--re-resolve`
- **Graceful degradation chain**: Semgrep missing → mock scan. GitNexus missing → skip enrichment. AI unconfigured → mock resolutions.
- **Subprocess pattern**: always `subprocess.run(capture_output=True, text=True, check=False, shell=(sys.platform == 'win32'))`
- **All user output → stderr**: via `utils/logger.get_logger()`; stdout reserved for JSON-only report output
- **Old-style type hints**: `typing.Dict`, `typing.Optional`, `typing.List` — not `dict | None`
- **No custom types**: all cross-module data flows as plain `dict`/`list` — no dataclasses, no Pydantic
- **Feature flags**: `--mock-scan` skips Semgrep subprocess, `--mock-ai` skips all AI API calls, `--fast` scans only git-changed files, `--re-resolve` skips the entire pipeline
