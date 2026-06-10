import os, json, time, requests
from typing import Dict, Any, List, Tuple, Optional

from logger import get_logger
from ai_config import _reload_env_file, get_ai_config  # noqa: F401 — re-exported for backward compat
from ai_prompts import SYSTEM_PROMPT_RESOLVE

logger = get_logger(__name__)

# Standard mock AI resolutions map
MOCK_AI_RESOLUTIONS = {
    "python.lang.security.audit.dangerous-exec": {
        "suggestion": "Avoid using exec(). Use structured functions or parse inputs securely.",
        "remediation_code": "import subprocess\n# Avoid exec(user_input)\n# Use safe subprocess with arguments\nsubprocess.run(['echo', user_input])"
    },
    "python.lang.security.audit.hardcoded-password": {
        "suggestion": "Load password from environment variables instead of hardcoding it in the connection string.",
        "remediation_code": "import os\npassword = os.environ.get('DB_PASSWORD')\n# conn = connect(password=password)"
    },
    "maintainability.naming.obscure": {
        "suggestion": "Đổi tên hàm 'do_it' thành 'process_user_data' và tham số 'x' thành 'user_input' để tăng tính rõ nghĩa và dễ bảo trì.",
        "remediation_code": "def process_user_data(user_input):"
    }
}

from constants import (
    MAX_CODE_CHARS, MAX_NAMING_AUDIT_FILES, MAX_RESOLVE_FINDINGS,
    AI_RESOLVE_MAX_TOKENS, NAMING_AUDIT_SLEEP, AI_MAX_RETRIES,
    AI_RETRY_BASE_WAIT_SECONDS, AI_RESOLVE_TIMEOUT_SECONDS, AI_NAMING_TIMEOUT_SECONDS,
)

# Strip comment-only "remediation" so frontend doesn't render fake fixes.
_COMMENT_PREFIXES = ("#", "//", "/*", "*", "--", ";")

def sanitize_remediation_code(code: str) -> str:
    """Strip placeholder-only / comment-only text; return empty if all lines are comments."""
    if not code:
        return ""
    lines = [line.rstrip() for line in code.splitlines()]
    non_empty = [line for line in lines if line.strip()]
    if not non_empty:
        return ""
    stripped = [line.strip() for line in non_empty]
    if all(line.startswith(_COMMENT_PREFIXES) for line in stripped):
        return ""
    return code.strip("\n")

def decode_response_text(response: Any) -> str:
    """Decode HTTP response body as UTF-8, fixing mojibake from wrong charset headers."""
    raw = response.content
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1")

def safe_json_parse(text: str) -> Any:
    """Robustly parse JSON from AI response. Handles markdown fences and trailing garbage."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    decoder = json.JSONDecoder()
    text = text.strip()
    for start_char in ('[', '{'):
        idx = text.find(start_char)
        if idx != -1:
            try:
                obj, _ = decoder.raw_decode(text, idx)
                return obj
            except json.JSONDecodeError:
                pass
    raise ValueError(f"Cannot parse JSON from AI response: {text[:200]}")

def parse_api_response(text: str) -> Dict[str, Any]:
    """Parse a 9router/OpenAI-format HTTP response body, searching for '{' first."""
    text = text.strip()
    decoder = json.JSONDecoder()
    idx = text.find('{')
    if idx != -1:
        try:
            obj, _ = decoder.raw_decode(text, idx)
            return obj
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Cannot parse API response body: {text[:200]}")

def post_with_retry(url: str, headers: dict, payload: dict, timeout: int) -> requests.Response:
    """POST with exponential-backoff retry on rate limits and local router read timeouts."""
    last_error = None
    for attempt in range(AI_MAX_RETRIES + 1):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=timeout)
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
            last_error = exc
            if attempt < AI_MAX_RETRIES:
                wait = AI_RETRY_BASE_WAIT_SECONDS * (2 ** attempt)
                logger.info(f"AI request failed ({exc.__class__.__name__}) — retrying in {wait:.0f}s (attempt {attempt + 1}/{AI_MAX_RETRIES})...")
                time.sleep(wait)
                continue
            raise
        if response.status_code == 429 and attempt < AI_MAX_RETRIES:
            wait = AI_RETRY_BASE_WAIT_SECONDS * (2 ** attempt)
            logger.info(f"429 Too Many Requests — retrying in {wait:.0f}s (attempt {attempt + 1}/{AI_MAX_RETRIES})...")
            time.sleep(wait)
            continue
        return response
    if last_error:
        raise last_error
    return response

def read_surrounding_code(target_path: str, file_path: str, line_num: int, context_lines: int = 5) -> str:
    """Read context lines around a finding from the source file; mark target with >>>>."""
    full_path = os.path.join(target_path, file_path)
    if not os.path.exists(full_path):
        return ""
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
    except (OSError, IOError):
        return ""
    start = max(0, line_num - 1 - context_lines)
    end = min(len(all_lines), line_num + context_lines)
    result = []
    for i in range(start, end):
        result.append(f">>>> {all_lines[i]}" if i == line_num - 1 else f"     {all_lines[i]}")
    return "".join(result)

def resolve_findings(findings: Any, use_mock: bool = False, target_path: Optional[str] = None) -> Dict[str, Any]:
    """Send findings to AI completions API for remediation. Falls back to mock when AI is unconfigured."""
    if isinstance(findings, dict):
        findings = findings.get("findings", [])

    api_key, base_url, model, requires_key = get_ai_config()

    missing_provider = not os.getenv("AI_PROVIDER")
    no_key = requires_key and not api_key
    no_config = not base_url or not model

    if use_mock or missing_provider or no_key or no_config:
        if not use_mock:
            if missing_provider:
                logger.info("AI provider is not configured. Set AI_PROVIDER (and provider keys) via the Settings drawer, or pass --mock-ai. Falling back to mock resolutions.")
            elif no_key:
                logger.info("API key is required but not found in environment. Falling back to mock resolutions.")
            else:
                logger.info(f"AI config is incomplete (base_url='{base_url}', model='{model}'). Falling back to mock resolutions.")
        else:
            logger.info("Using mock AI resolutions as requested.")

        resolutions = {}
        for finding in findings:
            rule_id = finding.get("rule_id")
            if rule_id in MOCK_AI_RESOLUTIONS:
                resolutions[rule_id] = MOCK_AI_RESOLUTIONS[rule_id]
            else:
                resolutions[rule_id] = {
                    "suggestion": f"Avoid this pattern for rule {rule_id}. Ensure input validation and standard security practices.",
                    "remediation_code": f"# Remediation for {rule_id}\n# Please review and replace dangerous code patterns."
                }
        return resolutions

    # Per-rule sequential: 1 rule/request avoids huge payloads that timeout (60s+).
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    url = f"{base_url.rstrip('/')}/chat/completions"

    seen_rules: set = set()
    unique_findings = []
    for f in findings:
        if len(unique_findings) >= MAX_RESOLVE_FINDINGS:
            break
        r_id = f.get("rule_id")
        if r_id and r_id not in seen_rules:
            seen_rules.add(r_id)
            item: Dict[str, Any] = {
                "rule_id": r_id,
                "file": f.get("file", "unknown"),
                "line": f.get("line", "?"),
                "message": f.get("message", "")
            }
            if "ast_context" in f:
                ac = f["ast_context"]
                item["ast_context"] = {
                    "symbol_name": ac.get("symbol_name"),
                    "kind": ac.get("kind"),
                    "callers": ac.get("callers", [])[:3],
                    "impact": ac.get("impact", {})
                }
            item["code_text"] = f.get("code_text", "")
            if target_path:
                try:
                    line_num = int(item["line"])
                except (ValueError, TypeError):
                    line_num = 0
                if line_num > 0:
                    surrounding = read_surrounding_code(target_path, item["file"], line_num)
                    if surrounding:
                        item["surrounding_code"] = surrounding
            unique_findings.append(item)

    if len(seen_rules) > MAX_RESOLVE_FINDINGS:
        logger.info(f"Capped AI resolution to {MAX_RESOLVE_FINDINGS} unique rules (out of {len(seen_rules)} total).")

    if not unique_findings:
        return {}

    logger.info(f"Querying AI completions endpoint ({base_url}) using model '{model}'...")

    resolutions: Dict[str, Any] = {}

    for idx, item in enumerate(unique_findings):
        rule_id = item["rule_id"]
        alias = f"r{idx}"  # Short alias for long rule_ids

        user_prompt = (
            f"Rule ID alias: {alias}\n"
            f"Full Rule: {rule_id}\n"
            f"File: {item['file']} (Line {item['line']})\n"
            f"Code: {item.get('code_text', 'N/A')}\n"
            f"Message: {item['message']}\n"
        )
        surrounding = item.get("surrounding_code")
        if surrounding:
            user_prompt += f"Surrounding code (target line marked with >>>>):\n{surrounding}\n"
        ast_ctx = item.get("ast_context")
        if ast_ctx:
            callers = ", ".join(c.get("name", "?") for c in ast_ctx.get("callers", [])) or "none"
            impact = ast_ctx.get("impact", {})
            user_prompt += (
                f"Symbol: {ast_ctx.get('symbol_name')} ({ast_ctx.get('kind')})\n"
                f"Callers: {callers}\n"
                f"Risk: {impact.get('risk', 'UNKNOWN')}, "
                f"Impacted: {impact.get('impactedCount', 0)}\n"
            )

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT_RESOLVE},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.1,
            "max_tokens": AI_RESOLVE_MAX_TOKENS
        }

        try:
            response = post_with_retry(url, headers, payload, timeout=AI_RESOLVE_TIMEOUT_SECONDS)
            response.raise_for_status()
            response_data = parse_api_response(decode_response_text(response))
            content = response_data["choices"][0]["message"]["content"].strip()
            result = safe_json_parse(content)
            if isinstance(result, dict):
                for key, value in result.items():
                    real_key = rule_id if key == alias else key
                    if isinstance(value, dict):
                        suggestion = (value.get("suggestion") or "").strip()
                        remediation = (value.get("remediation_code") or "").strip()
                        remediation = sanitize_remediation_code(remediation)
                        if not remediation and suggestion and not suggestion.lower().startswith("false positive"):
                            suggestion = f"False positive: {suggestion}"
                        resolutions[real_key] = {"suggestion": suggestion, "remediation_code": remediation}
                    else:
                        resolutions[real_key] = value
            logger.info(f"  [{idx+1}/{len(unique_findings)}] Resolved: {rule_id}")
        except (requests.RequestException, json.JSONDecodeError) as e:
            logger.info(f"  [{idx+1}/{len(unique_findings)}] Error resolving {rule_id}: {e}")
            resolutions[rule_id] = {
                "suggestion": f"False positive: AI resolution failed for {rule_id}: {e}. Re-run AI after checking the provider connection, or pick a faster model.",
                "remediation_code": "",
            }

        if idx < len(unique_findings) - 1:  # Rate limiting sleep
            time.sleep(NAMING_AUDIT_SLEEP)

    return resolutions

if __name__ == "__main__":
    print(json.dumps(resolve_findings([{"rule_id": "python.lang.security.audit.dangerous-exec", "file": "example.py", "line": 12}], use_mock=True), indent=2))
