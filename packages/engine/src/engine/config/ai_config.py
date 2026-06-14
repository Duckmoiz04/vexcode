"""AI provider configuration — secrets from ``.env``, defaults from ``conf/settings.toml``.

Precedence (highest to lowest):
1. Environment variable (e.g. ``OPENAI_API_KEY``)
2. ``conf/settings.toml`` (default model name, requires_key flag)
"""

import os
from pathlib import Path
from typing import Tuple

from dotenv import load_dotenv

from engine.config.constants import load_settings
from engine.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# .env loader — secrets
# ---------------------------------------------------------------------------

dotenv_path = Path.home() / ".vexcode" / ".env"
if dotenv_path.exists():
    load_dotenv(str(dotenv_path))
else:
    load_dotenv()


def _reload_env_file() -> None:
    """Reload .env values into os.environ (non-empty values only).

    - Lets unit tests inject values via ``@patch.dict(os.environ, ...)`` survive a reload.
    - Lets users edit the .env file at runtime and have the next call pick up the change.
    - Empty values in .env are ignored so missing settings fall back to whatever the
      caller already provided via os.environ.
    """
    if not dotenv_path.exists():
        return
    try:
        with open(dotenv_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip()
                if val:
                    os.environ[key] = val
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Provider name → env-var mapping
# ---------------------------------------------------------------------------

# Provider name → env-var prefix mapping (e.g. "9router" → "NINEROUTER")
_ENV_PREFIX: dict[str, str] = {
    "9router": "NINEROUTER",
}

_PROVIDER_CONFIG: dict[str, dict[str, str | bool]] | None = None


def _get_provider_config(provider: str) -> dict[str, str | bool]:
    """Return the merged config for *provider*: settings.toml defaults + env var overrides.

    Env var names follow the pattern ``{PREFIX}_API_KEY``, ``{PREFIX}_BASE_URL``,
    ``{PREFIX}_MODEL``. The prefix is ``provider.upper()`` except for known aliases
    (see ``_ENV_PREFIX``).
    """
    global _PROVIDER_CONFIG
    if _PROVIDER_CONFIG is None:
        settings = load_settings()
        _PROVIDER_CONFIG = dict(
            settings.get("ai", {}).get("providers", {})
        )

    key_prefix = _ENV_PREFIX.get(provider, provider.upper())
    defaults = _PROVIDER_CONFIG.get(provider, {})

    return {
        "api_key": os.getenv(f"{key_prefix}_API_KEY", "") or "",
        "base_url": os.getenv(f"{key_prefix}_BASE_URL", "") or "",
        "model": (os.getenv(f"{key_prefix}_MODEL") or defaults.get("model") or ""),
        "requires_key": defaults.get("requires_key", False),
    }


def get_ai_config() -> Tuple[str, str, str, bool]:
    """Resolve AI configuration dynamically based on ``AI_PROVIDER``.

    Returns:
        Tuple of ``(api_key, base_url, model, requires_key)``.
        Empty strings mean "not configured". The caller is responsible for falling
        back to mock resolutions or showing a clear error when required values
        are missing.
    """
    _reload_env_file()

    provider = (os.getenv("AI_PROVIDER") or "").lower()

    if provider in ("9router", "openai", "google", "anthropic", "nvidia"):
        cfg = _get_provider_config(provider)
        return (
            cfg["api_key"],      # type: ignore[arg-type]
            cfg["base_url"],     # type: ignore[arg-type]
            cfg["model"],        # type: ignore[arg-type]
            cfg["requires_key"],  # type: ignore[arg-type]
        )

    return "", "", "", False
