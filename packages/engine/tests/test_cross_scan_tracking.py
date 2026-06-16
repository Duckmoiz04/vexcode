"""Tests for cross-scan finding status tracking.

Tests classify_findings_against_previous() and get_previous_report_path().
"""

import json
import os
import tempfile
from unittest.mock import patch

import pytest


class TestGetPreviousReportPath:
    """Tests for get_previous_report_path()."""

    def test_returns_none_when_no_reports_dir(self):
        """No reports directory → None."""
        from engine.pipeline.scanner import get_previous_report_path

        with tempfile.TemporaryDirectory() as tmpdir:
            result = get_previous_report_path("/fake/target", reports_base_dir=tmpdir)
            assert result is None

    def test_returns_none_when_no_reports_for_project(self):
        """Reports dir exists but not for this project → None."""
        from engine.pipeline.scanner import get_previous_report_path

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create reports dir for a different project
            os.makedirs(os.path.join(tmpdir, "other_project"))
            result = get_previous_report_path("/fake/target", reports_base_dir=tmpdir)
            assert result is None

    def test_returns_latest_report(self):
        """Returns the most recent report file."""
        from engine.pipeline.scanner import get_previous_report_path

        with tempfile.TemporaryDirectory() as tmpdir:
            project_dir = os.path.join(tmpdir, "target")
            os.makedirs(project_dir)

            # Create two reports
            old_report = os.path.join(project_dir, "report_2026-06-01.json")
            new_report = os.path.join(project_dir, "report_2026-06-15.json")

            with open(old_report, "w") as f:
                json.dump({"findings": []}, f)
            with open(new_report, "w") as f:
                json.dump({"findings": []}, f)

            # Make new_report newer
            os.utime(new_report, (os.path.getmtime(new_report) + 100,) * 2)

            result = get_previous_report_path("/fake/target", reports_base_dir=tmpdir)
            assert result == new_report


class TestClassifyFindingsAgainstPrevious:
    """Tests for classify_findings_against_previous()."""

    def test_no_previous_report_all_new(self):
        """No previous report → all findings are 'new'."""
        from engine.pipeline.scanner import classify_findings_against_previous

        findings = [
            {"id": "abc123", "file": "a.py", "line": 1, "rule_id": "r1"},
            {"id": "def456", "file": "b.py", "line": 2, "rule_id": "r2"},
        ]
        result = classify_findings_against_previous(findings, None)

        assert len(result) == 2
        assert all(f["scan_status"] == "new" for f in result)

    def test_previous_report_not_found_all_new(self):
        """Previous report path doesn't exist → all findings are 'new'."""
        from engine.pipeline.scanner import classify_findings_against_previous

        findings = [{"id": "abc123", "file": "a.py", "line": 1, "rule_id": "r1"}]
        result = classify_findings_against_previous(findings, "/nonexistent/path.json")

        assert len(result) == 1
        assert result[0]["scan_status"] == "new"

    def test_finding_in_both_reports_persisting(self):
        """Finding in both reports → 'persisting'."""
        from engine.pipeline.scanner import classify_findings_against_previous

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({
                "findings": [
                    {"id": "abc123", "file": "a.py", "line": 1, "rule_id": "r1"},
                ]
            }, f)
            prev_path = f.name

        try:
            findings = [{"id": "abc123", "file": "a.py", "line": 1, "rule_id": "r1"}]
            result = classify_findings_against_previous(findings, prev_path)

            assert len(result) == 1
            assert result[0]["scan_status"] == "persisting"
        finally:
            os.unlink(prev_path)

    def test_new_finding_not_in_previous(self):
        """Finding not in previous report → 'new'."""
        from engine.pipeline.scanner import classify_findings_against_previous

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({
                "findings": [
                    {"id": "old111", "file": "old.py", "line": 1, "rule_id": "r1"},
                ]
            }, f)
            prev_path = f.name

        try:
            findings = [{"id": "new222", "file": "new.py", "line": 2, "rule_id": "r2"}]
            result = classify_findings_against_previous(findings, prev_path)

            # 1 new + 1 resolved
            assert len(result) == 2
            new_finding = next(f for f in result if f["id"] == "new222")
            assert new_finding["scan_status"] == "new"
        finally:
            os.unlink(prev_path)

    def test_previous_finding_not_in_current_resolved(self):
        """Previous finding not in current → virtual 'resolved' finding added."""
        from engine.pipeline.scanner import classify_findings_against_previous

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({
                "findings": [
                    {"id": "old111", "file": "old.py", "line": 1, "rule_id": "r1", "severity": "warning"},
                    {"id": "still222", "file": "still.py", "line": 2, "rule_id": "r2", "severity": "error"},
                ]
            }, f)
            prev_path = f.name

        try:
            # Only one finding remains (old111 was fixed)
            findings = [{"id": "still222", "file": "still.py", "line": 2, "rule_id": "r2"}]
            result = classify_findings_against_previous(findings, prev_path)

            assert len(result) == 2
            resolved = next(f for f in result if f["id"] == "old111")
            assert resolved["scan_status"] == "resolved"
            persisting = next(f for f in result if f["id"] == "still222")
            assert persisting["scan_status"] == "persisting"
        finally:
            os.unlink(prev_path)

    def test_regressed_finding_was_applied(self):
        """Finding was marked 'applied' in previous, reappears → 'regressed'."""
        from engine.pipeline.scanner import classify_findings_against_previous

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({
                "findings": [
                    {"id": "reg111", "file": "reg.py", "line": 1, "rule_id": "r1", "status": "applied"},
                ]
            }, f)
            prev_path = f.name

        try:
            findings = [{"id": "reg111", "file": "reg.py", "line": 1, "rule_id": "r1"}]
            result = classify_findings_against_previous(findings, prev_path)

            assert len(result) == 1
            assert result[0]["scan_status"] == "regressed"
        finally:
            os.unlink(prev_path)

    def test_regressed_finding_was_applied_flag(self):
        """Finding had _applied=true in previous, reappears → 'regressed'."""
        from engine.pipeline.scanner import classify_findings_against_previous

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({
                "findings": [
                    {"id": "reg111", "file": "reg.py", "line": 1, "rule_id": "r1", "_applied": True},
                ]
            }, f)
            prev_path = f.name

        try:
            findings = [{"id": "reg111", "file": "reg.py", "line": 1, "rule_id": "r1"}]
            result = classify_findings_against_previous(findings, prev_path)

            assert len(result) == 1
            assert result[0]["scan_status"] == "regressed"
        finally:
            os.unlink(prev_path)

    def test_false_positive_not_resolved(self):
        """Previous finding marked as false_positive → NOT added as resolved."""
        from engine.pipeline.scanner import classify_findings_against_previous

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({
                "findings": [
                    {"id": "fp111", "file": "fp.py", "line": 1, "rule_id": "r1", "status": "false_positive"},
                ]
            }, f)
            prev_path = f.name

        try:
            findings = []  # No current findings
            result = classify_findings_against_previous(findings, prev_path)

            # False positive should NOT be added as resolved
            assert len(result) == 0
        finally:
            os.unlink(prev_path)

    def test_empty_previous_report_all_new(self):
        """Empty previous report (no findings) → all current are 'new'."""
        from engine.pipeline.scanner import classify_findings_against_previous

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"findings": []}, f)
            prev_path = f.name

        try:
            findings = [{"id": "abc123", "file": "a.py", "line": 1, "rule_id": "r1"}]
            result = classify_findings_against_previous(findings, prev_path)

            assert len(result) == 1
            assert result[0]["scan_status"] == "new"
        finally:
            os.unlink(prev_path)

    def test_computes_id_when_missing(self):
        """Findings without id field → computes id from file+line+rule_id."""
        from engine.pipeline.scanner import classify_findings_against_previous

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({
                "findings": [
                    {"file": "a.py", "line": 1, "rule_id": "r1"},  # No id
                ]
            }, f)
            prev_path = f.name

        try:
            # Same finding, also without id
            findings = [{"file": "a.py", "line": 1, "rule_id": "r1"}]
            result = classify_findings_against_previous(findings, prev_path)

            assert len(result) == 1
            assert result[0]["scan_status"] == "persisting"
            assert "id" in result[0]  # ID was computed
        finally:
            os.unlink(prev_path)
