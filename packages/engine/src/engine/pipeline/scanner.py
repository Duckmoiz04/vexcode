import os
import sys
import subprocess
from datetime import datetime, timezone
from pathlib import Path
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
