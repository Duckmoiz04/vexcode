import os
import sys
import json
import subprocess
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple

from engine.utils.logger import get_logger
from engine.core.scanner import run_scan

logger = get_logger(__name__)


def get_git_state(target_dir: str) -> Optional[Dict[str, Any]]:
    try:
        shell = (sys.platform == 'win32')
        res = subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            cwd=target_dir,
            capture_output=True,
            text=True,
            check=False,
            shell=shell
        )
        if res.returncode != 0 or res.stdout.strip() != "true":
            return None

        res_commit = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=target_dir,
            capture_output=True,
            text=True,
            check=False,
            shell=shell
        )
        commit_hash = res_commit.stdout.strip() if res_commit.returncode == 0 else None

        res_status = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=target_dir,
            capture_output=True,
            text=True,
            check=False,
            shell=shell
        )
        is_dirty = bool(res_status.stdout.strip()) if res_status.returncode == 0 else False

        return {
            "commit": commit_hash,
            "is_dirty": is_dirty
        }
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        return None


def _detect_fast_scan_files(target: str, use_mock: bool) -> Optional[List[str]]:
    """Detect changed files for fast/incremental scan mode.

    Returns None for full scan, [] for clean repo, or list of changed file paths.
    """
    if use_mock:
        target_files = [os.path.join(target, "example.py")]
        logger.info(f"[Mock] Fast Scan: Pretending 'example.py' is modified.")
        return target_files

    logger.info("Fast Scan requested. Detecting changed files...")
    git_state = get_git_state(target)
    if not git_state:
        logger.info("No Git repository detected. Falling back to Full Scan...")
        return None

    shell = (sys.platform == 'win32')
    res = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=target,
        capture_output=True,
        text=True,
        check=False,
        shell=shell
    )
    if res.returncode != 0:
        logger.info("Git status failed. Falling back to Full Scan...")
        return None

    changed_files = []
    for line in res.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(None, 1)
        if len(parts) > 1:
            rel_file = parts[1].strip('"').strip()
            # Handle renamed files: "old_name -> new_name"
            if ' -> ' in rel_file:
                rel_file = rel_file.split(' -> ')[-1].strip('"').strip()
            abs_file = os.path.abspath(os.path.join(target, rel_file))
            if os.path.isfile(abs_file):
                changed_files.append(abs_file)

    if not changed_files:
        logger.info("No changes detected in Git repository. Codebase is clean.")
        return []

    logger.info(f"Detected {len(changed_files)} changed file(s) in Git.")
    return changed_files


def run_scan_phase(target: str, use_mock: bool, fast: bool) -> Tuple[Dict[str, Any], Optional[List[str]]]:
    """Run the scanning phase: detect fast-scan files, execute Opengrep scan.

    Returns (scan_results, target_files).
    target_files is None for full scan, [] for clean fast repo, or list of paths.
    """
    target_files = None
    if fast:
        target_files = _detect_fast_scan_files(target, use_mock)

    if target_files == []:
        scan_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        scan_results = {
            "scanner": "opengrep-fast",
            "timestamp": scan_time,
            "target_path": target,
            "findings": []
        }
    else:
        scan_results = run_scan(target, use_mock=use_mock, files=target_files)
        if target_files is not None:
            scan_results["scanner"] = "opengrep-fast"

    return scan_results, target_files


def get_previous_report_path(target: str, reports_base_dir: Optional[str] = None) -> Optional[str]:
    """Find the most recent report for the given target directory.
    
    Looks in ~/.vexcode/reports/<project_name>/ for the latest report.
    Returns the path to the previous report, or None if not found.
    """
    import glob
    
    if reports_base_dir is None:
        reports_base_dir = os.path.join(os.path.expanduser("~"), ".vexcode", "reports")
    
    # Derive project name from target (same logic as CLI's getProjectName)
    project_name = os.path.basename(os.path.normpath(target))
    project_name = ''.join(c if c.isalnum() or c in '-_' else '_' for c in project_name)
    
    project_dir = os.path.join(reports_base_dir, project_name)
    if not os.path.isdir(project_dir):
        return None
    
    # Find all report JSON files, sorted by modification time (newest first)
    pattern = os.path.join(project_dir, "report_*.json")
    reports = glob.glob(pattern)
    if not reports:
        return None
    
    # Sort by modification time, newest first
    reports.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    
    # Return the newest report (this will be the "previous" report before we write the new one)
    return reports[0] if reports else None


def classify_findings_against_previous(
    current_findings: List[dict],
    previous_report_path: Optional[str]
) -> List[dict]:
    """Classify each finding as new/persisting/resolved/regressed.
    
    Compares current scan findings with the previous report (if exists).
    Adds `scan_status` field to each finding:
    - "new": not in previous report
    - "persisting": in both reports
    - "resolved": was in previous, not in current (added as virtual finding)
    - "regressed": was marked applied in previous, reappeared in current
    
    Returns a list containing:
    - All current findings (with scan_status added)
    - Virtual "resolved" findings for previous findings that are no longer present
    """
    from engine.config.iso25010_taxonomy import compute_finding_id
    
    # If no previous report, all current findings are "new"
    if not previous_report_path or not os.path.exists(previous_report_path):
        for finding in current_findings:
            finding["scan_status"] = "new"
        return current_findings
    
    # Load previous report
    try:
        with open(previous_report_path, "r", encoding="utf-8") as f:
            previous_report = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(f"Failed to load previous report: {e}")
        for finding in current_findings:
            finding["scan_status"] = "new"
        return current_findings
    
    previous_findings = previous_report.get("findings", [])
    if not previous_findings:
        # Empty previous report, all current findings are "new"
        for finding in current_findings:
            finding["scan_status"] = "new"
        return current_findings
    
    # Build lookup of previous findings by ID
    previous_by_id: Dict[str, dict] = {}
    for pf in previous_findings:
        # Use existing ID if present, otherwise compute it
        fid = pf.get("id")
        if not fid:
            fid = compute_finding_id(
                pf.get("file", ""),
                pf.get("line", 0),
                pf.get("rule_id", "")
            )
        previous_by_id[fid] = pf
    
    # Build set of current finding IDs
    current_ids = set()
    for finding in current_findings:
        fid = finding.get("id")
        if not fid:
            fid = compute_finding_id(
                finding.get("file", ""),
                finding.get("line", 0),
                finding.get("rule_id", "")
            )
            finding["id"] = fid
        current_ids.add(fid)
        
        # Classify current finding
        if fid not in previous_by_id:
            finding["scan_status"] = "new"
        else:
            prev = previous_by_id[fid]
            # Check if previous finding was marked as applied
            prev_status = prev.get("status", "")
            prev_applied = prev.get("_applied", False)
            if prev_status == "applied" or prev_applied:
                finding["scan_status"] = "regressed"
            else:
                finding["scan_status"] = "persisting"
    
    # Add virtual "resolved" findings for previous findings not in current
    result = list(current_findings)
    for fid, prev_finding in previous_by_id.items():
        if fid not in current_ids:
            # Skip if previous finding was already resolved or marked as false positive
            prev_status = prev_finding.get("status", "")
            if prev_status in ("false_positive", "ignored"):
                continue
            
            # Create a virtual resolved finding
            resolved_finding = {
                **prev_finding,
                "scan_status": "resolved",
            }
            result.append(resolved_finding)
    
    logger.info(
        f"Cross-scan classification: "
        f"{sum(1 for f in result if f.get('scan_status') == 'new')} new, "
        f"{sum(1 for f in result if f.get('scan_status') == 'persisting')} persisting, "
        f"{sum(1 for f in result if f.get('scan_status') == 'resolved')} resolved, "
        f"{sum(1 for f in result if f.get('scan_status') == 'regressed')} regressed"
    )
    
    return result