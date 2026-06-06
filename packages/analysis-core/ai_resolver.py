import os
import sys
import json
import re
import time
import requests
from dotenv import load_dotenv
from typing import Dict, Any, List, Tuple

# Try loading from the current package directory first, then fallback to CWD
current_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(current_dir, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

# Centralized helper to resolve AI configuration dynamically based on active provider
def get_ai_config() -> Tuple[str, str, str, bool]:
    # Reload env dynamically to be absolutely fresh
    current_dir = os.path.dirname(os.path.abspath(__file__))
    dotenv_path = os.path.join(current_dir, '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path, override=True)
        
    ai_provider = os.getenv("AI_PROVIDER", "9router").lower()
    
    if ai_provider == "9router":
        api_key = os.getenv("NINEROUTER_API_KEY") or os.getenv("9ROUTER_API_KEY") or ""
        base_url = os.getenv("NINEROUTER_BASE_URL") or os.getenv("9ROUTER_BASE_URL") or "http://localhost:20128/v1"
        model = os.getenv("NINEROUTER_MODEL") or os.getenv("9ROUTER_MODEL") or "openai/gpt-4o-mini"
        # 9router does not require an API key by default (can run locally)
        return api_key, base_url, model, False
    elif ai_provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY") or ""
        base_url = os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1"
        model = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
        return api_key, base_url, model, True
    elif ai_provider == "google":
        api_key = os.getenv("GOOGLE_API_KEY") or ""
        base_url = os.getenv("GOOGLE_BASE_URL") or "https://generativelanguage.googleapis.com"
        model = os.getenv("GOOGLE_MODEL") or "gemini-1.5-flash"
        return api_key, base_url, model, True
    elif ai_provider == "anthropic":
        api_key = os.getenv("ANTHROPIC_API_KEY") or ""
        base_url = os.getenv("ANTHROPIC_BASE_URL") or "https://api.anthropic.com"
        model = os.getenv("ANTHROPIC_MODEL") or "claude-3-haiku-20240307"
        return api_key, base_url, model, True
        
    # Default fallback
    api_key = os.getenv("NINEROUTER_API_KEY") or ""
    base_url = os.getenv("NINEROUTER_BASE_URL") or "http://localhost:20128/v1"
    model = os.getenv("NINEROUTER_MODEL") or "openai/gpt-4o-mini"
    return api_key, base_url, model, False

# Backwards compatibility globals
NINEROUTER_API_KEY = os.getenv("NINEROUTER_API_KEY")
NINEROUTER_BASE_URL = os.getenv("NINEROUTER_BASE_URL", "http://localhost:20128/v1")
NINEROUTER_MODEL = os.getenv("NINEROUTER_MODEL", "openai/gpt-4o-mini")

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

MAX_CODE_CHARS = 3000         # Max characters of file/code content sent to AI per request
MAX_NAMING_AUDIT_FILES = 3   # Max files to audit per analysis run
MAX_RESOLVE_FINDINGS = 5     # Max unique rules sent to AI in one resolve_findings call

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

NAMING_AUDIT_SLEEP = 8.0      # Seconds between naming audit requests to avoid 429
NAMING_AUDIT_MAX_RETRIES = 2  # Max retries on 429

def post_with_retry(url: str, headers: dict, payload: dict, timeout: int) -> requests.Response:
    """
    POST with exponential-backoff retry on 429 Too Many Requests.
    Base wait is 15s (covers typical 30-60s rate limit windows).
    """
    for attempt in range(NAMING_AUDIT_MAX_RETRIES + 1):
        response = requests.post(url, headers=headers, json=payload, timeout=timeout)
        if response.status_code == 429 and attempt < NAMING_AUDIT_MAX_RETRIES:
            wait = 15.0 * (2 ** attempt)  # 15s, 30s
            print(f"429 Too Many Requests — retrying in {wait:.0f}s (attempt {attempt + 1}/{NAMING_AUDIT_MAX_RETRIES})...", file=sys.stderr)
            time.sleep(wait)
            continue
        return response
    return response  # return last response after exhausting retries

def resolve_findings(findings: Any, use_mock: bool = False) -> Dict[str, Any]:
    """
    Sends findings to the AI completions API to get AI remediation recommendations.
    If use_mock is True, or if required keys are missing or request fails,
    returns standard mock resolutions.
    """
    if isinstance(findings, dict):
        findings = findings.get("findings", [])
        
    api_key, base_url, model, requires_key = get_ai_config()
    
    # Require key fallback check
    fallback_due_to_key = requires_key and not api_key
    
    if use_mock or fallback_due_to_key:
        if fallback_due_to_key and not use_mock:
            print("API key is required but not found in environment. Falling back to mock resolutions.", file=sys.stderr)
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
            unique_findings.append(item)

    total = len(seen_rules)
    if total > MAX_RESOLVE_FINDINGS:
        print(f"Capped AI resolution to {MAX_RESOLVE_FINDINGS} unique rules (out of {total} total).", file=sys.stderr)

    if not unique_findings:
        return {}

    print(f"Querying AI completions endpoint ({base_url}) using model '{model}'...", file=sys.stderr)

    system_prompt = (
        "You are an expert security engineer. Given ONE security finding, provide a concise fix.\n"
        "Respond ONLY with raw JSON (no markdown) in exactly this shape:\n"
        "{\"<rule_id>\": {\"suggestion\": \"one-sentence fix explanation\", "
        "\"remediation_code\": \"code snippet showing the fix\"}}"
    )

    resolutions: Dict[str, Any] = {}

    for idx, item in enumerate(unique_findings):
        rule_id = item["rule_id"]
        user_prompt = (
            f"Rule ID: {rule_id}\n"
            f"File: {item['file']} (Line {item['line']})\n"
            f"Message: {item['message']}\n"
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
            "max_tokens": 512
        }

        try:
            response = post_with_retry(url, headers, payload, timeout=30)
            response.raise_for_status()
            response_data = parse_api_response(response.text)
            content = response_data["choices"][0]["message"]["content"].strip()
            result = safe_json_parse(content)
            if isinstance(result, dict):
                resolutions.update(result)
            print(f"  [{idx+1}/{len(unique_findings)}] Resolved: {rule_id}", file=sys.stderr)
        except Exception as e:
            print(f"  [{idx+1}/{len(unique_findings)}] Error resolving {rule_id}: {e}", file=sys.stderr)
            resolutions[rule_id] = (
                MOCK_AI_RESOLUTIONS.get(rule_id) or {
                    "suggestion": f"Vulnerability fix suggestion for {rule_id}.",
                    "remediation_code": f"# Remediation code for {rule_id}"
                }
            )

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

    if use_mock or fallback_due_to_key:
        if fallback_due_to_key and not use_mock:
            print("API key is required but not found. Using mock naming audit.", file=sys.stderr)
        
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
                "Your response MUST be a valid JSON array of objects matching this schema:\n"
                "[\n"
                "  {\n"
                "    \"line\": 12,\n"
                "    \"code_text\": \"const temp = req.body;\",\n"
                "    \"message\": \"Variable 'temp' is too generic.\",\n"
                "    \"suggestion\": \"Rename 'temp' to 'requestPayload' to describe the data structure.\",\n"
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
            response = post_with_retry(url, headers, payload, timeout=60)
            response.raise_for_status()

            # Use parse_api_response on raw response text to handle 9router trailing
            # garbage that causes response.json() to raise "Extra data" errors.
            response_data = parse_api_response(response.text)
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
                    
        except Exception as e:
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
