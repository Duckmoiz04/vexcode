import subprocess
import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pathlib import Path

from engine.opengrep_installer import ensure_opengrep, resolve_opengrep_path
from engine.core.findings import enrich_finding


def _get_project_root() -> str:
    """Return the monorepo root (d:/DATN2) from this file's location."""
    return str(Path(__file__).resolve().parents[5])


# Standard mock findings to return when use_mock=True or when scanning fails.
MOCK_FINDINGS = [
    {
        "file": "example.py",
        "line": 12,
        "rule_id": "python.lang.security.audit.dangerous-exec",
        "message": "Found use of exec() with user input, which presents a remote code execution vulnerability.",
        "severity": "ERROR",
        "code_text": "    exec(user_input)",
        "cwe_id": "CWE-94",
        "owasp_id": "OWASP-A03",
        "confidence": "HIGH",
        "precision": "HIGH",
        "category": "security",
    },
    {
        "file": "db.py",
        "line": 45,
        "rule_id": "python.lang.security.audit.hardcoded-password",
        "message": "Hardcoded password variable found in connection string.",
        "severity": "WARNING",
        "code_text": "        password = \"admin123\"",
        "cwe_id": "CWE-798",
        "owasp_id": "OWASP-A02",
        "confidence": "HIGH",
        "precision": "HIGH",
        "category": "security",
    }
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_cwe_id(item: Dict[str, Any]) -> Optional[str]:
    """Extract a CWE identifier from a Semgrep finding if present.

    Semgrep puts CWE under ``extra.metadata.cwe`` (sometimes a list of CWE
    entries or a single string). We return the first CWE in canonical
    ``CWE-XXX`` form, or None if absent.
    """
    metadata = item.get("extra", {}).get("metadata", {}) or {}
    candidates: List[str] = []

    # Common shapes
    cwe_val = metadata.get("cwe")
    if isinstance(cwe_val, str):
        candidates.append(cwe_val)
    elif isinstance(cwe_val, list):
        candidates.extend(str(c) for c in cwe_val)

    # Some rules use the longer-form "cwe2022-top25" etc — skip those
    for raw in candidates:
        # Look for "CWE-123" pattern
        import re
        m = re.search(r"CWE-(\d+)", raw, re.IGNORECASE)
        if m:
            return f"CWE-{m.group(1)}"
    return None


def _extract_confidence(item: Dict[str, Any]) -> Optional[str]:
    """Extract Semgrep rule confidence from ``extra.metadata.confidence``.

    Returns an uppercase string (``HIGH``, ``MEDIUM``, ``LOW``) or None.
    """
    metadata = item.get("extra", {}).get("metadata", {}) or {}
    raw = metadata.get("confidence")
    if raw and isinstance(raw, str):
        return raw.strip().upper()
    return None


def _extract_precision(item: Dict[str, Any]) -> Optional[str]:
    """Extract Semgrep rule precision from ``extra.metadata.precision``.

    Returns an uppercase string (``HIGH``, ``MEDIUM``, ``LOW``) or None.
    """
    metadata = item.get("extra", {}).get("metadata", {}) or {}
    raw = metadata.get("precision")
    if raw and isinstance(raw, str):
        return raw.strip().upper()
    return None


def _extract_owasp_id(item: Dict[str, Any]) -> Optional[str]:
    """Extract an OWASP Top 10 identifier from a Semgrep finding if present.

    Semgrep / OpenGrep registry rules store OWASP in ``extra.metadata.owasp``
    as a string (e.g. ``"A03:2021 - Injection"``) or a list, or in
    ``extra.metadata.tags`` as ``"owasp-a1"`` ... ``"owasp-a10"``.

    Returns a canonical ``OWASP-AXX`` form, or None if absent.
    """
    metadata = item.get("extra", {}).get("metadata", {}) or {}
    import re

    # 1. Direct 'owasp' field (string or list)
    owasp_val = metadata.get("owasp") or metadata.get("OWASP")
    candidates: List[str] = []
    if isinstance(owasp_val, str):
        candidates.append(owasp_val)
    elif isinstance(owasp_val, list):
        candidates.extend(str(c) for c in owasp_val)

    for raw in candidates:
        # "A03:2021 - Injection" -> "A03"
        # "A1: Injection"        -> "A01" (normalize to 2-digit)
        m = re.search(r"A(\d+)(?::|\b)", raw, re.IGNORECASE)
        if m:
            num = int(m.group(1))
            return f"OWASP-A{num:02d}"

    # 2. 'tags' list with "owasp-a1" ... "owasp-a10"
    tags = metadata.get("tags")
    if isinstance(tags, list):
        for tag in tags:
            m = re.search(r"owasp[_-]?a(\d+)", str(tag), re.IGNORECASE)
            if m:
                num = int(m.group(1))
                return f"OWASP-A{num:02d}"

    return None


def _extract_dataflow_trace(extra: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract taint dataflow trace from --dataflow-traces output.

    Returns a dict with source, sink, and propagators showing how
    tainted data flows from origin to dangerous usage.
    Returns None if no trace is present.
    """
    trace = extra.get("dataflow_trace")
    if not trace or not isinstance(trace, dict):
        return None

    def _extract_location(loc_data: dict) -> Optional[Dict[str, Any]]:
        if not loc_data or not isinstance(loc_data, dict):
            return None
        location = loc_data.get("location", {})
        start = location.get("start", {})
        return {
            "file": location.get("path", ""),
            "line": start.get("line", 0),
            "col": start.get("col", 0),
            "content": loc_data.get("content", "").strip(),
        }

    result = {}
    source = _extract_location(trace.get("taint_source"))
    if source:
        result["source"] = source
    sink = _extract_location(trace.get("taint_sink"))
    if sink:
        result["sink"] = sink
    propagators = trace.get("taint_propagator") or trace.get("taint_propagators")
    if propagators and isinstance(propagators, list):
        result["propagators"] = [
            _extract_location(p) for p in propagators if p
        ]
    return result if result else None


def _extract_enclosing_context(extra: Dict[str, Any]) -> Dict[str, str]:
    """Extract enclosing function/class from --output-enclosing-context output.

    Returns dict with 'function' and/or 'class' keys.
    """
    contexts = extra.get("enclosing_context")
    result: Dict[str, str] = {}
    if not contexts or not isinstance(contexts, list):
        return result
    for ctx in contexts:
        if not isinstance(ctx, dict):
            continue
        kind = ctx.get("kind", "")
        name = ctx.get("name", "")
        if not name:
            continue
        if kind == "function":
            result["function"] = name
        elif kind == "class":
            result["class"] = name
        elif kind == "method":
            result["function"] = name
    return result





def _resolve_to_existing(raw_path: str, abs_target: str, bases: List[str]) -> str:
    """Return a path for *raw_path* that exists on disk, normalised.

    OpenGrep's actual CWD when launched by the CLI bridge is the engine package
    dir, but raw paths in its JSON output may use any of: the absolute form,
    the scan target as base, the engine package as base, or a base further up
    the tree (so ``..\\..\\file`` resolves under scan target's parent). For each
    candidate base we join + normpath; the first hit that exists wins. As a
    final fallback we strip leading ``..`` segments and retry against every
    base, because some OpenGrep versions emit paths already relative to the
    scan target's parent.
    """
    if not raw_path:
        return ""

    if os.path.isabs(raw_path):
        normalised = os.path.normpath(raw_path)
        if os.path.exists(normalised):
            return normalised
        return normalised

    def _try(path: str) -> Optional[str]:
        candidate = os.path.normpath(os.path.join(base, path))
        return candidate if os.path.exists(candidate) else None

    for base in bases:
        hit = _try(raw_path)
        if hit is not None:
            return hit

    # Some OpenGrep versions emit paths relative to the scan target's parent,
    # so we strip leading ".." and retry before giving up.
    stripped = raw_path
    while stripped.startswith("..\\") or stripped.startswith("../"):
        stripped = stripped[3:]
        for base in bases:
            hit = _try(stripped)
            if hit is not None:
                return hit

    return os.path.normpath(os.path.join(abs_target, raw_path))


# Directories to exclude from Opengrep scans.
EXCLUDE_DIRS = [".venv", "node_modules", "__pycache__", ".git", ".agents", ".claude", ".codex"]

def run_scan(target_path: str, use_mock: bool = False, files: List[str] = None) -> Dict[str, Any]:
    """
    Executes an Opengrep scan on the target path or specific files, and parses the results.
    If use_mock is True, or if the Opengrep CLI is not installed or fails,
    returns standard mock findings.
    
    Args:
        target_path: The directory or file path to scan.
        use_mock: If True, forces the use of mock results.
        files: Optional list of specific file paths to scan.
        
    Returns:
        A dictionary containing scan metadata and list of findings.
    """
    scan_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    if use_mock:
        print("Using mock scanner findings as requested.", file=sys.stderr)
        filtered_mock = MOCK_FINDINGS
        if files:
            normalized_files = {os.path.normcase(os.path.basename(f)) for f in files}
            filtered_mock = [f for f in MOCK_FINDINGS if os.path.normcase(f["file"]) in normalized_files]
        # Enrich mock findings with id + category + language (idempotent)
        enriched_mock = [enrich_finding(dict(f)) for f in filtered_mock]
        return {
            "scanner": "opengrep-mock",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": enriched_mock
        }
    
    # Try running opengrep scan via subprocess
    try:
        # Check if target_path exists
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Target path '{target_path}' does not exist.")

        # Resolve opengrep binary path — auto-download if missing
        opengrep_bin = ensure_opengrep()

        exclude_args = []
        for d in EXCLUDE_DIRS:
            exclude_args.extend(["--exclude", d])

        if files:
            print(f"Running Opengrep scan on {len(files)} files...", file=sys.stderr)
            cmd = [opengrep_bin, "scan", "--json", "--quiet"] + exclude_args + files
        else:
            print(f"Running Opengrep scan on target: {target_path}...", file=sys.stderr)
            cmd = [opengrep_bin, "scan", "--json", "--quiet"] + exclude_args + [target_path]

        # OpenGrep-specific engine features (not available in Semgrep CE free tier)
        cmd.extend([
            "--taint-intrafile",              # Cross-function taint analysis within a file
            "--dynamic-timeout",              # Scale timeout by file size (prevents large file hangs)
            "--dataflow-traces",              # Include taint flow path (source → sink) in output
            "--experimental",                 # Required for --output-enclosing-context
            "--output-enclosing-context",     # Include function/class context in findings
            "--force-exclude",                # Apply --exclude to explicitly passed files (fast scan)
        ])

        # auto mode: Semgrep community registry (includes p/owasp-top-ten, p/default, etc.)
        cmd.extend(["--config", "auto"])
        from engine.config.constants import SEMGREP_CUSTOM_RULES_PATH
        custom_rules_dir = os.path.join(_get_project_root(), SEMGREP_CUSTOM_RULES_PATH)
        if os.path.isdir(custom_rules_dir):
            cmd.extend(["--config", custom_rules_dir])
            print(f"Custom rules loaded from: {custom_rules_dir}", file=sys.stderr)
        else:
            print("Running auto mode (Semgrep registry rules)", file=sys.stderr)

        result = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=120)

        if result.returncode != 0 and not result.stdout.strip():
            raise RuntimeError(f"Opengrep execution failed (exit code {result.returncode}): {result.stderr}")

        # Parse output
        output_data = json.loads(result.stdout)
        findings: List[Dict[str, Any]] = []

        abs_target = os.path.abspath(target_path)
        engine_pkg = os.path.dirname(os.path.abspath(__file__))
        bases = [abs_target, engine_pkg]
        walk = engine_pkg
        for _ in range(4):
            walk = os.path.dirname(walk)
            if walk and walk != os.path.dirname(walk):
                bases.append(walk)

        for item in output_data.get("results", []):
            extra = item.get("extra", {}) or {}
            metadata = extra.get("metadata", {}) or {}
            enclosing = _extract_enclosing_context(extra)

            raw_path = item.get("path") or ""
            raw_path = _resolve_to_existing(raw_path, abs_target, bases)

            finding: Dict[str, Any] = {
                "file": raw_path,
                "line": item.get("start", {}).get("line"),
                "end_line": item.get("end", {}).get("line"),
                "rule_id": item.get("check_id"),
                "message": extra.get("message"),
                "severity": extra.get("severity", "WARNING"),
                "code_text": extra.get("lines", ""),
                "cwe_id": _extract_cwe_id(item),
                "owasp_id": _extract_owasp_id(item),
                "confidence": _extract_confidence(item),
                "precision": _extract_precision(item),
                "iso_25010": metadata.get("iso_25010"),
                "iso_subcategory": metadata.get("iso_subcategory"),
                "dataflow_trace": _extract_dataflow_trace(extra),
                "enclosing_function": enclosing.get("function"),
                "enclosing_class": enclosing.get("class"),
                "fingerprint": extra.get("fingerprint"),
                "category": metadata.get("category"),
            }
            # Enrich: id, category, language, normalized severity
            findings.append(enrich_finding(finding))

        return {
            "scanner": "opengrep",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": findings
        }

    except (FileNotFoundError, RuntimeError, subprocess.TimeoutExpired) as e:
        print(f"Opengrep unavailable or failed: {e}", file=sys.stderr)
        print("Falling back to mock scan findings.", file=sys.stderr)
        return {
            "scanner": "opengrep-mock-fallback",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": [enrich_finding(dict(f)) for f in MOCK_FINDINGS],
            "fallback_reason": str(e)
        }
    except Exception as e:
        print(f"Error running Opengrep: {e}", file=sys.stderr)
        print("Falling back to mock scan findings.", file=sys.stderr)
        return {
            "scanner": "opengrep-mock-fallback",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": [enrich_finding(dict(f)) for f in MOCK_FINDINGS],
            "fallback_reason": str(e)
        }

if __name__ == "__main__":
    # Test script run
    import sys
    test_target = sys.argv[1] if len(sys.argv) > 1 else "."
    print(json.dumps(run_scan(test_target, use_mock=True), indent=2))
