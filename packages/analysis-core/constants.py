import os

def get_int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


# Max characters of file/code content sent to AI per request
MAX_CODE_CHARS = 3000
# Max files to audit per analysis run
MAX_NAMING_AUDIT_FILES = 3
# Max unique rules sent to AI in one resolve_findings call
MAX_RESOLVE_FINDINGS = 5

# Dynamic constants (resolved from env at import time)
AI_RESOLVE_MAX_TOKENS = get_int_env("AI_RESOLVE_MAX_TOKENS", get_int_env("AI_MAX_TOKENS", 512))
NAMING_AUDIT_SLEEP = float(os.getenv("AI_REQUEST_COOLDOWN_SECONDS", "8.0"))
AI_MAX_RETRIES = get_int_env("AI_MAX_RETRIES", 2)
AI_RETRY_BASE_WAIT_SECONDS = float(os.getenv("AI_RETRY_BASE_WAIT_SECONDS", "15.0"))
AI_RESOLVE_TIMEOUT_SECONDS = get_int_env("AI_RESOLVE_TIMEOUT_SECONDS", 90)
AI_NAMING_TIMEOUT_SECONDS = get_int_env("AI_NAMING_TIMEOUT_SECONDS", 90)
