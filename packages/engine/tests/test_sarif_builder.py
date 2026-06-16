"""Unit tests for pipeline/sarif_builder.py."""
import pytest
from engine.pipeline.sarif_builder import build_sarif, SEVERITY_TO_LEVEL, _compute_finding_id


SCAN_RESULTS = {
    "scanner": "opengrep-mock",
    "timestamp": "2026-06-09T00:00:00Z",
    "target_path": "/fake/target",
    "findings": [],
}


class TestBuildSarif:
    """Core SARIF document structure."""

    def test_empty_findings_produces_valid_sarif(self):
        sarif = build_sarif(SCAN_RESULTS, [], {}, "/fake/target", {"files": {}})
        assert sarif["version"] == "2.1.0"
        assert "$schema" in sarif
        assert len(sarif["runs"]) == 1
        run = sarif["runs"][0]
        assert run["tool"]["driver"]["name"] == "opengrep-mock"
        assert run["results"] == []
        assert run["tool"]["driver"]["rules"] == []

    def test_metrics_in_properties(self):
        metrics = {"files": {"test.py": {"complexity": 5, "loc": 100}}}
        sarif = build_sarif(SCAN_RESULTS, [], {}, "/fake/target", metrics)
        run = sarif["runs"][0]
        assert run["properties"]["metrics"] == metrics

    def test_invocation_uses_scan_timestamp(self):
        sarif = build_sarif(SCAN_RESULTS, [], {}, "/fake/target", {"files": {}})
        inv = sarif["runs"][0]["invocations"][0]
        assert inv["endTimeUtc"] == "2026-06-09T00:00:00Z"
        assert inv["executionSuccessful"] is True

    def test_original_uri_base_ids(self):
        sarif = build_sarif(SCAN_RESULTS, [], {}, "/fake/target", {"files": {}})
        uri = sarif["runs"][0]["originalUriBaseIds"]["SRCROOT"]["uri"]
        assert "fake/target" in uri


class TestSeverityMapping:
    """Severity → SARIF level mapping."""

    def _make_result(self, severity):
        findings = [{"file": "a.py", "line": 1, "rule_id": "r", "message": "m", "severity": severity}]
        sarif = build_sarif(SCAN_RESULTS, findings, {}, "/t", {"files": {}})
        return sarif["runs"][0]["results"][0]

    def test_error_maps_to_error(self):
        assert self._make_result("error")["level"] == "error"

    def test_warning_maps_to_warning(self):
        assert self._make_result("warning")["level"] == "warning"

    def test_info_maps_to_note(self):
        assert self._make_result("info")["level"] == "note"


class TestRulesDedup:
    """Rules array deduplicates by rule_id."""

    def test_duplicate_rules_deduplicated(self):
        findings = [
            {"file": "a.py", "line": 1, "rule_id": "r1", "message": "m1", "severity": "error"},
            {"file": "b.py", "line": 2, "rule_id": "r1", "message": "m1", "severity": "error"},
            {"file": "c.py", "line": 3, "rule_id": "r2", "message": "m2", "severity": "warning"},
        ]
        sarif = build_sarif(SCAN_RESULTS, findings, {}, "/t", {"files": {}})
        rules = sarif["runs"][0]["tool"]["driver"]["rules"]
        assert len(rules) == 2
        assert {r["id"] for r in rules} == {"r1", "r2"}


class TestCweTaxonomy:
    """CWE ID → taxa mapping."""

    def test_cwe_id_present(self):
        findings = [{"file": "a.py", "line": 1, "rule_id": "r", "message": "m",
                      "severity": "error", "cwe_id": "CWE-79"}]
        sarif = build_sarif(SCAN_RESULTS, findings, {}, "/t", {"files": {}})
        result = sarif["runs"][0]["results"][0]
        assert result["taxa"] == [{"id": "CWE-79", "toolComponent": {"name": "CWE"}}]

    def test_cwe_id_absent(self):
        findings = [{"file": "a.py", "line": 1, "rule_id": "r", "message": "m", "severity": "error"}]
        sarif = build_sarif(SCAN_RESULTS, findings, {}, "/t", {"files": {}})
        result = sarif["runs"][0]["results"][0]
        assert "taxa" not in result


class TestAstContext:
    """AST context → relatedLocations mapping."""

    def test_ast_context_creates_related_locations(self):
        findings = [{
            "file": "a.py", "line": 1, "rule_id": "r", "message": "m",
            "severity": "error",
            "ast_context": {"symbol_name": "handle_auth", "kind": "function", "source_code": "def handle_auth():"}
        }]
        sarif = build_sarif(SCAN_RESULTS, findings, {}, "/t", {"files": {}})
        result = sarif["runs"][0]["results"][0]
        assert "relatedLocations" in result
        loc = result["relatedLocations"][0]
        assert loc["logicalLocations"][0]["name"] == "handle_auth"
        assert loc["logicalLocations"][0]["kind"] == "function"

    def test_no_ast_context_no_related_locations(self):
        findings = [{"file": "a.py", "line": 1, "rule_id": "r", "message": "m", "severity": "error"}]
        sarif = build_sarif(SCAN_RESULTS, findings, {}, "/t", {"files": {}})
        result = sarif["runs"][0]["results"][0]
        assert "relatedLocations" not in result


class TestFixes:
    """AI resolution → fixes mapping."""

    def test_remediation_code_creates_fixes(self):
        findings = [{"file": "a.py", "line": 10, "rule_id": "r", "message": "m", "severity": "error"}]
        resolutions = {"r": {"suggestion": "Fix it", "remediation_code": "safe_code()"}}
        sarif = build_sarif(SCAN_RESULTS, findings, resolutions, "/t", {"files": {}})
        result = sarif["runs"][0]["results"][0]
        assert "fixes" in result
        fix = result["fixes"][0]
        change = fix["artifactChanges"][0]
        assert change["artifactLocation"]["uri"] == "a.py"
        assert change["replacements"][0]["insertedContent"]["text"] == "safe_code()"

    def test_ai_resolution_in_properties(self):
        findings = [{"file": "a.py", "line": 1, "rule_id": "r", "message": "m", "severity": "error"}]
        resolutions = {"r": {"suggestion": "Fix it"}}
        sarif = build_sarif(SCAN_RESULTS, findings, resolutions, "/t", {"files": {}})
        result = sarif["runs"][0]["results"][0]
        assert result["properties"]["aiResolution"] == {"suggestion": "Fix it"}


class TestVersionControl:
    """Git state → versionControlProvenance."""

    def test_git_state_present(self):
        git_state = {"commit": "abc123", "is_dirty": True}
        sarif = build_sarif(SCAN_RESULTS, [], {}, "/t", {"files": {}}, git_state=git_state)
        run = sarif["runs"][0]
        assert "versionControlProvenance" in run
        vcp = run["versionControlProvenance"][0]
        assert vcp["revisionId"] == "abc123"
        assert vcp["properties"]["isDirty"] is True

    def test_git_state_none(self):
        sarif = build_sarif(SCAN_RESULTS, [], {}, "/t", {"files": {}}, git_state=None)
        run = sarif["runs"][0]
        assert "versionControlProvenance" not in run


class TestFindingStatus:
    """Per-finding status and id in SARIF properties."""

    def test_default_status_is_open(self):
        findings = [{"file": "a.py", "line": 1, "rule_id": "r", "message": "m", "severity": "error"}]
        sarif = build_sarif(SCAN_RESULTS, findings, {}, "/t", {"files": {}})
        props = sarif["runs"][0]["results"][0]["properties"]
        assert props["status"] == "open"

    def test_status_preserved_from_finding(self):
        findings = [{"file": "a.py", "line": 1, "rule_id": "r", "message": "m",
                      "severity": "error", "status": "false_positive"}]
        sarif = build_sarif(SCAN_RESULTS, findings, {}, "/t", {"files": {}})
        props = sarif["runs"][0]["results"][0]["properties"]
        assert props["status"] == "false_positive"

    def test_finding_id_is_present(self):
        findings = [{"file": "a.py", "line": 1, "rule_id": "r", "message": "m", "severity": "error"}]
        sarif = build_sarif(SCAN_RESULTS, findings, {}, "/t", {"files": {}})
        props = sarif["runs"][0]["results"][0]["properties"]
        assert "id" in props
        assert len(props["id"]) == 12

    def test_finding_id_is_stable(self):
        f = {"file": "a.py", "line": 10, "rule_id": "xss"}
        id1 = _compute_finding_id(f)
        id2 = _compute_finding_id(f)
        assert id1 == id2

    def test_finding_id_differs_for_different_findings(self):
        id1 = _compute_finding_id({"file": "a.py", "line": 1, "rule_id": "r1"})
        id2 = _compute_finding_id({"file": "a.py", "line": 2, "rule_id": "r1"})
        assert id1 != id2
