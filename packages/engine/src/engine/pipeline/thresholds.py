"""Threshold evaluation engine for quality gates.

Evaluates scan findings and metrics against configurable thresholds.
Produces PASS/FAIL with violations list.

Threshold config (TOML):
    [thresholds]
    max_critical = 0           # Max critical-severity findings
    max_high = 10              # Max high-severity findings
    max_total = 100            # Max total findings
    max_files_with_errors = 20 # Max files containing errors
    min_rating = "C"           # Minimum acceptable A-E rating
"""

import os
from typing import Any, Dict, List, Optional, Tuple

from engine.utils.logger import get_logger

logger = get_logger(__name__)

# Default quality gate values (used when no config file is specified)
THRESHOLD_DEFAULTS: Dict[str, Any] = {
    "max_critical": 0,
    "max_high": 10,
    "max_total": 100,
    "max_files_with_errors": 20,
    "min_rating": "C",
}


def load_thresholds(config_path: Optional[str] = None) -> Dict[str, Any]:
    """Load thresholds from TOML config file.

    Falls back to defaults if no config provided or file not found.
    """
    if not config_path or not os.path.exists(config_path):
        return dict(THRESHOLD_DEFAULTS)

    try:
        import tomllib
        with open(config_path, "rb") as f:
            config = tomllib.load(f)
        thresholds_section = config.get("thresholds", {})
        merged = dict(THRESHOLD_DEFAULTS)
        merged.update({k: v for k, v in thresholds_section.items() if v is not None})
        logger.info(f"Thresholds loaded from {config_path}")
        return merged
    except Exception as e:
        logger.warning(f"Failed to load thresholds from {config_path}: {e}")
        return dict(THRESHOLD_DEFAULTS)


def evaluate_thresholds(
    findings: List[Dict[str, Any]],
    metrics: Dict[str, Any],
    thresholds: Dict[str, Any],
) -> Tuple[bool, List[Dict[str, Any]]]:
    """Evaluate findings and metrics against configured thresholds.

    Returns (passed: bool, violations: list).
    Each violation: {
        "threshold": "max_critical",
        "actual": 3,
        "limit": 0,
        "message": "Exceeded max critical findings: 3 > 0"
    }
    """
    violations: List[Dict[str, Any]] = []

    # Count by severity
    severity_counts: Dict[str, int] = {}
    for f in findings:
        sev = f.get("severity", "unknown").lower()
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    total = len(findings)

    # Check max_critical (error + critical severities)
    max_critical = thresholds.get("max_critical", 0)
    crit_count = severity_counts.get("critical", 0) + severity_counts.get("error", 0)
    if crit_count > max_critical:
        violations.append({
            "threshold": "max_critical",
            "actual": crit_count,
            "limit": max_critical,
            "message": f"Exceeded max critical findings: {crit_count} > {max_critical}",
        })

    # Check max_high (warning + high severities)
    max_high = thresholds.get("max_high", 10)
    high_count = severity_counts.get("high", 0) + severity_counts.get("warning", 0)
    if high_count > max_high:
        violations.append({
            "threshold": "max_high",
            "actual": high_count,
            "limit": max_high,
            "message": f"Exceeded max high-severity findings: {high_count} > {max_high}",
        })

    # Check max_total
    max_total = thresholds.get("max_total", 100)
    if total > max_total:
        violations.append({
            "threshold": "max_total",
            "actual": total,
            "limit": max_total,
            "message": f"Exceeded max total findings: {total} > {max_total}",
        })

    # Check max_files_with_errors
    max_files = thresholds.get("max_files_with_errors", 20)
    files_with_errors = len(set(
        f.get("file", "") for f in findings
        if f.get("severity") in ("error", "critical")
    ))
    if files_with_errors > max_files:
        violations.append({
            "threshold": "max_files_with_errors",
            "actual": files_with_errors,
            "limit": max_files,
            "message": f"Exceeded max files with errors: {files_with_errors} > {max_files}",
        })

    # Check min_rating (A-E) — if metrics have ratings
    ratings = metrics.get("ratings", {})
    if ratings and "min_rating" in thresholds:
        min_rating = thresholds["min_rating"]
        rating_order = {"A": 5, "B": 4, "C": 3, "D": 2, "E": 1}
        min_score = rating_order.get(min_rating, 3)
        for dim, rating in ratings.items():
            actual_score = rating_order.get(rating, 0)
            if actual_score < min_score:
                violations.append({
                    "threshold": "min_rating",
                    "actual": rating,
                    "limit": min_rating,
                    "message": f"Rating {dim}={rating} below minimum {min_rating}",
                })

    passed = len(violations) == 0
    return passed, violations
