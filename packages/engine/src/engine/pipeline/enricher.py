import sys
from typing import List

from engine.utils.logger import get_logger
from engine.core.ast_graph import (
    is_gitnexus_available,
    get_repo_info_for_path,
    get_relative_repo_path,
    resolve_location_to_symbol,
    get_symbol_context,
    get_symbol_impact,
    MOCK_AST_CONTEXTS
)

logger = get_logger(__name__)


def enrich_findings(findings: List[dict], target_path: str, use_mock: bool) -> List[dict]:
    """Enrich findings with GitNexus AST context (symbol, callers, blast radius).

    Mutates findings in-place with 'ast_context' key. Returns the same list.
    """
    if not findings:
        return findings

    gitnexus_ok = is_gitnexus_available()
    repo_name = None
    repo_path = None

    if gitnexus_ok:
        repo_name, repo_path = get_repo_info_for_path(target_path)
        if repo_name:
            logger.info(f"GitNexus is available. Target mapped to repo '{repo_name}' "
                  f"at path '{repo_path}'.")
        else:
            logger.info("GitNexus is available, but target path is not registered/indexed. "
                  "Skipping AST enrichment.")
    else:
        logger.info("GitNexus is not available on this system. Skipping AST enrichment.")

    if gitnexus_ok and repo_name and repo_path:
        logger.info("Enriching findings with AST context...")
        for finding in findings:
            file_path = finding.get("file")
            line_number = finding.get("line")
            if not file_path or line_number is None:
                continue

            rel_file = get_relative_repo_path(file_path, target_path, repo_path)
            try:
                line_int = int(line_number)
            except (ValueError, TypeError):
                continue
            symbol = resolve_location_to_symbol(repo_name, rel_file, line_int)

            if symbol:
                symbol_id = symbol.get("id")
                symbol_name = symbol.get("name")
                kind = symbol.get("label")

                context_data = get_symbol_context(repo_name, symbol_id)
                impact_data = get_symbol_impact(repo_name, symbol_id)

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
                if use_mock:
                    try:
                        key = (file_path, int(line_number))
                    except (ValueError, TypeError):
                        continue
                    if key in MOCK_AST_CONTEXTS:
                        finding["ast_context"] = MOCK_AST_CONTEXTS[key]

    elif use_mock:
        logger.info("GitNexus not available/mapped, but using mock AST context for mock scan.")
        for finding in findings:
            try:
                key = (finding.get("file"), int(finding.get("line", 0)))
            except (ValueError, TypeError):
                continue
            if key in MOCK_AST_CONTEXTS:
                finding["ast_context"] = MOCK_AST_CONTEXTS[key]

    return findings