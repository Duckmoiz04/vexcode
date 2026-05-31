import argparse
import json
import sys
import os
from datetime import datetime, timezone
from scanner import run_scan
from ai_resolver import resolve_findings
from ast_graph import (
    is_gitnexus_available,
    get_repo_info_for_path,
    get_relative_repo_path,
    resolve_location_to_symbol,
    get_symbol_context,
    get_symbol_impact,
    MOCK_AST_CONTEXTS
)

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
