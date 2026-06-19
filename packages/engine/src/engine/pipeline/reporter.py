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
