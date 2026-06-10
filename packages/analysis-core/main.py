import argparse
import json
import sys
import os
from datetime import datetime, timezone

from logger import get_logger
from ai_resolver import resolve_findings

logger = get_logger(__name__)


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
            logger.error(f"Error: Report not found: {report_path}")
            sys.exit(1)
        logger.info(f"Re-resolving AI findings from existing report: {report_path}")
        with open(report_path, "r", encoding="utf-8") as f:
            existing_report = json.load(f)
        findings = existing_report.get("findings", [])
        if not findings:
            logger.info("No findings in report. Nothing to resolve.")
            sys.exit(0)
        logger.info(f"Found {len(findings)} finding(s). Running AI resolution...")
        resolutions = resolve_findings(
            findings, use_mock=args.mock_ai,
            target_path=existing_report.get("target_path")
        )
        existing_report["ai_resolutions"] = resolutions
        existing_report["re_resolved_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(existing_report, f, indent=2, ensure_ascii=False)
        logger.info(f"AI resolutions updated in: {report_path}")
        sys.exit(0)

    logger.info(f"Starting analysis on target: {args.target}")

    try:
        # Lazy imports: only load pipeline modules when scan path is taken
        from pipeline.scanner import run_scan_phase
        from pipeline.enricher import enrich_findings
        from pipeline.resolver import resolve_phase
        from pipeline.reporter import assemble_report, write_report

        # 1. Scan
        scan_results, target_files = run_scan_phase(args.target, args.mock_scan, args.fast)
        findings = scan_results.get("findings", [])
        logger.info(f"Scan complete. Found {len(findings)} finding(s).")

        # 2. Enrich
        findings = enrich_findings(findings, args.target, args.mock_scan)

        # 3. Resolve
        findings, resolutions, metrics = resolve_phase(
            findings, args.target, args.mock_ai, target_files
        )

        # 4. Report
        report = assemble_report(scan_results, findings, resolutions, args.target, metrics)
        write_report(report, args.output)

        logger.info("Analysis engine executed successfully.")
        sys.exit(0)

    except (OSError, IOError) as e:
        logger.error(f"Error during analysis execution: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()