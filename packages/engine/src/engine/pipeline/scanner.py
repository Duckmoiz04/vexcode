import os
import re
import sys
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

import requests

from engine.utils.logger import get_logger
from engine.core.scanner import (
    run_scan,
    _extract_cwe_id,
    _extract_owasp_id,
    _normalize_severity,
    EXCLUDE_DIRS,
)

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
                finding = {
                    "rule_id": f"gitleaks/{item.get('RuleID', 'unknown')}",
                    "message": f"Secret detected: {item.get('Description', 'potential secret')}",
                    "severity": "error",
                    "file": item.get("File", ""),
                    "line": item.get("StartLine", 0),
                    "category": "security",
                    "scanner": "gitleaks",
                    "cwe_id": "CWE-798",
                    "owasp_id": "OWASP-A07",
                }
                findings.append(finding)
        except json.JSONDecodeError:
            logger.warning("Failed to parse Gitleaks output as JSON")

    logger.info(f"Gitleaks found {len(findings)} secret(s)")
    return findings


def run_ruff_scan(target: str, use_mock: bool = False) -> List[Dict[str, Any]]:
    """Run Ruff lint scan on target directory.

    Ruff provides 800+ rules covering security (S), bug (B), naming (N),
    complexity (C90), style (E/W), and more.

    Returns a list of findings in VexCode internal format.
    Returns empty list if Ruff is not installed.
    """
    if use_mock:
        return [
            {
                "rule_id": "ruff/mock-finding",
                "message": "[Mock] Ruff lint finding (replace me with mock output)",
                "severity": "info",
                "file": "example.py",
                "line": 1,
                "category": "maintainability",
                "scanner": "ruff",
                "cwe_id": "",
            }
        ]

    shell = (sys.platform == 'win32')
    try:
        subprocess.run(
            ["ruff", "--version"],
            capture_output=True, text=True, check=False,
            shell=shell,
        )
    except FileNotFoundError:
        logger.warning(
            "Ruff not found. Install with: "
            "pip install ruff"
        )
        return []

    try:
        from engine.config.constants import load_settings
        _s = load_settings()
        select = _s.get("ruff", {}).get("select", [])
        ignore = _s.get("ruff", {}).get("ignore", [])
        timeout = _s.get("ruff", {}).get("timeout_seconds", 60)
    except Exception:
        select = []
        ignore = []
        timeout = 60

    cmd = ["ruff", "check", "--output-format", "json", target, "--no-cache"]
    for rule in select:
        cmd.extend(["--select", rule])
    for rule in ignore:
        cmd.extend(["--ignore", rule])

    result = subprocess.run(
        cmd, capture_output=True, text=True, check=False,
        shell=shell, timeout=timeout,
    )

    findings: List[Dict[str, Any]] = []
    raw_output = result.stdout.strip()
    if not raw_output:
        logger.info("Ruff found no issues.")
        return []

    try:
        items = json.loads(raw_output)
    except json.JSONDecodeError:
        logger.warning("Failed to parse Ruff output as JSON")
        return []

    for item in items:
        rule_id = item.get("code", "ruff/unknown")
        # Ruff rule format: "S101" or "PLR0913" — prefix with "ruff/"
        prefixed = f"ruff/{rule_id}"

        # Map severity: ruff uses "error", "warning", "info" (same as ours)
        severity = item.get("level", "info")
        if severity not in ("error", "warning", "info"):
            severity = "info"

        # Map category: security rules (S series) → security, everything else → maintainability
        cat = "security" if rule_id.startswith("S") else "maintainability"

        # Map CWE for known security rules (approximate)
        cwe_map = {
            "S101": "CWE-228",    # assert → improper input handling
            "S102": "CWE-78",     # exec used → OS command injection
            "S103": "CWE-94",     # file upload → code injection
            "S104": "CWE-22",     # path traversal
            "S105": "CWE-89",     # SQL injection
            "S106": "CWE-79",     # XSS
            "S107": "CWE-706",    # dangerous function
            "S108": "CWE-326",    # weak cryptography
            "S202": "CWE-200",    # information exposure
            "S301": "CWE-134",    # format string
            "S302": "CWE-326",    # weak cryptography (salsa20)
            "S303": "CWE-326",    # weak cryptography (des)
            "S304": "CWE-326",    # weak cryptography (md5)
            "S305": "CWE-326",    # weak cryptography (cipher)
            "S306": "CWE-326",    # weak cryptography (mozilla)
            "S307": "CWE-326",    # weak cryptography (blowfish)
            "S308": "CWE-326",    # weak cryptography (mark safe)
            "S309": "CWE-326",    # weak cryptography (null cipher)
            "S310": "CWE-326",    # weak cryptography (pycrypto)
            "S311": "CWE-327",    # weak cryptography (satin)
            "S312": "CWE-327",    # weak cryptography (pgp)
            "S313": "CWE-327",    # weak cryptography (cryptography)
            "S314": "CWE-327",    # weak cryptography (xmss)
            "S315": "CWE-327",    # weak cryptography (snow)
            "S316": "CWE-327",    # weak cryptography (mceliece)
            "S317": "CWE-327",    # weak cryptography (safeprime)
            "S318": "CWE-327",    # weak cryptography (kyber)
            "S319": "CWE-327",    # weak cryptography (dilithium)
            "S320": "CWE-327",    # weak cryptography (falcon)
            "S321": "CWE-327",    # weak cryptography (sphincs)
            "S322": "CWE-327",    # weak cryptography (picnic)
            "S323": "CWE-327",    # weak cryptography (rainbow)
            "S324": "CWE-327",    # weak cryptography (classic mceliece)
            "S325": "CWE-327",    # weak cryptography (bike)
            "S326": "CWE-327",    # weak cryptography (hqc)
        }
        cwe = cwe_map.get(rule_id, "")

        # Map OWASP for security rules
        owasp_map = {
            "S101": "OWASP-A03",   # injection-related (assert bypass)
            "S102": "OWASP-A03",   # injection (exec)
            "S103": "OWASP-A03",   # injection (file upload RCE)
            "S104": "OWASP-A01",   # broken access control (path traversal)
            "S105": "OWASP-A03",   # injection (SQL)
            "S106": "OWASP-A03",   # injection (XSS)
            "S107": "OWASP-A03",   # injection (dangerous function)
            "S108": "OWASP-A02",   # cryptographic failures
            "S202": "OWASP-A05",   # security misconfiguration (info exposure)
            "S301": "OWASP-A03",   # injection (format string)
        }
        for code, owasp in owasp_map.items():
            if rule_id.startswith(code):
                owasp_id = owasp
                break
        else:
            owasp_id = ""

        # ruff error level → our severity mapping
        if item.get("level") == "error":
            sev = "error"
        elif item.get("level") == "warning":
            sev = "warning"
        else:
            sev = "info"

        finding: Dict[str, Any] = {
            "rule_id": prefixed,
            "message": item.get("message", ""),
            "severity": sev,
            "file": item.get("filename", ""),
            "line": item.get("location", {}).get("row", 1)
                     if isinstance(item.get("location"), dict) else item.get("row", 1),
            "category": cat,
            "scanner": "ruff",
            "cwe_id": cwe,
        }
        if owasp_id:
            finding["owasp_id"] = owasp_id
        findings.append(finding)

    logger.info(f"Ruff found {len(findings)} issue(s)")
    return findings


# ---------------------------------------------------------------------------
# OSV-Scanner — Software Composition Analysis (dependency vulnerability scan)
# ---------------------------------------------------------------------------
# Uses the Open Source Vulnerabilities (OSV) REST API:
#   https://api.osv.dev/v1/querybatch
# No CLI tool required. Supports PyPI (requirements.txt) and npm (package.json).
# ---------------------------------------------------------------------------

OSV_API_BATCH = "https://api.osv.dev/v1/querybatch"

# Ecosystem → manifest files to scan
OSV_MANIFESTS: Dict[str, tuple] = {
    "PyPI": ("requirements.txt",),
    "npm": ("package.json",),
}


def _parse_requirements_txt(path: str) -> List[Dict[str, str]]:
    """Parse requirements.txt → [{name, version}, ...].

    Only extracts pinned versions (``package==version``).
    """
    packages: List[Dict[str, str]] = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("-"):
                    continue
                m = re.match(r"^([a-zA-Z0-9_.-]+)\s*==\s*([\w.]+)", line)
                if m:
                    packages.append({"name": m.group(1), "version": m.group(2)})
    except (OSError, IOError):
        pass
    return packages


def _parse_package_json_deps(path: str) -> List[Dict[str, str]]:
    """Parse package.json → [{name, version}, ...].

    Extracts pinned or range versions from dependencies / devDependencies.
    Strips leading ^ ~ >= <= > < for the OSV lookup.
    """
    packages: List[Dict[str, str]] = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for dep_key in ("dependencies", "devDependencies"):
            deps = data.get(dep_key, {})
            for name, ver in deps.items():
                if isinstance(ver, str):
                    clean = re.sub(r"^[\^~>=<!\s]+", "", ver)
                    clean = re.split(r"\s+", clean)[0]
                    packages.append({"name": name, "version": clean})
    except (OSError, IOError, json.JSONDecodeError):
        pass
    return packages


def _collect_dependencies(target: str) -> List[dict]:
    """Walk *target* for known manifest files, return [(ecosystem, name, version), ...]."""
    deps: List[dict] = []
    for ecosystem, manifests in OSV_MANIFESTS.items():
        for manifest in manifests:
            path = os.path.join(target, manifest)
            if not os.path.isfile(path):
                continue
            if ecosystem == "PyPI":
                parsed = _parse_requirements_txt(path)
            elif ecosystem == "npm":
                parsed = _parse_package_json_deps(path)
            else:
                continue
            for pkg in parsed:
                pkg["ecosystem"] = ecosystem
                pkg["manifest"] = manifest
            deps.extend(parsed)
    return deps


def run_osv_scan(target: str, use_mock: bool = False) -> List[Dict[str, Any]]:
    """Scan project dependencies for known vulnerabilities via the OSV API.

    Supports ``requirements.txt`` (PyPI) and ``package.json`` (npm).
    Falls back to mock data when ``use_mock=True`` or API is unreachable.
    """
    if use_mock:
        return [
            {
                "rule_id": "osv/GHSA-mock-0001-xxxx",
                "message": "[Mock] Dependency vulnerability in flask 2.0.1 (CVE-2023-1234)",
                "severity": "warning",
                "file": "requirements.txt",
                "line": 1,
                "category": "security",
                "scanner": "osv",
                "cwe_id": "",
                "finding_type": "vulnerability",
            }
        ]

    deps = _collect_dependencies(target)
    if not deps:
        logger.info("OSV: No dependency manifests found (checked: requirements.txt, package.json).")
        return []

    # Build batch query
    queries = []
    for dep in deps:
        queries.append({
            "package": {"name": dep["name"], "ecosystem": dep["ecosystem"]},
            "version": dep["version"],
        })

    if not queries:
        return []

    logger.info(f"OSV: Querying {len(queries)} dependency/ies from {len(deps)} package(s)...")

    try:
        resp = requests.post(OSV_API_BATCH, json={"queries": queries}, timeout=30)
        resp.raise_for_status()
        results = resp.json()
    except (requests.RequestException, json.JSONDecodeError) as e:
        logger.warning(f"OSV API query failed: {e}")
        return []

    findings: List[Dict[str, Any]] = []
    result_list = results.get("results", [])
    for idx, result in enumerate(result_list):
        if idx >= len(deps):
            break
        dep = deps[idx]
        vulns = result.get("vulns", [])
        for vuln in vulns:
            vuln_id = vuln.get("id", "UNKNOWN")
            summary = vuln.get("summary", "")
            aliases = vuln.get("aliases", [])
            cve = next((a for a in aliases if a.startswith("CVE-")), "")
            # Extract CWE from database_specific if available
            db_specific = vuln.get("database_specific", {})
            cwe = db_specific.get("cwe_ids", [""])[0] if isinstance(db_specific, dict) else ""

            finding = {
                "rule_id": f"osv/{vuln_id}",
                "message": f"{dep['name']} {dep['version']}: {summary}" if summary else f"{dep['name']} {dep['version']}: {vuln_id}",
                "severity": "error" if cve else "warning",
                "file": dep["manifest"],
                "line": 1,
                "category": "security",
                "scanner": "osv",
                "cwe_id": cwe,
                "owasp_id": "OWASP-A06",
                "finding_type": "vulnerability",
            }
            findings.append(finding)

            if vuln_id.startswith("GHSA-"):
                severity = _osv_ghsa_severity(vuln, dep)
                if severity:
                    finding["severity"] = severity

    logger.info(f"OSV found {len(findings)} dependency vulnerability/ies")
    return findings


def _osv_ghsa_severity(vuln: dict, dep: dict) -> Optional[str]:
    """Map OSV severity to vexcode severity (error/warning/info).

    Checks ``severity`` array for CVSS score, then database_specific.
    """
    sev_list = vuln.get("severity", [])
    for s in sev_list:
        score_str = s.get("score", "")
        if "CVSS:3" in score_str:
            try:
                parts = score_str.split("/")
                for part in parts:
                    if part.startswith("CVSS:3"):
                        continue
                    if ":" in part:
                        val = part.split(":")[1]
                        if val in ("CRITICAL", "HIGH"):
                            return "error"
                        if val == "MEDIUM":
                            return "warning"
                        if val in ("LOW", "NONE"):
                            return "info"
            except Exception:
                pass
    db_specific = vuln.get("database_specific", {})
    if isinstance(db_specific, dict):
        severity = db_specific.get("severity", "")
        if severity == "CRITICAL":
            return "error"
    return "error" if vuln.get("id", "").startswith("CVE-") else "warning"


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