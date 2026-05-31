import subprocess
import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List

# Standard mock findings to return when use_mock=True or when semgrep is missing/fails.
MOCK_FINDINGS = [
    {
        "file": "example.py",
        "line": 12,
        "rule_id": "python.lang.security.audit.dangerous-exec",
        "message": "Found use of exec() with user input, which presents a remote code execution vulnerability.",
        "severity": "ERROR"
    },
    {
        "file": "db.py",
        "line": 45,
        "rule_id": "python.lang.security.audit.hardcoded-password",
        "message": "Hardcoded password variable found in connection string.",
        "severity": "WARNING"
    }
]

def run_scan(target_path: str, use_mock: bool = False) -> Dict[str, Any]:
    """
    Executes a Semgrep scan on the target path and parses the results.
    If use_mock is True, or if the Semgrep CLI is not installed or fails,
    returns standard mock findings.
    
    Args:
        target_path: The directory or file path to scan.
        use_mock: If True, forces the use of mock results.
        
    Returns:
        A dictionary containing scan metadata and list of findings.
    """
    scan_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    if use_mock:
        print("Using mock scanner findings as requested.", file=sys.stderr)
        return {
            "scanner": "semgrep-mock",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": MOCK_FINDINGS
        }
    
    # Try running semgrep scan via subprocess
    try:
        # Check if target_path exists
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Target path '{target_path}' does not exist.")
            
        print(f"Running Semgrep scan on target: {target_path}...", file=sys.stderr)
        
        # We invoke semgrep scan --json --quiet
        cmd = ["semgrep", "scan", "--json", "--quiet", target_path]
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        
        # Semgrep returns 0 if no findings, or sometimes non-zero when findings are found or on error.
        # But if we have stderr that doesn't look like a successful run, or if the executable is missing:
        if result.returncode != 0 and not result.stdout.strip():
            raise RuntimeError(f"Semgrep execution failed (exit code {result.returncode}): {result.stderr}")
            
        # Parse output
        output_data = json.loads(result.stdout)
        findings: List[Dict[str, Any]] = []
        
        for item in output_data.get("results", []):
            findings.append({
                "file": item.get("path"),
                "line": item.get("start", {}).get("line"),
                "rule_id": item.get("check_id"),
                "message": item.get("extra", {}).get("message"),
                "severity": item.get("extra", {}).get("severity", "WARNING")
            })
            
        return {
            "scanner": "semgrep",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": findings
        }
        
    except FileNotFoundError as e:
        print(f"Target path not found or Semgrep executable not found: {e}", file=sys.stderr)
        print("Falling back to mock scan findings.", file=sys.stderr)
        return {
            "scanner": "semgrep-mock-fallback",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": MOCK_FINDINGS
        }
    except Exception as e:
        print(f"Error running Semgrep: {e}", file=sys.stderr)
        print("Falling back to mock scan findings.", file=sys.stderr)
        return {
            "scanner": "semgrep-mock-fallback",
            "timestamp": scan_time,
            "target_path": target_path,
            "findings": MOCK_FINDINGS
        }

if __name__ == "__main__":
    # Test script run
    import sys
    test_target = sys.argv[1] if len(sys.argv) > 1 else "."
    print(json.dumps(run_scan(test_target, use_mock=True), indent=2))
