# `utils/` — Shared Utilities

**Lightweight helpers consumed by every other module.** No external dependencies beyond the Python standard library.

## Structure

| File | Exports | Responsibility |
|------|---------|----------------|
| `logger.py` | `get_logger(name)` | Creates/returns a `logging.Logger` with a single `StreamHandler(sys.stderr)`, simple message formatter (`%(message)s`), and `propagate=False` |

## Detailed Behavior

### `logger.py`
- `get_logger(name)`: Standard Python `logging.getLogger(name)` wrapper.
- On first call for a given `name`: creates a `logging.StreamHandler` writing to `sys.stderr`, sets formatter to `"%(message)s"` (no timestamps, no level prefixes), adds handler, disables propagation to root logger.
- On subsequent calls for the same `name`: returns cached logger (handlers check prevents duplicates).
- Used uniformly across the entire engine — every module calls `get_logger(__name__)` at module level.
- `sys.stderr` for user-facing messages (scan progress, warnings, errors) keeps `sys.stdout` clean for JSON report output.

## Where to Look

| Task | File |
|------|------|
| Change log format (add timestamps, levels) | `logger.py` |
| Change output stream (stdout vs stderr) | `logger.py` |
| Add structured logging (JSON lines) | `logger.py` |
| Silence specific module output in tests | `logger.py` (mock `get_logger` or `logging.Logger`) |

## Conventions

- **All user-facing output → stderr**: via `get_logger()`. stdout is reserved for JSON-only output (report file content).
- **Module-level instantiation**: every module calls `get_logger(__name__)` at the top — the logger is available as `logger` throughout the module.
- **No log levels**: the formatter strips level prefixes — all messages print as-is. Modules use `logger.info()` / `logger.error()` for semantic tagging only.
- **No log file rotation**: this is a CLI tool, not a long-running service. Output goes to stderr only.
