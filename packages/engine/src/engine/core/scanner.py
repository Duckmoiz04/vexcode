import subprocess
import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from engine.opengrep_installer import ensure_opengrep, resolve_opengrep_path
from engine.config.iso25010_taxonomy import classify_finding, compute_finding_id

# Standard mock findings to return when use_mock=True or when scanning fails.
MOCK_FINDINGS = [
    {
        "file": "example.py",
        "line": 12,
        "rule_id": "python.lang.security.audit.dangerous-exec",
        "message": "Found use of exec() with user input, which presents a remote code execution vulnerability.",
        "severity": "ERROR",
        "code_text": "    exec(user_input)"
    },
    {
        "file": "db.py",
        "line": 45,
        "rule_id": "python.lang.security.audit.hardcoded-password",
        "message": "Hardcoded password variable found in connection string.",
        "severity": "WARNING",
        "code_text": "        password = \"admin123\""
    }
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_LANGUAGE_BY_EXT: Dict[str, str] = {
    ".py":   "python",
    ".pyx":  "python",
    ".js":   "javascript",
    ".jsx":  "javascript",
    ".mjs":  "javascript",
    ".cjs":  "javascript",
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".go":   "go",
    ".rs":   "rust",
    ".java": "java",
    ".kt":   "kotlin",
    ".rb":   "ruby",
    ".php":  "php",
    ".cs":   "csharp",
    ".cpp":  "cpp",
    ".cc":   "cpp",
    ".cxx":  "cpp",
    ".c":    "c",
    ".h":    "c",
    ".hpp":  "cpp",
    ".swift": "swift",
    ".scala": "scala",
    ".sh":   "shell",
    ".bash": "shell",
    ".html": "html",
    ".htm":  "html",
    ".css":  "css",
    ".scss": "css",
    ".sql":  "sql",
    ".yaml": "yaml",
    ".yml":  "yaml",
    ".json": "json",
    ".md":   "markdown",
}


def _detect_language(file_path: Optional[str]) -> Optional[str]:
    """Return a language label for *file_path* based on extension, or None."""
    if not file_path:
        return None
    _, ext = os.path.splitext(file_path)
    return _LANGUAGE_BY_EXT.get(ext.lower())


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


def _normalize_severity(raw: str) -> str:
    """Normalize Semgrep severity to lowercase VexCode convention.

    Semgrep uses: INFO, WARNING, ERROR (uppercase).
    VexCode uses: info, warning, error (lowercase).
    Unknown values fall back to "warning".
    """
    raw = (raw or "").strip().lower()
    if raw in ("error", "warning", "info"):
        return raw
    return "warning"


def _enrich_finding(finding: Dict[str, Any]) -> Dict[str, Any]:
    """Add stable id, category, language, normalized severity to a finding.

    Mutates and returns the finding dict. Idempotent (safe to re-run).
    """
    # Stable id — derived from (file, line, rule_id)
    if "id" not in finding:
        finding["id"] = compute_finding_id(
            str(finding.get("file") or ""),
            int(finding.get("line") or 0),
            str(finding.get("rule_id") or ""),
        )

    # ISO/IEC 25010 category
    if "category" not in finding:
        finding["category"] = classify_finding(finding)

    # Language (from file extension)
    if "language" not in finding:
        finding["language"] = _detect_language(finding.get("file"))

    # Normalize severity to lowercase
    if "severity" in finding:
        finding["severity"] = _normalize_severity(finding["severity"])

    return finding

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
        enriched_mock = [_enrich_finding(dict(f)) for f in filtered_mock]
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

        result = subprocess.run(cmd, capture_output=True, text=True, check=False)

        if result.returncode != 0 and not result.stdout.strip():
            raise RuntimeError(f"Opengrep execution failed (exit code {result.returncode}): {result.stderr}")

        # Parse output
        output_data = json.loads(result.stdout)
        findings: List[Dict[str, Any]] = []

        for item in output_data.get("results", []):
            finding: Dict[str, Any] = {
                "file": item.get("path"),
                "line": item.get("start", {}).get("line"),
                "end_line": item.get("end", {}).get("line"),
                "rule_id": item.get("check_id"),
                "message": item.get("extra", {}).get("message"),
                "severity": item.get("extra", {}).get("severity", "WARNING"),
                "code_text": item.get("extra", {}).get("lines", ""),
                "cwe_id": _extract_cwe_id(item),
            }
            # Enrich: id, category, language, normalized severity
            findings.append(_enrich_finding(finding))

        return {
            "scanner": "opengrep",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": findings
        }

    except (FileNotFoundError, RuntimeError) as e:
        print(f"Opengrep unavailable or failed: {e}", file=sys.stderr)
        print("Falling back to mock scan findings.", file=sys.stderr)
        return {
            "scanner": "opengrep-mock-fallback",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": MOCK_FINDINGS
        }
    except Exception as e:
        print(f"Error running Opengrep: {e}", file=sys.stderr)
        print("Falling back to mock scan findings.", file=sys.stderr)
        return {
            "scanner": "opengrep-mock-fallback",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": MOCK_FINDINGS
        }

if __name__ == "__main__":
    # Test script run
    import sys
    test_target = sys.argv[1] if len(sys.argv) > 1 else "."
    print(json.dumps(run_scan(test_target, use_mock=True), indent=2))
