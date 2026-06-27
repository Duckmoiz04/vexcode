"""Content-based duplicate code detection.

Detects duplicated code blocks across source files using normalized
sliding-window hashing.  Focuses on exact or near-exact duplicates
(token-normalized), not semantic clones.

Thresholds are read from engine.config.constants.
"""

import hashlib
import os
import re
import logging
from typing import Dict, Any, List, Set, Tuple

from engine.config.constants import DUP_MIN_LINES, DUP_MIN_TOKENS

logger = logging.getLogger(__name__)

# Regex to remove string literals and numbers for normalization
_STRING_LITERAL_RE = re.compile(r"'[^']*'|\"[^\"]*\"|`[^`]*`")
_NUMBER_RE = re.compile(r'\b\d+(\.\d+)?\b')


def _normalize_line(line: str) -> str:
    """Normalize a line: strip strings, numbers, whitespace.

    Turns ``foo("bar", 42)`` into ``foo( ,  )`` so that structurally
    identical blocks with different literals still match.
    """
    line = _STRING_LITERAL_RE.sub(' ', line)
    line = _NUMBER_RE.sub(' ', line)
    return line.strip()


def _normalize_source(source: str) -> List[str]:
    """Split source into normalized non-empty lines."""
    lines = []
    for raw in source.splitlines():
        norm = _normalize_line(raw)
        if norm:
            lines.append(norm)
    return lines


def _hash_window(lines: List[str], start: int, size: int) -> str:
    """Compute a hash for a window of *size* lines starting at *start*."""
    block = '|'.join(lines[start:start + size])
    return hashlib.md5(block.encode('utf-8')).hexdigest()


def _collect_file_blocks(
    file_path: str,
    window_size: int,
) -> Tuple[List[str], Dict[str, List[int]]]:
    """Return (normalized_lines, {hash: [start_line, ...]}) for one file.

    Returns empty structures for non-readable files.
    """
    if not os.path.isfile(file_path):
        return [], {}
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            source = f.read()
    except (OSError, UnicodeDecodeError):
        return [], {}

    lines = _normalize_source(source)
    if len(lines) < window_size:
        return lines, {}

    blocks: Dict[str, List[int]] = {}
    for i in range(len(lines) - window_size + 1):
        h = _hash_window(lines, i, window_size)
        blocks.setdefault(h, []).append(i)
    return lines, blocks


def _count_tokens(lines: List[str], start: int, size: int) -> int:
    """Approximate token count for a window."""
    block = ' '.join(lines[start:start + size])
    return len(block.split())


def _find_duplicates(
    source_files: List[str],
    target: str,
    min_lines: int,
    min_tokens: int,
) -> List[Dict[str, Any]]:
    """Find duplicate code blocks across *source_files*.

    Returns a list of duplicate-group dicts, each with:
      - file_a, start_a, end_a (line numbers, 1-based)
      - file_b, start_b, end_b
      - match_lines (number of matching lines)
      - match_tokens (token count)
    """
    window_size = min_lines
    # Map hash -> [(file_idx, start_line)]
    hash_index: Dict[str, List[Tuple[int, int]]] = {}
    file_lines_cache: List[List[str]] = []

    for fi, fpath in enumerate(source_files):
        rel_path = os.path.relpath(fpath, target).replace("\\", "/")
        lines, blocks = _collect_file_blocks(fpath, window_size)
        file_lines_cache.append(lines)
        for h, starts in blocks.items():
            for s in starts:
                hash_index.setdefault(h, []).append((fi, s))

    duplicates: List[Dict[str, Any]] = []
    seen_pairs: Set[Tuple[str, int, str, int]] = set()

    for h, locations in hash_index.items():
        if len(locations) < 2:
            continue
        # Pair each location with later ones
        for i in range(len(locations)):
            for j in range(i + 1, len(locations)):
                fi_a, start_a = locations[i]
                fi_b, start_b = locations[j]
                # Skip same-file pairs adjacent within window_size
                if fi_a == fi_b and abs(start_a - start_b) <= window_size:
                    continue

                # Extend match beyond the minimum window
                match_size = window_size
                lines_a = file_lines_cache[fi_a]
                lines_b = file_lines_cache[fi_b]
                while (start_a + match_size < len(lines_a) and
                       start_b + match_size < len(lines_b) and
                       lines_a[start_a + match_size] == lines_b[start_b + match_size]):
                    match_size += 1

                # Check token threshold
                tokens = _count_tokens(lines_a, start_a, match_size)
                if tokens < min_tokens:
                    continue

                # Deduplication key
                ra = os.path.relpath(source_files[fi_a], target).replace("\\", "/")
                rb = os.path.relpath(source_files[fi_b], target).replace("\\", "/")
                pair_key = (ra, start_a, rb, start_b)
                rev_key = (rb, start_b, ra, start_a)
                if pair_key in seen_pairs or rev_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                duplicates.append({
                    "file_a": ra,
                    "start_a": start_a + 1,  # 1-based
                    "end_a": start_a + match_size,
                    "file_b": rb,
                    "start_b": start_b + 1,
                    "end_b": start_b + match_size,
                    "match_lines": match_size,
                    "match_tokens": tokens,
                })

    # Sort by match_lines descending, limit to manageable number
    duplicates.sort(key=lambda d: -d["match_lines"])
    return duplicates[:50]


def gen_duplication_findings(
    metrics: Dict[str, Any],
    target: str,
    source_files: List[str],
    min_lines: int = DUP_MIN_LINES,
    min_tokens: int = DUP_MIN_TOKENS,
) -> List[Dict[str, Any]]:
    """Generate findings for duplicated code blocks.

    Scans source files using sliding-window content hashing and reports
    duplicate blocks found across different files.

    Args:
        metrics: The metrics dict (unused, kept for API consistency).
        target: Target directory path.
        source_files: List of absolute source file paths to scan.
        min_lines: Minimum matching line count to report (default: 6).
        min_tokens: Minimum token count to report (default: 50).

    Returns:
        A list of finding dicts for duplicate code blocks.
    """
    if not source_files:
        return []

    dup_groups = _find_duplicates(source_files, target, min_lines, min_tokens)

    findings: List[Dict[str, Any]] = []
    for d in dup_groups:
        message = (
            f"Duplicate code block found: {d['file_a']}:{d['start_a']}-{d['end_a']} "
            f"and {d['file_b']}:{d['start_b']}-{d['end_b']} "
            f"({d['match_lines']} lines, {d['match_tokens']} tokens). "
            f"Consider extracting into a shared function."
        )
        findings.append({
            "file": d["file_a"],
            "line": d["start_a"],
            "rule_id": "maintainability.duplicate-code.block",
            "message": message,
            "severity": "info",
            "iso_25010": "maintainability",
            "duplicate": {
                "other_file": d["file_b"],
                "other_start": d["start_b"],
                "other_end": d["end_b"],
                "match_lines": d["match_lines"],
                "match_tokens": d["match_tokens"],
            },
        })

    return findings
