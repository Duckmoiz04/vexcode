import os
from dotenv import load_dotenv
from typing import Tuple

from logger import get_logger

logger = get_logger(__name__)

# Try loading from the current package directory first, then fallback to CWD
current_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(current_dir, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

def _reload_env_file() -> None:
    """Reload .env values into os.environ, but only override with non-empty values.

    - Lets unit tests inject values via @patch.dict(os.environ, ...) survive a reload.
    - Lets users edit the .env file at runtime and have the next call pick up the change.
    - Empty values in .env are treated as "clear" but are not propagated, so missing
      settings fall back to whatever the caller already provided via os.environ.
    """
    if not os.path.exists(dotenv_path):
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
                if val and key not in os.environ:
                    os.environ[key] = val
    except OSError:
        pass


# Centralized helper to resolve AI configuration dynamically based on active provider.
# Returns (api_key, base_url, model, requires_key). Empty strings mean "not configured".
# The caller is responsible for falling back to mock resolutions or showing a clear
# "configure me in Settings" error when any required value is missing.
def get_ai_config() -> Tuple[str, str, str, bool]:
    _reload_env_file()

    ai_provider = (os.getenv("AI_PROVIDER") or "").lower()

    if ai_provider == "9router":
        api_key = os.getenv("NINEROUTER_API_KEY") or ""
        base_url = os.getenv("NINEROUTER_BASE_URL") or ""
        model = os.getenv("NINEROUTER_MODEL") or ""
        # 9router does not require an API key by default (can run locally)
        return api_key, base_url, model, False
    elif ai_provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY") or ""
        base_url = os.getenv("OPENAI_BASE_URL") or ""
        model = os.getenv("OPENAI_MODEL") or ""
        return api_key, base_url, model, True
    elif ai_provider == "google":
        api_key = os.getenv("GOOGLE_API_KEY") or ""
        base_url = os.getenv("GOOGLE_BASE_URL") or ""
        model = os.getenv("GOOGLE_MODEL") or ""
        return api_key, base_url, model, True
    elif ai_provider == "anthropic":
        api_key = os.getenv("ANTHROPIC_API_KEY") or ""
        base_url = os.getenv("ANTHROPIC_BASE_URL") or ""
        model = os.getenv("ANTHROPIC_MODEL") or ""
        return api_key, base_url, model, True

    return "", "", "", False