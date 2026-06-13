import subprocess
import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List

from engine.opengrep_installer import ensure_opengrep, resolve_opengrep_path

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
        return {
            "scanner": "opengrep-mock",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": filtered_mock
        }
    
    # Try running opengrep scan via subprocess
    try:
        # Check if target_path exists
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Target path '{target_path}' does not exist.")

        # Resolve opengrep binary path — auto-download if missing
        opengrep_bin = ensure_opengrep()

        if files:
            print(f"Running Opengrep scan on {len(files)} files...", file=sys.stderr)
            cmd = [opengrep_bin, "scan", "--json", "--quiet"] + files
        else:
            print(f"Running Opengrep scan on target: {target_path}...", file=sys.stderr)
            cmd = [opengrep_bin, "scan", "--json", "--quiet", target_path]

        result = subprocess.run(cmd, capture_output=True, text=True, check=False)

        if result.returncode != 0 and not result.stdout.strip():
            raise RuntimeError(f"Opengrep execution failed (exit code {result.returncode}): {result.stderr}")

        # Parse output
        output_data = json.loads(result.stdout)
        findings: List[Dict[str, Any]] = []

        for item in output_data.get("results", []):
            findings.append({
                "file": item.get("path"),
                "line": item.get("start", {}).get("line"),
                "rule_id": item.get("check_id"),
                "message": item.get("extra", {}).get("message"),
                "severity": item.get("extra", {}).get("severity", "WARNING"),
                "code_text": item.get("extra", {}).get("lines", "")
            })

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
