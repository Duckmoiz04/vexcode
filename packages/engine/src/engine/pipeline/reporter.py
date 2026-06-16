import json
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
    """Write the report dict as JSON to output_path."""
    logger.info(f"Writing report to {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
