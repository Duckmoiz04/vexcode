import argparse
import json
import sys
import os
from datetime import datetime, timezone
from scanner import run_scan
from ai_resolver import resolve_findings

def main() -> None:
    parser = argparse.ArgumentParser(description="Python Core Analysis Engine")
    parser.add_argument(
        "--target",
        type=str,
        default=".",
        help="Root directory path to run static analysis on."
    )
    parser.add_argument(
        "--output",
        type=str,
        default="analysis_report.json",
        help="Destination path for the JSON results report."
    )
    parser.add_argument(
        "--mock-scan",
        action="store_true",
        help="Forces the use of mock scan findings instead of invoking the Semgrep binary."
    )
    parser.add_argument(
        "--mock-ai",
        action="store_true",
        help="Forces mock AI suggestions instead of contacting the 9router API."
    )
    
    args = parser.parse_args()
    
    print(f"Starting analysis on target: {args.target}", file=sys.stderr)
    
    try:
        # 1. Run static security scanning
        scan_results = run_scan(args.target, use_mock=args.mock_scan)
        findings = scan_results.get("findings", [])
        
        print(f"Scan complete. Found {len(findings)} finding(s).", file=sys.stderr)
        
        # 2. Query AI resolutions for the findings
        resolutions = {}
        if findings:
            print("Resolving findings with AI...", file=sys.stderr)
            resolutions = resolve_findings(findings, use_mock=args.mock_ai)
        else:
            print("No findings to resolve.", file=sys.stderr)
            
        # 3. Assemble unified output report
        report = {
            "scanner": scan_results.get("scanner", "unknown"),
            "timestamp": scan_results.get("timestamp", datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")),
            "target_path": scan_results.get("target_path", args.target),
            "findings": findings,
            "ai_resolutions": resolutions
        }
        
        # 4. Write to output file
        output_path = args.output
        print(f"Writing report to {output_path}...", file=sys.stderr)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
            
        print("Analysis engine executed successfully.", file=sys.stderr)
        sys.exit(0)
        
    except Exception as e:
        print(f"Error during analysis execution: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
