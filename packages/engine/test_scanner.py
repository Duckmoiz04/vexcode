import unittest
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scanner import run_scan, MOCK_FINDINGS


class TestScanner(unittest.TestCase):

    def test_run_scan_mock_returns_expected_keys(self):
        result = run_scan("/fake/target", use_mock=True)
        self.assertIn("scanner", result)
        self.assertIn("timestamp", result)
        self.assertIn("target_path", result)
        self.assertIn("findings", result)

    def test_run_scan_mock_scanner_field(self):
        result = run_scan("/fake/target", use_mock=True)
        self.assertEqual(result["scanner"], "semgrep-mock")

    def test_run_scan_mock_target_path_preserved(self):
        result = run_scan("/fake/target", use_mock=True)
        self.assertEqual(result["target_path"], "/fake/target")

    def test_run_scan_mock_returns_mock_findings(self):
        result = run_scan("/fake/target", use_mock=True)
        self.assertEqual(result["findings"], MOCK_FINDINGS)

    def test_mock_findings_structure(self):
        self.assertIsInstance(MOCK_FINDINGS, list)
        self.assertGreater(len(MOCK_FINDINGS), 0)
        for finding in MOCK_FINDINGS:
            self.assertIn("file", finding)
            self.assertIn("line", finding)
            self.assertIn("rule_id", finding)
            self.assertIn("message", finding)
            self.assertIn("severity", finding)
            self.assertIn("code_text", finding)

    def test_run_scan_mock_with_files_filter(self):
        result = run_scan("/fake/target", use_mock=True, files=["example.py"])
        self.assertEqual(len(result["findings"]), 1)
        self.assertEqual(result["findings"][0]["file"], "example.py")

    def test_run_scan_mock_with_files_no_match(self):
        result = run_scan("/fake/target", use_mock=True, files=["nonexistent.py"])
        self.assertEqual(len(result["findings"]), 0)

    def test_run_scan_mock_timestamp_is_iso_format(self):
        result = run_scan("/fake/target", use_mock=True)
        ts = result["timestamp"]
        self.assertIn("T", ts)
        self.assertTrue(ts.endswith("Z"))


if __name__ == "__main__":
    unittest.main()