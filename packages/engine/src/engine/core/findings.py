"""Shared finding enrichment utilities — language detection, severity normalization, ID generation.

This module consolidates finding-enrichment logic that was previously private
to ``scanner.py`` so that ALL scanners (OpenGrep, Gitleaks, OSV, complexity,
naming audit, …) can produce consistently enriched findings.

Every function is public and tested.  The ``enrich_finding()`` function is the
primary entry point — call it once per finding after all fields are populated.
"""

from __future__ import annotations

import os
from typing import Dict, Any, Optional

from engine.config.iso25010_taxonomy import classify_finding, compute_finding_id

# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

LANGUAGE_BY_EXT: Dict[str, str] = {
    ".py":   "python",
    ".pyx":  "python",
    ".js":   "javascript",
    ".jsx":  "javascript",
    ".mjs":  "javascript",
    ".cjs":  "javascript",
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".go":   "go",
    ".rs":   "rust",
    ".java": "java",
    ".kt":   "kotlin",
    ".rb":   "ruby",
    ".php":  "php",
    ".cs":   "csharp",
    ".cpp":  "cpp",
    ".cc":   "cpp",
    ".cxx":  "cpp",
    ".c":    "c",
    ".h":    "c",
    ".hpp":  "cpp",
    ".swift": "swift",
    ".scala": "scala",
    ".sh":   "shell",
    ".bash": "shell",
    ".html": "html",
    ".htm":  "html",
    ".css":  "css",
    ".scss": "css",
    ".sql":  "sql",
    ".yaml": "yaml",
    ".yml":  "yaml",
    ".json": "json",
    ".md":   "markdown",
}


def detect_language(file_path: Optional[str]) -> Optional[str]:
    """Return a language label for *file_path* based on extension, or None."""
    if not file_path:
        return None
    _, ext = os.path.splitext(file_path)
    return LANGUAGE_BY_EXT.get(ext.lower())


# ---------------------------------------------------------------------------
# Severity normalisation
# ---------------------------------------------------------------------------

def normalize_severity(raw: str) -> str:
    """Normalize severity to lowercase VexCode convention.

    Semgrep uses: INFO, WARNING, ERROR (uppercase).
    VexCode uses: info, warning, error (lowercase).
    Unknown values fall back to ``"warning"``.
    """
    raw = (raw or "").strip().lower()
    if raw in ("error", "warning", "info"):
        return raw
    return "warning"


# ---------------------------------------------------------------------------
# Safe integer conversion
# ---------------------------------------------------------------------------

def safe_int(value: Any, default: int = 0) -> int:
    """Convert *value* to int, returning *default* if conversion fails."""
    try:
        return int(value) if value is not None else default
    except (ValueError, TypeError):
        return default


# ---------------------------------------------------------------------------
# Main enrichment entry-point
# ---------------------------------------------------------------------------

def enrich_finding(finding: Dict[str, Any]) -> Dict[str, Any]:
    """Add stable id, category, language, and normalized severity to a finding.

    Mutates and returns the finding dict.  Idempotent — safe to re-run.

    Category resolution (via ``classify_finding()``):
    1. ``iso_25010`` field (direct override — used by complexity findings)
    2. ``category`` field → ``SEMGREP_TO_ISO25010`` lookup
    3. ``None`` (uncategorized — displayed as "Other" in dashboard)
    """
    # Stable id — prefer fingerprint, fallback to hash-based id
    if "id" not in finding:
        fp = finding.get("fingerprint")
        if fp:
            finding["id"] = fp
        else:
            finding["id"] = compute_finding_id(
                str(finding.get("file") or ""),
                safe_int(finding.get("line")),
                str(finding.get("rule_id") or ""),
            )

    finding["category"] = classify_finding(finding)

    # Language (from file extension)
    if "language" not in finding:
        finding["language"] = detect_language(finding.get("file"))

    # Normalize severity to lowercase
    if "severity" in finding:
        finding["severity"] = normalize_severity(finding["severity"])

    return finding
