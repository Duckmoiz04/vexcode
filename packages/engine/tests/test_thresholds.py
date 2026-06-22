import unittest
import os
import tempfile

from engine.pipeline.thresholds import load_thresholds, evaluate_thresholds

class TestThresholds(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_load_thresholds_default(self):
        """None or missing path returns defaults."""
        thresholds = load_thresholds(None)
        self.assertEqual(thresholds["max_critical"], 0)
        self.assertEqual(thresholds["max_high"], 10)
        self.assertEqual(thresholds["max_total"], 100)

        thresholds_missing = load_thresholds("/non/existent/path.toml")
        self.assertEqual(thresholds_missing["max_critical"], 0)

    def test_load_thresholds_toml(self):
        """Correctly load and merge settings from a TOML file."""
        config_path = os.path.join(self.temp_dir.name, "thresholds.toml")
        with open(config_path, "w") as f:
            f.write("""
[thresholds]
max_critical = 2
max_high = 5
min_rating = "B"
""")

        thresholds = load_thresholds(config_path)
        self.assertEqual(thresholds["max_critical"], 2)
        self.assertEqual(thresholds["max_high"], 5)
        self.assertEqual(thresholds["max_total"], 100)  # Inherited default
        self.assertEqual(thresholds["min_rating"], "B")

    def test_evaluate_thresholds_pass(self):
        """Pass when findings and metrics are within threshold limits."""
        findings = [
            {"severity": "warning", "file": "app.py"},
            {"severity": "info", "file": "app.py"},
        ]
        metrics = {
            "ratings": {
                "Security": "A",
                "Maintainability": "B"
            }
        }
        thresholds = {
            "max_critical": 0,
            "max_high": 5,
            "max_total": 10,
            "max_files_with_errors": 5,
            "min_rating": "C"
        }

        passed, violations = evaluate_thresholds(findings, metrics, thresholds)
        self.assertTrue(passed)
        self.assertEqual(len(violations), 0)

    def test_evaluate_thresholds_fail_max_critical(self):
        """Fail when critical/error findings exceed limits."""
        findings = [
            {"severity": "error", "file": "app.py"},
        ]
        metrics = {}
        thresholds = {
            "max_critical": 0,
            "max_high": 5,
            "max_total": 10,
            "max_files_with_errors": 5,
        }

        passed, violations = evaluate_thresholds(findings, metrics, thresholds)
        self.assertFalse(passed)
        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0]["threshold"], "max_critical")
        self.assertEqual(violations[0]["actual"], 1)
        self.assertEqual(violations[0]["limit"], 0)

    def test_evaluate_thresholds_fail_max_high(self):
        """Fail when warning/high findings exceed limits."""
        findings = [
            {"severity": "warning", "file": "app.py"},
            {"severity": "warning", "file": "db.py"},
        ]
        metrics = {}
        thresholds = {
            "max_critical": 1,
            "max_high": 1,
            "max_total": 10,
        }

        passed, violations = evaluate_thresholds(findings, metrics, thresholds)
        self.assertFalse(passed)
        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0]["threshold"], "max_high")
        self.assertEqual(violations[0]["actual"], 2)

    def test_evaluate_thresholds_fail_max_total(self):
        """Fail when total findings count exceeds limit."""
        findings = [
            {"severity": "info", "file": "app.py"} for _ in range(5)
        ]
        metrics = {}
        thresholds = {
            "max_critical": 0,
            "max_high": 10,
            "max_total": 3,
        }

        passed, violations = evaluate_thresholds(findings, metrics, thresholds)
        self.assertFalse(passed)
        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0]["threshold"], "max_total")
        self.assertEqual(violations[0]["actual"], 5)

    def test_evaluate_thresholds_fail_files_with_errors(self):
        """Fail when too many distinct files have errors/critical findings."""
        findings = [
            {"severity": "error", "file": "app.py"},
            {"severity": "error", "file": "db.py"},
        ]
        metrics = {}
        thresholds = {
            "max_critical": 5,
            "max_high": 5,
            "max_total": 10,
            "max_files_with_errors": 1,
        }

        passed, violations = evaluate_thresholds(findings, metrics, thresholds)
        self.assertFalse(passed)
        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0]["threshold"], "max_files_with_errors")
        self.assertEqual(violations[0]["actual"], 2)

    def test_evaluate_thresholds_fail_min_rating(self):
        """Fail when a rating is lower than minimum accepted rating."""
        findings = []
        metrics = {
            "ratings": {
                "Security": "D"
            }
        }
        thresholds = {
            "min_rating": "C"
        }

        passed, violations = evaluate_thresholds(findings, metrics, thresholds)
        self.assertFalse(passed)
        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0]["threshold"], "min_rating")
        self.assertEqual(violations[0]["actual"], "D")
        self.assertEqual(violations[0]["limit"], "C")
