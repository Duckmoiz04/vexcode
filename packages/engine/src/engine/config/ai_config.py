"""AI provider configuration — secrets from ``.env``, defaults from ``conf/settings.toml``.

Supports **multiple simultaneous providers** and **agent-to-provider routing**.

Precedence (highest to lowest):
1. Environment variable (e.g. ``OPENAI_API_KEY``)
2. ``conf/settings.toml`` (non-secret defaults: model name, enabled flag, requires_key)
"""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

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
    """Reload .env values into os.environ (non-empty values only)."""
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
# Provider name → env-var prefix mapping
# ---------------------------------------------------------------------------

_ENV_PREFIX: dict[str, str] = {
    "9router": "NINEROUTER",
}


def _env_prefix(provider: str) -> str:
    """Return the env-var prefix for *provider* (e.g. ``"openai"`` → ``"OPENAI"``)."""
    return _ENV_PREFIX.get(provider, provider.upper())


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class ProviderConfig:
    """Runtime config for a single AI provider, merged from settings.toml + .env."""

    name: str
    enabled: bool = True
    model: str = ""
    requires_key: bool = True
    api_key: str = ""
    base_url: str = ""


@dataclass
class AgentConfig:
    """Runtime config for a single agent (task type)."""

    name: str
    provider: str = "openai"
    model: str = ""
    enabled: bool = True


# ---------------------------------------------------------------------------
# Lazy-loaded merged config
# ---------------------------------------------------------------------------

_PROVIDERS: dict[str, ProviderConfig] | None = None
_AGENTS: dict[str, AgentConfig] | None = None
_AI_ENABLED: bool | None = None


def _load_all() -> None:
    """Load (or reload) and merge settings.toml + .env into module globals."""
    global _PROVIDERS, _AGENTS, _AI_ENABLED
    _reload_env_file()
    settings = load_settings()

    ai_section = settings.get("ai", {})
    _AI_ENABLED = ai_section.get("enabled", False)

    # -- Load providers -----------------------------------------------------
    raw_providers: dict[str, Any] = ai_section.get("providers", {})
    providers: dict[str, ProviderConfig] = {}
    for name, raw in raw_providers.items():
        prefix = _env_prefix(name)
        providers[name] = ProviderConfig(
            name=name,
            enabled=raw.get("enabled", True),
            model=(os.getenv(f"{prefix}_MODEL") or raw.get("model") or ""),
            requires_key=raw.get("requires_key", True),
            api_key=os.getenv(f"{prefix}_API_KEY", "") or "",
            base_url=os.getenv(f"{prefix}_BASE_URL", "") or "",
        )
    _PROVIDERS = providers

    # -- Load agents --------------------------------------------------------
    raw_agents: dict[str, Any] = ai_section.get("agents", {})
    agents: dict[str, AgentConfig] = {}
    for name, raw in raw_agents.items():
        agents[name] = AgentConfig(
            name=name,
            provider=raw.get("provider", "openai"),
            model=raw.get("model", ""),
            enabled=raw.get("enabled", True),
        )
    _AGENTS = agents


def _ensure_loaded() -> None:
    """Ensure lazy config is loaded exactly once (or re-loaded)."""
    if _PROVIDERS is None:
        _load_all()


def reset_config() -> None:
    """Reset the cached config so the next access re-loads from settings.toml + env.

    Useful for tests that need to control the environment before loading.
    """
    global _PROVIDERS, _AGENTS, _AI_ENABLED
    _PROVIDERS = None
    _AGENTS = None
    _AI_ENABLED = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def is_ai_enabled() -> bool:
    """Return the master AI toggle from settings.toml.

    When ``False``, NO AI agent runs regardless of individual agent settings.
    """
    _ensure_loaded()
    return bool(_AI_ENABLED)


def get_provider_config(name: str) -> ProviderConfig | None:
    """Return the merged ``ProviderConfig`` for *name*, or ``None`` if unknown."""
    _ensure_loaded()
    assert _PROVIDERS is not None
    return _PROVIDERS.get(name)


def get_agent_config(name: str) -> AgentConfig | None:
    """Return the ``AgentConfig`` for *name*, or ``None`` if unknown."""
    _ensure_loaded()
    assert _AGENTS is not None
    return _AGENTS.get(name)


def get_enabled_providers() -> list[ProviderConfig]:
    """Return config for every provider whose ``enabled`` flag is ``True``."""
    _ensure_loaded()
    assert _PROVIDERS is not None
    return [p for p in _PROVIDERS.values() if p.enabled]


def get_enabled_agents() -> list[AgentConfig]:
    """Return config for every agent whose ``enabled`` flag is ``True``."""
    _ensure_loaded()
    assert _AGENTS is not None
    return [a for a in _AGENTS.values() if a.enabled]


def is_agent_enabled(name: str) -> bool:
    """Return ``True`` iff the master toggle is on AND the named agent is enabled."""
    if not is_ai_enabled():
        return False
    agent = get_agent_config(name)
    return agent is not None and agent.enabled


def get_resolved_provider_for_agent(agent_name: str) -> ProviderConfig | None:
    """Resolve the provider config that *agent_name* is assigned to.

    Returns ``None`` if the agent is unknown, its provider is unknown, or the
    provider is disabled.
    """
    agent = get_agent_config(agent_name)
    if agent is None or not agent.enabled:
        return None
    provider = get_provider_config(agent.provider)
    if provider is None or not provider.enabled:
        logger.warning(
            "Agent '%s' references disabled/unknown provider '%s'",
            agent_name, agent.provider,
        )
        return None
    # Agent-level model override — return a copy to avoid mutating the cached object
    if agent.model:
        import copy
        provider = copy.copy(provider)
        provider.model = agent.model
    return provider


def dump_ai_config() -> dict[str, Any]:
    """Return the full AI config as a JSON-serialisable dict.

    Intended for the Express ``/api/settings/ai`` endpoint.
    ``api_key`` values are masked (``"••••••"``) unless empty.
    """
    _ensure_loaded()
    assert _PROVIDERS is not None
    assert _AGENTS is not None

    return {
        "enabled": bool(_AI_ENABLED),
        "providers": {
            name: {
                "enabled": p.enabled,
                "model": p.model,
                "requires_key": p.requires_key,
                # Never leak full keys — mask them
                "api_key": "••••••" if p.api_key else "",
                "base_url": p.base_url,
            }
            for name, p in _PROVIDERS.items()
        },
        "agents": {
            name: {
                "provider": a.provider,
                "model": a.model,
                "enabled": a.enabled,
            }
            for name, a in _AGENTS.items()
        },
    }


# ---------------------------------------------------------------------------
# Backward compatibility
# ---------------------------------------------------------------------------

#: Known provider names that the legacy ``get_ai_config()`` accepts.
_KNOWN_LEGACY_PROVIDERS = frozenset({"9router", "openai", "google", "anthropic", "nvidia"})


def get_ai_config() -> tuple[str, str, str, bool]:
    """Resolve AI configuration for the **legacy single-provider** code path.

    Returns:
        Tuple of ``(api_key, base_url, model, requires_key)``.
        Empty strings mean "not configured".

    Note:
        New code should call ``get_resolved_provider_for_agent("suggest")``
        instead. This function exists only so that ``ai_resolver.py`` keeps
        working during the transition.
    """
    _ensure_loaded()
    _reload_env_file()

    provider = (os.getenv("AI_PROVIDER") or "").lower()

    if provider in _KNOWN_LEGACY_PROVIDERS:
        cfg = get_provider_config(provider)
        if cfg is not None:
            return (cfg.api_key, cfg.base_url, cfg.model, cfg.requires_key)

    # Fallback: try the suggest agent's provider
    suggest = get_agent_config("suggest")
    if suggest is not None and suggest.enabled:
        resolved = get_resolved_provider_for_agent("suggest")
        if resolved is not None:
            # Don't return a provider that needs a key when none is available
            if resolved.requires_key and not resolved.api_key:
                return "", "", "", False
            return (resolved.api_key, resolved.base_url, resolved.model, resolved.requires_key)

    return "", "", "", False


# Eager-load once at import time so the first call is fast.
_ensure_loaded()
