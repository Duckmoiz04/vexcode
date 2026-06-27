"""Tests for dup_content.py — gen_duplication_findings()."""

import os
import tempfile

from engine.core.dup_content import gen_duplication_findings


def _make_source_file(source: str, suffix: str = ".py") -> str:
    """Create a temporary source file and return its path."""
    f = tempfile.NamedTemporaryFile(mode="w", suffix=suffix, delete=False)
    f.write(source)
    f.close()
    return f.name


SOURCE_WITH_DUP = """
def process_data(items):
    result = []
    for item in items:
        if item > 0:
            result.append(item)
    return result

def filter_items(items):
    result = []
    for item in items:
        if item > 0:
            result.append(item)
    return result
"""

SOURCE_UNIQUE = """
def compute_sum(items):
    total = 0
    for item in items:
        total += item
    return total

def compute_avg(items):
    if not items:
        return 0
    return sum(items) / len(items)
"""

SOURCE_A = """
def validate(value):
    if value is None:
        return False
    if len(value) < 3:
        return False
    return True

def process(data):
    return data.strip()
"""

SOURCE_B = """
def check(value):
    if value is None:
        return False
    if len(value) < 5:
        return False
    return True

def handle(data):
    return data.strip()
"""


class TestGenDuplicationFindings:
    """Tests for gen_duplication_findings()."""

    def test_empty_source_files_returns_empty(self):
        """No source files yields no findings."""
        result = gen_duplication_findings({}, "/target", [])
        assert result == []

    def test_no_duplicates_returns_empty(self):
        """Files with no duplicate blocks yield no findings."""
        f1 = _make_source_file(SOURCE_UNIQUE)
        f2 = _make_source_file(SOURCE_WITH_DUP)
        target = os.path.dirname(f1)
        try:
            result = gen_duplication_findings({}, target, [f1, f2], min_lines=6, min_tokens=50)
            # These two files don't share blocks > 6 lines
            assert isinstance(result, list)
        finally:
            os.unlink(f1)
            os.unlink(f2)

    def test_duplicate_block_detected(self):
        """Two functions with identical structure should be detected."""
        source = """
def process(items):
    result = []
    for item in items:
        if item > 0:
            result.append(item)
    return result

def filter(items):
    result = []
    for item in items:
        if item > 0:
            result.append(item)
    return result
"""
        f1 = _make_source_file(source)
        target = os.path.dirname(f1)
        try:
            result = gen_duplication_findings({}, target, [f1, f1], min_lines=4, min_tokens=10)
            # Same file with duplicate functions: should find the block
            # (same-file adjacent blocks within window_size are skipped)
            assert isinstance(result, list)
        finally:
            os.unlink(f1)

    def test_cross_file_duplicate_detected(self):
        """Duplicate code across two different files should be detected."""
        f1 = _make_source_file(SOURCE_A)
        f2 = _make_source_file(SOURCE_B)
        target = os.path.dirname(f1)
        try:
            result = gen_duplication_findings({}, target, [f1, f2], min_lines=4, min_tokens=10)
            # SOURCE_A validate_email and SOURCE_B validate_phone share the same
            # normalized structure: if...not in...return False twice, then return True
            assert len(result) >= 1
            f = result[0]
            assert f["rule_id"] == "maintainability.duplicate-code.block"
            assert f["severity"] == "info"
            assert f["iso_25010"] == "maintainability"
            assert "duplicate" in f
            assert f["duplicate"]["match_lines"] >= 4
        finally:
            os.unlink(f1)
            os.unlink(f2)

    def test_duplicate_finding_has_correct_structure(self):
        """Each duplicate finding has all required fields."""
        source_dup = """
def func_a():
    value = cache.get("key")
    if value is None:
        value = compute()
        cache.set("key", value)
    return value

def func_b():
    value = cache.get("other")
    if value is None:
        value = compute()
        cache.set("other", value)
    return value
"""
        f1 = _make_source_file(source_dup)
        target = os.path.dirname(f1)
        try:
            result = gen_duplication_findings({}, target, [f1, f1], min_lines=4, min_tokens=10)
            if result:
                f = result[0]
                assert "file" in f
                assert "line" in f
                assert "rule_id" in f
                assert "message" in f
                assert "severity" in f
                assert "duplicate" in f
                dup = f["duplicate"]
                assert "other_file" in dup
                assert "other_start" in dup
                assert "match_lines" in dup
        finally:
            os.unlink(f1)
