"""Deduplication module — removes duplicate findings before AI resolution.

A finding is considered a duplicate when another finding shares the
same (rule_id, file, line) triple. This typically happens when the same
rule fires on the same source location across overlapping scan passes.
"""

from engine.utils.logger import get_logger

logger = get_logger(__name__)


def deduplicate_findings(findings: list) -> list:
    """Remove duplicate findings based on (rule_id, file, line) key.

    The first occurrence of a given key is kept; later duplicates are
    discarded.  The input list order is preserved (stable).

    Args:
        findings: List of finding dicts, each expected to contain at
            least ``rule_id``, ``file``, and ``line`` keys.

    Returns:
        Deduplicated list of findings.
    """
    if not findings:
        return []

    seen: set[tuple[str, str, int]] = set()
    unique: list = []
    dupes = 0

    for f in findings:
        key = (f["rule_id"], f["file"], f["line"])
        if key in seen:
            dupes += 1
        else:
            seen.add(key)
            unique.append(f)

    if dupes:
        logger.info(
            f"Dedup: removed {dupes} duplicate "
            f"finding(s), {len(unique)} remain"
        )

    return unique
