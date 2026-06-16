import json
import os
import time
import requests
from typing import Dict, Any, List, Tuple

from engine.utils.logger import get_logger
from engine.config.constants import (
    MAX_CODE_CHARS,
    MAX_NAMING_AUDIT_FILES,
    NAMING_AUDIT_SLEEP,
    AI_NAMING_TIMEOUT_SECONDS,
)
from engine.config.ai_config import get_ai_config
from engine.core.ai_resolver import (
    MOCK_AI_RESOLUTIONS,
    post_with_retry,
    parse_api_response,
    decode_response_text,
    safe_json_parse,
    _extract_message_content,
)

logger = get_logger(__name__)


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
            logger.info("AI config is incomplete. Using mock naming audit.")
        
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
        logger.info(f"Limiting naming audit to {MAX_NAMING_AUDIT_FILES} files (out of {len(files_to_audit)} candidates).")
        files_to_audit = files_to_audit[:MAX_NAMING_AUDIT_FILES]

    logger.info(f"Querying AI completions for naming audit on {len(files_to_audit)} files...")

    for f_path in files_to_audit:
        if not os.path.exists(f_path):
            continue
            
        try:
            with open(f_path, "r", encoding="utf-8") as f:
                code_content = f.read()
                
            if not code_content.strip():
                continue
                
            rel_path = os.path.relpath(f_path, target_path).replace("\\", "/")
            
            from engine.config.ai_prompts import SYSTEM_PROMPT_NAMING_AUDIT
            
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
                    {"role": "system", "content": SYSTEM_PROMPT_NAMING_AUDIT},
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
            content = _extract_message_content(response_data)
            if not content:
                # Empty content — model refused, used tool calls, or returned non-text.
                choices = response_data.get("choices") or [{}]
                finish = (choices[0] or {}).get("finish_reason") or "?"
                logger.info(
                    f"AI returned empty content (finish_reason={finish}) "
                    f"during naming audit for {rel_path}. Skipping."
                )
                continue
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
                    
        except (requests.RequestException, json.JSONDecodeError, ValueError, KeyError, IndexError, TypeError) as e:
            logger.info(f"Error auditing naming for {f_path}: {e}")

        # Throttle requests to avoid 429 Too Many Requests from 9router
        time.sleep(NAMING_AUDIT_SLEEP)
            
    return findings, resolutions