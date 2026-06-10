import unittest
import os
import sys
import tempfile

# Ensure analysis-core is on python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from complexity import get_complexity_level, analyze_file_complexity


class TestComplexityLevel(unittest.TestCase):
    """Tests for get_complexity_level() threshold boundaries."""

    def test_low_boundary(self):
        """LOW: ccn <= 10"""
        self.assertEqual(get_complexity_level(1), "LOW")
        self.assertEqual(get_complexity_level(5), "LOW")
        self.assertEqual(get_complexity_level(10), "LOW")

    def test_medium_boundary(self):
        """MEDIUM: 11 <= ccn <= 25"""
        self.assertEqual(get_complexity_level(11), "MEDIUM")
        self.assertEqual(get_complexity_level(18), "MEDIUM")
        self.assertEqual(get_complexity_level(25), "MEDIUM")

    def test_high_boundary(self):
        """HIGH: ccn > 25"""
        self.assertEqual(get_complexity_level(26), "HIGH")
        self.assertEqual(get_complexity_level(50), "HIGH")
        self.assertEqual(get_complexity_level(100), "HIGH")


class TestAnalyzeFileComplexity(unittest.TestCase):
    """Tests for analyze_file_complexity() on real and edge-case files."""

    def test_analyze_self(self):
        """Analyze complexity.py itself — should return valid structure."""
        file_path = os.path.join(os.path.dirname(__file__), "complexity.py")
        result = analyze_file_complexity(file_path)

        self.assertIsInstance(result, dict)
        self.assertIn("complexity", result)
        self.assertIn("cognitive_complexity", result)
        self.assertIn("loc", result)
        self.assertIn("level", result)
        self.assertIn("functions", result)

        # complexity.py has at least 2 functions (get_complexity_level, analyze_file_complexity)
        self.assertGreaterEqual(len(result["functions"]), 2)
        self.assertGreater(result["complexity"], 0)
        self.assertGreater(result["loc"], 0)
        self.assertIn(result["level"], ("LOW", "MEDIUM", "HIGH"))

        # Each function entry has required keys
        for fn in result["functions"]:
            self.assertIn("name", fn)
            self.assertIn("start_line", fn)
            self.assertIn("end_line", fn)
            self.assertIn("complexity", fn)
            self.assertIn("cognitive_complexity", fn)
            self.assertIn("loc", fn)

    def test_nonexistent_file_returns_fallback(self):
        """Non-existent file should return fallback with zero values."""
        result = analyze_file_complexity("/nonexistent/path/foo.py")
        self.assertEqual(result["complexity"], 0)
        self.assertEqual(result["cognitive_complexity"], 0)
        self.assertEqual(result["loc"], 0)
        self.assertEqual(result["level"], "LOW")
        self.assertEqual(result["functions"], [])

    def test_empty_file_returns_fallback(self):
        """Empty file should return fallback with zero values."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write("")
            tmp_path = f.name

        try:
            result = analyze_file_complexity(tmp_path)
            self.assertEqual(result["complexity"], 0)
            self.assertEqual(result["cognitive_complexity"], 0)
            self.assertEqual(result["loc"], 0)
            self.assertEqual(result["level"], "LOW")
            self.assertEqual(result["functions"], [])
        finally:
            os.unlink(tmp_path)


if __name__ == "__main__":
    unittest.main()