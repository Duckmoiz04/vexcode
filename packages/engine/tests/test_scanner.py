"""Tests for scanner.py — run_scan() with mock mode."""

from unittest.mock import patch

from engine.core.scanner import run_scan, MOCK_FINDINGS, EXCLUDE_DIRS


class TestScanner:
    """Tests for run_scan() in mock mode."""

    def test_run_scan_mock_returns_expected_keys(self):
        result = run_scan("/fake/target", use_mock=True)
        assert "scanner" in result
        assert "timestamp" in result
        assert "target_path" in result
        assert "findings" in result

    def test_run_scan_mock_scanner_field(self):
        result = run_scan("/fake/target", use_mock=True)
        assert result["scanner"] == "opengrep-mock"

    def test_run_scan_mock_target_path_preserved(self):
        result = run_scan("/fake/target", use_mock=True)
        assert result["target_path"] == "/fake/target"

    def test_run_scan_mock_returns_mock_findings(self):
        result = run_scan("/fake/target", use_mock=True)
        assert result["findings"] == MOCK_FINDINGS

    def test_mock_findings_structure(self):
        assert isinstance(MOCK_FINDINGS, list)
        assert len(MOCK_FINDINGS) > 0
        for finding in MOCK_FINDINGS:
            assert "file" in finding
            assert "line" in finding
            assert "rule_id" in finding
            assert "message" in finding
            assert "severity" in finding
            assert "code_text" in finding

    def test_run_scan_mock_with_files_filter(self):
        result = run_scan("/fake/target", use_mock=True, files=["example.py"])
        assert len(result["findings"]) == 1
        assert result["findings"][0]["file"] == "example.py"

    def test_run_scan_mock_with_files_no_match(self):
        result = run_scan("/fake/target", use_mock=True, files=["nonexistent.py"])
        assert len(result["findings"]) == 0

    def test_run_scan_mock_timestamp_is_iso_format(self):
        result = run_scan("/fake/target", use_mock=True)
        ts = result["timestamp"]
        assert "T" in ts
        assert ts.endswith("Z")


class TestScannerExcludeDirs:
    """Tests for EXCLUDE_DIRS in scan command construction (non-mock path)."""

    def test_exclude_dirs_present_in_scan_cmd(self):
        with patch("engine.core.scanner.ensure_opengrep", return_value="opengrep-bin"):
            with patch("engine.core.scanner.subprocess.run") as mock_run:
                with patch("os.path.exists", return_value=True):
                    run_scan("/fake/target", use_mock=False)

        cmd = mock_run.call_args[0][0]
        exclude_flags = [cmd[i + 1] for i, arg in enumerate(cmd) if arg == "--exclude"]
        assert len(exclude_flags) == len(EXCLUDE_DIRS)
        for d in EXCLUDE_DIRS:
            assert d in exclude_flags
