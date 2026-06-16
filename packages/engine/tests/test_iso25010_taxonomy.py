"""Unit tests for ISO/IEC 25010 taxonomy classifier.

Reference: ISO/IEC 25010:2011 — Systems and software engineering — Systems
and software Quality Requirements and Evaluation (SQuaRE) — System and
software quality models.
"""

import os
import sys

import pytest

# Ensure src/ is on path for direct pytest invocation from the engine dir
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, "src")
)

from engine.config.iso25010_taxonomy import (  # noqa: E402
    DEFAULT_CATEGORY,
    MAINTAINABILITY,
    PERFORMANCE,
    PHASE_1_CATEGORIES,
    RELIABILITY,
    SECURITY,
    classify_finding,
    compute_finding_id,
    get_phase_1_categories,
    is_valid_category,
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
        # Vietnamese path with diacritics
        fid = compute_finding_id("src/tiện_ích/hàm.py", 10, "rule.x")
        assert len(fid) == 12

    def test_stable_across_runs(self):
        # Same inputs across two function calls = same output
        a = compute_finding_id("a.py", 1, "x.y.z")
        b = compute_finding_id("a.py", 1, "x.y.z")
        assert a == b

    def test_realistic_semgrep_rule(self):
        # Mimics a real Semgrep rule_id
        fid = compute_finding_id(
            "/home/user/project/src/auth/login.py",
            87,
            "python.lang.security.audit.dangerous-exec",
        )
        assert len(fid) == 12
        # Should be a real hex string
        int(fid, 16)  # raises if not hex


# ---------------------------------------------------------------------------
# classify_finding — security
# ---------------------------------------------------------------------------

class TestClassifySecurity:
    """Security: injection, XSS, CSRF, crypto, auth, secret."""

    @pytest.mark.parametrize("rule_id", [
        "python.lang.security.audit.dangerous-exec",
        "python.lang.security.audit.formatted-sql-query",
        "javascript.lang.security.audit.xss",
        "javascript.express.security.audit.express-open-redirect",
        "generic.crypto.use_of_hardcoded_key",
        "python.lang.security.audit.weak-hash",
        "python.lang.security.audit.hardcoded-password",
        "python.lang.security.audit.ssrf",
        "python.flask.security.audit.csrf-disabled",
        "python.lang.security.audit.dangerous-deserialization",
    ])
    def test_security_keyword(self, rule_id):
        assert classify_finding({"rule_id": rule_id}) == SECURITY

    @pytest.mark.parametrize("cwe", [
        "CWE-89",   # SQL injection
        "CWE-79",   # XSS
        "CWE-78",   # OS command injection
        "CWE-918",  # SSRF
        "CWE-352",  # CSRF
        "CWE-798",  # Hardcoded credentials
        "CWE-327",  # Broken crypto
        "CWE-22",   # Path traversal
    ])
    def test_security_cwe(self, cwe):
        assert classify_finding({"cwe_id": cwe, "rule_id": "unknown.rule"}) == SECURITY

    def test_cwe_normalization(self):
        # CWE without prefix, with trailing text
        assert classify_finding({"cwe_id": "89", "rule_id": "x"}) == SECURITY
        assert classify_finding({"cwe_id": "CWE-89: SQL Injection", "rule_id": "x"}) == SECURITY
        assert classify_finding({"cwe_id": "cwe-79", "rule_id": "x"}) == SECURITY


# ---------------------------------------------------------------------------
# classify_finding — reliability
# ---------------------------------------------------------------------------

class TestClassifyReliability:
    """Reliability: null, exception, race, resource, validation."""

    @pytest.mark.parametrize("rule_id", [
        "python.lang.correctness.null-check",
        "python.lang.correctness.unused-loop-variable",
        "python.lang.correctness.exception-handling",
        "python.lang.correctness.resource-leak",
        "javascript.express.correctness.unchecked-return-value",
        "java.concurrency.race-condition",
        "generic.error.null-dereference",
    ])
    def test_reliability_keyword(self, rule_id):
        assert classify_finding({"rule_id": rule_id}) == RELIABILITY

    @pytest.mark.parametrize("cwe", [
        "CWE-476",  # NULL Pointer Dereference
        "CWE-252",  # Unchecked Return Value
        "CWE-401",  # Memory Leak
        "CWE-362",  # Race Condition
        "CWE-400",  # Uncontrolled Resource Consumption
    ])
    def test_reliability_cwe(self, cwe):
        assert classify_finding({"cwe_id": cwe, "rule_id": "unknown"}) == RELIABILITY


# ---------------------------------------------------------------------------
# classify_finding — performance
# ---------------------------------------------------------------------------

class TestClassifyPerformance:
    """Performance: complexity, efficiency, memory, loop."""

    @pytest.mark.parametrize("rule_id", [
        "python.lang.performance.high-complexity",
        "python.lang.performance.inefficient-list-comprehension",
        "generic.performance.quadratic-loop",
        "javascript.lang.performance.memory-leak",
        "python.complexity.cyclomatic",
    ])
    def test_performance_keyword(self, rule_id):
        assert classify_finding({"rule_id": rule_id}) == PERFORMANCE

    def test_complexity_keyword(self):
        # "complexity" alone should map to performance
        assert classify_finding({"rule_id": "generic.complexity.too-high"}) == PERFORMANCE

    def test_nested_keyword(self):
        # "nested" → performance
        assert classify_finding({"rule_id": "generic.complexity.too-nested"}) == PERFORMANCE


# ---------------------------------------------------------------------------
# classify_finding — maintainability
# ---------------------------------------------------------------------------

class TestClassifyMaintainability:
    """Maintainability: naming, style, dead code, magic numbers."""

    @pytest.mark.parametrize("rule_id", [
        "python.lang.style.unused-variable",
        "python.lang.style.unused-import",
        "python.lang.style.docstring-missing",
        "python.lang.maintainability.dead-code",
        "python.lang.maintainability.duplicate-code",
        "python.lang.style.magic-number",
        "python.lang.style.obscure-name",
        "python.lang.too-many-params",
        "generic.deprecated.api-usage",
    ])
    def test_maintainability_keyword(self, rule_id):
        assert classify_finding({"rule_id": rule_id}) == MAINTAINABILITY

    @pytest.mark.parametrize("cwe", [
        "CWE-561",  # Dead Code
        "CWE-563",  # Unused Variable
    ])
    def test_maintainability_cwe(self, cwe):
        assert classify_finding({"cwe_id": cwe, "rule_id": "x"}) == MAINTAINABILITY


# ---------------------------------------------------------------------------
# classify_finding — default + edge cases
# ---------------------------------------------------------------------------

class TestClassifyDefaultAndEdgeCases:
    """Default + edge cases — must never raise."""

    def test_default_when_empty(self):
        assert classify_finding({}) == DEFAULT_CATEGORY

    def test_default_when_no_rule_id(self):
        assert classify_finding({"message": "just a message"}) == DEFAULT_CATEGORY

    def test_default_when_unrecognized(self):
        assert classify_finding({"rule_id": "completely.unknown.rule"}) == DEFAULT_CATEGORY

    def test_default_when_unicode_message(self):
        # Vietnamese / accented text with no keyword match
        assert classify_finding({
            "rule_id": "x.y.z",
            "message": "Lỗi không xác định được nguyên nhân",
        }) == DEFAULT_CATEGORY

    def test_handles_none_fields(self):
        # All fields None
        assert classify_finding({"rule_id": None, "message": None, "cwe_id": None}) == DEFAULT_CATEGORY

    def test_handles_missing_fields(self):
        # Fields missing entirely
        assert classify_finding({"random_field": "value"}) == DEFAULT_CATEGORY

    def test_cwe_priority_over_rule_id(self):
        # CWE says "reliability" but rule_id keyword says "security" → CWE wins
        # (CWE-252 is Unchecked Return Value, reliability)
        # But rule_id "secret" would say security
        result = classify_finding({
            "cwe_id": "CWE-252",
            "rule_id": "python.lang.security.audit.hardcoded-secret",
            "message": "hardcoded secret detected",
        })
        # CWE wins → reliability
        assert result == RELIABILITY

    def test_rule_id_priority_over_message(self):
        # rule_id has explicit "maintainability" keyword
        # message could match other categories
        result = classify_finding({
            "rule_id": "python.lang.style.unused-variable",
            "message": "race condition in loop",  # would say reliability
        })
        # rule_id wins → maintainability
        assert result == MAINTAINABILITY

    def test_longest_keyword_match_wins(self):
        # "high-complexity" is in map; "complexity" is also in map
        # Both map to PERFORMANCE, but ensure it doesn't crash
        assert classify_finding({"rule_id": "x.high-complexity"}) == PERFORMANCE
        assert classify_finding({"rule_id": "x.complexity"}) == PERFORMANCE


# ---------------------------------------------------------------------------
# Phase 1 contract
# ---------------------------------------------------------------------------

class TestPhase1Contract:
    """Phase 1 contract: exactly 4 categories, default is maintainability."""

    def test_phase_1_has_exactly_4_categories(self):
        assert len(PHASE_1_CATEGORIES) == 4

    def test_phase_1_categories_exact_set(self):
        assert PHASE_1_CATEGORIES == {
            SECURITY, RELIABILITY, MAINTAINABILITY, PERFORMANCE,
        }

    def test_default_is_maintainability(self):
        assert DEFAULT_CATEGORY == MAINTAINABILITY

    def test_get_phase_1_categories_returns_set(self):
        cats = get_phase_1_categories()
        assert isinstance(cats, set)
        assert len(cats) == 4

    @pytest.mark.parametrize("cat", [SECURITY, RELIABILITY, MAINTAINABILITY, PERFORMANCE])
    def test_is_valid_category_true(self, cat):
        assert is_valid_category(cat) is True

    @pytest.mark.parametrize("cat", [
        "functional_suitability",  # Phase 2 — not yet valid
        "compatibility",           # Phase 2
        "usability",               # Phase 2
        "portability",             # Phase 2
        "unknown",
        "",
        "SECURITY",  # case-sensitive
    ])
    def test_is_valid_category_false(self, cat):
        assert is_valid_category(cat) is False


# ---------------------------------------------------------------------------
# Determinism — same input always produces same output
# ---------------------------------------------------------------------------

class TestDeterminism:
    """Same input must always produce same output (testable, auditable)."""

    def test_classify_is_deterministic(self):
        finding = {
            "rule_id": "python.lang.security.audit.dangerous-exec",
            "message": "exec() call with user input",
            "cwe_id": "CWE-94",
            "file": "src/x.py",
            "line": 10,
        }
        results = {classify_finding(finding) for _ in range(100)}
        assert len(results) == 1  # all calls produce same category

    def test_id_is_deterministic(self):
        args = ("src/foo.py", 42, "rule.x")
        ids = {compute_finding_id(*args) for _ in range(100)}
        assert len(ids) == 1
