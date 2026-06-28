#!/usr/bin/env python3
"""CLI entry point for the VexCode analysis engine.

Usage:
    python -m engine --target <dir>                              Full scan
    python -m engine --target <dir> --output report.json         Custom output path
    python -m engine --target <dir> --mock-scan --mock-ai        Offline test mode
    python -m engine --target <dir> --fast                       Incremental scan (git)
    python -m engine --target <dir> --no-sarif                   Skip SARIF sidecar
    python -m engine --target <dir> --format md                  Markdown report
    python -m engine --target <dir> --explain                    Explain findings to stdout
    python -m engine --target <dir> --thresholds conf/thresholds.toml   Quality gates
    python -m engine --refresh-ai report.json                    Re-run AI only
    python -m engine --refresh-ai report.json --mock-ai           Re-run AI with mock
"""

import argparse
import json
import sys
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from engine.utils.logger import get_logger, emit_progress, PROGRESS_PHASES
from engine.core.ai_resolver import resolve_findings
from engine.core.findings import enrich_finding

logger = get_logger(__name__)


def create_parser() -> argparse.ArgumentParser:
    """Create the argument parser with all supported flags."""
    parser = argparse.ArgumentParser(description="VexCode static analysis engine — security scan, AST enrichment, AI remediation")
    parser.add_argument("--target", type=str, default=".",
                        help="Root directory path to run static analysis on.")
    parser.add_argument("--output", type=str,
                        default=os.path.join(os.path.expanduser("~"), ".vexcode", "reports", "analysis_report.json"),
                        help="Destination path for the VexCode JSON results report.")
    parser.add_argument("--mock-scan", action="store_true",
                        help="Forces the use of mock scan findings instead of invoking the Opengrep binary.")
    parser.add_argument("--mock-ai", action="store_true",
                        help="Forces mock AI suggestions instead of contacting the 9router API.")
    parser.add_argument("--fast", action="store_true",
                        help="Runs an incremental scan on modified and untracked files in the Git working directory.")
    parser.add_argument("--refresh-ai", type=str, default=None, metavar="REPORT_PATH",
                        help="Re-run AI resolution on an existing VexCode report without re-scanning. Updates ai_resolutions in-place.")
    parser.add_argument("--no-sarif", action="store_true",
                        help="Skip writing the SARIF 2.1.0 sidecar report (default: write both .json + .sarif).")
    parser.add_argument("--format", type=str, choices=["json", "md", "sarif"], default="json",
                        help="Output format for the primary report (default: json). 'md' writes a Markdown report.")
    parser.add_argument("--thresholds", type=str, default=None, metavar="TOML_PATH",
                        help="Path to a TOML file with quality gate thresholds. Evaluated after scan.")
    parser.add_argument("--explain", action="store_true",
                        help="Print a human-readable explanation of findings to STDOUT after scan.")
    parser.add_argument("--fail-on-threshold", action="store_true",
                        help="Exit with code 1 if threshold evaluation fails (quality gate breached).")
    parser.add_argument("--ccn-threshold", type=int, default=None,
                        help="Cyclomatic complexity threshold for HIGH level (default: 25).")
    parser.add_argument("--cognitive-threshold", type=int, default=None,
                        help="Cognitive complexity threshold for findings (default: 15).")
    parser.add_argument("--dup-min-lines", type=int, default=None,
                        help="Minimum matching lines for duplicate detection (default: 6).")
    parser.add_argument("--dup-min-tokens", type=int, default=None,
                        help="Minimum tokens for duplicate detection (default: 50).")
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


def print_explain(findings: List[dict], thresholds_result: Optional[dict] = None) -> None:
    """Print human-readable explanation of findings to STDOUT."""
    if not findings:
        print("✓ No findings detected.")
        return

    # Group by severity
    print(f"\n{'='*60}")
    print(f"  VexCode Scan — Explain Report")
    print(f"{'='*60}")
    print(f"  Total: {len(findings)} finding(s)\n")

    by_severity: Dict[str, List[dict]] = {}
    for f in findings:
        by_severity.setdefault(f.get("severity", "unknown"), []).append(f)

    for severity in ["error", "warning", "info", "unknown"]:
        items = by_severity.get(severity, [])
        if not items:
            continue
        print(f"  [{severity.upper()}] — {len(items)} finding(s)")
        print(f"  {'-'*56}")
        for f in items:
            print(f"    Rule:     {f.get('rule_id', 'N/A')}")
            print(f"    File:     {f.get('file', 'N/A')}:{f.get('line', 'N/A')}")
            print(f"    Message:  {f.get('message', 'N/A')}")
            print(f"    Category: {f.get('category', 'N/A')}")
            if f.get('cwe_id'):
                print(f"    CWE:      {f.get('cwe_id')}")
            if f.get('owasp_id'):
                print(f"    OWASP:    {f.get('owasp_id')}")
            if f.get('scanner') and f['scanner'] != 'opengrep':
                print(f"    Scanner:  {f.get('scanner')}")
            print()

    # Threshold results
    if thresholds_result and not thresholds_result.get("passed", True):
        print(f"\n  {'='*60}")
        print(f"  ❌ THRESHOLD VIOLATIONS")
        print(f"  {'='*60}")
        for v in thresholds_result.get("violations", []):
            print(f"    - {v['message']}")
        print()

    print(f"{'='*60}\n")


RERESOLVE_PHASES = ["ai_resolve", "report"]


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
    emit_progress("ai_resolve", "Re-resolving findings with AI...",
                  current=0, total=len(findings), phase_order=RERESOLVE_PHASES)
    resolutions = resolve_findings(
        findings, use_mock=args.mock_ai,
        target_path=target_path
    )
    emit_progress("ai_resolve", f"AI resolution complete for {len(resolutions)} finding(s).",
                  current=len(findings), total=len(findings), phase_order=RERESOLVE_PHASES)

    existing_report["ai_resolutions"] = resolutions
    existing_report["re_resolved_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    emit_progress("report", "Saving updated report...",
                  current=0, total=1, phase_order=RERESOLVE_PHASES)
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

    emit_progress("report", "Re-resolution complete.",
                  current=1, total=1, phase_order=RERESOLVE_PHASES)
    sys.exit(0)


def run_analysis(args: argparse.Namespace) -> None:
    """Run the full analysis pipeline: scan → enrich → dedup → resolve → report."""
    logger.info(f"Starting analysis on target: {args.target}")

    try:
        # Lazy imports: only load pipeline modules when scan path is taken
        from engine.pipeline.scanner import run_scan_phase, get_git_state
        from engine.pipeline.gitleaks_scanner import run_gitleaks_scan
        from engine.pipeline.osv_scanner import run_osv_scan
        from engine.pipeline.enricher import enrich_findings
        from engine.pipeline.resolver import resolve_phase
        from engine.pipeline.reporter import assemble_report, write_report, export_markdown
        from engine.pipeline.sarif_builder import build_sarif
        from engine.pipeline.thresholds import load_thresholds, evaluate_thresholds
        from engine.core.dedup import deduplicate_findings
        from engine.core import complexity as _complexity_mod
        from engine.core import dup_content as _dup_mod

        # Apply CLI threshold overrides before any analysis runs
        if args.ccn_threshold is not None:
            _complexity_mod.CCN_HIGH_THRESHOLD = args.ccn_threshold
        if args.cognitive_threshold is not None:
            _complexity_mod.COGNITIVE_HIGH_THRESHOLD = args.cognitive_threshold
        if args.dup_min_lines is not None:
            _dup_mod.DUP_MIN_LINES = args.dup_min_lines
        if args.dup_min_tokens is not None:
            _dup_mod.DUP_MIN_TOKENS = args.dup_min_tokens

        # 1. Scan (OpenGrep)
        emit_progress("scan", "Running static analysis (OpenGrep)...", current=1, total=5)
        scan_results, target_files = run_scan_phase(args.target, args.mock_scan, args.fast)
        findings = scan_results.get("findings", [])
        emit_progress("scan", f"OpenGrep complete. Found {len(findings)} finding(s).", current=1, total=5)
        logger.info(f"OpenGrep scan complete. Found {len(findings)} finding(s).")

        # 1b. Gitleaks secret scan (additive — merge findings)
        from engine.config.constants import GITLEAKS_ENABLED
        if GITLEAKS_ENABLED:
            emit_progress("scan", "Running Gitleaks secret scan...", current=3, total=5)
            gitleaks_findings = run_gitleaks_scan(args.target, args.mock_scan)
            if gitleaks_findings:
                gitleaks_findings = [enrich_finding(f) for f in gitleaks_findings]
                findings.extend(gitleaks_findings)
                scan_results["findings"] = findings
                logger.info(f"Gitleaks added {len(gitleaks_findings)} secret finding(s).")
            emit_progress("scan", f"Secret scan complete. Total: {len(findings)} finding(s).", current=3, total=5)

        # 1c. OSV dependency vulnerability scan (additive — merge findings)
        from engine.config.constants import OSV_ENABLED
        if OSV_ENABLED:
            emit_progress("scan", "Running OSV dependency vulnerability scan...", current=5, total=5)
            osv_findings = run_osv_scan(args.target, args.mock_scan)
            if osv_findings:
                osv_findings = [enrich_finding(f) for f in osv_findings]
                findings.extend(osv_findings)
                scan_results["findings"] = findings
                logger.info(f"OSV added {len(osv_findings)} dependency finding(s).")
            emit_progress("scan", f"OSV scan complete. Total: {len(findings)} finding(s).", current=5, total=5)

        # 2. Enrich
        emit_progress("enrich", "Enriching findings with AST context (GitNexus)...")
        findings = enrich_findings(findings, args.target, args.mock_scan)
        emit_progress("enrich", f"AST enrichment complete. Context added to {sum(1 for f in findings if f.get('ast_context'))} finding(s).")

        # 3. Complexity
        emit_progress("complexity", "Calculating complexity metrics (Lizard)...")

        # 4. Dedup
        emit_progress("dedup", "Deduplicating findings...")
        findings = deduplicate_findings(findings)
        emit_progress("dedup", f"Deduplication complete. {len(findings)} unique findings.")

        # 5. Resolve (naming audit + AI resolution)
        findings, resolutions, metrics = resolve_phase(
            findings, args.target, args.mock_ai, target_files
        )

        # 6b. Propagate finding_type from AI resolutions back to each finding.
        # The AI classifies each unique rule as confirmed/false_positive.
        # Findings whose rule wasn't AI-resolved default to "confirmed".
        for finding in findings:
            rule_id = finding.get("rule_id", "")
            if rule_id in resolutions:
                classification = resolutions[rule_id].get("classification", "confirmed")
            else:
                classification = "confirmed"
            # Preserve scanner designation for findings that already have scanner set
            finding["finding_type"] = classification

        # 7. Git state (used by both formats)
        git_state = get_git_state(args.target)

        # 8. Report — write VexCode + SARIF
        emit_progress("report", "Assembling final report...")
        vexcode_report = assemble_report(
            scan_results, findings, resolutions, args.target, metrics, git_state,
        )

        # 8b. Threshold evaluation (if configured)
        thresholds_path = getattr(args, "thresholds", None)
        if thresholds_path:
            thresholds_config = load_thresholds(thresholds_path)
            passed, violations = evaluate_thresholds(findings, metrics, thresholds_config)
            vexcode_report["thresholds"] = {
                "passed": passed,
                "violations": violations,
                "config": thresholds_config,
            }
            if passed:
                logger.info("Quality gate: PASSED")
            else:
                logger.warning(f"Quality gate: FAILED ({len(violations)} violation(s))")

        # Write primary report
        if getattr(args, "format", "json") == "md":
            md_output = args.output
            json_output = args.output
            if md_output.endswith(".json"):
                md_output = md_output.replace(".json", ".md")
            elif json_output.endswith(".md"):
                json_output = json_output.replace(".md", ".json")
            
            export_markdown(vexcode_report, md_output)
            logger.info(f"Markdown report written: {md_output}")
            # Also write JSON for web UI compatibility
            write_report(vexcode_report, json_output)
            logger.info(f"VexCode JSON report written: {json_output}")
        else:
            write_report(vexcode_report, args.output)
            logger.info(f"VexCode report written: {args.output}")

        if not getattr(args, "no_sarif", False):
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

        # 9. Explain output (if requested)
        if getattr(args, "explain", False):
            thresholds_result = vexcode_report.get("thresholds")
            print_explain(findings, thresholds_result)

        emit_progress("report", "Analysis complete. Report saved.")
        logger.info("Analysis engine executed successfully.")

        # Exit with code 1 if threshold failed and --fail-on-threshold is set
        if getattr(args, "fail_on_threshold", False):
            thresholds_data = vexcode_report.get("thresholds", {})
            if not thresholds_data.get("passed", True):
                logger.warning("Exiting with code 1 due to threshold violation.")
                sys.exit(1)

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
