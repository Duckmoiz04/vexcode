"""Build SARIF 2.1.0 documents from VexCode pipeline data.

Reference: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
"""
from engine.config.iso25010_taxonomy import compute_finding_id
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from engine.core.finding_status import DEFAULT_STATUS

SARIF_SCHEMA = (
    "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/"
    "main/sarif-2.1/schema/sarif-schema-2.1.0.json"
)

SEVERITY_TO_LEVEL: Dict[str, str] = {
    "error": "error",
    "warning": "warning",
    "info": "note",
}


def build_sarif(
    scan_results: Dict[str, Any],
    findings: List[dict],
    resolutions: dict,
    target: str,
    metrics: Dict[str, Any],
    git_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a SARIF 2.1.0 document from internal pipeline data."""
    rules = _build_rules(findings)
    results = _build_results(findings, resolutions)
    invocation = _build_invocation(scan_results, target)
    vcp = _build_version_control(git_state)
    run: Dict[str, Any] = {
        "tool": {
            "driver": {
                "name": scan_results.get("scanner", "unknown"),
                "rules": rules,
            }
        },
        "results": results,
        "invocations": [invocation],
        "originalUriBaseIds": {
            "SRCROOT": {"uri": "file:///" + target.replace("\\", "/").lstrip("/")}
        },
        "properties": {"metrics": metrics or {"files": {}}},
    }
    if vcp:
        run["versionControlProvenance"] = [vcp]
    return {"$schema": SARIF_SCHEMA, "version": "2.1.0", "runs": [run]}


# ── helpers ──────────────────────────────────────────────────────────────────


def _build_rules(findings: List[dict]) -> List[dict]:
    seen: set = set()
    rules: List[dict] = []
    for f in findings:
        rid = f.get("rule_id")
        if rid and rid not in seen:
            seen.add(rid)
            rules.append({"id": rid, "shortDescription": {"text": f.get("message", "")}})
    return rules


def _build_results(findings: List[dict], resolutions: dict) -> List[dict]:
    results: List[dict] = []
    for f in findings:
        rule_id = f.get("rule_id", "unknown")
        level = SEVERITY_TO_LEVEL.get(f.get("severity", "warning"), "warning")
        # Stable finding ID: hash of (file, line, rule_id)
        finding_id = _compute_finding_id(f)

        result: Dict[str, Any] = {
            "ruleId": rule_id,
            "level": level,
            "message": {"text": f.get("message", "")},
            "locations": [_build_location(f)],
            "properties": {
                "_applied": bool(f.get("_applied")),
                "id": finding_id,
                "status": f.get("status") or DEFAULT_STATUS,
            },
        }

        # CWE taxonomy
        cwe_id = f.get("cwe_id")
        if cwe_id:
            result["taxa"] = [{"id": cwe_id, "toolComponent": {"name": "CWE"}}]

        # AST context → relatedLocations
        ast = f.get("ast_context")
        if ast:
            rel_locs = _build_related_locations(ast)
            if rel_locs:
                result["relatedLocations"] = rel_locs

        # AI resolution → properties + fixes
        ai_res = resolutions.get(rule_id)
        if ai_res:
            result["properties"]["aiResolution"] = ai_res
            remediation_code = ai_res.get("remediation_code")
            if remediation_code:
                result["fixes"] = _build_fixes(f, remediation_code)

        results.append(result)
    return results


def _compute_finding_id(f: dict) -> str:
    """Compute a stable hash ID from (file, line, rule_id).

    Delegates to the canonical ``compute_finding_id`` in iso25010_taxonomy
    so that VexCode internal IDs and SARIF IDs are always consistent.
    """
    return compute_finding_id(
        str(f.get('file', '')),
        int(f.get('line', 0)),
        str(f.get('rule_id', '')),
    )


def _build_location(f: dict) -> dict:
    region: Dict[str, Any] = {}
    line = f.get("line")
    if line is not None:
        region["startLine"] = int(line)
    code_text = f.get("code_text")
    if code_text:
        region["snippet"] = {"text": code_text}
    return {
        "physicalLocation": {
            "artifactLocation": {"uri": f.get("file", "")},
            **({"region": region} if region else {}),
        }
    }


def _build_related_locations(ast: dict) -> List[dict]:
    locs: List[dict] = []
    symbol_name = ast.get("symbol_name")
    kind = ast.get("kind")
    if symbol_name or kind:
        loc: Dict[str, Any] = {"logicalLocations": [{"name": symbol_name or "", "kind": kind or ""}]}
        source_code = ast.get("source_code")
        if source_code:
            loc["physicalLocation"] = {
                "artifactLocation": {"uri": ""},
                "region": {"snippet": {"text": source_code}},
            }
        locs.append(loc)
    return locs


def _build_fixes(f: dict, remediation_code: str) -> List[dict]:
    line = f.get("line")
    deleted_region: Dict[str, Any] = {}
    if line is not None:
        deleted_region["startLine"] = int(line)
        deleted_region["startColumn"] = 1
    return [
        {
            "description": {"text": f"AI fix for {f.get('rule_id', '')}"},
            "artifactChanges": [
                {
                    "artifactLocation": {"uri": f.get("file", "")},
                    "replacements": [
                        {
                            **({"deletedRegion": deleted_region} if deleted_region else {}),
                            "insertedContent": {"text": remediation_code},
                        }
                    ],
                }
            ],
        }
    ]


def _build_invocation(scan_results: dict, target: str) -> dict:
    timestamp = scan_results.get("timestamp")
    if not timestamp:
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "executionSuccessful": True,
        "endTimeUtc": timestamp,
        "workingDirectory": {"uri": "file:///" + target.replace("\\", "/").lstrip("/")},
    }


def _build_version_control(git_state: Optional[dict]) -> Optional[dict]:
    """Build SARIF versionControlProvenance from git_state dict."""
    if not git_state:
        return None
    return {
        "repositoryUri": "",
        "revisionId": git_state.get("commit") or "",
        "properties": {"isDirty": bool(git_state.get("is_dirty"))},
    }
