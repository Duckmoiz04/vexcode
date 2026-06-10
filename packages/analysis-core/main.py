import argparse
import json
import sys
import os
from datetime import datetime, timezone

from ai_resolver import resolve_findings


def main() -> None:
    parser = argparse.ArgumentParser(description="Python Core Analysis Engine")
    parser.add_argument("--target", type=str, default=".",
                        help="Root directory path to run static analysis on.")
    parser.add_argument("--output", type=str, default="analysis_report.json",
                        help="Destination path for the JSON results report.")
    parser.add_argument("--mock-scan", action="store_true",
                        help="Forces the use of mock scan findings instead of invoking the Semgrep binary.")
    parser.add_argument("--mock-ai", action="store_true",
                        help="Forces mock AI suggestions instead of contacting the 9router API.")
    parser.add_argument("--fast", action="store_true",
                        help="Runs an incremental scan on modified and untracked files in the Git working directory.")
    parser.add_argument("--re-resolve", type=str, default=None, metavar="REPORT_PATH",
                        help="Re-run AI resolution on an existing report without re-scanning. Updates ai_resolutions in-place.")

    args = parser.parse_args()

    # --- Re-resolve mode: skip scanning, just re-run AI on existing findings ---
    if args.re_resolve:
        report_path = args.re_resolve
        if not os.path.exists(report_path):
            print(f"Error: Report not found: {report_path}", file=sys.stderr)
            sys.exit(1)
        print(f"Re-resolving AI findings from existing report: {report_path}", file=sys.stderr)
        with open(report_path, "r", encoding="utf-8") as f:
            existing_report = json.load(f)
        findings = existing_report.get("findings", [])
        if not findings:
            print("No findings in report. Nothing to resolve.", file=sys.stderr)
            sys.exit(0)
        print(f"Found {len(findings)} finding(s). Running AI resolution...", file=sys.stderr)
        resolutions = resolve_findings(
            findings, use_mock=args.mock_ai,
            target_path=existing_report.get("target_path")
        )
        existing_report["ai_resolutions"] = resolutions
        existing_report["re_resolved_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(existing_report, f, indent=2, ensure_ascii=False)
        print(f"AI resolutions updated in: {report_path}", file=sys.stderr)
        sys.exit(0)

    print(f"Starting analysis on target: {args.target}", file=sys.stderr)

    try:
        # Lazy imports: only load pipeline modules when scan path is taken
        from pipeline.scanner import run_scan_phase
        from pipeline.enricher import enrich_findings
        from pipeline.resolver import resolve_phase
        from pipeline.reporter import assemble_report, write_report

        # 1. Scan
        scan_results, target_files = run_scan_phase(args.target, args.mock_scan, args.fast)
        findings = scan_results.get("findings", [])
        print(f"Scan complete. Found {len(findings)} finding(s).", file=sys.stderr)

        # 2. Enrich
        findings = enrich_findings(findings, args.target, args.mock_scan)

        # 3. Resolve
        findings, resolutions, metrics = resolve_phase(
            findings, args.target, args.mock_ai, target_files
        )

        # 4. Report
        report = assemble_report(scan_results, findings, resolutions, args.target, metrics)
        write_report(report, args.output)

        print("Analysis engine executed successfully.", file=sys.stderr)
        sys.exit(0)

    except (OSError, IOError) as e:
        print(f"Error during analysis execution: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()