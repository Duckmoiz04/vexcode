"""Tests for scanner.py — run_scan() with mock mode."""

from unittest.mock import patch

from engine.core.scanner import (
    run_scan,
    MOCK_FINDINGS,
    EXCLUDE_DIRS,
    _resolve_to_existing,
)


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
        # MOCK_FINDINGS are enriched with id, category, language + severity normalized to lowercase
        assert len(result["findings"]) == len(MOCK_FINDINGS)
        for rf, mf in zip(result["findings"], MOCK_FINDINGS):
            assert rf["file"] == mf["file"]
            assert rf["line"] == mf["line"]
            assert rf["rule_id"] == mf["rule_id"]
            assert rf["message"] == mf["message"]
            assert rf["code_text"] == mf["code_text"]
            assert rf["severity"] == mf["severity"].lower()
            assert isinstance(rf.get("id"), str) and len(rf["id"]) > 0
            assert isinstance(rf.get("category"), str) and len(rf["category"]) > 0
            assert isinstance(rf.get("language"), str) and len(rf["language"]) > 0

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


class TestResolveToExisting:
    """Tests for _resolve_to_existing (file-path normalisation for OpenGrep output)."""

    TARGET = "D:\\DATN2"
    BASES = [TARGET, "D:\\DATN2\\packages\\engine", "D:\\DATN2\\packages", "D:\\DATN2"]

    def test_absolute_path_existing_returned_normpath(self):
        with patch("os.path.exists", return_value=True):
            result = _resolve_to_existing("D:\\resolve-manifest.mjs", self.TARGET, self.BASES)
        assert result == "D:\\resolve-manifest.mjs"

    def test_empty_input_returns_empty(self):
        assert _resolve_to_existing("", self.TARGET, self.BASES) == ""

    def test_relative_path_under_target_base_resolves(self):
        existing = {"D:\\DATN2\\src\\main.py": True}
        with patch("os.path.exists", side_effect=lambda p: existing.get(p, False)):
            result = _resolve_to_existing("src\\main.py", self.TARGET, self.BASES)
        assert result == "D:\\DATN2\\src\\main.py"

    def test_dotdot_path_resolves_under_engine_base(self):
        real = "D:\\DATN2\\resolve-manifest.mjs"
        hit_paths = {real}
        with patch("os.path.exists", side_effect=lambda p: p in hit_paths):
            result = _resolve_to_existing("..\\..\\resolve-manifest.mjs", self.TARGET, self.BASES)
        assert result == real

    def test_dotdot_strip_fallback(self):
        raw = "..\\foo.py"
        real = "D:\\DATN2\\foo.py"
        hit_paths = {real}
        with patch("os.path.exists", side_effect=lambda p: p in hit_paths):
            result = _resolve_to_existing(raw, self.TARGET, self.BASES)
        assert result == real

    def test_unknown_relative_path_falls_back_normpath(self):
        with patch("os.path.exists", return_value=False):
            result = _resolve_to_existing("ghost.py", self.TARGET, self.BASES)
        assert result == "D:\\DATN2\\ghost.py"
