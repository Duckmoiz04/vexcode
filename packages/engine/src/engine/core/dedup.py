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

    seen: set = set()
    unique: list = []
    dupes = 0

    for f in findings:
        rule_id = f.get("rule_id")
        file = f.get("file")
        line = f.get("line")
        if rule_id is None or file is None or line is None:
            # Malformed finding — keep it but don't dedup
            unique.append(f)
            continue
        key = (str(rule_id), str(file), line)
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
