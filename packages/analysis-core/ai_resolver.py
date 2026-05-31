import os
import sys
import json
import requests
from dotenv import load_dotenv
from typing import Dict, Any, List

# Try loading from the current package directory first, then fallback to CWD
current_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(current_dir, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

# Load env variables
NINEROUTER_API_KEY = os.getenv("NINEROUTER_API_KEY")
NINEROUTER_BASE_URL = os.getenv("NINEROUTER_BASE_URL", "https://api.9router.com/v1")
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
    }
}

def resolve_findings(findings: Any, use_mock: bool = False) -> Dict[str, Any]:
    """
    Sends findings to the 9router API to get AI remediation recommendations.
    If use_mock is True, or if NINEROUTER_API_KEY is not set or the request fails,
    returns standard mock resolutions.
    
    Args:
        findings: List of security findings, or a dictionary containing a 'findings' key.
        use_mock: If True, forces the use of mock resolutions.
        
    Returns:
        A dictionary mapping rule_ids to their AI suggestions and remediation code.
    """
    if isinstance(findings, dict):
        findings = findings.get("findings", [])
        
    if use_mock or not NINEROUTER_API_KEY:
        if not NINEROUTER_API_KEY and not use_mock:
            print("NINEROUTER_API_KEY not found in environment. Falling back to mock resolutions.", file=sys.stderr)
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

    # Make real HTTP request to 9router
    print(f"Querying 9router completions endpoint ({NINEROUTER_BASE_URL}) using model '{NINEROUTER_MODEL}'...", file=sys.stderr)
    
    # Extract unique rules and findings to keep payload clean
    unique_findings = []
    seen_rules = set()
    for f in findings:
        r_id = f.get("rule_id")
        if r_id not in seen_rules:
            seen_rules.add(r_id)
            item = {
                "rule_id": r_id,
                "file": f.get("file"),
                "line": f.get("line"),
                "message": f.get("message")
            }
            if "ast_context" in f:
                item["ast_context"] = f["ast_context"]
            unique_findings.append(item)

    if not unique_findings:
        return {}

    system_prompt = (
        "You are an expert security engineer. You will receive a list of security findings, "
        "enriched with AST context including enclosing symbols, source code, direct caller chains, "
        "and upstream blast radius (impact analysis).\n"
        "For each unique rule_id, provide a suggestion on how to fix it and the remediation code to resolve it. "
        "Ensure your recommendations are highly context-aware: review the symbol's implementation details, "
        "caller chains, and blast radius to prevent regressions, type mismatches, or security side effects in callers.\n"
        "Your response MUST be a valid JSON object matching this schema:\n"
        "{\n"
        "  \"<rule_id>\": {\n"
        "    \"suggestion\": \"Detailed explanation of the fix.\",\n"
        "    \"remediation_code\": \"Python/JavaScript code demonstrating the fix.\"\n"
        "  }\n"
        "}\n"
        "Do not include any markdown formatting (like ```json) in your response. Just output raw valid JSON."
    )
    
    user_prompt_parts = []
    for item in unique_findings:
        rule_id = item["rule_id"]
        file_path = item["file"]
        line = item["line"]
        message = item["message"]
        
        part = (
            f"Rule ID: {rule_id}\n"
            f"Vulnerability Message: {message}\n"
        )
        
        ast_ctx = item.get("ast_context")
        if ast_ctx:
            callers_list = []
            for caller in ast_ctx.get("callers", []):
                callers_list.append(f"- {caller.get('name')} ({caller.get('relation')} in {caller.get('filePath')})")
            callers_str = "\n".join(callers_list) if callers_list else "None detected"
            
            impact_summary_list = []
            impact_data = ast_ctx.get("impact", {})
            if impact_data:
                risk = impact_data.get("risk", "UNKNOWN")
                impacted_count = impact_data.get("impactedCount", 0)
                impact_summary_list.append(f"Risk level: {risk}")
                impact_summary_list.append(f"Impacted nodes count: {impacted_count}")
                
            for br in ast_ctx.get("blast_radius", []):
                impact_summary_list.append(f"- Depth {br.get('depth')}: {br.get('name')} ({br.get('relation')} in {br.get('filePath')})")
            impact_summary_str = "\n".join(impact_summary_list) if impact_summary_list else "None detected"
            
            part += (
                f"Affected Symbol: {ast_ctx.get('symbol_name')} ({ast_ctx.get('kind')})\n"
                f"File: {file_path} (Line {line})\n"
                f"Symbol Source Code:\n"
                f"{ast_ctx.get('source_code')}\n\n"
                f"Direct Callers:\n"
                f"{callers_str}\n\n"
                f"Blast Radius / Upstream Impact:\n"
                f"{impact_summary_str}\n"
            )
        else:
            part += (
                f"File: {file_path} (Line {line})\n"
                f"AST Context: Not available\n"
            )
            
        user_prompt_parts.append(part)
        
    user_prompt = "Findings to resolve:\n\n" + "\n---\n\n".join(user_prompt_parts)
    
    headers = {
        "Authorization": f"Bearer {NINEROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": NINEROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1
    }
    
    try:
        url = f"{NINEROUTER_BASE_URL.rstrip('/')}/chat/completions"
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        response_data = response.json()
        content = response_data["choices"][0]["message"]["content"].strip()
        
        # Strip markdown code blocks if the model returned them
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()
            
        resolutions = json.loads(content)
        return resolutions
        
    except Exception as e:
        print(f"Error querying 9router API: {e}", file=sys.stderr)
        print("Falling back to mock resolutions.", file=sys.stderr)
        
        resolutions = {}
        for finding in findings:
            rule_id = finding.get("rule_id")
            if rule_id in MOCK_AI_RESOLUTIONS:
                resolutions[rule_id] = MOCK_AI_RESOLUTIONS[rule_id]
            else:
                resolutions[rule_id] = {
                    "suggestion": f"Vulnerability fix suggestion for {rule_id}.",
                    "remediation_code": f"# Remediation code for {rule_id}"
                }
        return resolutions

if __name__ == "__main__":
    # Test script run
    test_findings = [
        {"rule_id": "python.lang.security.audit.dangerous-exec", "file": "example.py", "line": 12}
    ]
    print(json.dumps(resolve_findings(test_findings, use_mock=True), indent=2))
