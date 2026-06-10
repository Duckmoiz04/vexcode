import os
import sys
import json
import re
import time
import requests
from dotenv import load_dotenv
from typing import Dict, Any, List, Tuple, Optional

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
                if val:
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
    MAX_CODE_CHARS,
    MAX_NAMING_AUDIT_FILES,
    MAX_RESOLVE_FINDINGS,
    AI_RESOLVE_MAX_TOKENS,
    NAMING_AUDIT_SLEEP,
    AI_MAX_RETRIES,
    AI_RETRY_BASE_WAIT_SECONDS,
    AI_RESOLVE_TIMEOUT_SECONDS,
    AI_NAMING_TIMEOUT_SECONDS,
)

# Comment markers per language. The AI sometimes returns a comment-only "remediation"
# like "# Remediation code for path-traversal" — we strip those to keep the
# frontend from rendering them as real + additions.
_COMMENT_PREFIXES = ("#", "//", "/*", "*", "--", ";")


def sanitize_remediation_code(code: str) -> str:
    """Return the remediation code with placeholder-only / comment-only text stripped.

    If every non-empty line is a comment, the AI did not produce an actual fix.
    In that case we return an empty string so the frontend treats this as a
    deletion / false-positive instead of a real code addition.
    """
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
    """Decode HTTP response body as UTF-8, fixing mojibake from wrong charset headers.
    9router returns Content-Type: text/event-stream; charset=iso-8859-1
    causing requests to mangle UTF-8 chars (e.g., em dash → â\x80\x94).
    """
    raw = response.content
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


def safe_json_parse(text: str) -> Any:
    """
    Robustly parse JSON from AI response text.
    Handles: markdown fences, extra trailing data after valid JSON.
    Uses raw_decode to stop at the end of the first valid JSON value
    and silently discard any trailing garbage.
    Returns parsed Python object or raises ValueError.
    """
    # Strip markdown code fences
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        lines = lines[1:]  # remove opening fence
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]  # remove closing fence
        text = "\n".join(lines).strip()

    # raw_decode parses the first valid JSON value and ignores trailing text
    # This is the correct fix for "Extra data" errors.
    decoder = json.JSONDecoder()
    text = text.strip()
    # Find first '[' or '{' to skip any leading non-JSON text
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
    """
    Parse a 9router/OpenAI-format HTTP response body.
    Always searches for '{' first since API responses are always JSON objects.
    Handles trailing garbage after the JSON object.
    """
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
    """
    POST with exponential-backoff retry on rate limits and slow local routers.
    Local 9router/model backends can accept the request and then exceed the
    read timeout, so timeout/connectivity errors need the same bounded retry
    treatment as 429 responses.
    """
    last_error = None
    for attempt in range(AI_MAX_RETRIES + 1):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=timeout)
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
            last_error = exc
            if attempt < AI_MAX_RETRIES:
                wait = AI_RETRY_BASE_WAIT_SECONDS * (2 ** attempt)
                print(
                    f"AI request failed ({exc.__class__.__name__}) — retrying in {wait:.0f}s "
                    f"(attempt {attempt + 1}/{AI_MAX_RETRIES})...",
                    file=sys.stderr
                )
                time.sleep(wait)
                continue
            raise

        if response.status_code == 429 and attempt < AI_MAX_RETRIES:
            wait = AI_RETRY_BASE_WAIT_SECONDS * (2 ** attempt)
            print(f"429 Too Many Requests — retrying in {wait:.0f}s (attempt {attempt + 1}/{AI_MAX_RETRIES})...", file=sys.stderr)
            time.sleep(wait)
            continue
        return response

    if last_error:
        raise last_error
    return response


def read_surrounding_code(target_path: str, file_path: str, line_num: int, context_lines: int = 5) -> str:
    """Read context lines around a finding from the source file.
    Returns annotated lines with >>>> marking the target line."""
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
        if i == line_num - 1:
            result.append(f">>>> {all_lines[i]}")
        else:
            result.append(f"     {all_lines[i]}")
    return "".join(result)


def resolve_findings(findings: Any, use_mock: bool = False, target_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Sends findings to the AI completions API to get AI remediation recommendations.
    If use_mock is True, or if required keys are missing or request fails,
    returns standard mock resolutions.
    """
    if isinstance(findings, dict):
        findings = findings.get("findings", [])
        
    api_key, base_url, model, requires_key = get_ai_config()

    # Fall back to mock resolutions when the user has not configured the AI yet.
    fallback_due_to_key = requires_key and not api_key
    fallback_due_to_config = not base_url or not model
    fallback_due_to_missing_provider = not os.getenv("AI_PROVIDER")

    if use_mock or fallback_due_to_key or fallback_due_to_config or fallback_due_to_missing_provider:
        if not use_mock:
            if fallback_due_to_missing_provider:
                print("AI provider is not configured. Set AI_PROVIDER (and provider keys) via the Settings drawer, or pass --mock-ai. Falling back to mock resolutions.", file=sys.stderr)
            elif fallback_due_to_key:
                print("API key is required but not found in environment. Falling back to mock resolutions.", file=sys.stderr)
            else:
                print(f"AI config is incomplete (base_url='{base_url}', model='{model}'). Falling back to mock resolutions.", file=sys.stderr)
        else:
            print("Using mock AI resolutions as requested.", file=sys.stderr)
            
        # Return mock resolutions matched against the rule_ids in the findings
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

    # Per-rule sequential approach: send ONE rule per request.
    # Batch requests with 5+ rules generate huge responses that timeout (60s+).
    # One rule per request = small payload, ~512 token response, completes in ~5-10s.
    headers = {
        "Content-Type": "application/json"
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    url = f"{base_url.rstrip('/')}/chat/completions"

    # Collect unique rules capped at MAX_RESOLVE_FINDINGS
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
                ast_ctx = f["ast_context"]
                item["ast_context"] = {
                    "symbol_name": ast_ctx.get("symbol_name"),
                    "kind": ast_ctx.get("kind"),
                    "callers": ast_ctx.get("callers", [])[:3],
                    "impact": ast_ctx.get("impact", {})
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

    total = len(seen_rules)
    if total > MAX_RESOLVE_FINDINGS:
        print(f"Capped AI resolution to {MAX_RESOLVE_FINDINGS} unique rules (out of {total} total).", file=sys.stderr)

    if not unique_findings:
        return {}

    print(f"Querying AI completions endpoint ({base_url}) using model '{model}'...", file=sys.stderr)

    system_prompt = (
        "You are an expert security engineer reviewing code. Follow these two steps:\n"
        "1. VERIFY: Determine if the reported finding is a real vulnerability or a false positive. "
        "Look at the surrounding code — is the dangerous pattern actually reachable with "
        "attacker-controlled input? Is there existing sanitization?\n"
        "2. EVALUATE & FIX: If it is a real issue, produce a fix that accounts for:\n"
        "  - Security: attack vector, input validation, principle of least privilege\n"
        "  - Correctness: the fix preserves intended behavior\n"
        "  - Side effects: the fix does not break callers or other components\n"
        "  - Best practices: idiomatic patterns for the language and framework\n"
        "Rules for remediation_code:\n"
        "- ONLY the fixed line(s) of code, nothing else\n"
        "- NO surrounding context, NO function body, NO file content\n"
        "- NO 'Before:'/'After:' comments, NO explanatory comments\n"
        "- NEVER return a comment-only string such as '# Remediation code for X' or '// TODO fix'. "
        "If you cannot produce a concrete code fix, return an empty string for remediation_code "
        "and prefix the suggestion with 'False positive:'.\n"
        "- A clean, standalone snippet that directly replaces the vulnerable pattern\n"
        "- Example for a RegExp issue: const safeRegex = /hardcoded_pattern/;\n"
        "If the finding is a FALSE POSITIVE, set suggestion to 'False positive: <explain why>' "
        "and remediation_code to an empty string.\n"
        "IMPORTANT: Use the 'Rule ID alias' value (e.g., r0) as the JSON key, NOT the full rule name.\n"
        "Respond ONLY with raw JSON (no markdown fences) in this exact shape:\n"
        "{\"<alias>\": {\"suggestion\": \"one sentence: what to change and why\", "
        "\"remediation_code\": \"ONLY the fixed replacement code\"}}"
    )

    resolutions: Dict[str, Any] = {}

    for idx, item in enumerate(unique_findings):
        rule_id = item["rule_id"]
        # Use a short alias (r0, r1, ...) so the model doesn't truncate the JSON key
        # when the rule_id is very long (e.g., 75+ chars like detect-non-literal-regexp...)
        alias = f"r{idx}"

        user_prompt = (
            f"Rule ID alias: {alias}\n"
            f"Full Rule: {rule_id}\n"
            f"File: {item['file']} (Line {item['line']})\n"
            f"Code: {item.get('code_text', 'N/A')}\n"
            f"Message: {item['message']}\n"
        )
        surrounding = item.get("surrounding_code")
        if surrounding:
            user_prompt += (
                f"Surrounding code (target line marked with >>>>):\n"
                f"{surrounding}\n"
            )
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
                {"role": "system", "content": system_prompt},
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
                # Remap alias key back to the real rule_id
                for key, value in result.items():
                    real_key = rule_id if key == alias else key
                    if isinstance(value, dict):
                        suggestion = (value.get("suggestion") or "").strip()
                        remediation = (value.get("remediation_code") or "").strip()
                        remediation = sanitize_remediation_code(remediation)
                        if not remediation and suggestion and not suggestion.lower().startswith("false positive"):
                            suggestion = f"False positive: {suggestion}"
                        resolutions[real_key] = {
                            "suggestion": suggestion,
                            "remediation_code": remediation,
                        }
                    else:
                        resolutions[real_key] = value
            print(f"  [{idx+1}/{len(unique_findings)}] Resolved: {rule_id}", file=sys.stderr)
        except (requests.RequestException, json.JSONDecodeError) as e:
            print(f"  [{idx+1}/{len(unique_findings)}] Error resolving {rule_id}: {e}", file=sys.stderr)
            resolutions[rule_id] = {
                "suggestion": f"False positive: AI resolution failed for {rule_id}: {e}. Re-run AI after checking the provider connection, or pick a faster model.",
                "remediation_code": "",
            }

        # Sleep between rules to avoid rate limiting
        if idx < len(unique_findings) - 1:
            time.sleep(NAMING_AUDIT_SLEEP)

    return resolutions

def run_naming_audit(files_to_audit: List[str], target_path: str, use_mock: bool = False) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Scans source files to audit naming quality of variables/functions/classes.
    Returns a list of naming findings and a dictionary of resolutions.
    """
    findings = []
    resolutions = {}
    
    if not files_to_audit:
        return findings, resolutions
        
    api_key, base_url, model, requires_key = get_ai_config()
    fallback_due_to_key = requires_key and not api_key
    fallback_due_to_config = not base_url or not model
    fallback_due_to_missing_provider = not os.getenv("AI_PROVIDER")

    if use_mock or fallback_due_to_key or fallback_due_to_config or fallback_due_to_missing_provider:
        if not use_mock:
            print("AI config is incomplete. Using mock naming audit.", file=sys.stderr)
        
        # Look for mock target example.py
        for f_path in files_to_audit:
            rel_path = os.path.relpath(f_path, target_path).replace("\\", "/")
            if "example.py" in rel_path:
                rule_id = "maintainability.naming.obscure"
                finding = {
                    "file": rel_path,
                    "line": 8,
                    "rule_id": rule_id,
                    "message": "Tên hàm 'do_it' và tham số 'x' quá chung chung và tối nghĩa. Đề xuất đổi tên để phản ánh rõ chức năng xử lý dữ liệu người dùng.",
                    "severity": "WARNING",
                    "code_text": "def do_it(x):"
                }
                findings.append(finding)
                resolutions[rule_id] = MOCK_AI_RESOLUTIONS[rule_id]
                break
        return findings, resolutions

    # Real AI execution — cap number of files to avoid overloading the router
    if len(files_to_audit) > MAX_NAMING_AUDIT_FILES:
        print(f"Limiting naming audit to {MAX_NAMING_AUDIT_FILES} files (out of {len(files_to_audit)} candidates).", file=sys.stderr)
        files_to_audit = files_to_audit[:MAX_NAMING_AUDIT_FILES]

    print(f"Querying AI completions for naming audit on {len(files_to_audit)} files...", file=sys.stderr)

    for f_path in files_to_audit:
        if not os.path.exists(f_path):
            continue
            
        try:
            with open(f_path, "r", encoding="utf-8") as f:
                code_content = f.read()
                
            if not code_content.strip():
                continue
                
            rel_path = os.path.relpath(f_path, target_path).replace("\\", "/")
            
            system_prompt = (
                "You are an expert software architect. Analyze the provided source code and review "
                "the naming quality of classes, functions, and key variables. Identify any obscure, "
                "too generic (like x, a, temp, data, obj, process), or misleading names.\n"
                "Rules for remediation_code:\n"
                "- ONLY the renamed line of code, nothing else\n"
                "- NO surrounding context, NO function body\n"
                "- NO 'Before:'/'After:' comments\n"
                "Your response MUST be a valid JSON array of objects matching this schema:\n"
                "[\n"
                "  {\n"
                "    \"line\": 12,\n"
                "    \"code_text\": \"const temp = req.body;\",\n"
                "    \"message\": \"Variable 'temp' is too generic.\",\n"
                "    \"suggestion\": \"Rename 'temp' to 'requestPayload' to describe the data.\",\n"
                "    \"remediation_code\": \"const requestPayload = req.body;\"\n"
                "  }\n"
                "]\n"
                "If no naming issues are found, return an empty array []. Just return raw JSON, no markdown formatting."
            )
            
            # Truncate large files to avoid token/payload limits causing 502 errors
            if len(code_content) > MAX_CODE_CHARS:
                code_content = code_content[:MAX_CODE_CHARS] + "\n# ... (truncated)"

            user_prompt = f"File: {rel_path}\n\nCode Content:\n{code_content}"
            
            headers = {
                "Content-Type": "application/json"
            }
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.1
            }
            
            url = f"{base_url.rstrip('/')}/chat/completions"
            response = post_with_retry(url, headers, payload, timeout=AI_NAMING_TIMEOUT_SECONDS)
            response.raise_for_status()

            # Use parse_api_response on raw response text to handle 9router trailing
            # garbage that causes response.json() to raise "Extra data" errors.
            response_data = parse_api_response(decode_response_text(response))
            content = response_data["choices"][0]["message"]["content"].strip()
            issues = safe_json_parse(content)
            
            if isinstance(issues, list):
                for idx, issue in enumerate(issues):
                    rule_id = f"maintainability.naming.obscure.{rel_path.replace('/', '_').replace('.', '_')}_{idx}"
                    line_num = issue.get("line")
                    code_line = issue.get("code_text")
                    msg = issue.get("message")
                    sug = issue.get("suggestion")
                    rem = issue.get("remediation_code")
                    
                    finding = {
                        "file": rel_path,
                        "line": line_num,
                        "rule_id": rule_id,
                        "message": msg,
                        "severity": "WARNING",
                        "code_text": code_line
                    }
                    findings.append(finding)
                    
                    resolutions[rule_id] = {
                        "suggestion": sug,
                        "remediation_code": rem
                    }
                    
        except requests.RequestException as e:
            print(f"Error auditing naming for {f_path}: {e}", file=sys.stderr)

        # Throttle requests to avoid 429 Too Many Requests from 9router
        time.sleep(NAMING_AUDIT_SLEEP)
            
    return findings, resolutions


if __name__ == "__main__":
    # Test script run
    test_findings = [
        {"rule_id": "python.lang.security.audit.dangerous-exec", "file": "example.py", "line": 12}
    ]
    print(json.dumps(resolve_findings(test_findings, use_mock=True), indent=2))
