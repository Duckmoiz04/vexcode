import unittest
import subprocess
import sys
import os
import json
import tempfile

# Ensure engine is on python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class TestMainCLI(unittest.TestCase):

    REQUIRED_KEYS = {"scanner", "timestamp", "target_path", "findings", "ai_resolutions", "git_state", "metrics"}

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.main_py = os.path.join(os.path.dirname(os.path.abspath(__file__)), "main.py")
        self.target_dir = os.path.dirname(os.path.abspath(__file__))

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _run_main(self, *args):
        """Run main.py via subprocess and return (returncode, stdout, stderr).

        Prefers the .venv Python (has lizard + all deps); falls back to
        sys.executable when .venv doesn't exist (CI, non-local).
        """
        venv_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv")
        if sys.platform == "win32":
            venv_python = os.path.join(venv_dir, "Scripts", "python.exe")
        else:
            venv_python = os.path.join(venv_dir, "bin", "python")
        python_exe = venv_python if os.path.exists(venv_python) else sys.executable
        cmd = [python_exe, self.main_py] + list(args)
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=self.target_dir
        )
        return result.returncode, result.stdout, result.stderr

    def _assert_valid_report(self, report):
        """Assert report has all required keys and correct types."""
        for key in self.REQUIRED_KEYS:
            self.assertIn(key, report, f"Report missing required key: {key}")

        self.assertIsInstance(report["scanner"], str)
        self.assertIsInstance(report["timestamp"], str)
        self.assertIsInstance(report["target_path"], str)
        self.assertIsInstance(report["findings"], list)
        self.assertIsInstance(report["ai_resolutions"], dict)
        self.assertIsInstance(report["metrics"], dict)
        self.assertIn("files", report["metrics"])
        self.assertIsInstance(report["metrics"]["files"], dict)

        # git_state can be dict or None
        if report["git_state"] is not None:
            self.assertIsInstance(report["git_state"], dict)

    def test_scan_mock(self):
        """Full scan with --mock-scan --mock-ai produces valid report JSON."""
        output_path = os.path.join(self.temp_dir, "report.json")
        rc, stdout, stderr = self._run_main(
            "--target", self.target_dir,
            "--output", output_path,
            "--mock-scan",
            "--mock-ai"
        )

        self.assertEqual(rc, 0, f"main.py exited with {rc}. stderr: {stderr}")

        self.assertTrue(os.path.exists(output_path), f"Output file not created: {output_path}")

        with open(output_path, "r", encoding="utf-8") as f:
            report = json.load(f)

        self._assert_valid_report(report)
        self.assertGreater(len(report["scanner"]), 0)

    def test_scan_fast_mock(self):
        """Fast scan with --fast --mock-scan --mock-ai exits cleanly."""
        output_path = os.path.join(self.temp_dir, "report_fast.json")
        rc, stdout, stderr = self._run_main(
            "--target", self.target_dir,
            "--output", output_path,
            "--fast",
            "--mock-scan",
            "--mock-ai"
        )

        self.assertEqual(rc, 0, f"main.py --fast exited with {rc}. stderr: {stderr}")

        self.assertTrue(os.path.exists(output_path), f"Output file not created: {output_path}")

        with open(output_path, "r", encoding="utf-8") as f:
            report = json.load(f)

        self._assert_valid_report(report)
        # Fast scan should use semgrep-fast scanner
        self.assertIn("fast", report["scanner"].lower())

    def test_re_resolve_mock(self):
        """Re-resolve mode updates ai_resolutions on an existing report."""
        # Step 1: Write a minimal valid report JSON to a temp file
        initial_report_path = os.path.join(self.temp_dir, "initial_report.json")
        initial_report = {
            "scanner": "semgrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": self.target_dir,
            "findings": [
                {
                    "file": "test.py",
                    "line": 1,
                    "rule_id": "test.rule",
                    "message": "test finding",
                    "severity": "warning"
                }
            ],
            "ai_resolutions": {},
            "git_state": None,
            "metrics": {"files": {}}
        }
        with open(initial_report_path, "w", encoding="utf-8") as f:
            json.dump(initial_report, f)

        # Step 2: Run --re-resolve with --mock-ai
        rc, stdout, stderr = self._run_main(
            "--re-resolve", initial_report_path,
            "--mock-ai"
        )

        self.assertEqual(rc, 0, f"main.py --re-resolve exited with {rc}. stderr: {stderr}")

        # Step 3: Verify the report was updated in-place
        with open(initial_report_path, "r", encoding="utf-8") as f:
            updated_report = json.load(f)

        self._assert_valid_report(updated_report)
        self.assertIsInstance(updated_report["ai_resolutions"], dict)
        self.assertGreater(len(updated_report["ai_resolutions"]), 0,
                           "ai_resolutions should be populated after re-resolve")
        self.assertIn("re_resolved_at", updated_report)

    def test_re_resolve_missing_file(self):
        """Re-resolve with non-existent report exits with code 1."""
        missing_path = os.path.join(self.temp_dir, "nonexistent.json")
        rc, stdout, stderr = self._run_main(
            "--re-resolve", missing_path,
            "--mock-ai"
        )

        self.assertEqual(rc, 1, f"Expected exit code 1 for missing file, got {rc}")

    def test_re_resolve_empty_findings(self):
        """Re-resolve with report containing no findings exits with code 0."""
        empty_report_path = os.path.join(self.temp_dir, "empty_report.json")
        empty_report = {
            "scanner": "semgrep",
            "timestamp": "2026-06-09T00:00:00Z",
            "target_path": self.target_dir,
            "findings": [],
            "ai_resolutions": {},
            "git_state": None,
            "metrics": {"files": {}}
        }
        with open(empty_report_path, "w", encoding="utf-8") as f:
            json.dump(empty_report, f)

        rc, stdout, stderr = self._run_main(
            "--re-resolve", empty_report_path,
            "--mock-ai"
        )

        self.assertEqual(rc, 0, f"Expected exit code 0 for empty findings, got {rc}")


if __name__ == '__main__':
    unittest.main()