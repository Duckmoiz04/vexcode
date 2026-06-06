import argparse
import json
import sys
import os
import time
from datetime import datetime, timezone
from scanner import run_scan
from ai_resolver import resolve_findings, run_naming_audit
from complexity import analyze_file_complexity
from ast_graph import (
    is_gitnexus_available,
    get_repo_info_for_path,
    get_relative_repo_path,
    resolve_location_to_symbol,
    get_symbol_context,
    get_symbol_impact,
    MOCK_AST_CONTEXTS
)

import subprocess
from typing import Dict, Any, Optional

def get_git_state(target_dir: str) -> Optional[Dict[str, Any]]:
    try:
        shell = (sys.platform == 'win32')
        res = subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            cwd=target_dir,
            capture_output=True,
            text=True,
            check=False,
            shell=shell
        )
        if res.returncode != 0 or res.stdout.strip() != "true":
            return None
            
        res_commit = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=target_dir,
            capture_output=True,
            text=True,
            check=False,
            shell=shell
        )
        commit_hash = res_commit.stdout.strip() if res_commit.returncode == 0 else None
        
        res_status = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=target_dir,
            capture_output=True,
            text=True,
            check=False,
            shell=shell
        )
        is_dirty = bool(res_status.stdout.strip()) if res_status.returncode == 0 else False
        
        return {
            "commit": commit_hash,
            "is_dirty": is_dirty
        }
    except Exception:
        return None

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
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Runs an incremental scan on modified and untracked files in the Git working directory."
    )
    parser.add_argument(
        "--re-resolve",
        type=str,
        default=None,
        metavar="REPORT_PATH",
        help="Re-run AI resolution on an existing report without re-scanning. Updates ai_resolutions in-place."
    )

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
        resolutions = resolve_findings(findings, use_mock=args.mock_ai)
        existing_report["ai_resolutions"] = resolutions
        existing_report["re_resolved_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(existing_report, f, indent=2, ensure_ascii=False)
        print(f"AI resolutions updated in: {report_path}", file=sys.stderr)
        sys.exit(0)


    print(f"Starting analysis on target: {args.target}", file=sys.stderr)
    
    try:
        # Resolve target files if fast scan is requested
        target_files = None
        if args.fast:
            if args.mock_scan:
                # For mock testing, pretend example.py is modified
                target_files = [os.path.join(args.target, "example.py")]
                print(f"[Mock] Fast Scan: Pretending 'example.py' is modified.", file=sys.stderr)
            else:
                print("Fast Scan requested. Detecting changed files...", file=sys.stderr)
                git_state = get_git_state(args.target)
                if git_state:
                    shell = (sys.platform == 'win32')
                    res = subprocess.run(
                        ["git", "status", "--porcelain"],
                        cwd=args.target,
                        capture_output=True,
                        text=True,
                        check=False,
                        shell=shell
                    )
                    if res.returncode == 0:
                        changed_files = []
                        for line in res.stdout.splitlines():
                            line = line.strip()
                            if not line:
                                continue
                            parts = line.split(None, 1)
                            if len(parts) > 1:
                                rel_file = parts[1].strip('"').strip()
                                abs_file = os.path.abspath(os.path.join(args.target, rel_file))
                                if os.path.isfile(abs_file):
                                    changed_files.append(abs_file)
                                    
                        if not changed_files:
                            print("No changes detected in Git repository. Codebase is clean.", file=sys.stderr)
                            target_files = []
                        else:
                            print(f"Detected {len(changed_files)} changed file(s) in Git.", file=sys.stderr)
                            target_files = changed_files
                else:
                    print("No Git repository detected. Falling back to Full Scan...", file=sys.stderr)

        # 1. Run static security scanning
        if target_files == []:
            scan_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            scan_results = {
                "scanner": "semgrep-fast",
                "timestamp": scan_time,
                "target_path": args.target,
                "findings": []
            }
        else:
            scan_results = run_scan(args.target, use_mock=args.mock_scan, files=target_files)
            if target_files is not None:
                scan_results["scanner"] = "semgrep-fast"
                
        findings = scan_results.get("findings", [])
        
        print(f"Scan complete. Found {len(findings)} finding(s).", file=sys.stderr)
        
        # Check GitNexus availability and map repo
        gitnexus_ok = is_gitnexus_available()
        repo_name = None
        repo_path = None
        if gitnexus_ok:
            repo_name, repo_path = get_repo_info_for_path(args.target)
            if repo_name:
                print(f"GitNexus is available. Target mapped to repo '{repo_name}' at path '{repo_path}'.", file=sys.stderr)
            else:
                print("GitNexus is available, but target path is not registered/indexed. Skipping AST enrichment.", file=sys.stderr)
        else:
            print("GitNexus is not available on this system. Skipping AST enrichment.", file=sys.stderr)
            
        # Enrich findings with AST context
        if findings:
            if gitnexus_ok and repo_name and repo_path:
                print("Enriching findings with AST context...", file=sys.stderr)
                for finding in findings:
                    file_path = finding.get("file")
                    line_number = finding.get("line")
                    if not file_path or line_number is None:
                        continue
                    
                    # Get relative path for Cypher query
                    rel_file = get_relative_repo_path(file_path, args.target, repo_path)
                    
                    # Resolve symbol
                    symbol = resolve_location_to_symbol(repo_name, rel_file, int(line_number))
                    if symbol:
                        symbol_id = symbol.get("id")
                        symbol_name = symbol.get("name")
                        kind = symbol.get("label")
                        
                        # Fetch context and impact
                        context_data = get_symbol_context(repo_name, symbol_id)
                        impact_data = get_symbol_impact(repo_name, symbol_id)
                        
                        # Extract callers from context_data
                        incoming_data = context_data.get("incoming", {})
                        callers = []
                        for rel_type, nodes in incoming_data.items():
                            if isinstance(nodes, list):
                                for node in nodes:
                                    callers.append({
                                        "uid": node.get("uid") or node.get("id"),
                                        "name": node.get("name"),
                                        "filePath": node.get("filePath"),
                                        "relation": rel_type
                                    })
                                    
                        # Extract blast radius from impact_data
                        blast_radius = []
                        by_depth = impact_data.get("byDepth", {})
                        for depth_str, nodes in by_depth.items():
                            if isinstance(nodes, list):
                                for node in nodes:
                                    blast_radius.append({
                                        "uid": node.get("id") or node.get("uid"),
                                        "name": node.get("name"),
                                        "filePath": node.get("filePath"),
                                        "depth": node.get("depth"),
                                        "relation": node.get("relationType")
                                    })
                                    
                        finding["ast_context"] = {
                            "symbol_id": symbol_id,
                            "symbol_name": symbol_name,
                            "kind": kind,
                            "source_code": context_data.get("symbol", {}).get("content"),
                            "callers": callers,
                            "impact": impact_data,
                            "blast_radius": blast_radius
                        }
                    else:
                        # Fallback to mock context if mock-scan is requested
                        if args.mock_scan:
                            key = (file_path, int(line_number))
                            if key in MOCK_AST_CONTEXTS:
                                finding["ast_context"] = MOCK_AST_CONTEXTS[key]
            elif args.mock_scan:
                print("GitNexus not available/mapped, but using mock AST context for mock scan.", file=sys.stderr)
                for finding in findings:
                    key = (finding.get("file"), int(finding.get("line", 0)))
                    if key in MOCK_AST_CONTEXTS:
                        finding["ast_context"] = MOCK_AST_CONTEXTS[key]
                        
        # Calculate complexity metrics for all relevant source files
        print("Calculating file complexity metrics with Lizard...", file=sys.stderr)
        metrics = {"files": {}}
        source_files = []
        if target_files:
            source_files = target_files
        else:
            # Walk directory to find files (limit to 100 files to avoid performance bottleneck)
            ignored_dirs = {".git", "node_modules", ".venv", "__pycache__", "dist", "build", "public", ".gemini", ".gitnexus"}
            valid_exts = {".py", ".js", ".jsx", ".ts", ".tsx"}
            for root, dirs, files in os.walk(args.target):
                dirs[:] = [d for d in dirs if d not in ignored_dirs]
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext in valid_exts:
                        full_path = os.path.join(root, file)
                        source_files.append(full_path)
                        if len(source_files) >= 100:
                            break
                if len(source_files) >= 100:
                    break
                    
        for f_path in source_files:
            rel_path = os.path.relpath(f_path, args.target).replace("\\", "/")
            metrics["files"][rel_path] = analyze_file_complexity(f_path)
            
        # Run AI Naming Quality Audit
        print("Auditing code naming quality...", file=sys.stderr)
        # Exclude framework/tool directories from naming audit — focus on user project code only
        NAMING_AUDIT_SKIP_DIRS = {".agents", ".claude", ".codex", "process", ".venv", "node_modules", "__pycache__"}
        def is_user_code(path: str) -> bool:
            rel = os.path.relpath(path, args.target)
            parts = rel.replace("\\", "/").split("/")
            return not any(p in NAMING_AUDIT_SKIP_DIRS for p in parts)

        finding_files = [os.path.join(args.target, f.get("file")) for f in findings if f.get("file")]
        all_audit_candidates = list(set(finding_files + source_files[:5]))
        files_to_audit = [p for p in all_audit_candidates if is_user_code(p)]
        naming_findings, naming_resolutions = run_naming_audit(files_to_audit, args.target, use_mock=args.mock_ai)
        
        # Merge naming findings into main findings list
        findings.extend(naming_findings)

        # 2. Query AI resolutions for the findings
        resolutions = {}
        if findings:
            # Cooldown: let 9router recover from naming audit requests before the resolution call
            if not args.mock_ai and files_to_audit:
                print("Cooling down 15s before AI resolution to avoid rate limiting...", file=sys.stderr)
                time.sleep(15)
            print("Resolving findings with AI...", file=sys.stderr)
            resolutions = resolve_findings(findings, use_mock=args.mock_ai)
            # Merge naming resolutions
            resolutions.update(naming_resolutions)
        else:
            print("No findings to resolve.", file=sys.stderr)
            
        # 3. Assemble unified output report
        report = {
            "scanner": scan_results.get("scanner", "unknown"),
            "timestamp": scan_results.get("timestamp", datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")),
            "target_path": scan_results.get("target_path", args.target),
            "findings": findings,
            "ai_resolutions": resolutions,
            "git_state": get_git_state(args.target),
            "metrics": metrics
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
