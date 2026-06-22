import json
import os
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from engine.utils.logger import get_logger

logger = get_logger(__name__)


def assemble_report(scan_results: Dict[str, Any], findings: List[dict],
                    resolutions: dict, target: str,
                    metrics: Dict[str, Any],
                    git_state: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Assemble the final analysis report in VexCode internal format.

    VexCode format (web's internal data model):
        {
            "scanner": str,
            "timestamp": str,
            "target_path": str,
            "findings": [...],
            "ai_resolutions": {rule_id: {suggestion, remediation_code}},
            "git_state": {commit, is_dirty},
            "metrics": {files: {...}},
        }
    """
    timestamp = scan_results.get("timestamp") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    return {
        "scanner": scan_results.get("scanner", "unknown"),
        "timestamp": timestamp,
        "target_path": scan_results.get("target_path") or target,
        "findings": findings,
        "ai_resolutions": resolutions,
        "git_state": git_state if git_state is not None else {"commit": "", "is_dirty": False},
        "metrics": metrics or {"files": {}},
    }


def write_report(report: Dict[str, Any], output_path: str) -> None:
    """Write the report dict as JSON to output_path.

    Uses atomic write (temp file + os.replace) so a crash mid-write
    never leaves a corrupted/truncated report on disk.
    """
    import tempfile

    logger.info(f"Writing report to {output_path}...")
    output_dir = os.path.dirname(output_path) or "."
    os.makedirs(output_dir, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=output_dir, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, output_path)
    except BaseException:
        # Clean up temp file on failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def export_markdown(report: Dict[str, Any], output_path: str) -> None:
    """Write a human-readable Markdown report from VexCode report data.

    Sections:
    - Scan info (timestamp, target, scanner)
    - Summary (total findings per severity, per category)
    - Quality ratings (A-E per ISO dimension if computed)
    - Finding details per file (file, line, severity, message, category, status)
    - AI resolutions (if any)
    - Threshold results (if evaluated)
    """
    lines: List[str] = []
    # Header
    lines.append("# VexCode Scan Report")
    lines.append("")
    lines.append(f"- **Target**: `{report.get('target_path', 'N/A')}`")
    lines.append(f"- **Scanner**: {report.get('scanner', 'N/A')}")
    lines.append(f"- **Timestamp**: {report.get('timestamp', 'N/A')}")
    git_state = report.get("git_state", {})
    if git_state and git_state.get("commit"):
        lines.append(f"- **Commit**: `{git_state['commit'][:8]}`")
        lines.append(f"- **Dirty**: {'Yes' if git_state.get('is_dirty') else 'No'}")
    lines.append("")

    findings = report.get("findings", [])
    # Summary
    lines.append("## Summary")
    lines.append("")
    lines.append(f"**Total findings**: {len(findings)}")
    lines.append("")

    # Per severity
    severity_counts: Dict[str, int] = {}
    category_counts: Dict[str, int] = {}
    for f in findings:
        sev = f.get("severity", "unknown")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
        cat = f.get("category", "unknown")
        category_counts[cat] = category_counts.get(cat, 0) + 1

    lines.append("### By Severity")
    lines.append("")
    for sev in ["error", "warning", "info"]:
        if sev in severity_counts:
            lines.append(f"- **{sev}**: {severity_counts[sev]}")
    lines.append("")

    lines.append("### By Category")
    lines.append("")
    for cat in sorted(category_counts.keys()):
        lines.append(f"- **{cat}**: {category_counts[cat]}")
    lines.append("")

    # Ratings
    metrics = report.get("metrics", {})
    ratings = metrics.get("ratings", {})
    if ratings:
        lines.append("### Quality Ratings (A-E)")
        lines.append("")
        for dim, rating in ratings.items():
            lines.append(f"- **{dim}**: {rating}")
        lines.append("")

    # Threshold results
    thresholds = report.get("thresholds", {})
    if thresholds:
        passed = thresholds.get("passed", True)
        status_icon = "✓ PASSED" if passed else "✗ FAILED"
        lines.append(f"### Quality Gate: {status_icon}")
        lines.append("")
        violations = thresholds.get("violations", [])
        if violations:
            for v in violations:
                lines.append(f"- ❌ {v.get('message', '')}")
            lines.append("")

    # Finding details grouped by file
    lines.append("## Finding Details")
    lines.append("")
    by_file: Dict[str, List[dict]] = {}
    for f in findings:
        file_key = f.get("file", "unknown")
        by_file.setdefault(file_key, []).append(f)

    for file_path, file_findings in sorted(by_file.items()):
        lines.append(f"### {file_path}")
        lines.append("")
        lines.append("| Line | Severity | Rule | Message | Category | Status |")
        lines.append("|------|----------|------|---------|----------|--------|")
        for f in file_findings:
            lines.append(
                f"| {f.get('line', '')} "
                f"| {f.get('severity', '')} "
                f"| `{f.get('rule_id', '')}` "
                f"| {f.get('message', '')[:80]} "
                f"| {f.get('category', '')} "
                f"| {f.get('status', 'open')} |"
            )
        lines.append("")

    # AI resolutions
    ai_res = report.get("ai_resolutions", {})
    if ai_res:
        lines.append("## AI Resolutions")
        lines.append("")
        for rule_id, res in ai_res.items():
            suggestion = res.get("suggestion", "") if isinstance(res, dict) else str(res)
            lines.append(f"- **{rule_id}**: {suggestion[:120]}")
        lines.append("")

    content = "\n".join(lines)
    output_dir = os.path.dirname(output_path) or "."
    os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info(f"Markdown report written to {output_path}")
