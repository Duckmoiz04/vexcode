import unittest
from unittest.mock import patch, MagicMock
import subprocess
import json

from engine.pipeline.scanner import run_ruff_scan


class TestRuffScan(unittest.TestCase):
    def test_run_ruff_scan_mock(self):
        """Mock mode returns simulated ruff finding."""
        findings = run_ruff_scan("/fake/path", use_mock=True)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["rule_id"], "ruff/mock-finding")
        self.assertEqual(findings[0]["category"], "maintainability")
        self.assertEqual(findings[0]["scanner"], "ruff")

    @patch("subprocess.run")
    def test_run_ruff_scan_ruff_missing(self, mock_run):
        """If ruff is not on system PATH, fail gracefully."""
        mock_run.side_effect = FileNotFoundError("ruff not found")
        findings = run_ruff_scan("/fake/path", use_mock=False)
        self.assertEqual(findings, [])

    @patch("subprocess.run")
    def test_run_ruff_scan_no_issues(self, mock_run):
        """No ruff issues returns empty list."""
        mock_version = MagicMock(returncode=0)
        mock_check = MagicMock(returncode=0, stdout="")
        mock_run.side_effect = [mock_version, mock_check]

        findings = run_ruff_scan("/fake/path", use_mock=False)
        self.assertEqual(findings, [])

    @patch("subprocess.run")
    def test_run_ruff_scan_maintainability_finding(self, mock_run):
        """Non-security ruff rule (e.g. E501 line too long) -> maintainability category."""
        mock_version = MagicMock(returncode=0)
        mock_check = MagicMock()
        mock_check.returncode = 0
        mock_check.stdout = json.dumps([
            {
                "code": "E501",
                "message": "Line too long (92 > 88 characters)",
                "level": "warning",
                "filename": "src/example.py",
                "location": {"row": 42, "col": 1},
            }
        ])
        mock_run.side_effect = [mock_version, mock_check]

        findings = run_ruff_scan("/fake/path", use_mock=False)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["rule_id"], "ruff/E501")
        self.assertEqual(findings[0]["category"], "maintainability")
        self.assertEqual(findings[0]["severity"], "warning")
        self.assertEqual(findings[0]["scanner"], "ruff")

    @patch("subprocess.run")
    def test_run_ruff_scan_security_finding(self, mock_run):
        """Security ruff rule (S series) -> security category + owasp_id."""
        mock_version = MagicMock(returncode=0)
        mock_check = MagicMock()
        mock_check.returncode = 0
        mock_check.stdout = json.dumps([
            {
                "code": "S101",
                "message": "Use of assert detected",
                "level": "warning",
                "filename": "src/example.py",
                "location": {"row": 10, "col": 5},
            }
        ])
        mock_run.side_effect = [mock_version, mock_check]

        findings = run_ruff_scan("/fake/path", use_mock=False)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["rule_id"], "ruff/S101")
        self.assertEqual(findings[0]["category"], "security")
        self.assertEqual(findings[0]["cwe_id"], "CWE-228")
        self.assertEqual(findings[0]["owasp_id"], "OWASP-A03")
        self.assertEqual(findings[0]["scanner"], "ruff")

    @patch("subprocess.run")
    def test_run_ruff_scan_security_cwe_maps(self, mock_run):
        """Multiple security rules each get correct CWE and OWASP."""
        mock_version = MagicMock(returncode=0)
        mock_check = MagicMock()
        mock_check.returncode = 0
        mock_check.stdout = json.dumps([
            {"code": "S101", "message": "assert", "level": "warning",
             "filename": "a.py", "location": {"row": 1}},
            {"code": "S102", "message": "exec", "level": "warning",
             "filename": "a.py", "location": {"row": 2}},
            {"code": "S105", "message": "SQL injection", "level": "error",
             "filename": "a.py", "location": {"row": 3}},
            {"code": "S108", "message": "weak crypto", "level": "warning",
             "filename": "a.py", "location": {"row": 4}},
        ])
        mock_run.side_effect = [mock_version, mock_check]

        findings = run_ruff_scan("/fake/path", use_mock=False)
        self.assertEqual(len(findings), 4)
        expected = [
            ("ruff/S101", "CWE-228", "OWASP-A03"),
            ("ruff/S102", "CWE-78", "OWASP-A03"),
            ("ruff/S105", "CWE-89", "OWASP-A03"),
            ("ruff/S108", "CWE-326", "OWASP-A02"),
        ]
        for i, (rule, cwe, owasp) in enumerate(expected):
            with self.subTest(rule=rule):
                self.assertEqual(findings[i]["rule_id"], rule)
                self.assertEqual(findings[i]["category"], "security")
                self.assertEqual(findings[i]["cwe_id"], cwe)
                self.assertEqual(findings[i]["owasp_id"], owasp)

    @patch("subprocess.run")
    def test_run_ruff_scan_mixed_findings(self, mock_run):
        """Mixed security + maintainability findings handled correctly."""
        mock_version = MagicMock(returncode=0)
        mock_check = MagicMock()
        mock_check.returncode = 0
        mock_check.stdout = json.dumps([
            {"code": "E501", "message": "line too long", "level": "warning",
             "filename": "a.py", "location": {"row": 1}},
            {"code": "S101", "message": "assert", "level": "warning",
             "filename": "b.py", "location": {"row": 10}},
            {"code": "N802", "message": "function name in caps", "level": "info",
             "filename": "c.py", "location": {"row": 5}},
        ])
        mock_run.side_effect = [mock_version, mock_check]

        findings = run_ruff_scan("/fake/path", use_mock=False)
        self.assertEqual(len(findings), 3)
        self.assertEqual(findings[0]["category"], "maintainability")
        self.assertEqual(findings[1]["category"], "security")
        self.assertEqual(findings[2]["category"], "maintainability")
        # Security finding should have owasp_id, maintainability should not
        self.assertNotIn("owasp_id", findings[0])
        self.assertIn("owasp_id", findings[1])
        self.assertNotIn("owasp_id", findings[2])

    @patch("subprocess.run")
    def test_run_ruff_scan_invalid_json(self, mock_run):
        """Invalid JSON output from ruff returns empty list gracefully."""
        mock_version = MagicMock(returncode=0)
        mock_check = MagicMock()
        mock_check.returncode = 0
        mock_check.stdout = "not valid json"
        mock_run.side_effect = [mock_version, mock_check]

        findings = run_ruff_scan("/fake/path", use_mock=False)
        self.assertEqual(findings, [])
