import json
from datetime import datetime, timezone
from typing import Dict, Any, List

from engine.logger import get_logger
from engine.pipeline.scanner import get_git_state

logger = get_logger(__name__)


def assemble_report(scan_results: Dict[str, Any], findings: List[dict],
                    resolutions: dict, target: str,
                    metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Assemble the final analysis report dict."""
    return {
        "scanner": scan_results.get("scanner", "unknown"),
        "timestamp": scan_results.get(
            "timestamp",
            datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        ),
        "target_path": scan_results.get("target_path", target),
        "findings": findings,
        "ai_resolutions": resolutions,
        "git_state": get_git_state(target),
        "metrics": metrics
    }


def write_report(report: Dict[str, Any], output_path: str) -> None:
    """Write the report dict as JSON to output_path."""
    logger.info(f"Writing report to {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)