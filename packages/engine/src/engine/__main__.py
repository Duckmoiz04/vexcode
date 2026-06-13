#!/usr/bin/env python3
"""CLI entry point for the VexCode analysis engine.

Usage:
    python -m engine --target <dir> --output report.json
    python -m engine --target <dir> --mock-scan --mock-ai
    python -m engine --target <dir> --fast
    python -m engine --refresh-ai existing_report.json --mock-ai
"""

import argparse
import json
import sys
import os
from datetime import datetime, timezone

from engine.utils.logger import get_logger
from engine.core.ai_resolver import resolve_findings

logger = get_logger(__name__)


def create_parser() -> argparse.ArgumentParser:
    """Create the argument parser with all supported flags."""
    parser = argparse.ArgumentParser(description="Python Core Analysis Engine")
    parser.add_argument("--target", type=str, default=".",
                        help="Root directory path to run static analysis on.")
    parser.add_argument("--output", type=str, default="analysis_report.json",
                        help="Destination path for the JSON results report.")
    parser.add_argument("--mock-scan", action="store_true",
                        help="--mockForces the use of mock scan findings instead of invoking the Semgrep binary.")
    parser.add_argument("--mock-ai", action="store_true",
                        help="Forces mock AI suggestions instead of contacting the 9router API.")
    parser.add_argument("--fast", action="store_true",
                        help="Runs an incremental scan on modified and untracked files in the Git working directory.")
    parser.add_argument("--refresh-ai", type=str, default=None, metavar="REPORT_PATH",
                        help="Re-run AI resolution on an existing report without re-scanning. Updates ai_resolutions in-place.")
    return parser


def validate_args(args: argparse.Namespace) -> None:
    """Validate parsed arguments, fail fast before loading pipeline."""
    if args.target.startswith("--"):
        logger.error(
            f"--target requires a directory path, but got '{args.target}'. "
            f"Did you forget to specify a path?"
        )
        sys.exit(1)
    if not os.path.isdir(args.target):
        logger.error(f"Target directory does not exist: {args.target}")
        sys.exit(1)


def run_refresh_ai(args: argparse.Namespace) -> None:
    """Re-run AI resolution on an existing report without re-scanning.
    Updates the report file in-place with fresh ai_resolutions.
    """
    report_path = args.refresh_ai
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


def run_analysis(args: argparse.Namespace) -> None:
    """Run the full analysis pipeline: scan → enrich → resolve → report."""
    logger.info(f"Starting analysis on target: {args.target}")

    try:
        # Lazy imports: only load pipeline modules when scan path is taken
        from engine.pipeline.scanner import run_scan_phase
        from engine.pipeline.enricher import enrich_findings
        from engine.pipeline.resolver import resolve_phase
        from engine.pipeline.reporter import assemble_report, write_report

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


def main() -> None:
    parser = create_parser()
    args = parser.parse_args()
    validate_args(args)

    if args.refresh_ai:
        return run_refresh_ai(args)

    return run_analysis(args)


if __name__ == "__main__":
    main()
