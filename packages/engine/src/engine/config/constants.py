"""Shared constants and configuration loader.

All non-secret defaults live in ``conf/settings.toml``.
Environment variables override settings values at runtime.
Secrets (API keys) remain in ``.env`` — see ``ai_config.py``.
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict

# ---------------------------------------------------------------------------
# Settings loader
# ---------------------------------------------------------------------------

_SETTINGS: Dict[str, Any] | None = None


def _get_engine_root() -> Path:
    """Return the absolute path to ``packages/engine/`` (project root)."""
    return Path(__file__).resolve().parents[3]


def _nested_get(d: Dict[str, Any], keys: list[str], default: Any = None) -> Any:
    """Safely traverse a nested dict."""
    for key in keys:
        if isinstance(d, dict):
            d = d.get(key)
        else:
            return default
    return d if d is not None else default


def load_settings() -> Dict[str, Any]:
    """Load ``conf/settings.toml`` and return as a dict (cached).

    Returns an empty dict if the file does not exist — enables graceful
    degradation when running in environments without the config tree.
    """
    global _SETTINGS
    if _SETTINGS is not None:
        return _SETTINGS

    settings_path = _get_engine_root() / "conf" / "settings.toml"
    if settings_path.exists():
        try:
            import tomllib
        except ImportError:
            # Python < 3.11 fallback (unlikely — we target 3.12+)
            tomllib = None  # type: ignore[assignment]

        if tomllib is not None:
            with settings_path.open("rb") as f:
                _SETTINGS = tomllib.load(f)
        else:
            _SETTINGS = {}
    else:
        _SETTINGS = {}

    return _SETTINGS


def get_int_env(name: str, default: int) -> int:
    """Read an integer from an environment variable, falling back to *default*."""
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Loaded once at module import time
# ---------------------------------------------------------------------------
_settings = load_settings()

# -- Analysis thresholds ----------------------------------------------------
MAX_CODE_CHARS = _nested_get(_settings, ["analysis", "max_code_chars"], 3000)
MAX_NAMING_AUDIT_FILES = _nested_get(_settings, ["analysis", "max_naming_audit_files"], 3)
MAX_RESOLVE_FINDINGS = _nested_get(_settings, ["analysis", "max_resolve_findings"], 5)

# -- AI resolution settings (env overrides supported) -----------------------
AI_RESOLVE_MAX_TOKENS = get_int_env(
    "AI_RESOLVE_MAX_TOKENS",
    get_int_env(
        "AI_MAX_TOKENS",
        _nested_get(_settings, ["ai_settings", "resolve_max_tokens"], 512),
    ),
)
NAMING_AUDIT_SLEEP = float(
    os.getenv(
        "AI_REQUEST_COOLDOWN_SECONDS",
        str(_nested_get(_settings, ["ai_settings", "request_cooldown_seconds"], 8.0)),
    )
)
AI_MAX_RETRIES = get_int_env(
    "AI_MAX_RETRIES",
    _nested_get(_settings, ["ai_settings", "max_retries"], 2),
)
AI_RETRY_BASE_WAIT_SECONDS = float(
    os.getenv(
        "AI_RETRY_BASE_WAIT_SECONDS",
        str(_nested_get(_settings, ["ai_settings", "retry_base_wait_seconds"], 15.0)),
    )
)
AI_RESOLVE_TIMEOUT_SECONDS = get_int_env(
    "AI_RESOLVE_TIMEOUT_SECONDS",
    _nested_get(_settings, ["ai_settings", "resolve_timeout_seconds"], 90),
)
AI_NAMING_TIMEOUT_SECONDS = get_int_env(
    "AI_NAMING_TIMEOUT_SECONDS",
    _nested_get(_settings, ["ai_settings", "naming_timeout_seconds"], 90),
)
AI_PARALLEL_WORKERS = get_int_env(
    "AI_PARALLEL_WORKERS",
    _nested_get(_settings, ["ai_settings", "parallel_workers"], 3),
)
