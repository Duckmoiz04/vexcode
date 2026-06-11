"""Tests for complexity.py — get_complexity_level() and analyze_file_complexity()."""

import os
import tempfile

from engine.complexity import get_complexity_level, analyze_file_complexity

ENGINE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "engine")


class TestComplexityLevel:
    """Tests for get_complexity_level() threshold boundaries."""

    def test_low_boundary(self):
        """LOW: ccn <= 10"""
        assert get_complexity_level(1) == "LOW"
        assert get_complexity_level(5) == "LOW"
        assert get_complexity_level(10) == "LOW"

    def test_medium_boundary(self):
        """MEDIUM: 11 <= ccn <= 25"""
        assert get_complexity_level(11) == "MEDIUM"
        assert get_complexity_level(18) == "MEDIUM"
        assert get_complexity_level(25) == "MEDIUM"

    def test_high_boundary(self):
        """HIGH: ccn > 25"""
        assert get_complexity_level(26) == "HIGH"
        assert get_complexity_level(50) == "HIGH"
        assert get_complexity_level(100) == "HIGH"


class TestAnalyzeFileComplexity:
    """Tests for analyze_file_complexity() on real and edge-case files."""

    def test_analyze_self(self):
        """Analyze complexity.py itself — should return valid structure."""
        file_path = os.path.join(ENGINE_DIR, "complexity.py")
        result = analyze_file_complexity(file_path)

        assert isinstance(result, dict)
        assert "complexity" in result
        assert "cognitive_complexity" in result
        assert "loc" in result
        assert "level" in result
        assert "functions" in result

        # complexity.py has at least 2 functions
        assert len(result["functions"]) >= 2
        assert result["complexity"] > 0
        assert result["loc"] > 0
        assert result["level"] in ("LOW", "MEDIUM", "HIGH")

        # Each function entry has required keys
        for fn in result["functions"]:
            assert "name" in fn
            assert "start_line" in fn
            assert "end_line" in fn
            assert "complexity" in fn
            assert "cognitive_complexity" in fn
            assert "loc" in fn

    def test_nonexistent_file_returns_fallback(self):
        """Non-existent file should return fallback with zero values."""
        result = analyze_file_complexity("/nonexistent/path/foo.py")
        assert result["complexity"] == 0
        assert result["cognitive_complexity"] == 0
        assert result["loc"] == 0
        assert result["level"] == "LOW"
        assert result["functions"] == []

    def test_empty_file_returns_fallback(self):
        """Empty file should return fallback with zero values."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write("")
            tmp_path = f.name

        try:
            result = analyze_file_complexity(tmp_path)
            assert result["complexity"] == 0
            assert result["cognitive_complexity"] == 0
            assert result["loc"] == 0
            assert result["level"] == "LOW"
            assert result["functions"] == []
        finally:
            os.unlink(tmp_path)
