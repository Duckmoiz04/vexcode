# `pipeline/` — Stage Orchestrators

**Pipeline coordinators.** Each file owns one stage of the analysis pipeline. Stages execute sequentially: scanner → enricher → resolver → reporter. Data flows as plain Python dicts/lists with no custom types between stages.

## Structure

| File | Exports | Stage | What it does |
|------|---------|-------|-------------|
| `scanner.py` | `run_scan_phase()`, `get_git_state()`, `_detect_fast_scan_files()` | 1. Scan | Git state detection → fast or full scan → Semgrep execution or mock |
| `enricher.py` | `enrich_findings()` | 2. Enrich | GitNexus AST context enrichment for each finding (symbol, callers, impact) |
| `resolver.py` | `resolve_phase()`, `_collect_source_files()`, `_compute_metrics()`, `_run_naming_audit()` | 3. Resolve | Complexity metrics + naming audit + AI resolution (3 sub-steps) |
| `reporter.py` | `assemble_report()`, `write_report()` | 4. Report | Assemble final report dict + write JSON file |

## Detail

### `scanner.py`
- `get_git_state(target_dir) → dict | None`: Runs `git rev-parse --is-inside-work-tree`, `git rev-parse HEAD`, `git status --porcelain`. Returns `{commit, is_dirty}` or `None` if not a git repo.
- `_detect_fast_scan_files(target, use_mock) → list | None`: If `--fast`, runs `git status --porcelain` → extracts changed file paths. Mock mode returns `[target/example.py]`. Returns `None` (full scan), `[]` (clean repo), or `[paths]`.
- `run_scan_phase(target, use_mock, fast) → (scan_results, target_files)`:
  - If `fast` + `target_files == []` (clean repo): returns empty findings with `scanner: "semgrep-fast"`.
  - If `fast` + `target_files == [paths]`: delegates to `run_scan(target, files=paths)`, sets scanner to `"semgrep-fast"`.
  - If not `fast`: full scan via `run_scan(target)`.
- Edge cases: non-git dir with `--fast` → falls back to full scan. `git status` failure → falls back to full scan.

### `enricher.py`
- `enrich_findings(findings, target_path, use_mock) → findings` (mutated in-place):
  1. Checks `is_gitnexus_available()` via subprocess.
  2. If GitNexus available: `get_repo_info_for_path(target_path)` maps target to a registered repo.
  3. Per finding with both `file` and `line`:
     - `get_relative_repo_path()` normalizes the file path.
     - `resolve_location_to_symbol()` runs a Cypher query to find the symbol at that location.
     - `get_symbol_context()` + `get_symbol_impact()` retrieve full context and blast radius.
     - Extracts callers from `context.incoming.*` and blast radius from `impact.byDepth.*`.
     - Sets `finding["ast_context"]` = `{symbol_id, symbol_name, kind, source_code, callers[], impact{}, blast_radius[]}`.
  4. If GitNexus unavailable + `use_mock`: falls back to `MOCK_AST_CONTEXTS[(file, line)]` — 2 entries.
- **Mutation**: the input list is modified in-place AND returned — both the original list reference and return value point to the same objects.

### `resolver.py`
- Module-level `_settings = load_settings()` — cached at import time.
- Reads config: `MAX_FILES_FOR_COMPLEXITY` (default 100), `FAST_SCAN_SLEEP_SECONDS` (default 15), `MAX_NAMING_AUDIT_CANDIDATES` (default 5).
- `_collect_source_files(target, target_files) → list`: If `target_files` provided, uses directly. Otherwise `os.walk()` collecting `.py/.js/.jsx/.ts/.tsx` files, skipping `.git/node_modules/.venv/__pycache__/dist/build/public/.gemini/.gitnexus`, capped at `MAX_FILES_FOR_COMPLEXITY`.
- `_compute_metrics(target, source_files) → {files: {rel_path: {complexity, ...}}}`: Iterates source files, calls `analyze_file_complexity()` for each.
- `_run_naming_audit(findings, target, source_files, use_mock) → (naming_findings, naming_resolutions, files_to_audit)`: Union of finding files + first 5 source files, filtered to exclude `.agents/.claude/.codex/process/.venv/node_modules/__pycache__`. Delegates to `run_naming_audit()`.
- `resolve_phase(findings, target, use_mock, target_files) → (findings, resolutions, metrics)`:
  1. Collect source files → compute complexity metrics.
  2. Run naming audit → append naming findings to findings list.
  3. If findings exist: 15s cooldown (if not mock) → `resolve_findings()` → merge naming resolutions.
- **Data mutation**: naming findings are appended to the input findings list.

### `reporter.py`
- `assemble_report(scan_results, findings, resolutions, target, metrics) → dict`:
  ```python
  {
    "scanner": scan_results["scanner"],
    "timestamp": scan_results["timestamp"],
    "target_path": scan_results["target_path"],
    "findings": findings,            # enriched + naming findings
    "ai_resolutions": resolutions,    # per-rule AI suggestions
    "git_state": get_git_state(target),  # {commit, is_dirty} or None
    "metrics": metrics                # complexity per file
  }
  ```
- `get_git_state(target)` is called again at report time (redundant with scan phase — independent call).
- `write_report(report, output_path)`: `json.dump(report, f, indent=2)`.
- No custom serialization — the output is a plain JSON dict. All values must be JSON-serializable.

## Data Flow

```
┌──────────┐     scan_results({})     ┌──────────┐     findings[] (enriched)    ┌──────────┐
│ Scanner  │ ──────────────────────►  │ Enricher │ ──────────────────────────►  │ Resolver │
│          │    target_files (list)   │          │     findings + target_files  │          │
└──────────┘                          └──────────┘                             │          │
       ▲                                                                       │          │
       │                                                                 ┌─────┤          │
       │                                            ┌──────────────────┐ │     └──────────┘
       │                                            │ core/complexity   │◄┤            │
       │                                            │ core/naming_audit │◄┤            │
       │                                            │ core/ai_resolver  │◄┤            │
       │                                            └──────────────────┘ │            │
       │                                                                  │            │
       │                                            (findings, resolutions, metrics)   │
       │                                                                                 │
       │                                                                                 ▼
       │                                                                       ┌──────────┐
       └───────────────────────────────────────────────────────────────────────┤ Reporter │
                                                                               └──────────┘
                                                                                     │
                                                                                     ▼
                                                                               JSON file
```

## Where to Look

| Task | File |
|------|------|
| Change fast scan detection logic | `scanner.py` |
| Change git state collection | `scanner.py` |
| Change enrichment flow or add new AST dimensions | `enricher.py` |
| Change complexity collection scope or limits | `resolver.py` |
| Change naming audit criteria or file filters | `resolver.py` |
| Change report structure or add fields | `reporter.py` |

## Conventions

- **`use_mock` passthrough**: each stage receives the mock flag and passes it down to downstream modules. If any stage has no work in mock mode, it returns early.
- **`resolver.py`** is the only stage with module-level `_settings` cache (`_settings = load_settings()` at import time).
- **Cross-pipe data flows** as plain dicts/lists — no custom types, no dataclasses, no type-safe wrappers.
- **Mutable findings**: `enrich_findings()` mutates findings in-place (adds `.ast_context`). `resolve_phase()` mutates the list by appending naming findings. The original list reference is preserved.
