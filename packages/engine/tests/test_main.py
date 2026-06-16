"""Tests for main.py CLI — subprocess-based integration tests."""

import json
import os
import subprocess
import sys

ENGINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN_PY = os.path.join(ENGINE_DIR, "main.py")

# VexCode-format required keys
VEXCODE_REQUIRED_KEYS = {"scanner", "timestamp", "target_path", "findings",
                          "ai_resolutions", "git_state", "metrics"}

# SARIF 2.1.0 required keys
SARIF_REQUIRED_KEYS = {"$schema", "version", "runs"}


def _find_python():
    """Find the Python executable, preferring .venv."""
    venv_dir = os.path.join(ENGINE_DIR, ".venv")
    if sys.platform == "win32":
        venv_python = os.path.join(venv_dir, "Scripts", "python.exe")
    else:
        venv_python = os.path.join(venv_dir, "bin", "python")
    return venv_python if os.path.exists(venv_python) else sys.executable


def _run_main(*args):
    """Run main.py via subprocess and return (returncode, stdout, stderr)."""
    python_exe = _find_python()
    cmd = [python_exe, MAIN_PY] + list(args)
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=ENGINE_DIR)
    return result.returncode, result.stdout, result.stderr


def _assert_vexcode_report(report):
    """Assert report is a valid VexCode-format document."""
    for key in VEXCODE_REQUIRED_KEYS:
        assert key in report, f"Report missing required key: {key}"
    assert isinstance(report["scanner"], str)
    assert isinstance(report["findings"], list)
    assert isinstance(report["ai_resolutions"], dict)
    assert isinstance(report["metrics"], dict)
    assert "files" in report["metrics"]


def _assert_sarif_report(report):
    """Assert report is a valid SARIF 2.1.0 document."""
    for key in SARIF_REQUIRED_KEYS:
        assert key in report, f"SARIF missing required key: {key}"
    assert report["version"] == "2.1.0"
    assert isinstance(report["runs"], list)
    assert len(report["runs"]) >= 1
    run = report["runs"][0]
    assert "tool" in run
    assert isinstance(run["tool"]["driver"]["name"], str)
    assert isinstance(run["results"], list)
    assert "properties" in run
    assert "metrics" in run["properties"]


class TestMainCLI:
    """Integration tests for main.py CLI."""

    def test_scan_mock_writes_dual_reports(self, tmp_path):
        """Full scan writes BOTH a VexCode .json AND a SARIF 2.1.0 .sarif sidecar."""
        output_path = tmp_path / "report.json"
        rc, stdout, stderr = _run_main(
            "--target", ENGINE_DIR,
            "--output", str(output_path),
            "--mock-scan",
            "--mock-ai"
        )
        assert rc == 0, f"main.py exited with {rc}. stderr: {stderr}"
        assert output_path.exists(), f"Output file not created: {output_path}"
        with open(output_path, "r", encoding="utf-8") as f:
            vexcode = json.load(f)
        _assert_vexcode_report(vexcode)
        assert len(vexcode["scanner"]) > 0

        # SARIF sidecar must also exist
        sarif_path = output_path.with_suffix(".sarif")
        assert sarif_path.exists(), f"SARIF sidecar not created: {sarif_path}"
        with open(sarif_path, "r", encoding="utf-8") as f:
            sarif = json.load(f)
        _assert_sarif_report(sarif)
        assert sarif["runs"][0]["tool"]["driver"]["name"] == vexcode["scanner"]

    def test_scan_fast_mock(self, tmp_path):
        """Fast scan with --fast --mock-scan --mock-ai exits cleanly."""
        output_path = tmp_path / "report_fast.json"
        rc, stdout, stderr = _run_main(
            "--target", ENGINE_DIR,
            "--output", str(output_path),
            "--fast",
            "--mock-scan",
            "--mock-ai"
        )
        assert rc == 0, f"main.py --fast exited with {rc}. stderr: {stderr}"
        assert output_path.exists(), f"Output file not created: {output_path}"
        with open(output_path, "r", encoding="utf-8") as f:
            vexcode = json.load(f)
        _assert_vexcode_report(vexcode)
        assert "fast" in vexcode["scanner"].lower()

    def test_no_sarif_flag(self, tmp_path):
        """--no-sarif skips writing the SARIF sidecar."""
        output_path = tmp_path / "report.json"
        rc, stdout, stderr = _run_main(
            "--target", ENGINE_DIR,
            "--output", str(output_path),
            "--mock-scan",
            "--mock-ai",
            "--no-sarif"
        )
        assert rc == 0, f"main.py exited with {rc}. stderr: {stderr}"
        assert output_path.exists()
        assert not output_path.with_suffix(".sarif").exists()

    def test_refresh_ai_mock(self, tmp_path):
        """Refresh AI mode updates ai_resolutions on an existing VexCode report."""
        initial_report_path = tmp_path / "initial_report.json"
        initial_report = {
            "scanner": "opengrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": ENGINE_DIR,
            "findings": [{
                "file": "test.py", "line": 1, "rule_id": "test.rule",
                "message": "test finding", "severity": "WARNING",
            }],
            "ai_resolutions": {},
            "git_state": {"commit": "", "is_dirty": False},
            "metrics": {"files": {}},
        }
        with open(initial_report_path, "w", encoding="utf-8") as f:
            json.dump(initial_report, f)

        rc, stdout, stderr = _run_main("--refresh-ai", str(initial_report_path), "--mock-ai")
        assert rc == 0, f"main.py --refresh-ai exited with {rc}. stderr: {stderr}"

        with open(initial_report_path, "r", encoding="utf-8") as f:
            updated_report = json.load(f)
        # Should still be valid VexCode
        _assert_vexcode_report(updated_report)
        assert "test.rule" in updated_report["ai_resolutions"]
        assert "re_resolved_at" in updated_report

    def test_refresh_ai_missing_file(self, tmp_path):
        """Refresh AI with non-existent report exits with code 1."""
        missing_path = tmp_path / "nonexistent.json"
        rc, stdout, stderr = _run_main("--refresh-ai", str(missing_path), "--mock-ai")
        assert rc == 1, f"Expected exit code 1 for missing file, got {rc}"

    def test_refresh_ai_empty_findings(self, tmp_path):
        """Refresh AI with report containing no findings exits with code 0."""
        empty_report_path = tmp_path / "empty_report.json"
        empty_report = {
            "scanner": "opengrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": ENGINE_DIR,
            "findings": [],
            "ai_resolutions": {},
            "git_state": None,
            "metrics": {"files": {}}
        }
        with open(empty_report_path, "w", encoding="utf-8") as f:
            json.dump(empty_report, f)
        rc, stdout, stderr = _run_main("--refresh-ai", str(empty_report_path), "--mock-ai")
        assert rc == 0, f"Expected exit code 0 for empty findings, got {rc}"


class TestOutputPath:
    """Tests for --output path validation (Task 3)."""

    def test_default_output_contains_vexcode_dir(self):
        """Default --output value points to ~/.vexcode/reports/analysis_report.json."""
        from engine.__main__ import create_parser
        parser = create_parser()
        default = parser.get_default("output")
        assert ".vexcode" in default
        assert "reports" in default
        assert "analysis_report.json" in default

    def test_output_auto_creates_parent_dir(self, tmp_path):
        """Output path with non-existent parent dir creates it automatically."""
        output_path = tmp_path / "deep" / "nested" / "report.json"
        rc, stdout, stderr = _run_main(
            "--target", ENGINE_DIR,
            "--output", str(output_path),
            "--mock-scan",
            "--mock-ai"
        )
        assert rc == 0, f"main.py exited with {rc}. stderr: {stderr}"
        assert output_path.exists(), f"Output file not created: {output_path}"

    def test_output_invalid_path_fails_gracefully(self, tmp_path):
        """Output path where parent cannot be created exits with code 1."""
        block_file = tmp_path / "block"
        block_file.write_text("blocking file")
        invalid_output = tmp_path / "block" / "report.json"
        rc, stdout, stderr = _run_main(
            "--target", ENGINE_DIR,
            "--output", str(invalid_output),
            "--mock-scan",
            "--mock-ai"
        )
        assert rc == 1, f"Expected exit code 1 for invalid path, got {rc}"
