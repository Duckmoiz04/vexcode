"""Tests for pipeline/reporter.py — assemble_report() produces VexCode internal format."""


class TestVexCodeReporter:
    """Tests for the VexCode-format reporter (primary, consumed by web UI)."""

    def test_assemble_report_vexcode_structure(self, mocker):
        """assemble_report returns the VexCode internal data model."""
        from engine.pipeline.reporter import assemble_report

        scan_results = {
            "scanner": "opengrep-mock",
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
        git_state = {"commit": "abc123", "is_dirty": False}

        report = assemble_report(
            scan_results, scan_results["findings"], resolutions, "/fake/target",
            metrics, git_state=git_state,
        )

        assert report["scanner"] == "opengrep-mock"
        assert report["timestamp"] == "2026-06-09T00:00:00Z"
        assert report["target_path"] == "/fake/target"
        assert report["findings"] == scan_results["findings"]
        assert report["ai_resolutions"] == resolutions
        assert report["git_state"] == git_state
        assert report["metrics"] == metrics
        # SARIF-specific keys must NOT be present
        assert "version" not in report
        assert "runs" not in report
        assert "$schema" not in report

    def test_assemble_report_uses_target_arg_when_scan_lacks_path(self):
        """When scan_results has no target_path, fall back to the target argument."""
        from engine.pipeline.reporter import assemble_report

        scan_results = {
            "scanner": "opengrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "findings": [],
        }
        report = assemble_report(
            scan_results, [], {}, "/fallback/target", {"files": {}},
        )
        assert report["target_path"] == "/fallback/target"

    def test_assemble_report_generates_fallback_timestamp(self):
        """When scan_results has no timestamp, generate a fresh UTC ISO timestamp."""
        from engine.pipeline.reporter import assemble_report

        scan_results = {
            "scanner": "opengrep",
            "target_path": "/fake/target",
            "findings": [],
        }
        report = assemble_report(
            scan_results, [], {}, "/fake/target", {"files": {}},
        )
        assert isinstance(report["timestamp"], str)
        assert report["timestamp"].endswith("Z")

    def test_assemble_report_default_git_state(self):
        """When no git_state is provided, default to a clean empty state."""
        from engine.pipeline.reporter import assemble_report

        scan_results = {
            "scanner": "opengrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": [],
        }
        report = assemble_report(
            scan_results, [], {}, "/fake/target", {"files": {}},
        )
        assert report["git_state"] == {"commit": "", "is_dirty": False}

    def test_assemble_report_passes_through_provided_git_state(self):
        """When git_state is provided, pass it through unchanged."""
        from engine.pipeline.reporter import assemble_report

        scan_results = {
            "scanner": "opengrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": [],
        }
        git_state = {"commit": "deadbeef", "is_dirty": True}
        report = assemble_report(
            scan_results, [], {}, "/fake/target", {"files": {}}, git_state=git_state,
        )
        assert report["git_state"] == git_state

    def test_assemble_report_empty_metrics_fallback(self):
        """When metrics is None, default to {"files": {}}."""
        from engine.pipeline.reporter import assemble_report

        scan_results = {
            "scanner": "opengrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": "/fake/target",
            "findings": [],
        }
        report = assemble_report(
            scan_results, [], {}, "/fake/target", None,
        )
        assert report["metrics"] == {"files": {}}
