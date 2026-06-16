"""ISO/IEC 25010 quality model — Phase 1 taxonomy for VexCode findings.

The ISO/IEC 25010 standard defines 8 quality characteristics for software
products. VexCode ships a 4-category Phase 1 subset chosen to align with
the categories most commonly produced by Semgrep/OpenGrep rules:

    1. Security           (ISO/IEC 25010 §6)
    2. Reliability        (ISO/IEC 25010 §5)
    3. Maintainability    (ISO/IEC 25010 §7)
    4. Performance        (ISO/IEC 25010 §2)

Phase 2 (post-DATN) will extend to the remaining 4: Functional Suitability,
Compatibility, Usability, Portability.

Mapping strategy (deterministic, testable):
    1. CWE ID (highest priority — security/reliability semantics come
       directly from the CWE catalog, e.g. CWE-89 → SQL injection →
       security)
    2. rule_id keyword match (substring, case-insensitive)
    3. message keyword match (fallback for rules without rich CWE)
    4. Default = 'maintainability' (catch-all bucket)

The mapping table below is intentionally explicit (no ML, no fuzzy match)
so that test cases are deterministic and the classifier is auditable.
"""

from __future__ import annotations

import hashlib
import re
from typing import Dict, List, Set


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------

# Phase 1 categories
SECURITY: str = "security"
RELIABILITY: str = "reliability"
MAINTAINABILITY: str = "maintainability"
PERFORMANCE: str = "performance"

# All Phase 1 categories
PHASE_1_CATEGORIES: Set[str] = {
    SECURITY,
    RELIABILITY,
    MAINTAINABILITY,
    PERFORMANCE,
}

DEFAULT_CATEGORY: str = MAINTAINABILITY


# ---------------------------------------------------------------------------
# CWE → ISO 25010 mapping
# ---------------------------------------------------------------------------
# CWE = Common Weakness Enumeration (https://cwe.mitre.org/)
# Subset chosen for the Semgrep rules VexCode actually loads.
# Priority: CWE > rule_id keyword > message keyword > default

CWE_TO_ISO25010: Dict[str, str] = {
    # ── Security (injection, auth, crypto, leak) ──
    "CWE-89":  SECURITY,   # SQL Injection
    "CWE-79":  SECURITY,   # Cross-site Scripting (XSS)
    "CWE-78":  SECURITY,   # OS Command Injection
    "CWE-94":  SECURITY,   # Code Injection
    "CWE-95":  SECURITY,   # Eval Injection
    "CWE-77":  SECURITY,   # Command Injection (generic)
    "CWE-918": SECURITY,   # Server-Side Request Forgery (SSRF)
    "CWE-352": SECURITY,   # CSRF
    "CWE-611": SECURITY,   # XXE
    "CWE-502": SECURITY,   # Deserialization
    "CWE-798": SECURITY,   # Hardcoded Credentials
    "CWE-259": SECURITY,   # Hardcoded Password
    "CWE-256": SECURITY,   # Plaintext Storage of Password
    "CWE-522": SECURITY,   # Insufficiently Protected Credentials
    "CWE-321": SECURITY,   # Use of Hard-coded Cryptographic Key
    "CWE-327": SECURITY,   # Use of a Broken Crypto Algorithm
    "CWE-328": SECURITY,   # Reversible One-Way Hash
    "CWE-330": SECURITY,   # Use of Insufficiently Random Values
    "CWE-338": SECURITY,   # Use of Cryptographically Weak PRNG
    "CWE-916": SECURITY,   # Use of Password Hash With Insufficient Computational Effort
    "CWE-287": SECURITY,   # Improper Authentication
    "CWE-306": SECURITY,   # Missing Authentication for Critical Function
    "CWE-862": SECURITY,   # Missing Authorization
    "CWE-863": SECURITY,   # Incorrect Authorization
    "CWE-200": SECURITY,   # Information Exposure
    "CWE-209": SECURITY,   # Information Exposure Through Error Message
    "CWE-532": SECURITY,   # Information Exposure Through Log Files
    "CWE-22":  SECURITY,   # Path Traversal
    "CWE-59":  SECURITY,   # Link Following
    "CWE-434": SECURITY,   # Unrestricted File Upload
    "CWE-601": SECURITY,   # URL Redirection to Untrusted Site (Open Redirect)
    "CWE-295": SECURITY,   # Improper Cert Validation
    "CWE-319": SECURITY,   # Cleartext Transmission

    # ── Reliability (null, exception, race, resource) ──
    "CWE-476": RELIABILITY,  # NULL Pointer Dereference
    "CWE-690": RELIABILITY,  # Unchecked Return Value to NULL Pointer
    "CWE-252": RELIABILITY,  # Unchecked Return Value
    "CWE-754": RELIABILITY,  # Improper Check for Unusual or Exceptional Conditions
    "CWE-248": RELIABILITY,  # Uncaught Exception
    "CWE-703": RELIABILITY,  # Improper Check or Handling of Exceptional Conditions
    "CWE-755": RELIABILITY,  # Improper Handling of Exceptional Conditions
    "CWE-401": RELIABILITY,  # Memory Leak (missing release)
    "CWE-404": RELIABILITY,  # Improper Resource Shutdown or Release
    "CWE-459": RELIABILITY,  # Incomplete Cleanup
    "CWE-772": RELIABILITY,  # Missing Release of Resource
    "CWE-400": RELIABILITY,  # Uncontrolled Resource Consumption
    "CWE-770": RELIABILITY,  # Allocation of Resources Without Limits
    "CWE-362": RELIABILITY,  # Race Condition
    "CWE-366": RELIABILITY,  # Race Condition Within a Thread
    "CWE-364": RELIABILITY,  # Signal Handler Race Condition
    "CWE-209": RELIABILITY,  # (also info exposure; primary here is error handling)
    "CWE-1284": RELIABILITY, # Improper Validation of Specified Quantity in Input
    "CWE-190": RELIABILITY,  # Integer Overflow (when not exploitable)
    "CWE-191": RELIABILITY,  # Integer Underflow
    "CWE-682": RELIABILITY,  # Incorrect Calculation

    # ── Performance (complexity, memory, loop) ──
    "CWE-407": PERFORMANCE,  # Algorithmic Complexity (in some interpretations)
    # NOTE: many "complexity" rules map via rule_id, not CWE.

    # ── Maintainability (style, naming, dead code) ──
    "CWE-561": MAINTAINABILITY,  # Dead Code
    "CWE-563": MAINTAINABILITY,  # Assignment to Variable without Use
    "CWE-1164": MAINTAINABILITY, # Irrelevant Code
    "CWE-477": MAINTAINABILITY,  # Use of Obsolete Function
    "CWE-1188": MAINTAINABILITY, # Insecure Default Variable Initialization
}


# ---------------------------------------------------------------------------
# rule_id keyword → ISO 25010 (Phase 1)
# ---------------------------------------------------------------------------
# Order matters for short keywords (e.g. "complex" must be tested before
# "complexity" to avoid false matches). We sort by length descending when
# matching, so the longest match wins.

RULE_TO_ISO25010: Dict[str, str] = {
    # ── Security (longest first) ──
    "dangerous-exec":      SECURITY,
    "dangerous_exec":      SECURITY,
    "sql-injection":       SECURITY,
    "sql_injection":       SECURITY,
    "sql-query":           SECURITY,
    "sql_query":           SECURITY,
    "formatted-sql":       SECURITY,
    "formatted_sql":       SECURITY,
    "dangerous-deserialization": SECURITY,
    "dangerous_deserialization": SECURITY,
    "injection":           SECURITY,
    "deserialization":     SECURITY,
    "xxe":                 SECURITY,
    "xss":                 SECURITY,
    "csrf":                SECURITY,
    "ssrf":                SECURITY,
    "open-redirect":       SECURITY,
    "open_redirect":       SECURITY,
    "hardcoded-secret":    SECURITY,
    "hardcoded_secret":    SECURITY,
    "hardcoded-password":  SECURITY,
    "hardcoded_password":  SECURITY,
    "weak-crypto":         SECURITY,
    "weak_crypto":         SECURITY,
    "insecure-random":     SECURITY,
    "insecure_random":     SECURITY,
    "broken-crypto":       SECURITY,
    "broken_crypto":       SECURITY,
    "insufficient-random": SECURITY,
    "weak-hash":           SECURITY,
    "weak_hash":           SECURITY,
    "sql":                 SECURITY,
    "command":             SECURITY,  # OS command exec
    "crypto":              SECURITY,
    "auth":                SECURITY,
    "secret":              SECURITY,
    "password":            SECURITY,
    "token":               SECURITY,  # leaked token
    "credential":          SECURITY,
    "overflow":            SECURITY,  # buffer overflow
    "leak":                SECURITY,
    "cert":                SECURITY,
    "ssl":                 SECURITY,
    "tls":                 SECURITY,
    "hash":                SECURITY,  # weak hash
    "jwt":                 SECURITY,
    "priv":                SECURITY,  # private key

    # ── Reliability ──
    "unhandled":           RELIABILITY,
    "null-pointer":        RELIABILITY,
    "null_pointer":        RELIABILITY,
    "null-deref":          RELIABILITY,
    "null_deref":          RELIABILITY,
    "unchecked-return":   RELIABILITY,
    "unchecked_return":   RELIABILITY,
    "unchecked":           RELIABILITY,
    "race-condition":      RELIABILITY,
    "race_condition":      RELIABILITY,
    "resource-leak":       RELIABILITY,
    "resource_leak":       RELIABILITY,
    "missing-release":     RELIABILITY,
    "missing_release":     RELIABILITY,
    "null-check":          RELIABILITY,
    "null_check":          RELIABILITY,
    "exception":           RELIABILITY,
    "validation":          RELIABILITY,
    "boundary":            RELIABILITY,
    "race":                RELIABILITY,
    "concurrency":         RELIABILITY,
    "deadlock":            RELIABILITY,
    "null":                RELIABILITY,
    "error":               RELIABILITY,
    "exception-handling":  RELIABILITY,
    "exception_handling":  RELIABILITY,
    # Disambiguate: "unused-X-variable" is reliability (correctness bug),
    # bare "unused-X" (no -variable) is maintainability.
    "unused-variable":     RELIABILITY,
    "unused_variable":     RELIABILITY,
    "unused-loop":         RELIABILITY,
    "unused_loop":         RELIABILITY,

    # ── Performance ──
    "high-complexity":     PERFORMANCE,
    "high_complexity":     PERFORMANCE,
    "cyclomatic":          PERFORMANCE,
    "performance":         PERFORMANCE,
    "inefficient":         PERFORMANCE,
    "memory-leak":         PERFORMANCE,
    "memory_leak":         PERFORMANCE,
    "n-squared":           PERFORMANCE,
    "n_squared":           PERFORMANCE,
    "quadratic":           PERFORMANCE,
    "efficiency":          PERFORMANCE,
    "complexity":          PERFORMANCE,  # CCN-related
    "loop":                PERFORMANCE,  # suspicious loop pattern
    "nested":              PERFORMANCE,  # nested loop / deep nesting
    "redundant":           PERFORMANCE,  # redundant computation

    # ── Maintainability ──
    "docstring-missing":   MAINTAINABILITY,
    "docstring_missing":   MAINTAINABILITY,
    "missing-docstring":   MAINTAINABILITY,
    "missing_docstring":   MAINTAINABILITY,
    "unused-import":       MAINTAINABILITY,
    "unused_import":       MAINTAINABILITY,
    "unused-function":     MAINTAINABILITY,
    "unused_function":     MAINTAINABILITY,
    "dead-code":           MAINTAINABILITY,
    "dead_code":           MAINTAINABILITY,
    "duplicate-code":      MAINTAINABILITY,
    "duplicate_code":      MAINTAINABILITY,
    "magic-number":        MAINTAINABILITY,
    "magic_number":        MAINTAINABILITY,
    "obscure-name":        MAINTAINABILITY,
    "obscure_name":        MAINTAINABILITY,
    "long-method":         MAINTAINABILITY,
    "long_method":         MAINTAINABILITY,
    "long-parameter":      MAINTAINABILITY,
    "long_parameter":      MAINTAINABILITY,
    "too-many-params":     MAINTAINABILITY,
    "too_many_params":     MAINTAINABILITY,
    "naming":              MAINTAINABILITY,
    "style":               MAINTAINABILITY,
    "format":              MAINTAINABILITY,
    "convention":          MAINTAINABILITY,
    "duplicate":           MAINTAINABILITY,
    "unused":              MAINTAINABILITY,
    "comment":             MAINTAINABILITY,
    "obscure":             MAINTAINABILITY,
    "magic":               MAINTAINABILITY,
    "deprecated":          MAINTAINABILITY,
    "todo":                MAINTAINABILITY,
    "fixme":               MAINTAINABILITY,
    "xxx":                 MAINTAINABILITY,
}

# Pre-sorted keyword list (longest first) to avoid short keyword false positives.
SORTED_KEYWORDS: List[str] = sorted(RULE_TO_ISO25010.keys(), key=len, reverse=True)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_finding_id(file: str, line: int, rule_id: str) -> str:
    """Compute a stable, short finding ID from (file, line, rule_id).

    The same logical finding across re-scans of the same code will produce
    the same ID, which is the foundation of the ``applied[]`` audit log.

    Returns the first 12 hex chars of SHA-1 — 48 bits of entropy is enough
    for any realistic report (collision probability is negligible until
    ~16M findings, and reports are < 100K in practice).
    """
    payload = f"{file}|{line}|{rule_id}".encode("utf-8")
    return hashlib.sha1(payload).hexdigest()[:12]


def classify_finding(finding: dict) -> str:
    """Classify a finding into an ISO/IEC 25010 Phase 1 category.

    Resolution order (deterministic):
        1. CWE ID (most reliable — semantically grounded)
        2. Context override: if rule_id contains a strong "category hint"
           like "style", "naming", "format", "convention", force that
           category (prevents "unused-variable" from leaking into security
           or reliability just because the keyword substring matches).
        3. rule_id keyword (substring, longest-match-wins)
        4. message keyword (substring, longest-match-wins)
        5. DEFAULT_CATEGORY ('maintainability')

    The function NEVER raises. Unknown inputs return the default category.
    """
    # 1. CWE ID (highest priority)
    cwe = (finding.get("cwe_id") or "").strip().upper()
    if cwe:
        # Normalize: "CWE-89" or "CWE-89: ..." or "89" all map to "CWE-89"
        if not cwe.startswith("CWE-"):
            cwe = f"CWE-{cwe}"
        # Trim anything after a space/colon (e.g. "CWE-89: SQL Injection")
        cwe = cwe.split()[0].split(":")[0].strip()
        if cwe in CWE_TO_ISO25010:
            return CWE_TO_ISO25010[cwe]

    # 2. Context override — Semgrep uses paths like "lang.style.*" or
    # "lang.naming.*" that signal style/naming audits. These take
    # precedence over inner keywords. Use word-boundary match to avoid
    # false positives like "formatted" matching "format".
    rule_id_raw = (finding.get("rule_id") or "").lower()
    CONTEXT_HINT_PATTERN = re.compile(
        r"(?:^|[._-])(style|naming|convention|lint)(?:[._-]|$)"
    )
    if CONTEXT_HINT_PATTERN.search(rule_id_raw):
        return MAINTAINABILITY

    # 3. rule_id keyword (longest match wins to avoid false positives)
    for keyword in SORTED_KEYWORDS:
        if keyword in rule_id_raw:
            return RULE_TO_ISO25010[keyword]

    # 4. message keyword (longest match wins)
    message = (finding.get("message") or "").lower()
    for keyword in SORTED_KEYWORDS:
        if keyword in message:
            return RULE_TO_ISO25010[keyword]

    # 5. Default
    return DEFAULT_CATEGORY


def get_phase_1_categories() -> Set[str]:
    """Return the set of valid Phase 1 categories (for validation/tests)."""
    return set(PHASE_1_CATEGORIES)


def is_valid_category(category: str) -> bool:
    """True if *category* is a valid Phase 1 ISO/IEC 25010 category."""
    return category in PHASE_1_CATEGORIES
