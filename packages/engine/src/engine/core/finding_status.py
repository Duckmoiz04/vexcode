"""
Per-finding status constants for Option A (per-finding status persistence).

The `status` field tracks whether a finding has been addressed by the user.
It lives alongside each finding in the report JSON and survives page reload.

Values:
    - "open"            : User has not addressed this finding (default).
    - "applied"         : User clicked "Apply Fix"; fix was applied to the source file.
    - "false_positive"  : User marked this finding as a false positive; ignore going forward.
    - "ignored"         : User explicitly chose to ignore this finding.

The field is opt-in: missing `status` in the JSON is treated as "open" by all
consumer code (engine, CLI, web). This keeps old reports backward-compatible.
"""

from typing import Literal

# Status enum (Python side). Mirrors the TypeScript FindingStatus type.
FindingStatus = Literal["open", "applied", "false_positive", "ignored"]

# Default value used when the field is missing from a finding on disk.
DEFAULT_STATUS: FindingStatus = "open"

# All valid status values. Use this for validation in CLI endpoints.
VALID_STATUSES: frozenset[FindingStatus] = frozenset(
    ["open", "applied", "false_positive", "ignored"]
)
