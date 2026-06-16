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
from pathlib import Path

from engine.utils.logger import get_logger
from engine.core.ai_resolver import resolve_findings

logger = get_logger(__name__)


def create_parser() -> argparse.ArgumentParser:
    """Create the argument parser with all supported flags."""
    parser = argparse.ArgumentParser(description="Python Core Analysis Engine")
    parser.add_argument("--target", type=str, default=".",
                        help="Root directory path to run static analysis on.")
    parser.add_argument("--output", type=str,
                        default=os.path.join(os.path.expanduser("~"), ".vexcode", "reports", "analysis_report.json"),
                        help="Destination path for the VexCode JSON results report.")
    parser.add_argument("--mock-scan", action="store_true",
                        help="--mockForces the use of mock scan findings instead of invoking the Semgrep binary.")
    parser.add_argument("--mock-ai", action="store_true",
                        help="Forces mock AI suggestions instead of contacting the 9router API.")
    parser.add_argument("--fast", action="store_true",
                        help="Runs an incremental scan on modified and untracked files in the Git working directory.")
    parser.add_argument("--refresh-ai", type=str, default=None, metavar="REPORT_PATH",
                        help="Re-run AI resolution on an existing VexCode report without re-scanning. Updates ai_resolutions in-place.")
    parser.add_argument("--no-sarif", action="store_true",
                        help="Skip writing the SARIF 2.1.0 sidecar report (default: write both .json + .sarif).")
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

    output_parent = os.path.dirname(args.output)
    if output_parent:
        if not os.path.exists(output_parent):
            logger.warning(
                f"Output directory does not exist, creating: {output_parent}"
            )
            try:
                os.makedirs(output_parent, exist_ok=True)
            except OSError as e:
                logger.error(
                    f"Cannot create output directory '{output_parent}': {e}"
                )
                sys.exit(1)
        if not os.access(output_parent, os.W_OK):
            logger.error(
                f"Output directory is not writable: {output_parent}"
            )
            sys.exit(1)


def _sarif_path_for(vexcode_path: str) -> str:
    """Return the sidecar SARIF path for a VexCode report path (foo.json -> foo.sarif)."""
    return str(Path(vexcode_path).with_suffix(".sarif"))


def run_refresh_ai(args: argparse.Namespace) -> None:
    """Re-run AI resolution on an existing VexCode report without re-scanning.

    Updates ai_resolutions in-place and refreshes the SARIF sidecar if present.
    """
    report_path = args.refresh_ai
    if not os.path.exists(report_path):
        logger.error(f"Error: Report not found: {report_path}")
        sys.exit(1)

    logger.info(f"Re-resolving AI findings from existing report: {report_path}")
    with open(report_path, "r", encoding="utf-8") as f:
        existing_report = json.load(f)

    # VexCode format only at this layer — SARIF is derived.
    findings = existing_report.get("findings", [])
    target_path = existing_report.get("target_path") or "."

    if not findings:
        logger.info("No findings in report. Nothing to resolve.")
        sys.exit(0)

    logger.info(f"Found {len(findings)} finding(s). Running AI resolution...")
    resolutions = resolve_findings(
        findings, use_mock=args.mock_ai,
        target_path=target_path
    )

    existing_report["ai_resolutions"] = resolutions
    existing_report["re_resolved_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(existing_report, f, indent=2, ensure_ascii=False)
    logger.info(f"AI resolutions updated in: {report_path}")

    # If a SARIF sidecar exists alongside the VexCode report, refresh it too.
    sarif_path = _sarif_path_for(report_path)
    if os.path.exists(sarif_path):
        from engine.pipeline.sarif_builder import build_sarif
        scan_results = {
            "scanner": existing_report.get("scanner", "unknown"),
            "timestamp": existing_report.get("timestamp", ""),
            "target_path": target_path,
        }
        sarif_doc = build_sarif(
            scan_results=scan_results,
            findings=findings,
            resolutions=resolutions,
            target=target_path,
            metrics=existing_report.get("metrics", {"files": {}}),
            git_state=existing_report.get("git_state"),
        )
        with open(sarif_path, "w", encoding="utf-8") as f:
            json.dump(sarif_doc, f, indent=2, ensure_ascii=False)
        logger.info(f"SARIF sidecar refreshed: {sarif_path}")

    sys.exit(0)


def run_analysis(args: argparse.Namespace) -> None:
    """Run the full analysis pipeline: scan → enrich → dedup → resolve → report."""
    logger.info(f"Starting analysis on target: {args.target}")

    try:
        # Lazy imports: only load pipeline modules when scan path is taken
        from engine.pipeline.scanner import run_scan_phase, get_git_state
        from engine.pipeline.enricher import enrich_findings
        from engine.pipeline.resolver import resolve_phase
        from engine.pipeline.reporter import assemble_report, write_report
        from engine.pipeline.sarif_builder import build_sarif
        from engine.core.dedup import deduplicate_findings

        # 1. Scan
        scan_results, target_files = run_scan_phase(args.target, args.mock_scan, args.fast)
        findings = scan_results.get("findings", [])
        logger.info(f"Scan complete. Found {len(findings)} finding(s).")

        # 2. Enrich
        findings = enrich_findings(findings, args.target, args.mock_scan)

        # 3. Dedup
        findings = deduplicate_findings(findings)

        # 4. Cross-scan classification (compare with previous report)
        from engine.pipeline.scanner import get_previous_report_path, classify_findings_against_previous
        previous_report_path = get_previous_report_path(args.target)
        if previous_report_path:
            logger.info(f"Comparing with previous report: {previous_report_path}")
        findings = classify_findings_against_previous(findings, previous_report_path)

        # 5. Resolve
        findings, resolutions, metrics = resolve_phase(
            findings, args.target, args.mock_ai, target_files
        )

        # 6. Git state (used by both formats)
        git_state = get_git_state(args.target)

        # 7. Report — write VexCode (primary, consumed by web UI directly)
        vexcode_report = assemble_report(
            scan_results, findings, resolutions, args.target, metrics, git_state,
        )
        write_report(vexcode_report, args.output)
        logger.info(f"VexCode report written: {args.output}")

        # 8. Report — write SARIF sidecar (boundary format for external tools)
        if not args.no_sarif:
            sarif_report = build_sarif(
                scan_results=scan_results,
                findings=findings,
                resolutions=resolutions,
                target=args.target,
                metrics=metrics,
                git_state=git_state,
            )
            sarif_path = _sarif_path_for(args.output)
            with open(sarif_path, "w", encoding="utf-8") as f:
                json.dump(sarif_report, f, indent=2, ensure_ascii=False)
            logger.info(f"SARIF sidecar written: {sarif_path}")

        logger.info("Analysis engine executed successfully.")
        sys.exit(0)

    except (OSError, IOError) as e:
        logger.error(f"Error during analysis execution: {e}")
        sys.exit(1)


def main() -> None:
    parser = create_parser()
    args = parser.parse_args()
    args.output = os.path.expanduser(args.output)
    validate_args(args)

    if args.refresh_ai:
        return run_refresh_ai(args)

    return run_analysis(args)


if __name__ == "__main__":
    main()
