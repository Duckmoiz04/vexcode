import os
import time
from typing import Dict, Any, List, Optional, Tuple

from engine.logger import get_logger
from engine.complexity import analyze_file_complexity
from engine.ai_resolver import resolve_findings
from engine.naming_audit import run_naming_audit
from engine.constants import load_settings

logger = get_logger(__name__)

_settings = load_settings()

MAX_FILES_FOR_COMPLEXITY = _settings.get("analysis", {}).get(
    "max_files_for_complexity", 100
)
FAST_SCAN_SLEEP_SECONDS = _settings.get("analysis", {}).get(
    "fast_scan_sleep_seconds", 15
)
MAX_NAMING_AUDIT_CANDIDATES = _settings.get("analysis", {}).get(
    "max_naming_audit_candidates", 5
)


def _collect_source_files(target: str, target_files: Optional[List[str]]) -> List[str]:
    """Collect source files for complexity analysis.

    If target_files is provided (non-empty), use those directly.
    Otherwise walk the target directory (capped at MAX_FILES_FOR_COMPLEXITY).
    """
    if target_files:
        return list(target_files)

    source_files = []
    ignored_dirs = {".git", "node_modules", ".venv", "__pycache__", "dist", "build",
                    "public", ".gemini", ".gitnexus"}
    valid_exts = {".py", ".js", ".jsx", ".ts", ".tsx"}

    for root, dirs, files in os.walk(target):
        dirs[:] = [d for d in dirs if d not in ignored_dirs]
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in valid_exts:
                full_path = os.path.join(root, file)
                source_files.append(full_path)
                if len(source_files) >= MAX_FILES_FOR_COMPLEXITY:
                    break
        if len(source_files) >= MAX_FILES_FOR_COMPLEXITY:
            break

    return source_files


def _compute_metrics(target: str, source_files: List[str]) -> Dict[str, Any]:
    """Compute complexity metrics for collected source files."""
    logger.info("Calculating file complexity metrics with Lizard...")
    metrics = {"files": {}}
    for f_path in source_files:
        rel_path = os.path.relpath(f_path, target).replace("\\", "/")
        metrics["files"][rel_path] = analyze_file_complexity(f_path)
    return metrics


def _run_naming_audit(findings: List[dict], target: str,
                      source_files: List[str], use_mock: bool) -> Tuple[List[dict], dict]:
    """Run AI naming quality audit and return (naming_findings, naming_resolutions)."""
    logger.info("Auditing code naming quality...")

    NAMING_AUDIT_SKIP_DIRS = {".agents", ".claude", ".codex", "process",
                               ".venv", "node_modules", "__pycache__"}

    def is_user_code(path: str) -> bool:
        rel = os.path.relpath(path, target)
        parts = rel.replace("\\", "/").split("/")
        return not any(p in NAMING_AUDIT_SKIP_DIRS for p in parts)

    finding_files = [os.path.join(target, f.get("file"))
                     for f in findings if f.get("file")]
    all_audit_candidates = list(set(
        finding_files + source_files[:MAX_NAMING_AUDIT_CANDIDATES]
    ))
    files_to_audit = [p for p in all_audit_candidates if is_user_code(p)]

    naming_findings, naming_resolutions = run_naming_audit(
        files_to_audit, target, use_mock=use_mock
    )
    return naming_findings, naming_resolutions, files_to_audit


def resolve_phase(findings: List[dict], target: str, use_mock: bool,
                  target_files: Optional[List[str]] = None) -> Tuple[List[dict], dict, Dict[str, Any]]:
    """Run the resolution phase: complexity metrics, naming audit, AI resolution.

    Returns (findings, resolutions, metrics).
    """
    source_files = _collect_source_files(target, target_files)
    metrics = _compute_metrics(target, source_files)

    naming_findings, naming_resolutions, files_to_audit = _run_naming_audit(
        findings, target, source_files, use_mock
    )
    findings.extend(naming_findings)

    resolutions = {}
    if findings:
        if not use_mock and files_to_audit:
            logger.info("Cooling down 15s before AI resolution to avoid rate limiting...")
            time.sleep(FAST_SCAN_SLEEP_SECONDS)
        logger.info("Resolving findings with AI...")
        resolutions = resolve_findings(
            findings, use_mock=use_mock, target_path=target
        )
        resolutions.update(naming_resolutions)
    else:
        logger.info("No findings to resolve.")

    return findings, resolutions, metrics