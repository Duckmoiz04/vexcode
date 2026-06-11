"""Tests for pipeline submodules — scanner, enricher, resolver, reporter."""

from unittest.mock import MagicMock


class TestPipelineScanner:
    """Tests for pipeline/scanner.py — run_scan_phase()."""

    def test_run_scan_phase_mock_full_scan(self, mocker):
        """run_scan_phase with use_mock=True, fast=False delegates to run_scan."""
        mock_run_scan = mocker.patch("engine.pipeline.scanner.run_scan")
        from engine.pipeline.scanner import run_scan_phase

        mock_scan_results = {
            "scanner": "semgrep-mock",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": [{
                "file": "test.py", "line": 1, "rule_id": "x.y",
                "message": "msg", "severity": "WARNING",
            }],
        }
        mock_run_scan.return_value = mock_scan_results

        scan_results, target_files = run_scan_phase("/fake/target", use_mock=True, fast=False)

        mock_run_scan.assert_called_once_with("/fake/target", use_mock=True, files=None)
        assert scan_results == mock_scan_results
        assert target_files is None

    def test_run_scan_phase_fast_with_changed_files(self, mocker):
        """run_scan_phase with fast=True and changed files sets scanner to semgrep-fast."""
        mock_detect = mocker.patch("engine.pipeline.scanner._detect_fast_scan_files")
        mock_run_scan = mocker.patch("engine.pipeline.scanner.run_scan")
        from engine.pipeline.scanner import run_scan_phase

        mock_detect.return_value = ["/fake/target/modified.py"]
        mock_scan_results = {
            "scanner": "semgrep-mock",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": [],
        }
        mock_run_scan.return_value = mock_scan_results

        scan_results, target_files = run_scan_phase("/fake/target", use_mock=True, fast=True)

        mock_detect.assert_called_once_with("/fake/target", True)
        mock_run_scan.assert_called_once_with(
            "/fake/target", use_mock=True, files=["/fake/target/modified.py"]
        )
        assert scan_results["scanner"] == "semgrep-fast"
        assert target_files == ["/fake/target/modified.py"]

    def test_run_scan_phase_fast_clean_repo(self, mocker):
        """run_scan_phase with fast=True and clean repo returns empty findings."""
        mocker.patch("engine.pipeline.scanner._detect_fast_scan_files", return_value=[])
        from engine.pipeline.scanner import run_scan_phase

        scan_results, target_files = run_scan_phase("/fake/target", use_mock=True, fast=True)

        assert scan_results["scanner"] == "semgrep-fast"
        assert scan_results["findings"] == []
        assert target_files == []


class TestPipelineEnricher:
    """Tests for pipeline/enricher.py — enrich_findings()."""

    def test_enrich_findings_empty_list(self, mocker):
        """enrich_findings with empty findings returns empty list unchanged."""
        mock_available = mocker.patch("engine.pipeline.enricher.is_gitnexus_available")
        from engine.pipeline.enricher import enrich_findings

        result = enrich_findings([], "/fake/target", use_mock=False)

        assert result == []
        mock_available.assert_not_called()

    def test_enrich_findings_mock_fallback(self, mocker):
        """enrich_findings with use_mock=True and no GitNexus uses MOCK_AST_CONTEXTS."""
        mocker.patch("engine.pipeline.enricher.is_gitnexus_available", return_value=False)
        mocker.patch("engine.pipeline.enricher.MOCK_AST_CONTEXTS", {
            ("test.py", 12): {
                "symbol_id": "Function:test.py:foo",
                "symbol_name": "foo",
                "kind": "Function",
                "source_code": "def foo():\n    pass\n",
                "callers": [],
                "impact": {},
                "blast_radius": [],
            },
        })
        from engine.pipeline.enricher import enrich_findings

        findings = [
            {"file": "test.py", "line": 12, "rule_id": "x.y",
             "message": "msg", "severity": "WARNING"},
        ]

        result = enrich_findings(findings, "/fake/target", use_mock=True)

        assert len(result) == 1
        assert "ast_context" in result[0]
        assert result[0]["ast_context"]["symbol_name"] == "foo"

    def test_enrich_findings_no_gitnexus_no_mock(self, mocker):
        """enrich_findings without GitNexus and without use_mock leaves findings unchanged."""
        mocker.patch("engine.pipeline.enricher.is_gitnexus_available", return_value=False)
        from engine.pipeline.enricher import enrich_findings

        findings = [
            {"file": "test.py", "line": 12, "rule_id": "x.y",
             "message": "msg", "severity": "WARNING"},
        ]

        result = enrich_findings(findings, "/fake/target", use_mock=False)

        assert len(result) == 1
        assert "ast_context" not in result[0]


class TestPipelineResolver:
    """Tests for pipeline/resolver.py — resolve_phase()."""

    def test_resolve_phase_with_findings(self, mocker):
        """resolve_phase with findings returns enriched findings, resolutions, and metrics."""
        mocker.patch("engine.pipeline.resolver.os.walk", return_value=[
            ("/fake/target", [], ["app.py", "utils.py"]),
        ])
        mocker.patch("engine.pipeline.resolver.analyze_file_complexity", return_value={
            "complexity": 5, "cognitive_complexity": 3, "loc": 100,
            "level": "LOW", "functions": [],
        })
        mocker.patch("engine.pipeline.resolver.run_naming_audit", return_value=([], {}))
        mocker.patch("engine.pipeline.resolver.resolve_findings", return_value={
            "test.rule": {"suggestion": "Fix it", "remediation_code": "# fixed"},
        })
        from engine.pipeline.resolver import resolve_phase

        findings = [
            {"file": "app.py", "line": 10, "rule_id": "test.rule",
             "message": "issue", "severity": "ERROR"},
        ]

        result_findings, resolutions, metrics = resolve_phase(
            findings, "/fake/target", use_mock=True, target_files=None,
        )

        assert isinstance(result_findings, list)
        assert isinstance(resolutions, dict)
        assert isinstance(metrics, dict)
        assert "files" in metrics
        assert "app.py" in metrics["files"]
        assert "test.rule" in resolutions

    def test_resolve_phase_no_findings(self, mocker):
        """resolve_phase with no findings returns empty resolutions."""
        mocker.patch("engine.pipeline.resolver.analyze_file_complexity", return_value={
            "complexity": 0, "cognitive_complexity": 0, "loc": 0,
            "level": "LOW", "functions": [],
        })
        mocker.patch("engine.pipeline.resolver.run_naming_audit", return_value=([], {}))
        mock_resolve = mocker.patch("engine.pipeline.resolver.resolve_findings")
        from engine.pipeline.resolver import resolve_phase

        result_findings, resolutions, metrics = resolve_phase(
            [], "/fake/target", use_mock=True, target_files=[],
        )

        assert result_findings == []
        assert resolutions == {}
        mock_resolve.assert_not_called()

    def test_resolve_phase_with_target_files(self, mocker):
        """resolve_phase with target_files uses them directly for complexity analysis."""
        mocker.patch("engine.pipeline.resolver.analyze_file_complexity", return_value={
            "complexity": 3, "cognitive_complexity": 1, "loc": 50,
            "level": "LOW", "functions": [],
        })
        mocker.patch("engine.pipeline.resolver.run_naming_audit", return_value=([], {}))
        mocker.patch("engine.pipeline.resolver.resolve_findings", return_value={})
        from engine.pipeline.resolver import resolve_phase

        target_files = ["/fake/target/modified.py"]

        result_findings, resolutions, metrics = resolve_phase(
            [], "/fake/target", use_mock=True, target_files=target_files,
        )

        assert "modified.py" in metrics["files"]


class TestPipelineReporter:
    """Tests for pipeline/reporter.py — assemble_report()."""

    REQUIRED_KEYS = {"scanner", "timestamp", "target_path", "findings",
                     "ai_resolutions", "git_state", "metrics"}

    def test_assemble_report_all_keys(self, mocker):
        """assemble_report returns dict with all 7 required keys."""
        mocker.patch("engine.pipeline.reporter.get_git_state",
                      return_value={"commit": "abc123", "is_dirty": False})
        from engine.pipeline.reporter import assemble_report

        scan_results = {
            "scanner": "semgrep-mock",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": [{
                "file": "test.py", "line": 1, "rule_id": "x.y",
                "message": "msg", "severity": "WARNING",
            }],
        }
        resolutions = {"x.y": {"suggestion": "Fix it", "remediation_code": "# fixed"}}
        metrics = {
            "files": {"test.py": {
                "complexity": 5, "loc": 100, "level": "LOW", "functions": [],
            }},
        }

        report = assemble_report(
            scan_results, scan_results["findings"], resolutions, "/fake/target", metrics,
        )

        for key in self.REQUIRED_KEYS:
            assert key in report, f"Report missing required key: {key}"
        assert report["scanner"] == "semgrep-mock"
        assert report["timestamp"] == "2026-06-09T00:00:00Z"
        assert report["target_path"] == "/fake/target"
        assert isinstance(report["findings"], list)
        assert isinstance(report["ai_resolutions"], dict)
        assert isinstance(report["metrics"], dict)
        assert isinstance(report["git_state"], dict)

    def test_assemble_report_git_state_none(self, mocker):
        """assemble_report handles None git_state gracefully."""
        mocker.patch("engine.pipeline.reporter.get_git_state", return_value=None)
        from engine.pipeline.reporter import assemble_report

        scan_results = {
            "scanner": "semgrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": [],
        }

        report = assemble_report(
            scan_results, [], {}, "/fake/target", {"files": {}},
        )

        assert report["git_state"] is None
        assert report["scanner"] == "semgrep"

    def test_assemble_report_fallback_timestamp(self, mocker):
        """assemble_report generates timestamp when scan_results lacks one."""
        mocker.patch("engine.pipeline.reporter.get_git_state", return_value=None)
        from engine.pipeline.reporter import assemble_report

        scan_results = {
            "scanner": "semgrep",
            "target_path": "/fake/target",
            "findings": [],
        }

        report = assemble_report(
            scan_results, [], {}, "/fake/target", {"files": {}},
        )

        assert "timestamp" in report
        assert isinstance(report["timestamp"], str)
        assert len(report["timestamp"]) > 0

    def test_assemble_report_fallback_target_path(self, mocker):
        """assemble_report falls back to target arg when scan_results lacks target_path."""
        mocker.patch("engine.pipeline.reporter.get_git_state", return_value=None)
        from engine.pipeline.reporter import assemble_report

        scan_results = {
            "scanner": "semgrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "findings": [],
        }

        report = assemble_report(
            scan_results, [], {}, "/fallback/target", {"files": {}},
        )

        assert report["target_path"] == "/fallback/target"
