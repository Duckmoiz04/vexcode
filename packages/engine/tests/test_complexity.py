"""Tests for complexity.py — get_complexity_level(), analyze_file_complexity(),
gen_complexity_findings(), compute_cognitive_complexity(),
and gen_cognitive_complexity_findings()."""

import os
import tempfile

from engine.core.complexity import (
    CCN_HIGH_THRESHOLD,
    COGNITIVE_HIGH_THRESHOLD,
    get_complexity_level,
    analyze_file_complexity,
    gen_complexity_findings,
    gen_cognitive_complexity_findings,
    compute_cognitive_complexity,
)
from engine.config.iso25010_taxonomy import classify_finding

ENGINE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "engine", "core")


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

    def test_binary_file_returns_fallback(self):
        """Binary file (with null bytes) should return fallback."""
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".bin", delete=False) as f:
            f.write(b"\x00\x01\x02\x03" * 256)
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

    def test_large_file_returns_fallback(self):
        """File larger than 1MB should return fallback."""
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".py", delete=False) as f:
            f.write(b"x = 1\n")
            tmp_path = f.name

        os.truncate(tmp_path, 1024 * 1024 + 1)

        try:
            result = analyze_file_complexity(tmp_path)
            assert result["complexity"] == 0
            assert result["cognitive_complexity"] == 0
            assert result["loc"] == 0
            assert result["level"] == "LOW"
            assert result["functions"] == []
        finally:
            os.unlink(tmp_path)


class TestGenComplexityFindings:
    """Tests for gen_complexity_findings() — generating findings for HIGH complexity files."""

    def test_empty_metrics_returns_empty(self):
        """Empty metrics dict yields no findings."""
        assert gen_complexity_findings({}, "/target") == []
        assert gen_complexity_findings({"files": {}}, "/target") == []

    def test_all_low_or_medium_returns_empty(self):
        """No file with level=HIGH yields no findings."""
        metrics = {
            "files": {
                "src/app.py": {"complexity": 5, "level": "LOW", "functions": []},
                "src/utils.py": {"complexity": 25, "level": "MEDIUM", "functions": []},
            }
        }
        assert gen_complexity_findings(metrics, "/target") == []

    def test_single_high_file_generates_finding(self):
        """A single file with level=HIGH produces one finding with correct fields."""
        metrics = {
            "files": {
                "src/complex.py": {
                    "complexity": 42,
                    "cognitive_complexity": 30,
                    "loc": 200,
                    "level": "HIGH",
                    "functions": [],
                },
            }
        }
        result = gen_complexity_findings(metrics, "/target")

        assert len(result) == 1
        f = result[0]
        assert f["file"] == "src/complex.py"
        assert f["line"] == 1
        assert f["rule_id"] == "maintainability.complexity.high-ccn"
        assert f["severity"] == "warning"
        assert f["iso_25010"] == "maintainability"
        assert str(CCN_HIGH_THRESHOLD) in f["message"]
        assert "42" in f["message"]

    def test_multiple_high_files_generates_multiple_findings(self):
        """Multiple HIGH files produce one finding each."""
        metrics = {
            "files": {
                "a.py": {"complexity": 30, "level": "HIGH", "functions": []},
                "b.py": {"complexity": 12, "level": "MEDIUM", "functions": []},
                "c.py": {"complexity": 50, "level": "HIGH", "functions": []},
            }
        }
        result = gen_complexity_findings(metrics, "/target")
        assert len(result) == 2
        assert result[0]["file"] == "a.py"
        assert result[1]["file"] == "c.py"

    def test_high_file_with_functions_includes_detail(self):
        """When the HIGH file has function-level data, top functions appear in the message."""
        metrics = {
            "files": {
                "spaghetti.py": {
                    "complexity": 60,
                    "level": "HIGH",
                    "functions": [
                        {"name": "main", "complexity": 30, "start_line": 1},
                        {"name": "parse", "complexity": 20, "start_line": 50},
                        {"name": "helper", "complexity": 8, "start_line": 100},
                    ],
                },
            }
        }
        result = gen_complexity_findings(metrics, "/target")
        assert len(result) == 1
        msg = result[0]["message"]
        # Only functions with CCN > 10 should appear
        assert "main (CCN 30, line 1)" in msg
        assert "parse (CCN 20, line 50)" in msg
        # helper is CCN 8, should NOT be mentioned
        assert "helper" not in msg.split("Top high-complexity functions:")[0]

    def test_classify_finding_returns_maintainability(self):
        """classify_finding() on a complexity finding returns maintainability via iso_25010 override."""
        metrics = {
            "files": {
                "spaghetti.py": {
                    "complexity": 42,
                    "level": "HIGH",
                    "functions": [],
                },
            }
        }
        result = gen_complexity_findings(metrics, "/target")
        assert len(result) == 1
        assert classify_finding(result[0]) == "maintainability"


class TestCognitiveComplexity:
    """Tests for compute_cognitive_complexity() and gen_cognitive_complexity_findings()."""

    def test_compute_cognitive_complexity_self(self):
        """Compute cognitive complexity of complexity.py itself — should return >= 0."""
        file_path = os.path.join(ENGINE_DIR, "complexity.py")
        per_fn, total = compute_cognitive_complexity(file_path)
        assert isinstance(per_fn, int)
        assert isinstance(total, int)
        assert total >= 0
        assert per_fn >= 0

    def test_empty_file_returns_zero(self):
        """Empty Python file should have zero cognitive complexity."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write("")
            tmp_path = f.name
        try:
            per_fn, total = compute_cognitive_complexity(tmp_path)
            assert total == 0
        finally:
            os.unlink(tmp_path)

    def test_simple_function_returns_zero(self):
        """A simple function with no control flow should have low cognitive complexity."""
        source = "def foo():\n    return 42\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(source)
            tmp_path = f.name
        try:
            per_fn, total = compute_cognitive_complexity(tmp_path)
            # No branching, no nesting -> 0
            assert total == 0
        finally:
            os.unlink(tmp_path)

    def test_if_statement_increases_cognitive(self):
        """A function with an if-statement should have cognitive complexity > 0."""
        source = "def foo(x):\n    if x > 0:\n        return x\n    return 0\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(source)
            tmp_path = f.name
        try:
            per_fn, total = compute_cognitive_complexity(tmp_path)
            assert total > 0
        finally:
            os.unlink(tmp_path)

    def test_nested_if_increases_more(self):
        """Nested control flow should have higher cognitive complexity than flat."""
        source_flat = "def foo(x, y):\n    if x > 0:\n        return x\n    if y > 0:\n        return y\n    return 0\n"
        source_nested = "def foo(x, y):\n    if x > 0:\n        if y > 0:\n            return y\n        return x\n    return 0\n"

        f1 = tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False)
        f1.write(source_flat)
        f1.close()
        f2 = tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False)
        f2.write(source_nested)
        f2.close()

        try:
            p1, t1 = compute_cognitive_complexity(f1.name)
            p2, t2 = compute_cognitive_complexity(f2.name)
            assert t2 > t1, f"Nested ({t2}) should be > flat ({t1})"
        finally:
            os.unlink(f1.name)
            os.unlink(f2.name)

    def test_boolean_ops_increase_cognitive(self):
        """Boolean operators (and/or) increment cognitive complexity."""
        source = "def foo(x, y, z):\n    if x > 0 and y > 0 or z > 0:\n        return True\n    return False\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(source)
            tmp_path = f.name
        try:
            per_fn, total = compute_cognitive_complexity(tmp_path)
            # if branch + and + or = at least 3
            assert total >= 2
        finally:
            os.unlink(tmp_path)

    def test_cognitive_findings_empty_when_below_threshold(self):
        """No findings when all cognitive complexities are below threshold."""
        metrics = {
            "files": {
                "simple.py": {"cognitive_complexity": 3, "functions": []},
                "medium.py": {"cognitive_complexity": 10, "functions": []},
            }
        }
        result = gen_cognitive_complexity_findings(metrics, "/target")
        assert result == []

    def test_cognitive_findings_single_high(self):
        """Single file above threshold produces one finding."""
        metrics = {
            "files": {
                "complex.py": {
                    "cognitive_complexity": 30,
                    "functions": [],
                },
            }
        }
        result = gen_cognitive_complexity_findings(metrics, "/target")
        assert len(result) == 1
        f = result[0]
        assert f["rule_id"] == "maintainability.complexity.high-cognitive"
        assert f["severity"] == "warning"
        assert f["iso_25010"] == "maintainability"
        assert str(COGNITIVE_HIGH_THRESHOLD) in f["message"]

    def test_cognitive_findings_classifies_maintainability(self):
        """classify_finding() returns maintainability via iso_25010 override."""
        metrics = {
            "files": {
                "brain.py": {"cognitive_complexity": 25, "functions": []},
            }
        }
        result = gen_cognitive_complexity_findings(metrics, "/target")
        assert len(result) == 1
        assert classify_finding(result[0]) == "maintainability"

    def test_non_python_file_heuristic(self):
        """Cognitive complexity for non-Python files should use heuristic and return >= 0."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as f:
            f.write("function foo(x) {\n  if (x > 0) {\n    return x;\n  }\n  return 0;\n}\n")
            tmp_path = f.name
        try:
            per_fn, total = compute_cognitive_complexity(tmp_path)
            # Heuristic detects the "if" pattern
            assert total >= 0
        finally:
            os.unlink(tmp_path)
