"""Centralized logging configuration for the engine package."""

import json
import logging
import sys
from typing import Optional


def get_logger(name: str) -> logging.Logger:
    """Get a configured logger that outputs to stderr with simple message format.

    Args:
        name: Logger name (typically __name__ of the calling module)

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
        logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# Structured progress protocol
# ---------------------------------------------------------------------------
# The engine emits JSON progress lines to stdout. The CLI bridge detects
# lines starting with "{" and parses them as structured progress events.
#
# Phase order (each maps to 1/8th of total progress):
#   1. scan           — Semgrep / Opengrep static analysis
#   2. enrich         — GitNexus AST context enrichment
#   3. complexity     — Lizard cyclomatic complexity metrics
#   4. dedup          — Cross-scan deduplication
#   5. classify       — Cross-scan classification (new/persisting/resolved/regressed)
#   6. naming_audit   — AI naming quality audit
#   7. ai_resolve     — AI remediation suggestion generation
#   8. report         — JSON + SARIF report assembly & write
# ---------------------------------------------------------------------------

PROGRESS_PHASES: list[str] = [
    "scan",
    "enrich",
    "complexity",
    "dedup",
    "classify",
    "naming_audit",
    "ai_resolve",
    "report",
]


def emit_progress(
    phase: str,
    message: str,
    current: int = 1,
    total: int = 1,
    *,
    phase_order: Optional[list[str]] = None,
) -> None:
    """Emit a structured progress line as JSON on stdout.

    The CLI bridge detects lines starting with ``{`` and parses them as
    structured progress events, which the frontend uses to render a real
    progress bar instead of guessing phases from raw log text.

    Args:
        phase: One of PROGRESS_PHASES (e.g. ``"scan"``, ``"ai_resolve"``).
        message: Human-readable status message.
        current: Current step within this phase (1-based).
        total: Total steps for this phase.
        phase_order: Override the global phase list (for re-resolve which only
                     has ``ai_resolve`` + ``report``).
    """
    phases = phase_order if phase_order is not None else PROGRESS_PHASES
    total_phases = len(phases)

    try:
        phase_index = phases.index(phase)
    except ValueError:
        phase_index = 0

    phase_weight = 1.0 / total_phases
    completed_fraction = phase_index / total_phases
    phase_fraction = (current / total) * phase_weight if total > 0 else 0.0
    percentage = round(min(100.0, (completed_fraction + phase_fraction) * 100), 1)

    progress = {
        "type": "progress",
        "phase": phase,
        "message": message,
        "current": current,
        "total": total,
        "percentage": percentage,
    }
    print(json.dumps(progress), flush=True)