"""Unit tests for ISO/IEC 25010 taxonomy classifier — simplified mapping.

The classifier now maps OpenGrep's 4 native categories to ISO 25010
terms, plus a direct ``iso_25010`` override for internal findings.
"""

import os
import sys

import pytest

# Ensure src/ is on path for direct pytest invocation from the engine dir
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, "src")
)

from engine.config.iso25010_taxonomy import (  # noqa: E402
    MAINTAINABILITY,
    PERFORMANCE,
    PHASE_1_CATEGORIES,
    RELIABILITY,
    SECURITY,
    classify_finding,
    compute_finding_id,
    SEMGREP_TO_ISO25010,
)


# ---------------------------------------------------------------------------
# compute_finding_id
# ---------------------------------------------------------------------------

class TestComputeFindingId:
    """Tests for compute_finding_id() — must be stable + collision-resistant."""

    def test_returns_12_hex_chars(self):
        fid = compute_finding_id("src/foo.py", 42, "rule.x")
        assert isinstance(fid, str)
        assert len(fid) == 12
        assert all(c in "0123456789abcdef" for c in fid)

    def test_same_inputs_produce_same_id(self):
        a = compute_finding_id("src/foo.py", 42, "rule.x")
        b = compute_finding_id("src/foo.py", 42, "rule.x")
        assert a == b

    def test_different_line_produces_different_id(self):
        a = compute_finding_id("src/foo.py", 42, "rule.x")
        b = compute_finding_id("src/foo.py", 43, "rule.x")
        assert a != b

    def test_different_file_produces_different_id(self):
        a = compute_finding_id("src/foo.py", 42, "rule.x")
        b = compute_finding_id("src/bar.py", 42, "rule.x")
        assert a != b

    def test_different_rule_produces_different_id(self):
        a = compute_finding_id("src/foo.py", 42, "rule.x")
        b = compute_finding_id("src/foo.py", 42, "rule.y")
        assert a != b

    def test_handles_unicode_path(self):
        fid = compute_finding_id("src/tiện_ích/hàm.py", 10, "rule.x")
        assert len(fid) == 12

    def test_stable_across_runs(self):
        a = compute_finding_id("a.py", 1, "x.y.z")
        b = compute_finding_id("a.py", 1, "x.y.z")
        assert a == b

    def test_realistic_semgrep_rule(self):
        fid = compute_finding_id(
            "/home/user/project/src/auth/login.py",
            87,
            "python.lang.security.audit.dangerous-exec",
        )
        assert len(fid) == 12
        int(fid, 16)  # raises if not hex


# ---------------------------------------------------------------------------
# classify_finding — SEMGREP_TO_ISO25010 mapping
# ---------------------------------------------------------------------------

class TestClassifyByCategory:
    """Mapping through SEMGREP_TO_ISO25010 dict."""

    @pytest.mark.parametrize("native_cat,expected", [
        ("security", SECURITY),
        ("correctness", RELIABILITY),
        ("best-practice", MAINTAINABILITY),
        ("performance", PERFORMANCE),
    ])
    def test_open_grep_category_maps_correctly(self, native_cat, expected):
        assert classify_finding({"category": native_cat}) == expected

    @pytest.mark.parametrize("native_cat", [
        "security", "correctness", "best-practice", "performance",
    ])
    def test_mapping_is_contained_in_dict(self, native_cat):
        assert native_cat in SEMGREP_TO_ISO25010

    def test_case_insensitive_mapping(self):
        assert classify_finding({"category": "SECURITY"}) == SECURITY
        assert classify_finding({"category": "Correctness"}) == RELIABILITY

    def test_unknown_category_returns_none(self):
        assert classify_finding({"category": "unknown"}) is None
        assert classify_finding({"category": "usability"}) is None

    def test_missing_category_returns_none(self):
        assert classify_finding({}) is None

    def test_none_category_returns_none(self):
        assert classify_finding({"category": None}) is None

    def test_empty_string_category_returns_none(self):
        assert classify_finding({"category": ""}) is None

    def test_iso_25010_override_wins(self):
        mapping_under_test = classify_finding({
            "category": "correctness",   # would normally map to reliability
            "iso_25010": "performance",  # but override wins
        })
        assert mapping_under_test == PERFORMANCE

    def test_iso_25010_override_with_unknown_category(self):
        result = classify_finding({
            "category": "unknown",
            "iso_25010": "maintainability",
        })
        assert result == MAINTAINABILITY

    def test_iso_25010_override_invalid_ignored(self):
        # Invalid iso_25010 value should be ignored, falls through to category
        assert classify_finding({
            "category": "security",
            "iso_25010": "not_a_real_category",
        }) == SECURITY
        assert classify_finding({
            "category": "best-practice",
            "iso_25010": None,
        }) == MAINTAINABILITY


# ---------------------------------------------------------------------------
# Edge cases — must never raise
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Edge cases that must never raise."""

    def test_empty_dict(self):
        assert classify_finding({}) is None

    def test_none_fields(self):
        assert classify_finding({
            "rule_id": None, "message": None, "category": None,
        }) is None

    def test_missing_fields(self):
        assert classify_finding({"random_field": "value"}) is None

    def test_unicode_message_no_match(self):
        assert classify_finding({
            "category": "nonexistent",
            "message": "Lỗi không xác định được nguyên nhân",
        }) is None

    def test_handles_all_field_types(self):
        assert classify_finding({"category": 123}) is None  # not a string
        assert classify_finding({"category": []}) is None   # not a string
        assert classify_finding({"category": True}) is None  # not a string


# ---------------------------------------------------------------------------
# Phase 1 contract
# ---------------------------------------------------------------------------

class TestPhase1Contract:
    """Phase 1 contract: exactly 4 categories."""

    def test_phase_1_has_exactly_4_categories(self):
        assert len(PHASE_1_CATEGORIES) == 4

    def test_phase_1_categories_exact_set(self):
        assert PHASE_1_CATEGORIES == {
            SECURITY, RELIABILITY, MAINTAINABILITY, PERFORMANCE,
        }

    def test_all_open_grep_categories_are_mapped(self):
        assert set(SEMGREP_TO_ISO25010.values()) == PHASE_1_CATEGORIES


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------

class TestDeterminism:
    """Same input must always produce same output."""

    def test_classify_is_deterministic(self):
        finding = {
            "category": "security",
            "rule_id": "python.lang.security.audit.dangerous-exec",
            "message": "exec() call with user input",
        }
        results = {classify_finding(finding) for _ in range(100)}
        assert len(results) == 1

    def test_id_is_deterministic(self):
        args = ("src/foo.py", 42, "rule.x")
        ids = {compute_finding_id(*args) for _ in range(100)}
        assert len(ids) == 1
