"""Tests for engine.core.dedup — deduplicate_findings()."""


class TestDedup:
    """Tests for the deduplicate_findings deduplication function."""

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _finding(rule_id: str, file: str, line: int, **overrides: str) -> dict:
        """Return a minimal finding dict with the given key fields."""
        d: dict = {
            "rule_id": rule_id,
            "file": file,
            "line": line,
            "message": "some issue",
            "severity": "WARNING",
        }
        d.update(overrides)
        return d

    # ------------------------------------------------------------------
    # (a) Three identical findings → one remains
    # ------------------------------------------------------------------

    def test_dedup_removes_exact_duplicates(self):
        """3 identical (rule_id, file, line) → 1 remains."""
        from engine.core.dedup import deduplicate_findings

        finding = self._finding("test.rule", "app.py", 10)
        findings = [finding, dict(finding), dict(finding)]

        result = deduplicate_findings(findings)

        assert len(result) == 1
        assert result[0] == finding

    # ------------------------------------------------------------------
    # (b) Different rules on same line → all kept
    # ------------------------------------------------------------------

    def test_dedup_keeps_different_rules_same_line(self):
        """Different rule_ids on the same (file, line) are not duplicates."""
        from engine.core.dedup import deduplicate_findings

        findings = [
            self._finding("rule.one", "app.py", 10),
            self._finding("rule.two", "app.py", 10),
            self._finding("rule.three", "app.py", 10),
        ]

        result = deduplicate_findings(findings)

        assert len(result) == 3

    # ------------------------------------------------------------------
    # (c) Empty list → empty list
    # ------------------------------------------------------------------

    def test_dedup_empty_list(self):
        """Empty input returns empty list."""
        from engine.core.dedup import deduplicate_findings

        assert deduplicate_findings([]) == []

    # ------------------------------------------------------------------
    # Edge cases
    # ------------------------------------------------------------------

    def test_dedup_same_rule_different_files(self):
        """Same rule_id on different files are NOT duplicates."""
        from engine.core.dedup import deduplicate_findings

        findings = [
            self._finding("test.rule", "app.py", 10),
            self._finding("test.rule", "utils.py", 10),
        ]

        result = deduplicate_findings(findings)

        assert len(result) == 2

    def test_dedup_same_rule_same_file_different_lines(self):
        """Same rule_id, same file, but different lines are NOT duplicates."""
        from engine.core.dedup import deduplicate_findings

        findings = [
            self._finding("test.rule", "app.py", 10),
            self._finding("test.rule", "app.py", 20),
            self._finding("test.rule", "app.py", 30),
        ]

        result = deduplicate_findings(findings)

        assert len(result) == 3

    def test_dedup_mixed_duplicates(self):
        """Mixed scenario: some duplicates, some unique — correct counts."""
        from engine.core.dedup import deduplicate_findings

        findings = [
            self._finding("r1", "a.py", 1),  # keep
            self._finding("r1", "a.py", 1),  # dup → skip
            self._finding("r2", "a.py", 1),  # keep (different rule)
            self._finding("r1", "b.py", 1),  # keep (different file)
            self._finding("r1", "a.py", 1),  # dup → skip
            self._finding("r1", "a.py", 2),  # keep (different line)
        ]

        result = deduplicate_findings(findings)

        assert len(result) == 4

    def test_dedup_input_order_preserved(self):
        """Deduplicated list preserves original order of first occurrence."""
        from engine.core.dedup import deduplicate_findings

        findings = [
            self._finding("r1", "a.py", 1),
            self._finding("r2", "a.py", 1),
            self._finding("r1", "a.py", 1),  # duplicate of first
            self._finding("r3", "a.py", 1),
        ]

        result = deduplicate_findings(findings)

        assert len(result) == 3
        assert result[0]["rule_id"] == "r1"
        assert result[1]["rule_id"] == "r2"
        assert result[2]["rule_id"] == "r3"
