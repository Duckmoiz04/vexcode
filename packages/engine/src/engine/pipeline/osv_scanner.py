import json
import os
import re
from typing import Dict, Any, List, Optional

import requests

from engine.utils.logger import get_logger

logger = get_logger(__name__)

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
