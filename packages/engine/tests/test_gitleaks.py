import unittest
from unittest.mock import patch, MagicMock
import subprocess
import json

from engine.pipeline.gitleaks_scanner import run_gitleaks_scan
from engine.pipeline.scanner import get_git_state

class TestGitleaksScan(unittest.TestCase):
    def test_run_gitleaks_scan_mock(self):
        """Mock mode returns simulated secret findings with OWASP mapping."""
        findings = run_gitleaks_scan("/fake/path", use_mock=True)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["rule_id"], "gitleaks/mock-secret")
        self.assertEqual(findings[0]["category"], "security")
        self.assertEqual(findings[0]["cwe_id"], "CWE-798")
        self.assertEqual(findings[0]["owasp_id"], "OWASP-A07")

    @patch("engine.pipeline.gitleaks_scanner.get_git_state")
    def test_run_gitleaks_scan_not_git_repo(self, mock_get_git_state):
        """Not a git repo returns empty findings gracefully."""
        mock_get_git_state.return_value = None
        findings = run_gitleaks_scan("/fake/path", use_mock=False)
        self.assertEqual(findings, [])

    @patch("engine.pipeline.gitleaks_scanner.get_git_state")
    @patch("subprocess.run")
    def test_run_gitleaks_scan_gitleaks_missing(self, mock_run, mock_get_git_state):
        """If gitleaks is not on the system PATH, fail gracefully."""
        mock_get_git_state.return_value = {"commit": "abcdef", "is_dirty": False}
        mock_run.side_effect = FileNotFoundError("gitleaks not found")
        findings = run_gitleaks_scan("/fake/path", use_mock=False)
        self.assertEqual(findings, [])

    @patch("engine.pipeline.gitleaks_scanner.get_git_state")
    @patch("subprocess.run")
    def test_run_gitleaks_scan_success(self, mock_run, mock_get_git_state):
        """Parse gitleaks JSON output and format findings correctly."""
        mock_get_git_state.return_value = {"commit": "abcdef", "is_dirty": False}
        
        # Mock gitleaks version check then gitleaks detect check
        mock_version = MagicMock()
        mock_version.returncode = 0
        
        mock_detect = MagicMock()
        mock_detect.returncode = 0
        mock_detect.stdout = json.dumps([
            {
                "RuleID": "generic-api-key",
                "Description": "Generic API Key",
                "File": "config.json",
                "StartLine": 12,
                "Secret": "AIzaSy..."
            }
        ])
        
        mock_run.side_effect = [mock_version, mock_detect]

        findings = run_gitleaks_scan("/fake/path", use_mock=False)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["rule_id"], "gitleaks/generic-api-key")
        self.assertEqual(findings[0]["file"], "config.json")
        self.assertEqual(findings[0]["line"], 12)
        self.assertEqual(findings[0]["category"], "security")
        self.assertEqual(findings[0]["cwe_id"], "CWE-798")
        self.assertEqual(findings[0]["owasp_id"], "OWASP-A07")

    @patch("subprocess.run")
    def test_get_git_state_success(self, mock_run):
        mock_is_inside = MagicMock(returncode=0, stdout="true")
        mock_commit = MagicMock(returncode=0, stdout="abcdef123456")
        mock_status = MagicMock(returncode=0, stdout=" M example.py")
        
        mock_run.side_effect = [mock_is_inside, mock_commit, mock_status]
        
        state = get_git_state("/fake/path")
        self.assertIsNotNone(state)
        self.assertEqual(state["commit"], "abcdef123456")
        self.assertTrue(state["is_dirty"])

    @patch("subprocess.run")
    def test_get_git_state_non_git(self, mock_run):
        mock_is_inside = MagicMock(returncode=1, stdout="false")
        mock_run.side_effect = [mock_is_inside]
        
        state = get_git_state("/fake/path")
        self.assertIsNone(state)
