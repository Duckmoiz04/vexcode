import unittest
import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class TestPipelineScanner(unittest.TestCase):
    """Tests for pipeline/scanner.py — run_scan_phase()."""

    @patch("pipeline.scanner.run_scan")
    def test_run_scan_phase_mock_full_scan(self, mock_run_scan):
        """run_scan_phase with use_mock=True, fast=False delegates to run_scan."""
        from pipeline.scanner import run_scan_phase

        mock_scan_results = {
            "scanner": "semgrep-mock",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": [{"file": "test.py", "line": 1, "rule_id": "x.y", "message": "msg", "severity": "WARNING"}]
        }
        mock_run_scan.return_value = mock_scan_results

        scan_results, target_files = run_scan_phase("/fake/target", use_mock=True, fast=False)

        mock_run_scan.assert_called_once_with("/fake/target", use_mock=True, files=None)
        self.assertEqual(scan_results, mock_scan_results)
        self.assertIsNone(target_files)

    @patch("pipeline.scanner.run_scan")
    @patch("pipeline.scanner._detect_fast_scan_files")
    def test_run_scan_phase_fast_with_changed_files(self, mock_detect, mock_run_scan):
        """run_scan_phase with fast=True and changed files sets scanner to semgrep-fast."""
        from pipeline.scanner import run_scan_phase

        mock_detect.return_value = ["/fake/target/modified.py"]
        mock_scan_results = {
            "scanner": "semgrep-mock",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": []
        }
        mock_run_scan.return_value = mock_scan_results

        scan_results, target_files = run_scan_phase("/fake/target", use_mock=True, fast=True)

        mock_detect.assert_called_once_with("/fake/target", True)
        mock_run_scan.assert_called_once_with("/fake/target", use_mock=True, files=["/fake/target/modified.py"])
        self.assertEqual(scan_results["scanner"], "semgrep-fast")
        self.assertEqual(target_files, ["/fake/target/modified.py"])

    @patch("pipeline.scanner._detect_fast_scan_files")
    def test_run_scan_phase_fast_clean_repo(self, mock_detect):
        """run_scan_phase with fast=True and clean repo returns empty findings."""
        from pipeline.scanner import run_scan_phase

        mock_detect.return_value = []

        scan_results, target_files = run_scan_phase("/fake/target", use_mock=True, fast=True)

        self.assertEqual(scan_results["scanner"], "semgrep-fast")
        self.assertEqual(scan_results["findings"], [])
        self.assertEqual(target_files, [])


class TestPipelineEnricher(unittest.TestCase):
    """Tests for pipeline/enricher.py — enrich_findings()."""

    @patch("pipeline.enricher.is_gitnexus_available")
    def test_enrich_findings_empty_list(self, mock_available):
        """enrich_findings with empty findings returns empty list unchanged."""
        from pipeline.enricher import enrich_findings

        result = enrich_findings([], "/fake/target", use_mock=False)

        self.assertEqual(result, [])
        mock_available.assert_not_called()

    @patch("pipeline.enricher.MOCK_AST_CONTEXTS", {
        ("test.py", 12): {
            "symbol_id": "Function:test.py:foo",
            "symbol_name": "foo",
            "kind": "Function",
            "source_code": "def foo():\n    pass\n",
            "callers": [],
            "impact": {},
            "blast_radius": []
        }
    })
    @patch("pipeline.enricher.is_gitnexus_available")
    def test_enrich_findings_mock_fallback(self, mock_available):
        """enrich_findings with use_mock=True and no GitNexus uses MOCK_AST_CONTEXTS."""
        from pipeline.enricher import enrich_findings

        mock_available.return_value = False

        findings = [
            {"file": "test.py", "line": 12, "rule_id": "x.y", "message": "msg", "severity": "WARNING"}
        ]

        result = enrich_findings(findings, "/fake/target", use_mock=True)

        self.assertEqual(len(result), 1)
        self.assertIn("ast_context", result[0])
        self.assertEqual(result[0]["ast_context"]["symbol_name"], "foo")

    @patch("pipeline.enricher.is_gitnexus_available")
    def test_enrich_findings_no_gitnexus_no_mock(self, mock_available):
        """enrich_findings without GitNexus and without use_mock leaves findings unchanged."""
        from pipeline.enricher import enrich_findings

        mock_available.return_value = False

        findings = [
            {"file": "test.py", "line": 12, "rule_id": "x.y", "message": "msg", "severity": "WARNING"}
        ]

        result = enrich_findings(findings, "/fake/target", use_mock=False)

        self.assertEqual(len(result), 1)
        self.assertNotIn("ast_context", result[0])


class TestPipelineResolver(unittest.TestCase):
    """Tests for pipeline/resolver.py — resolve_phase()."""

    @patch("pipeline.resolver.run_naming_audit")
    @patch("pipeline.resolver.resolve_findings")
    @patch("pipeline.resolver.analyze_file_complexity")
    @patch("pipeline.resolver.os.walk")
    def test_resolve_phase_with_findings(self, mock_walk, mock_complexity,
                                          mock_resolve, mock_naming):
        """resolve_phase with findings returns enriched findings, resolutions, and metrics."""
        from pipeline.resolver import resolve_phase

        mock_walk.return_value = [
            ("/fake/target", [], ["app.py", "utils.py"])
        ]
        mock_complexity.return_value = {
            "complexity": 5,
            "cognitive_complexity": 3,
            "loc": 100,
            "level": "LOW",
            "functions": []
        }
        mock_naming.return_value = ([], {})
        mock_resolve.return_value = {"test.rule": {"suggestion": "Fix it", "remediation_code": "# fixed"}}

        findings = [
            {"file": "app.py", "line": 10, "rule_id": "test.rule", "message": "issue", "severity": "ERROR"}
        ]

        result_findings, resolutions, metrics = resolve_phase(
            findings, "/fake/target", use_mock=True, target_files=None
        )

        self.assertIsInstance(result_findings, list)
        self.assertIsInstance(resolutions, dict)
        self.assertIsInstance(metrics, dict)
        self.assertIn("files", metrics)
        self.assertIn("app.py", metrics["files"])
        self.assertIn("test.rule", resolutions)

    @patch("pipeline.resolver.run_naming_audit")
    @patch("pipeline.resolver.resolve_findings")
    @patch("pipeline.resolver.analyze_file_complexity")
    def test_resolve_phase_no_findings(self, mock_complexity, mock_resolve, mock_naming):
        """resolve_phase with no findings returns empty resolutions."""
        from pipeline.resolver import resolve_phase

        mock_complexity.return_value = {
            "complexity": 0,
            "cognitive_complexity": 0,
            "loc": 0,
            "level": "LOW",
            "functions": []
        }
        mock_naming.return_value = ([], {})

        result_findings, resolutions, metrics = resolve_phase(
            [], "/fake/target", use_mock=True, target_files=[]
        )

        self.assertEqual(result_findings, [])
        self.assertEqual(resolutions, {})
        mock_resolve.assert_not_called()

    @patch("pipeline.resolver.run_naming_audit")
    @patch("pipeline.resolver.resolve_findings")
    @patch("pipeline.resolver.analyze_file_complexity")
    def test_resolve_phase_with_target_files(self, mock_complexity, mock_resolve, mock_naming):
        """resolve_phase with target_files uses them directly for complexity analysis."""
        from pipeline.resolver import resolve_phase

        mock_complexity.return_value = {
            "complexity": 3,
            "cognitive_complexity": 1,
            "loc": 50,
            "level": "LOW",
            "functions": []
        }
        mock_naming.return_value = ([], {})
        mock_resolve.return_value = {}

        target_files = ["/fake/target/modified.py"]

        result_findings, resolutions, metrics = resolve_phase(
            [], "/fake/target", use_mock=True, target_files=target_files
        )

        self.assertIn("modified.py", metrics["files"])


class TestPipelineReporter(unittest.TestCase):
    """Tests for pipeline/reporter.py — assemble_report()."""

    REQUIRED_KEYS = {"scanner", "timestamp", "target_path", "findings",
                      "ai_resolutions", "git_state", "metrics"}

    @patch("pipeline.reporter.get_git_state")
    def test_assemble_report_all_keys(self, mock_git_state):
        """assemble_report returns dict with all 7 required keys."""
        from pipeline.reporter import assemble_report

        mock_git_state.return_value = {"commit": "abc123", "is_dirty": False}

        scan_results = {
            "scanner": "semgrep-mock",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": [{"file": "test.py", "line": 1, "rule_id": "x.y", "message": "msg", "severity": "WARNING"}]
        }
        findings = scan_results["findings"]
        resolutions = {"x.y": {"suggestion": "Fix it", "remediation_code": "# fixed"}}
        metrics = {"files": {"test.py": {"complexity": 5, "loc": 100, "level": "LOW", "functions": []}}}

        report = assemble_report(scan_results, findings, resolutions, "/fake/target", metrics)

        for key in self.REQUIRED_KEYS:
            self.assertIn(key, report, f"Report missing required key: {key}")

        self.assertEqual(report["scanner"], "semgrep-mock")
        self.assertEqual(report["timestamp"], "2026-06-09T00:00:00Z")
        self.assertEqual(report["target_path"], "/fake/target")
        self.assertIsInstance(report["findings"], list)
        self.assertIsInstance(report["ai_resolutions"], dict)
        self.assertIsInstance(report["metrics"], dict)
        self.assertIsInstance(report["git_state"], dict)

    @patch("pipeline.reporter.get_git_state")
    def test_assemble_report_git_state_none(self, mock_git_state):
        """assemble_report handles None git_state gracefully."""
        from pipeline.reporter import assemble_report

        mock_git_state.return_value = None

        scan_results = {
            "scanner": "semgrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": []
        }

        report = assemble_report(scan_results, [], {}, "/fake/target", {"files": {}})

        self.assertIsNone(report["git_state"])
        self.assertEqual(report["scanner"], "semgrep")

    @patch("pipeline.reporter.get_git_state")
    def test_assemble_report_fallback_timestamp(self, mock_git_state):
        """assemble_report generates timestamp when scan_results lacks one."""
        from pipeline.reporter import assemble_report

        mock_git_state.return_value = None

        scan_results = {
            "scanner": "semgrep",
            "target_path": "/fake/target",
            "findings": []
        }

        report = assemble_report(scan_results, [], {}, "/fake/target", {"files": {}})

        self.assertIn("timestamp", report)
        self.assertIsInstance(report["timestamp"], str)
        self.assertTrue(len(report["timestamp"]) > 0)

    @patch("pipeline.reporter.get_git_state")
    def test_assemble_report_fallback_target_path(self, mock_git_state):
        """assemble_report falls back to target arg when scan_results lacks target_path."""
        from pipeline.reporter import assemble_report

        mock_git_state.return_value = None

        scan_results = {
            "scanner": "semgrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "findings": []
        }

        report = assemble_report(scan_results, [], {}, "/fallback/target", {"files": {}})

        self.assertEqual(report["target_path"], "/fallback/target")


if __name__ == "__main__":
    unittest.main()