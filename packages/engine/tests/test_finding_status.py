"""Unit tests for core/finding_status.py."""
from engine.core.finding_status import FindingStatus, DEFAULT_STATUS, VALID_STATUSES


class TestFindingStatus:
    """Constants and type definitions for per-finding status."""

    def test_default_status_is_open(self):
        assert DEFAULT_STATUS == "open"

    def test_valid_statuses_has_all_four(self):
        assert len(VALID_STATUSES) == 4
        assert "open" in VALID_STATUSES
        assert "applied" in VALID_STATUSES
        assert "false_positive" in VALID_STATUSES
        assert "ignored" in VALID_STATUSES

    def test_valid_statuses_is_frozenset(self):
        assert isinstance(VALID_STATUSES, frozenset)
