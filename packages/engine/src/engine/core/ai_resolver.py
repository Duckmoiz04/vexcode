import os, json, random, time, requests
import concurrent.futures
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Dict, Any, List, Tuple, Optional, Literal

from engine.utils.logger import get_logger, emit_progress
from engine.config.ai_config import _reload_env_file, get_ai_config, get_resolved_provider_for_agent  # noqa: F401 — re-exported for backward compat
from engine.config.ai_prompts import SYSTEM_PROMPT_RESOLVE

logger = get_logger(__name__)

AIStatus = Literal["success", "failed", "fallback_mock"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_resolution(
    suggestion: str,
    remediation_code: str = "",
    *,
    ai_status: str = "success",
    ai_error: str = "",
    model: str = "",
    remediation_target_file: str = "",
    classification: str = "vulnerability",
) -> Dict[str, Any]:
    return {
        "suggestion": suggestion,
        "remediation_code": remediation_code,
        "classification": classification,
        "ai_status": ai_status,
        "ai_error": ai_error,
        "model": model,
        "generated_at": _now_iso(),
        "remediation_target_file": remediation_target_file,
    }


# Standard mock AI resolutions map
MOCK_AI_RESOLUTIONS = {
    "python.lang.security.audit.dangerous-exec": _make_resolution(
        suggestion="Avoid using exec(). Use structured functions or parse inputs securely.",
        remediation_code="import subprocess\n# Avoid exec(user_input)\n# Use safe subprocess with arguments\nsubprocess.run(['echo', user_input])",
        model="mock",
        classification="vulnerability",
    ),
    "python.lang.security.audit.hardcoded-password": _make_resolution(
        suggestion="Load password from environment variables instead of hardcoding it in the connection string.",
        remediation_code="import os\npassword = os.environ.get('DB_PASSWORD')\n# conn = connect(password=password)",
        model="mock",
        classification="vulnerability",
    ),
    "maintainability.naming.obscure": _make_resolution(
        suggestion="Đổi tên hàm 'do_it' thành 'process_user_data' và tham số 'x' thành 'user_input' để tăng tính rõ nghĩa và dễ bảo trì.",
        remediation_code="def process_user_data(user_input):",
        model="mock",
        classification="vulnerability",
    ),
}

from engine.config.constants import (
    MAX_CODE_CHARS, MAX_NAMING_AUDIT_FILES, MAX_RESOLVE_FINDINGS,
    AI_RESOLVE_MAX_TOKENS, NAMING_AUDIT_SLEEP, AI_MAX_RETRIES,
    AI_RETRY_BASE_WAIT_SECONDS, AI_RESOLVE_TIMEOUT_SECONDS, AI_NAMING_TIMEOUT_SECONDS,
    AI_PARALLEL_WORKERS,
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


def _extract_message_content(response_data: Dict[str, Any]) -> str:
    """Robustly extract text content from a chat-completions response.

    Handles several response shapes that the standard ``response.choices[0].message.content``
    accessor does not cover:

    - **Standard**: ``content`` is a plain string.
    - **Multimodal list of parts** (e.g. NVIDIA NIM ``minimax-m3``): ``content`` is a
      list of dicts, each with ``type`` (e.g. ``"text"``, ``"reasoning"``) and ``text``.
    - **Tool-call / refusal**: ``content`` is ``None`` or empty.

    Returns an empty string when no text can be extracted; never raises.
    """
    try:
        choices = response_data.get("choices")
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        content = message.get("content")

        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts: list = []
            for part in content:
                if not isinstance(part, dict):
                    continue
                ptype = part.get("type")
                if ptype in ("text", "reasoning", None) and "text" in part:
                    parts.append(str(part.get("text") or ""))
            return "\n".join(parts).strip()
        # None / dict / other — treat as empty
        return ""
    except (KeyError, IndexError, TypeError, AttributeError):
        return ""

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
            retry_after = response.headers.get("Retry-After")
            if retry_after is not None:
                try:
                    wait = int(retry_after) + random.uniform(0, 5)
                except (ValueError, TypeError):
                    try:
                        parsed_date = parsedate_to_datetime(retry_after)
                        delta = parsed_date - datetime.now(timezone.utc)
                        wait = max(0, delta.total_seconds()) + random.uniform(0, 5)
                    except (ValueError, TypeError):
                        wait = AI_RETRY_BASE_WAIT_SECONDS * (2 ** attempt)
            else:
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

    # Try the new agent-resolved provider first, then fall back to legacy get_ai_config
    provider_cfg = get_resolved_provider_for_agent("suggest")
    if provider_cfg is not None:
        api_key = provider_cfg.api_key
        base_url = provider_cfg.base_url
        model = provider_cfg.model
        requires_key = provider_cfg.requires_key
    else:
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
                resolutions[rule_id] = _make_resolution(
                    suggestion=f"Avoid this pattern for rule {rule_id}. Ensure input validation and standard security practices.",
                    remediation_code=f"# Remediation for {rule_id}\n# Please review and replace dangerous code patterns.",
                    ai_status="fallback_mock",
                    model="mock",
                    classification="vulnerability",
                )
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
                "message": f.get("message", ""),
                "owasp_id": f.get("owasp_id", ""),
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

    logger.info(f"Querying AI completions endpoint ({base_url}) using model '{model}' with {AI_PARALLEL_WORKERS} parallel workers...")

    resolutions: Dict[str, Any] = {}
    total = len(unique_findings)
    completed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=AI_PARALLEL_WORKERS) as executor:
        futures = {
            executor.submit(
                call_ai_for_rule,
                {
                    **item,
                    "url": url,
                    "headers": headers,
                    "model": model,
                    "idx": idx,
                    "total": total,
                },
            ): idx
            for idx, item in enumerate(unique_findings)
        }
        for future in concurrent.futures.as_completed(futures):
            completed += 1
            try:
                rule_id, resolution = future.result()
                resolutions[rule_id] = resolution
                emit_progress("ai_resolve", "Resolving findings...",
                              current=completed, total=total)
            except Exception as e:
                idx = futures[future]
                rule_id = unique_findings[idx].get("rule_id", f"unknown-{idx}")
                logger.info(f"  [{idx+1}/{total}] Unexpected error resolving {rule_id}: {e}")
                resolutions[rule_id] = _make_resolution(
                    suggestion=f"False positive: AI resolution failed for {rule_id}: {e}.",
                    remediation_code="",
                    ai_status="failed",
                    ai_error=str(e),
                    model=model,
                    classification="false_positive",
                )
                emit_progress("ai_resolve", f"Failed: {rule_id}",
                              current=completed, total=total)

    return dict(sorted(resolutions.items()))


def call_ai_for_rule(item: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    rule_id = item["rule_id"]
    url = item["url"]
    headers = item["headers"]
    model = item["model"]
    idx = item["idx"]
    total = item["total"]
    alias = f"r{idx}"

    user_prompt = (
        f"Rule ID alias: {alias}\n"
        f"Full Rule: {rule_id}\n"
        f"File: {item['file']} (Line {item['line']})\n"
        f"Code: {item.get('code_text', 'N/A')}\n"
        f"Message: {item['message']}\n"
    )
    owasp_id = item.get("owasp_id", "")
    if owasp_id:
        user_prompt += f"OWASP: {owasp_id}\n"
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
        content = _extract_message_content(response_data)
        if not content:
            choices = response_data.get("choices") or [{}]
            first = choices[0] or {}
            finish = first.get("finish_reason") or "?"
            logger.info(
                f"  [{idx+1}/{total}] AI returned empty content "
                f"(finish_reason={finish}) for {rule_id}. "
                f"Model may have refused or returned non-text."
            )
            return rule_id, _make_resolution(
                suggestion=(
                    f"False positive: AI returned no text content for {rule_id} "
                    f"(finish_reason={finish}). The model may have refused, used tool calls, "
                    f"or returned a non-text/multimodal response."
                ),
                remediation_code="",
                ai_status="failed",
                ai_error=f"model returned empty content (finish_reason={finish})",
                model=model,
                classification="false_positive",
            )
        result = safe_json_parse(content)
        if isinstance(result, dict):
            out: Dict[str, Any] = {}
            for key, value in result.items():
                real_key = rule_id if key == alias else key
                if isinstance(value, dict):
                    suggestion = (value.get("suggestion") or "").strip()
                    remediation = (value.get("remediation_code") or "").strip()
                    remediation = sanitize_remediation_code(remediation)
                    classification = value.get("classification")
                    # Infer classification if AI didn't provide one (backward compat)
                    if not classification:
                        if not remediation and suggestion.lower().startswith("false positive"):
                            classification = "false_positive"
                        elif not remediation:
                            classification = "hotspot"
                        else:
                            classification = "vulnerability"
                    out[real_key] = _make_resolution(
                        suggestion=suggestion,
                        remediation_code=remediation,
                        classification=classification,
                        ai_status="success",
                        model=model,
                    )
                else:
                    out[real_key] = _make_resolution(
                        suggestion=str(value),
                        remediation_code="",
                        ai_status="success",
                        model=model,
                    )
            logger.info(f"  [{idx+1}/{total}] Resolved: {rule_id}")
            resolution = out.get(rule_id) or out.get(alias) or next(iter(out.values()), None)
            if resolution is None:
                resolution = _make_resolution(
                    suggestion="",
                    remediation_code="",
                    ai_status="failed",
                    ai_error="AI returned empty result map",
                    model=model,
                )
            return rule_id, resolution

        logger.info(
            f"  [{idx+1}/{total}] AI response for {rule_id} was not JSON; using raw text as suggestion."
        )
        return rule_id, _make_resolution(
            suggestion=content[:500],
            remediation_code="",
            ai_status="failed",
            ai_error="response was not valid JSON",
            model=model,
        )
    except (requests.RequestException, json.JSONDecodeError, ValueError, KeyError, IndexError, TypeError) as e:
        logger.info(f"  [{idx+1}/{total}] Error resolving {rule_id}: {e}")
        return rule_id, _make_resolution(
            suggestion=f"False positive: AI resolution failed for {rule_id}: {e}. Re-run AI after checking the provider connection, or pick a faster model.",
            remediation_code="",
            ai_status="failed",
            ai_error=str(e),
            model=model,
            classification="false_positive",
        )

if __name__ == "__main__":
    print(json.dumps(resolve_findings([{"rule_id": "python.lang.security.audit.dangerous-exec", "file": "example.py", "line": 12}], use_mock=True), indent=2))
