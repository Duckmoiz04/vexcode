"""Tests for pipeline submodules — scanner, enricher, resolver, reporter."""

import json
import pytest
from unittest.mock import MagicMock


class TestPipelineScanner:
    """Tests for pipeline/scanner.py — run_scan_phase()."""

    def test_run_scan_phase_mock_full_scan(self, mocker):
        """run_scan_phase with use_mock=True, fast=False delegates to run_scan."""
        mock_run_scan = mocker.patch("engine.pipeline.scanner.run_scan")
        from engine.pipeline.scanner import run_scan_phase

        mock_scan_results = {
            "scanner": "opengrep-mock",
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
        """run_scan_phase with fast=True and changed files sets scanner to opengrep-fast."""
        mock_detect = mocker.patch("engine.pipeline.scanner._detect_fast_scan_files")
        mock_run_scan = mocker.patch("engine.pipeline.scanner.run_scan")
        from engine.pipeline.scanner import run_scan_phase

        mock_detect.return_value = ["/fake/target/modified.py"]
        mock_scan_results = {
            "scanner": "opengrep-mock",
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
        assert scan_results["scanner"] == "opengrep-fast"
        assert target_files == ["/fake/target/modified.py"]

    def test_run_scan_phase_fast_clean_repo(self, mocker):
        """run_scan_phase with fast=True and clean repo returns empty findings."""
        mocker.patch("engine.pipeline.scanner._detect_fast_scan_files", return_value=[])
        from engine.pipeline.scanner import run_scan_phase

        scan_results, target_files = run_scan_phase("/fake/target", use_mock=True, fast=True)

        assert scan_results["scanner"] == "opengrep-fast"
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


class TestPipelineDualOutput:
    """Tests for the dual-output architecture: VexCode .json + SARIF .sarif sidecar."""

    def test_run_analysis_writes_both_json_and_sarif(self, mocker, tmp_path):
        """A full scan writes a VexCode .json AND a SARIF 2.1.0 .sarif sidecar."""
        from engine.__main__ import run_analysis
        from argparse import Namespace

        # Mock the entire pipeline
        mocker.patch("engine.pipeline.scanner.run_scan_phase", return_value=(
            {
                "scanner": "opengrep-mock",
                "timestamp": "2026-06-09T00:00:00Z",
                "target_path": "/fake/target",
                "findings": [{
                    "file": "test.py", "line": 1, "rule_id": "x.y",
                    "message": "msg", "severity": "WARNING",
                }],
            },
            None,
        ))
        mocker.patch("engine.pipeline.enricher.enrich_findings", side_effect=lambda f, *a, **kw: f)
        mocker.patch("engine.core.dedup.deduplicate_findings", side_effect=lambda f: f)
        mocker.patch("engine.pipeline.resolver.resolve_phase", return_value=(
            [{"file": "test.py", "line": 1, "rule_id": "x.y",
              "message": "msg", "severity": "WARNING"}],
            {"x.y": {"suggestion": "Fix it", "remediation_code": "# fixed"}},
            {"files": {"test.py": {"complexity": 5, "loc": 100, "level": "LOW", "functions": []}}},
        ))
        mocker.patch("engine.pipeline.scanner.get_git_state",
                     return_value={"commit": "abc123", "is_dirty": False})

        output_path = tmp_path / "report.json"
        args = Namespace(
            target="/fake/target",
            output=str(output_path),
            mock_scan=True,
            mock_ai=True,
            fast=False,
            refresh_ai=None,
            no_sarif=False,
        )
        with pytest.raises(SystemExit) as exc_info:
            run_analysis(args)
        assert exc_info.value.code == 0

        # VexCode JSON
        assert output_path.exists()
        with open(output_path) as f:
            vexcode = json.load(f)
        assert "findings" in vexcode
        assert "ai_resolutions" in vexcode
        assert "scanner" in vexcode

        # SARIF sidecar
        sarif_path = output_path.with_suffix(".sarif")
        assert sarif_path.exists()
        with open(sarif_path) as f:
            sarif = json.load(f)
        assert sarif["version"] == "2.1.0"
        assert sarif["runs"][0]["tool"]["driver"]["name"] == "opengrep-mock"

    def test_run_analysis_no_sarif_flag_skips_sidecar(self, mocker, tmp_path):
        """--no-sarif skips writing the SARIF sidecar."""
        from engine.__main__ import run_analysis
        from argparse import Namespace

        mocker.patch("engine.pipeline.scanner.run_scan_phase", return_value=(
            {"scanner": "opengrep", "timestamp": "2026-06-09T00:00:00Z",
             "target_path": "/fake/target", "findings": []},
            None,
        ))
        mocker.patch("engine.pipeline.enricher.enrich_findings", side_effect=lambda f, *a, **kw: f)
        mocker.patch("engine.core.dedup.deduplicate_findings", side_effect=lambda f: f)
        mocker.patch("engine.pipeline.resolver.resolve_phase", return_value=(
            [], {}, {"files": {}},
        ))
        mocker.patch("engine.pipeline.scanner.get_git_state", return_value=None)

        output_path = tmp_path / "report.json"
        args = Namespace(
            target="/fake/target",
            output=str(output_path),
            mock_scan=True,
            mock_ai=True,
            fast=False,
            refresh_ai=None,
            no_sarif=True,
        )
        with pytest.raises(SystemExit) as exc_info:
            run_analysis(args)
        assert exc_info.value.code == 0

        assert output_path.exists()
        assert not output_path.with_suffix(".sarif").exists()

    def test_refresh_ai_updates_vexcode_and_sidecar(self, mocker, tmp_path):
        """--refresh-ai updates the VexCode .json AND refreshes the SARIF sidecar if present."""
        from engine.__main__ import run_refresh_ai
        from argparse import Namespace

        # Pre-existing VexCode report
        report_path = tmp_path / "report.json"
        existing = {
            "scanner": "opengrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": [{
                "file": "test.py", "line": 1, "rule_id": "x.y",
                "message": "msg", "severity": "WARNING",
            }],
            "ai_resolutions": {},
            "git_state": {"commit": "abc", "is_dirty": False},
            "metrics": {"files": {}},
        }
        with open(report_path, "w") as f:
            json.dump(existing, f)

        # Pre-existing SARIF sidecar
        sarif_path = report_path.with_suffix(".sarif")
        with open(sarif_path, "w") as f:
            json.dump({"version": "2.1.0", "runs": []}, f)

        mocker.patch("engine.core.ai_resolver.resolve_findings", return_value={
            "x.y": {"suggestion": "Mock fix", "remediation_code": "# mock"},
        })
        mocker.patch("engine.pipeline.sarif_builder.build_sarif", return_value={
            "version": "2.1.0", "runs": [{"tool": {"driver": {"name": "opengrep"}}}],
        })

        args = Namespace(
            target="/fake/target",
            output=str(report_path),
            mock_scan=True,
            mock_ai=True,
            fast=False,
            refresh_ai=str(report_path),
            no_sarif=False,
        )
        with pytest.raises(SystemExit) as exc_info:
            run_refresh_ai(args)
        assert exc_info.value.code == 0

        with open(report_path) as f:
            updated = json.load(f)
        assert "x.y" in updated["ai_resolutions"]
        assert "re_resolved_at" in updated

        with open(sarif_path) as f:
            refreshed_sarif = json.load(f)
        assert refreshed_sarif["version"] == "2.1.0"
