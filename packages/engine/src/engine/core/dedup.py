"""Deduplication module — removes duplicate findings before AI resolution.

A finding is considered a duplicate when another finding shares the
same dedup key.  Key resolution order:
1. OpenGrep fingerprint (most accurate — content-aware)
2. (rule_id, file, line) triple (fallback for non-OpenGrep scanners)
"""

from engine.utils.logger import get_logger

logger = get_logger(__name__)


def _dedup_key(finding: dict):
    fp = finding.get("fingerprint")
    if fp:
        return ("fp", fp)
    rule_id = finding.get("rule_id")
    file = finding.get("file")
    line = finding.get("line")
    if rule_id is None or file is None or line is None:
        return None
    return ("legacy", str(rule_id), str(file), line)


def deduplicate_findings(findings: list) -> list:
    if not findings:
        return []

    seen: set = set()
    unique: list = []
    dupes = 0

    for f in findings:
        key = _dedup_key(f)
        if key is None:
            unique.append(f)
            continue
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
