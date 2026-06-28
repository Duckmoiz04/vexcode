import os, json, random, time, requests
import concurrent.futures
import hashlib
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional, Literal

from engine.utils.logger import get_logger, emit_progress
from engine.config.ai_config import _reload_env_file, get_ai_config, get_resolved_provider_for_agent  # noqa: F401 — re-exported for backward compat
from engine.config.ai_prompts import (
    SYSTEM_PROMPT_RESOLVE, SYSTEM_PROMPT_ANALYZE, SYSTEM_PROMPT_FIX, SYSTEM_PROMPT_REVIEW,
)
from engine.core.ast_graph import search_similar_patterns, get_repo_name_for_path

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
    classification: str = "confirmed",
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
        classification="confirmed",
    ),
    "python.lang.security.audit.hardcoded-password": _make_resolution(
        suggestion="Load password from environment variables instead of hardcoding it in the connection string.",
        remediation_code="import os\npassword = os.environ.get('DB_PASSWORD')\n# conn = connect(password=password)",
        model="mock",
        classification="confirmed",
    ),
    "maintainability.naming.obscure": _make_resolution(
        suggestion="Đổi tên hàm 'do_it' thành 'process_user_data' và tham số 'x' thành 'user_input' để tăng tính rõ nghĩa và dễ bảo trì.",
        remediation_code="def process_user_data(user_input):",
        model="mock",
        classification="confirmed",
    ),
}

from engine.config.constants import (
    MAX_CODE_CHARS, MAX_NAMING_AUDIT_FILES, MAX_RESOLVE_FINDINGS,
    AI_RESOLVE_MAX_TOKENS, NAMING_AUDIT_SLEEP, AI_MAX_RETRIES,
    AI_RETRY_BASE_WAIT_SECONDS, AI_RESOLVE_TIMEOUT_SECONDS, AI_NAMING_TIMEOUT_SECONDS,
    AI_PARALLEL_WORKERS,
)

# --- AI result cache (local JSON file, no DB needed) ---

_CACHE_DIR = Path.home() / ".vexcode" / "ai_cache"
_CACHE_FILE = _CACHE_DIR / "ai_resolutions.json"
_CACHE_TTL_HOURS = 24


def _ensure_cache_file() -> None:
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if not _CACHE_FILE.exists():
        _CACHE_FILE.write_text("{}", encoding="utf-8")


def _load_cache() -> Dict[str, Any]:
    _ensure_cache_file()
    try:
        return json.loads(_CACHE_FILE.read_text(encoding="utf-8")) or {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save_cache(cache: Dict[str, Any]) -> None:
    try:
        _ensure_cache_file()
        _CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def _make_cache_key(rule_id: str, code_text: str, surrounding_code: str) -> str:
    material = f"{rule_id}|||{code_text}|||{surrounding_code}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def _cache_get(rule_id: str, code_text: str, surrounding_code: str) -> Optional[Dict[str, Any]]:
    cache = _load_cache()
    key = _make_cache_key(rule_id, code_text, surrounding_code)
    entry = cache.get(key)
    if not entry:
        return None
    # TTL eviction: expire entries older than _CACHE_TTL_HOURS
    generated_at = entry.get("generated_at", "")
    try:
        gen_dt = datetime.fromisoformat(generated_at)
        if (datetime.now(timezone.utc) - gen_dt).total_seconds() > _CACHE_TTL_HOURS * 3600:
            return None
    except (ValueError, TypeError):
        return None
    return entry


def _cache_put(
    rule_id: str, code_text: str, surrounding_code: str, resolution: Dict[str, Any]
) -> None:
    cache = _load_cache()
    key = _make_cache_key(rule_id, code_text, surrounding_code)
    cache[key] = resolution
    _save_cache(cache)


# --- Smart AI trigger: severity + confidence gate ---

_AI_WORTHY_SEVERITIES = frozenset({"ERROR", "WARNING", "HIGH", "CRITICAL"})
_AI_WORTHY_CONFIDENCES = frozenset({"HIGH", "MEDIUM"})


def _should_skip_ai_call(finding: Dict[str, Any]) -> bool:
    # Temporarily disabled smart gate filter so that all findings are resolved via AI
    return False

# --- Pipeline metrics ---

_pipeline_metrics: Dict[str, Any] = {
    "total_findings": 0,
    "skipped_by_smart_gate": 0,
    "cache_hits": 0,
    "ai_calls": 0,
    "classifications": {"confirmed": 0, "false_positive": 0},
    "fix_success": 0,
    "fix_failure": 0,
    "review_approved": 0,
    "review_rejected": 0,
    "review_corrected": 0,
    "errors": 0,
}


def _record_metric(key: str, value: int = 1) -> None:
    """Increment a counter metric. For nested keys, use dot notation (e.g., 'classifications.confirmed')."""
    parts = key.split(".")
    d = _pipeline_metrics
    for p in parts[:-1]:
        if p not in d:
            d[p] = {}
        d = d[p]
    d[parts[-1]] = d.get(parts[-1], 0) + value


def get_pipeline_metrics() -> Dict[str, Any]:
    """Return a snapshot of pipeline run metrics."""
    import copy
    return copy.deepcopy(_pipeline_metrics)


def reset_pipeline_metrics() -> None:
    """Reset metrics for a new pipeline run."""
    _pipeline_metrics.update({
        "total_findings": 0,
        "skipped_by_smart_gate": 0,
        "cache_hits": 0,
        "ai_calls": 0,
        "classifications": {"confirmed": 0, "false_positive": 0},
        "fix_success": 0,
        "fix_failure": 0,
        "review_approved": 0,
        "review_rejected": 0,
        "review_corrected": 0,
        "errors": 0,
    })

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

    # Resolve per-stage provider → agent routing:
    #   analyze → cheap model (classification)
    #   fix     → strong model (code generation)
    #   review  → balanced model (QA)
    cfg_analyze = get_resolved_provider_for_agent("suggest") or get_resolved_provider_for_agent("bug_scan") or get_resolved_provider_for_agent("analyze")
    cfg_fix = get_resolved_provider_for_agent("suggest") or get_resolved_provider_for_agent("bug_scan") or get_resolved_provider_for_agent("fix")
    cfg_review = get_resolved_provider_for_agent("suggest") or get_resolved_provider_for_agent("bug_scan") or get_resolved_provider_for_agent("review")

    if cfg_analyze is not None:
        api_key = cfg_analyze.api_key
        base_url = cfg_analyze.base_url
        model = cfg_analyze.model
        requires_key = cfg_analyze.requires_key
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

        reset_pipeline_metrics()
        resolutions = {}
        for finding in findings:
            rule_id = finding.get("rule_id")
            _record_metric("total_findings")

            # Simulate realistic metrics based on rule_id string hash (deterministic per rule)
            seed_val = sum(ord(c) for c in (rule_id or ''))
            is_cache = (seed_val % 4) == 0
            if is_cache:
                _record_metric("cache_hits")
            else:
                _record_metric("ai_calls")

            # Simulate classifications
            class_mod = seed_val % 2
            classification = "confirmed" if class_mod == 0 else "false_positive"
            _record_metric(f"classifications.{classification}")

            # Simulate review decisions
            if classification == "confirmed":
                _record_metric("fix_success")
                if (seed_val % 5) < 4:
                    _record_metric("review_approved")
                else:
                    _record_metric("review_corrected")
            else:
                _record_metric("fix_failure")
                _record_metric("review_rejected")

            if rule_id in MOCK_AI_RESOLUTIONS:
                resolutions[rule_id] = MOCK_AI_RESOLUTIONS[rule_id]
            else:
                resolutions[rule_id] = _make_resolution(
                    suggestion=f"Avoid this pattern for rule {rule_id}. Ensure input validation and standard security practices.",
                    remediation_code=f"# Remediation for {rule_id}\n# Please review and replace dangerous code patterns.",
                    ai_status="fallback_mock",
                    model="mock",
                    classification=classification,
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
                "severity": f.get("severity", ""),
                "confidence": f.get("confidence", ""),
            }
            if "ast_context" in f:
                ac = f["ast_context"]
                item["ast_context"] = {
                    "symbol_name": ac.get("symbol_name"),
                    "kind": ac.get("kind"),
                    "source_code": ac.get("source_code"),
                    "callers": ac.get("callers", []),
                    "impact": ac.get("impact", {}),
                    "blast_radius": ac.get("blast_radius", []),
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

    total = len(unique_findings)
    a_model = cfg_analyze.model if cfg_analyze else model
    f_model = cfg_fix.model if cfg_fix else model
    r_model = cfg_review.model if cfg_review else model
    logger.info(
        f"Starting 3-stage AI pipeline for {total} findings "
        f"(analyze: {a_model}, fix: {f_model}, review: {r_model})"
    )

    reset_pipeline_metrics()
    resolutions: Dict[str, Any] = {}
    completed = 0

    for idx, item in enumerate(unique_findings):
        r_id = item["rule_id"]
        code_text = item.get("code_text", "")
        surrounding_code = item.get("surrounding_code", "")
        _record_metric("total_findings")

        # Semantic search: find similar patterns across codebase
        if target_path and r_id and code_text:
            repo_name = get_repo_name_for_path(target_path)
            if repo_name:
                item["semantic_search"] = search_similar_patterns(repo_name, code_text, r_id)

        # Smart skip: low-severity or low-confidence findings get mock
        if _should_skip_ai_call(item):
            resolutions[r_id] = _make_resolution(
                suggestion=f"Avoid this pattern for rule {r_id}. Auto-skipped: severity/confidence below AI threshold.",
                remediation_code="",
                ai_status="fallback_mock",
                model="mock-skipped",
                classification="confirmed",
            )
            _record_metric("skipped_by_smart_gate")
            completed += 1
            continue

        # Cache hit
        cached = _cache_get(r_id, code_text, surrounding_code)
        if cached is not None:
            cached["ai_status"] = "success"
            cached["model"] = model
            cached["generated_at"] = _now_iso()
            resolutions[r_id] = cached
            _record_metric("cache_hits")
            completed += 1
            continue

        stage_item = {**item, "url": url, "headers": headers, "model": model, "idx": idx, "total": total}

        # ---- STAGE 1: Analyze (cheap model) ----
        _record_metric("ai_calls")
        a_item = _stage_item(item, idx, total, cfg_analyze) if cfg_analyze else stage_item
        analyze_result = _call_stage(a_item, SYSTEM_PROMPT_ANALYZE, AI_RESOLVE_MAX_TOKENS)
        analyze_data = analyze_result[1]
        if "error" in analyze_data:
            resolutions[r_id] = _make_resolution(
                suggestion=f"False positive: Analysis failed for {r_id}: {analyze_data['error']}.",
                remediation_code="", ai_status="failed", ai_error=analyze_data["error"],
                model=model, classification="false_positive",
            )
            _record_metric("errors")
            completed += 1
            continue

        classification = analyze_data.get("classification", "confirmed")
        # Normalize: prompt requests confirmed|false_positive, but LLM may return
        # other values (e.g. "hotspot"). Map anything unexpected to "confirmed".
        if classification not in ("confirmed", "false_positive"):
            logger.info(f"AI returned unexpected classification '{classification}' for rule {r_id}, normalizing to 'confirmed'")
            classification = "confirmed"
        reasoning = analyze_data.get("reasoning", "")
        _record_metric(f"classifications.{classification}")

        # False positives stop here - TEMPORARILY DISABLED to allow fixes for all findings
        # if classification in ("false_positive",):
        #     resolutions[r_id] = _make_resolution(
        #         suggestion=f"{classification.replace('_', ' ').title()}: {reasoning}",
        #         remediation_code="",
        #         ai_status="success",
        #         model=model,
        #         classification=classification,
        #     )
        #     completed += 1
        #     continue

        # ---- STAGE 2: Fix (strong model, vulnerability only) ----
        _record_metric("ai_calls")
        f_item = _stage_item(item, idx, total, cfg_fix) if cfg_fix else stage_item
        fix_extra = f"Analyst classification: {classification}\nReasoning: {reasoning}"
        fix_result = _call_stage(f_item, SYSTEM_PROMPT_FIX, AI_RESOLVE_MAX_TOKENS, extra_content=fix_extra)
        fix_data = fix_result[1]
        if "error" in fix_data:
            resolutions[r_id] = _make_resolution(
                suggestion=f"False positive: Fix generation failed for {r_id}: {fix_data['error']}.",
                remediation_code="", ai_status="failed", ai_error=fix_data["error"],
                model=model, classification="false_positive",
            )
            _record_metric("errors")
            _record_metric("fix_failure")
            completed += 1
            continue

        _record_metric("fix_success")
        suggestion = fix_data.get("suggestion", "") or ""
        remediation = sanitize_remediation_code(fix_data.get("remediation_code", "") or "")

        # ---- STAGE 3: Review (balanced model) ----
        _record_metric("ai_calls")
        r_item = _stage_item(item, idx, total, cfg_review) if cfg_review else stage_item
        review_extra = (
            f"Analyst classification: {classification}\n"
            f"Reasoning: {reasoning}\n"
            f"Engineer's suggestion: {suggestion}\n"
            f"Engineer fix:\n```\n{remediation}\n```"
        )
        review_result = _call_stage(r_item, SYSTEM_PROMPT_REVIEW, AI_RESOLVE_MAX_TOKENS, extra_content=review_extra)
        review_data = review_result[1]

        final_suggestion = suggestion
        final_remediation = remediation
        final_classification = classification

        if "error" not in review_data:
            decision = review_data.get("decision", "approved")
            if decision == "approved":
                _record_metric("review_approved")
                final_suggestion = review_data.get("suggestion", suggestion)
                final_remediation = sanitize_remediation_code(review_data.get("remediation_code", remediation) or "")
            else:
                _record_metric("review_rejected")
                final_suggestion = review_data.get("suggestion", suggestion)
                alt_fix = review_data.get("remediation_code", "")
                if alt_fix:
                    _record_metric("review_corrected")
                    final_remediation = sanitize_remediation_code(alt_fix)
        else:
            _record_metric("errors")

        resolution = _make_resolution(
            suggestion=final_suggestion,
            remediation_code=final_remediation,
            classification=final_classification,
            ai_status="success",
            model=model,
        )
        if "error" not in review_data:
            resolution["review_decision"] = review_data.get("decision", "approved")
            resolution["review_comment"] = review_data.get("review_comment", "")

        resolutions[r_id] = resolution
        # Cache the final result
        _cache_put(r_id, code_text, surrounding_code, resolution)
        completed += 1
        emit_progress("ai_resolve", f"Pipeline complete: {r_id}", current=completed, total=total)

    metrics = get_pipeline_metrics()
    logger.info(
        f"Pipeline metrics: {metrics['total_findings']} findings → "
        f"skipped={metrics['skipped_by_smart_gate']} cache={metrics['cache_hits']} "
        f"calls={metrics['ai_calls']} errors={metrics['errors']} | "
        f"cls=v:{metrics['classifications']['confirmed']}/"
        f"fp:{metrics['classifications']['false_positive']} | "
        f"fix={metrics['fix_success']}/{metrics['fix_failure']} | "
        f"review=+{metrics['review_approved']}-{metrics['review_rejected']}~{metrics['review_corrected']}"
    )
    return dict(sorted(resolutions.items()))


def _stage_item(
    item: Dict[str, Any], idx: int, total: int, provider_cfg: Any
) -> Dict[str, Any]:
    """Build a stage-specific item dict with provider url/headers/model."""
    return {
        **item,
        "url": f"{provider_cfg.base_url.rstrip('/')}/chat/completions",
        "headers": {
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {provider_cfg.api_key}"} if provider_cfg.api_key else {}),
        },
        "model": provider_cfg.model,
        "idx": idx,
        "total": total,
    }


def _build_user_prompt(item: Dict[str, Any]) -> str:
    """Build the common user prompt from finding data. Shared across pipeline stages."""
    prompt = (
        f"Rule ID alias: r{item['idx']}\n"
        f"Full Rule: {item['rule_id']}\n"
        f"File: {item['file']} (Line {item['line']})\n"
        f"Code: {item.get('code_text', 'N/A')}\n"
        f"Message: {item['message']}\n"
    )
    owasp_id = item.get("owasp_id", "")
    if owasp_id:
        prompt += f"OWASP: {owasp_id}\n"
    surrounding = item.get("surrounding_code")
    if surrounding:
        prompt += f"Surrounding code (target line marked with >>>>):\n{surrounding}\n"
    return prompt


def _build_data_flow_trace(item: Dict[str, Any]) -> str:
    """Build a human-readable data flow trace from blast radius AST data.

    Traces the call chain from the vulnerable symbol backward through callers
    to identify potential taint sources (HTTP handlers, file I/O, CLI args, DB reads).
    """
    ast_ctx = item.get("ast_context")
    if not ast_ctx:
        return ""

    blast = ast_ctx.get("blast_radius", [])
    if not blast:
        return ""

    lines = ["\n--- Data Flow Trace (GitNexus upstream call chain) ---"]
    lines.append("Trace from this vulnerable code BACK to potential taint sources:")

    symbol_name = ast_ctx.get("symbol_name", "?")
    lines.append(f"\n[VULNERABLE] {symbol_name} @ {item.get('file', '?')}:{item.get('line', '?')}")

    for entry in blast[:7]:
        depth = entry.get("depth", "?")
        caller_name = entry.get("name", entry.get("uid", "?"))
        file_path = entry.get("filePath", "?")
        relation = entry.get("relation", entry.get("relationType", "?"))

        markers = []
        if relation in ("CALLS", "calls"):
            markers.append("calls")
        if depth == 1:
            markers.append("direct caller")

        marker_str = ", ".join(markers) if markers else ""
        prefix = "  ↑" + "  →" * (int(depth) if isinstance(depth, int) else 1) if depth != "?" else "  ↑"

        lines.append(f"{prefix} [{caller_name}] in {file_path} (depth {depth}{', ' + marker_str if marker_str else ''})")

    taint_hints = _detect_taint_sources(blast)
    if taint_hints:
        lines.append(f"\nPotential taint sources detected: {', '.join(taint_hints)}")

    lines.append("\nUse this trace to confirm: does attacker input reach this code?")
    return "\n".join(lines) + "\n"


def _detect_taint_sources(blast_radius: List[Dict[str, Any]]) -> List[str]:
    """Heuristically detect taint sources from blast radius callers."""
    taint_keywords = {
        "request": "HTTP request handler",
        "router": "route handler",
        "api": "API endpoint",
        "endpoint": "API endpoint",
        "handler": "event handler",
        "controller": "controller",
        "read_file": "file I/O",
        "open(": "file I/O",
        "sys.argv": "CLI arguments",
        "argparse": "CLI arguments",
        "os.environ": "environment variable",
        "input(": "user input",
        "socket": "network socket",
        "recv": "network receive",
        "fetch": "HTTP fetch",
        "query": "database query",
        "execute": "database execute",
    }
    found = set()
    for entry in blast_radius:
        name = (entry.get("name") or "").lower()
        for keyword, label in taint_keywords.items():
            if keyword in name and label not in found:
                found.add(label)
    return sorted(found)


def _inject_ast_context(item: Dict[str, Any], prompt: str) -> str:
    """Append GitNexus AST context (source, callers, blast radius) to the prompt.

    Returns the prompt unchanged if no ast_context is available.
    """
    ast_ctx = item.get("ast_context")
    if not ast_ctx:
        return prompt

    symbol_source = ast_ctx.get("source_code")
    if symbol_source:
        prompt += (
            f"\n--- Symbol source code (from GitNexus AST) ---\n"
            f"Full source of '{ast_ctx.get('symbol_name')}' ({ast_ctx.get('kind')}):\n"
            f"```\n{symbol_source}\n```\n"
        )
    callers = ast_ctx.get("callers", [])
    if callers:
        caller_lines = [f"  - {c.get('name', '?')} @ {c.get('filePath', '?')}" for c in callers]
        prompt += (
            f"\nCallers that depend on this symbol (GitNexus blast radius):\n"
            + "\n".join(caller_lines) + "\n"
        )
    impact = ast_ctx.get("impact", {})
    if impact:
        prompt += (
            f"Risk level: {impact.get('risk', 'UNKNOWN')}. "
            f"Direct dependents: {impact.get('impactedCount', 0)}.\n"
        )
    blast = ast_ctx.get("blast_radius", [])
    if blast:
        blast_lines = [
            f"  - {b.get('name', '?')} (depth {b.get('depth', '?')}, "
            f"{b.get('relation', '?')}) in {b.get('filePath', '?')}"
            for b in blast[:5]
        ]
        prompt += f"Blast radius (symbols that depend on this code):\n" + "\n".join(blast_lines) + "\n"
    # Inject data flow trace (upstream call chain → taint source detection)
    data_flow = _build_data_flow_trace(item)
    if data_flow:
        prompt += data_flow

    # Inject semantic search results (similar patterns across codebase)
    semantic = item.get("semantic_search")
    if semantic:
        prompt += "\n--- Similar code patterns in this codebase (GitNexus semantic search) ---\n"
        prompt += "The following locations have patterns similar to this vulnerability:\n"
        for i, result in enumerate(semantic, 1):
            prompt += f"\n[{i}] {result.get('name', 'unknown')} (score: {result.get('match_score', '?')})\n"
            for step in result.get("steps", []):
                src = step.get("source_code", "")
                if src:
                    src = src[:300] if len(src) > 300 else src
                    prompt += f"    File: {step.get('file', '?')}:{step.get('line', '?')}\n"
                    prompt += f"    Code: {src}\n"
        prompt += "\nConsider whether these similar patterns indicate a systemic vulnerability or if this is isolated.\n"
    return prompt


def _make_payload(model: str, system_prompt: str, user_content: str, max_tokens: int) -> Dict[str, Any]:
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.1,
        "max_tokens": max_tokens,
    }


def _call_stage(
    item: Dict[str, Any],
    system_prompt: str,
    max_tokens: int,
    extra_content: str = "",
) -> Tuple[str, Dict[str, Any]]:
    """Call AI for one pipeline stage. Returns (rule_id, parsed_result_dict)."""
    rule_id = item["rule_id"]
    url = item["url"]
    headers = item["headers"]
    model = item["model"]
    idx = item["idx"]
    total = item["total"]

    user_prompt = _build_user_prompt(item)
    user_prompt = _inject_ast_context(item, user_prompt)
    if extra_content:
        user_prompt += f"\n{extra_content}\n"

    payload = _make_payload(model, system_prompt, user_prompt, max_tokens)

    try:
        response = post_with_retry(url, headers, payload, timeout=AI_RESOLVE_TIMEOUT_SECONDS)
        response.raise_for_status()
        response_data = parse_api_response(decode_response_text(response))
        content = _extract_message_content(response_data)
        if not content:
            logger.info(f"  [{idx+1}/{total}] Stage returned empty content for {rule_id}")
            return rule_id, {"error": "empty_content"}
        result = safe_json_parse(content)
        if isinstance(result, dict):
            logger.info(f"  [{idx+1}/{total}] Stage completed: {rule_id}")
            return rule_id, result
        logger.info(f"  [{idx+1}/{total}] Stage returned non-dict for {rule_id}")
        return rule_id, {"error": "invalid_response", "raw": str(result)[:200]}
    except (requests.RequestException, json.JSONDecodeError, ValueError, KeyError, IndexError, TypeError) as e:
        logger.info(f"  [{idx+1}/{total}] Stage error for {rule_id}: {e}")
        return rule_id, {"error": str(e)[:200]}


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
        # GitNexus-powered RAG: inject deep context so the LLM understands
        # the symbol it's patching — its source, who calls it, and what breaks.
        symbol_source = ast_ctx.get("source_code")
        if symbol_source:
            user_prompt += (
                f"\n--- Symbol source code (from GitNexus AST) ---\n"
                f"Full source of '{ast_ctx.get('symbol_name')}' ({ast_ctx.get('kind')}):\n"
                f"```\n{symbol_source}\n```\n"
            )
        callers = ast_ctx.get("callers", [])
        if callers:
            caller_lines = []
            for c in callers:
                cid = f"{c.get('name', '?')} @ {c.get('filePath', '?')}"
                caller_lines.append(f"  - {cid}")
            if caller_lines:
                user_prompt += (
                    f"\nCallers that depend on this symbol (GitNexus blast radius):\n"
                    + "\n".join(caller_lines) + "\n"
                )
        impact = ast_ctx.get("impact", {})
        if impact:
            user_prompt += (
                f"Risk level: {impact.get('risk', 'UNKNOWN')}. "
                f"Direct dependents: {impact.get('impactedCount', 0)}.\n"
            )
        blast = ast_ctx.get("blast_radius", [])
        if blast:
            blast_lines = []
            for b in blast[:5]:
                blast_lines.append(
                    f"  - {b.get('name', '?')} (depth {b.get('depth', '?')}, "
                    f"{b.get('relation', '?')}) in {b.get('filePath', '?')}"
                )
            if blast_lines:
                user_prompt += (
                    f"Blast radius (symbols that depend on this code):\n"
                    + "\n".join(blast_lines) + "\n"
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
                            classification = "confirmed"
                        else:
                            classification = "confirmed"
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
