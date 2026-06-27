"""ISO/IEC 25010 quality model — taxonomy mapping for VexCode findings.

VexCode maps OpenGrep's 4 native categories to ISO/IEC 25010 quality
characteristics. This mapping is used only by the Web UI dashboard for
display grouping — it has no effect on pipeline logic (smart skip, fix,
review all operate on severity + confidence only).

    OpenGrep native      → ISO/IEC 25010
    ───────────────        ─────────────
    security                Security
    correctness             Reliability
    best-practice           Maintainability
    performance             Performance Efficiency

Custom rules or findings without an OpenGrep category get ``None`` and
are displayed as "Uncategorized" in the dashboard.
"""

from __future__ import annotations

import hashlib
from typing import Dict, Optional, Set

# ---------------------------------------------------------------------------
# Category constants — Phase 1 (active)
# ---------------------------------------------------------------------------

SECURITY: str = "security"
RELIABILITY: str = "reliability"
MAINTAINABILITY: str = "maintainability"
PERFORMANCE: str = "performance"

PHASE_1_CATEGORIES: Set[str] = {
    SECURITY,
    RELIABILITY,
    MAINTAINABILITY,
    PERFORMANCE,
}

# ---------------------------------------------------------------------------
# Category constants — Phase 2 (reserved for future ISO 25010 Sprint)
# ---------------------------------------------------------------------------

FUNCTIONAL_SUITABILITY: str = "functional_suitability"
OPERABILITY: str = "operability"
COMPATIBILITY: str = "compatibility"
TRANSFERABILITY: str = "transferability"

ALL_CATEGORIES: Set[str] = PHASE_1_CATEGORIES | {
    FUNCTIONAL_SUITABILITY,
    OPERABILITY,
    COMPATIBILITY,
    TRANSFERABILITY,
}

# ---------------------------------------------------------------------------
# Human-readable display names
# ---------------------------------------------------------------------------

ISO_METADATA_KEYS: Dict[str, str] = {
    "security": "Security",
    "reliability": "Reliability",
    "maintainability": "Maintainability",
    "performance": "Performance Efficiency",
    "functional_suitability": "Functional Suitability",
    "operability": "Operability",
    "compatibility": "Compatibility",
    "transferability": "Transferability",
}

ISO_SUBCATEGORIES: Dict[str, str] = {
    "confidentiality": "Confidentiality",
    "integrity": "Integrity",
    "availability": "Availability",
    "accountability": "Accountability",
    "authenticity": "Authenticity",
    "functional_completeness": "Functional Completeness",
    "functional_correctness": "Functional Correctness",
    "functional_appropriateness": "Functional Appropriateness",
    "appropriateness_recognizability": "Appropriateness Recognizability",
    "learnability": "Learnability",
    "ease_of_use": "Ease of Use",
    "helpfulness": "Helpfulness",
    "error_handling": "Error Handling",
    "co_existence": "Co-existence",
    "interoperability": "Interoperability",
    "portability": "Portability",
    "adaptability": "Adaptability",
    "installability": "Installability",
    "replaceability": "Replaceability",
}

# ---------------------------------------------------------------------------
# OpenGrep → ISO 25010 mapping
# ---------------------------------------------------------------------------

SEMGREP_TO_ISO25010: Dict[str, str] = {
    "security": "security",
    "correctness": "reliability",
    "best-practice": "maintainability",
    "performance": "performance",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_finding_id(file: str, line: int, rule_id: str,
                       content_hint: str = "") -> str:
    """Compute a stable, short finding ID.

    Two modes:
      - **Line-based** (default, when ``content_hint`` is empty):
        ``SHA-1(file | line | rule_id)[:12]`` — used by OpenGrep findings
        and any finding where content isn't available.
      - **Content-based** (when ``content_hint`` is provided):
        ``SHA-1(file | rule_id | content_hint)[:12]`` — line-number is
        replaced by actual content, so same code at a shifted line still
        produces the same ID.  Used by Gitleaks, OSV, and other scanners
        whose findings lack a content-aware fingerprint.

    Returns the first 12 hex chars of SHA-1 — 48 bits of entropy is enough
    for any realistic report (collision probability is negligible until
    ~16M findings, and reports are < 100K in practice).
    """
    if content_hint:
        payload = f"{file}|{rule_id}|{content_hint}".encode("utf-8")
    else:
        payload = f"{file}|{line}|{rule_id}".encode("utf-8")
    return hashlib.sha1(payload).hexdigest()[:12]


def classify_finding(finding: dict) -> Optional[str]:
    """Map a finding to an ISO/IEC 25010 category.

    Resolution order:
        1. ``iso_25010`` field (direct override — used by complexity findings)
        2. ``category`` field → ``SEMGREP_TO_ISO25010`` lookup
        3. ``None`` (uncategorized)

    The function NEVER raises. Unknown inputs return ``None``.
    """
    # 1. Direct metadata override (used by complexity.py findings)
    meta_cat = finding.get("iso_25010")
    if meta_cat and meta_cat in ALL_CATEGORIES:
        return meta_cat

    # 2. OpenGrep native category → ISO 25010
    cat = finding.get("category")
    if not isinstance(cat, str):
        return None
    return SEMGREP_TO_ISO25010.get(cat.strip().lower())  # None if no match
