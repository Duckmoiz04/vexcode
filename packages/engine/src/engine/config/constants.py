"""Shared constants and configuration loader.

Precedence (highest to lowest):
1. Environment variables
2. ``~/.vexcode/settings.toml`` (user overrides)
3. ``conf/settings.toml`` (repo defaults)
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

_USER_CONFIG_PATH: Path = Path.home() / ".vexcode" / "settings.toml"


def _get_engine_root() -> Path:
    """Return the absolute path to ``packages/engine/`` (project root)."""
    return Path(__file__).resolve().parents[3]


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively merge *override* into *base* and return a new dict.

    For nested dict values, recurse.  For all other types (including lists),
    the override value replaces the base value.  Keys only present in *base*
    are preserved.
    """
    merged = base.copy()
    for key, val in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(val, dict):
            merged[key] = _deep_merge(merged[key], val)
        else:
            merged[key] = val
    return merged


def _load_toml(path: Path) -> Dict[str, Any]:
    """Parse a TOML file and return as a dict, or empty dict on failure."""
    if not path.exists():
        return {}
    try:
        import tomllib
    except ImportError:
        return {}
    try:
        with path.open("rb") as f:
            return tomllib.load(f)
    except Exception:
        return {}


def _nested_get(d: Dict[str, Any], keys: list[str], default: Any = None) -> Any:
    """Safely traverse a nested dict."""
    for key in keys:
        if isinstance(d, dict):
            d = d.get(key)
        else:
            return default
    return d if d is not None else default


def load_settings() -> Dict[str, Any]:
    """Load and merge config with user overrides (cached).

    Merge order (higher wins):
    1. ``conf/settings.toml`` — repo defaults
    2. ``~/.vexcode/settings.toml`` — user overrides (if exists)

    Returns an empty dict if the default file does not exist — enables graceful
    degradation when running in environments without the config tree.
    """
    global _SETTINGS
    if _SETTINGS is not None:
        return _SETTINGS

    defaults_path = _get_engine_root() / "conf" / "settings.toml"
    defaults = _load_toml(defaults_path)

    user_cfg = _load_toml(_USER_CONFIG_PATH)
    if user_cfg:
        _SETTINGS = _deep_merge(defaults, user_cfg)
    else:
        _SETTINGS = defaults

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
