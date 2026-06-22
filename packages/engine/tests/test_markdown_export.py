import unittest
import os
import tempfile
from pathlib import Path

from engine.pipeline.reporter import export_markdown

class TestMarkdownExport(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.output_path = os.path.join(self.temp_dir.name, "report.md")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_export_markdown_basic(self):
        """Export basic scan report correctly."""
        report = {
            "target_path": "/src/project",
            "scanner": "opengrep",
            "timestamp": "2026-06-22T00:00:00Z",
            "git_state": {
                "commit": "abcdef1234567890",
                "is_dirty": True
            },
            "findings": [
                {
                    "file": "app.py",
                    "line": 5,
                    "severity": "error",
                    "rule_id": "no-hardcoded-creds",
                    "message": "Found hardcoded password",
                    "category": "security",
                    "status": "open"
                }
            ],
            "metrics": {
                "ratings": {
                    "Security": "A",
                    "Maintainability": "B"
                }
            },
            "ai_resolutions": {
                "no-hardcoded-creds": {
                    "suggestion": "Use env variables instead."
                }
            },
            "thresholds": {
                "passed": False,
                "violations": [
                    {"message": "Exceeded max critical findings: 1 > 0"}
                ]
            }
        }

        export_markdown(report, self.output_path)
        self.assertTrue(os.path.exists(self.output_path))

        with open(self.output_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check metadata
        self.assertIn("# VexCode Scan Report", content)
        self.assertIn("- **Target**: `/src/project`", content)
        self.assertIn("- **Scanner**: opengrep", content)
        self.assertIn("- **Commit**: `abcdef12`", content)
        self.assertIn("- **Dirty**: Yes", content)

        # Check summary
        self.assertIn("## Summary", content)
        self.assertIn("- **error**: 1", content)
        self.assertIn("- **security**: 1", content)

        # Check ratings
        self.assertIn("Quality Ratings (A-E)", content)
        self.assertIn("- **Security**: A", content)
        self.assertIn("- **Maintainability**: B", content)

        # Check quality gate
        self.assertIn("Quality Gate: ✗ FAILED", content)
        self.assertIn("❌ Exceeded max critical findings: 1 > 0", content)

        # Check details
        self.assertIn("## Finding Details", content)
        self.assertIn("### app.py", content)
        self.assertIn("no-hardcoded-creds", content)

        # Check AI resolutions
        self.assertIn("## AI Resolutions", content)
        self.assertIn("no-hardcoded-creds", content)
        self.assertIn("Use env variables instead.", content)

    def test_export_markdown_empty(self):
        """Export empty report gracefully."""
        report = {
            "target_path": "/src/project",
            "scanner": "opengrep-mock",
            "timestamp": "2026-06-22T00:00:00Z",
            "findings": []
        }

        export_markdown(report, self.output_path)
        self.assertTrue(os.path.exists(self.output_path))

        with open(self.output_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("**Total findings**: 0", content)
        self.assertIn("## Finding Details", content)
        self.assertNotIn("|", content)  # No details table since empty
