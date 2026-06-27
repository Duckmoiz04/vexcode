import json
import sys
import subprocess
from typing import Dict, Any, List, Optional

from engine.utils.logger import get_logger
from engine.pipeline.scanner import get_git_state
from engine.config.iso25010_taxonomy import compute_finding_id

logger = get_logger(__name__)


def run_gitleaks_scan(target: str, use_mock: bool = False) -> List[Dict[str, Any]]:
    """Run Gitleaks secret scan on target directory.

    Returns a list of findings in VexCode internal format.
    Returns empty list if Gitleaks is not installed or not a git repo.
    """
    if use_mock:
        return [
            {
                "rule_id": "gitleaks/mock-secret",
                "message": "[Mock] Hardcoded credential detected",
                "severity": "error",
                "file": "example.py",
                "line": 10,
                "category": "security",
                "scanner": "gitleaks",
                "cwe_id": "CWE-798",
                "owasp_id": "OWASP-A07",
            }
        ]

    # Check if git repo
    git_state = get_git_state(target)
    if not git_state:
        logger.info("Gitleaks: Not a git repository, skipping secret scan.")
        return []

    # Check if gitleaks is installed
    shell = (sys.platform == 'win32')
    try:
        subprocess.run(
            ["gitleaks", "version"],
            capture_output=True, text=True, check=False,
            shell=shell,
        )
    except FileNotFoundError:
        logger.warning(
            "Gitleaks not found. Install with: "
            "brew install gitleaks / scoop install gitleaks / choco install gitleaks"
        )
        return []

    # Run gitleaks detect — scan files in working tree (not git history)
    try:
        from engine.config.constants import load_settings
        _s = load_settings()
        timeout = _s.get("gitleaks", {}).get("timeout_seconds", 120)
    except Exception:
        timeout = 120

    result = subprocess.run(
        ["gitleaks", "detect", "--source", target,
         "--report-format", "json", "--no-git",
         "--exit-code", "0"],
        cwd=target, capture_output=True, text=True, check=False,
        shell=shell, timeout=timeout,
    )

    findings: List[Dict[str, Any]] = []
    raw_output = result.stdout.strip()
    if raw_output:
        try:
            raw = json.loads(raw_output)
            items = raw if isinstance(raw, list) else raw.get("Findings", [])
            for item in items:
                finding_file = item.get("File", "")
                finding_rule = f"gitleaks/{item.get('RuleID', 'unknown')}"
                finding_line = item.get("StartLine", 0)
                code_text = item.get("Match", "")

                finding = {
                    "rule_id": finding_rule,
                    "message": f"Secret detected: {item.get('Description', 'potential secret')}",
                    "severity": "error",
                    "file": finding_file,
                    "line": finding_line,
                    "code_text": code_text,
                    "category": "security",
                    "scanner": "gitleaks",
                    "cwe_id": "CWE-798",
                    "owasp_id": "OWASP-A07",
                    "id": compute_finding_id(
                        finding_file, finding_line, finding_rule,
                        content_hint=code_text,
                    ),
                }
                findings.append(finding)
        except json.JSONDecodeError:
            logger.warning("Failed to parse Gitleaks output as JSON")

    logger.info(f"Gitleaks found {len(findings)} secret(s)")
    return findings
