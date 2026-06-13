import subprocess
import json
import re
import sys
import os
from typing import Dict, Any, List, Tuple, Optional

from engine.utils.logger import get_logger

logger = get_logger(__name__)

def is_gitnexus_available() -> bool:
    """
    Invokes 'gitnexus --version' to check if the GitNexus CLI is installed
    globally and is executable.
    """
    if os.environ.get("TEST_SKIP_GITNEXUS") == "true":
        return False
    try:
        shell = (sys.platform == 'win32')
        result = subprocess.run(
            ["gitnexus", "--version"],
            capture_output=True,
            text=True,
            check=False,
            shell=shell
        )
        return result.returncode == 0
    except subprocess.CalledProcessError:
        return False

def get_repo_info_for_path(target_path: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parses 'gitnexus list' and finds the registered repository that contains
    the normalized target_path.
    Returns:
        A tuple of (repo_name, repo_root_path) or (None, None) if not found.
    """
    try:
        shell = (sys.platform == 'win32')
        result = subprocess.run(
            ["gitnexus", "list"],
            capture_output=True,
            text=True,
            check=False,
            shell=shell
        )
        if result.returncode != 0:
            return None, None
            
        target_abs = os.path.abspath(target_path)
        target_norm = os.path.normcase(target_abs)
        
        current_repo = None
        for line in result.stdout.splitlines():
            # Match "Path:" line
            match_path = re.match(r'^\s*Path:\s*(.+)$', line, re.IGNORECASE)
            if match_path:
                repo_path = match_path.group(1).strip()
                repo_path_abs = os.path.abspath(repo_path)
                repo_path_norm = os.path.normcase(repo_path_abs)
                # Check if target_path is inside or matches repo_path
                if target_norm.startswith(repo_path_norm):
                    return current_repo, repo_path_abs
            else:
                # Match repository name lines, e.g. "  DATN2"
                match_header = re.match(r'^  ([^\s].*)$', line)
                if match_header:
                    header = match_header.group(1).strip()
                    if '(' in header:
                        repo_name = header.split('(')[0].strip()
                    else:
                        repo_name = header
                    if not repo_name.lower().startswith("indexed repositories"):
                        current_repo = repo_name
                        
        return None, None
    except Exception as e:
        logger.info(f"Error listing GitNexus repositories: {e}")
        return None, None

def get_repo_name_for_path(target_path: str) -> Optional[str]:
    """
    Parses the output of 'gitnexus list' and maps the target_path to its
    GitNexus repository alias (name).
    """
    name, _ = get_repo_info_for_path(target_path)
    return name

def parse_markdown_table(markdown_string: str) -> List[Dict[str, Any]]:
    """
    Parses a markdown table string into a list of row dictionaries matching the headers.
    Headers are normalized to lowercase attributes (id, name, startLine, endLine, label).
    """
    if not markdown_string or not isinstance(markdown_string, str):
        return []
        
    lines = [line.strip() for line in markdown_string.strip().splitlines() if line.strip()]
    if len(lines) < 3:
        return []
        
    header_parts = lines[0].split('|')
    if header_parts[0] == '':
        header_parts = header_parts[1:]
    if header_parts and header_parts[-1] == '':
        header_parts = header_parts[:-1]
        
    headers = [h.strip() for h in header_parts]
    
    # Normalize headers
    norm_headers = []
    for h in headers:
        hl = h.lower()
        if 'label' in hl:
            norm_headers.append('label')
        elif 'id' in hl:
            norm_headers.append('id')
        elif 'name' in hl:
            norm_headers.append('name')
        elif 'startline' in hl:
            norm_headers.append('startLine')
        elif 'endline' in hl:
            norm_headers.append('endLine')
        else:
            norm_headers.append(h)
            
    rows = []
    for line in lines[2:]:
        if line.startswith('|-') or line.startswith('| -'):
            continue
        parts = line.split('|')
        if parts[0] == '':
            parts = parts[1:]
        if parts and parts[-1] == '':
            parts = parts[:-1]
            
        row_values = [p.strip() for p in parts]
        row_dict = {}
        for i, val in enumerate(row_values):
            if i < len(norm_headers):
                header_name = norm_headers[i]
                if header_name in ('startLine', 'endLine'):
                    try:
                        row_dict[header_name] = int(val) if val else None
                    except ValueError:
                        row_dict[header_name] = val
                else:
                    row_dict[header_name] = val
        rows.append(row_dict)
    return rows

def get_relative_repo_path(finding_file: str, target_path: str, repo_path: str) -> str:
    """
    Calculates the finding file path relative to the repository root and
    normalizes slashes to forward slashes.
    """
    if os.path.isabs(finding_file):
        abs_file = finding_file
    else:
        opt1 = os.path.abspath(os.path.join(target_path, finding_file))
        if os.path.exists(opt1):
            abs_file = opt1
        else:
            abs_file = os.path.abspath(finding_file)
            
    rel_path = os.path.relpath(abs_file, repo_path)
    return rel_path.replace('\\', '/')

def resolve_location_to_symbol(repo_name: str, file_path: str, line_number: int) -> Optional[Dict[str, Any]]:
    """
    Runs a Cypher query via the GitNexus CLI to map the given file path and line number
    to the most specific enclosing code node.
    """
    # Normalize path to forward slashes
    file_path = file_path.replace('\\', '/')
    query = (
        f"MATCH (n) WHERE n.filePath = '{file_path}' "
        f"AND n.startLine <= {line_number} AND n.endLine >= {line_number} "
        f"RETURN n.id, n.name, n.startLine, n.endLine, labels(n)"
    )
    
    shell = (sys.platform == 'win32')
    cmd = ["gitnexus", "cypher", "-r", repo_name, query]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False, shell=shell)
        if result.returncode != 0:
            logger.info(f"Cypher query failed: {result.stderr}")
            return None
            
        data = json.loads(result.stdout)
        if isinstance(data, list):
            if not data:
                return None
            if isinstance(data[0], dict):
                rows = data
            else:
                return None
        elif isinstance(data, dict):
            markdown_str = data.get("markdown", "")
            rows = parse_markdown_table(markdown_str)
        else:
            return None
            
        if not rows:
            return None
            
        # Select the most specific node (prefer Function, Method, Class, then by smallest span)
        preferred_labels = {'Function', 'Method', 'Class'}
        
        def sort_key(row):
            label = row.get('label', '')
            has_preferred = label in preferred_labels
            
            start = row.get('startLine')
            end = row.get('endLine')
            if start is not None and end is not None:
                span = abs(int(end) - int(start))
            else:
                span = float('inf')
                
            return (not has_preferred, span, label)
            
        sorted_rows = sorted(rows, key=sort_key)
        return sorted_rows[0]
    except Exception as e:
        logger.info(f"Error in resolve_location_to_symbol: {e}")
        return None

def get_symbol_context(repo_name: str, symbol_id: str) -> Dict[str, Any]:
    """
    Retrieves the 360-degree context of a code symbol including its source code.
    """
    shell = (sys.platform == 'win32')
    cmd = ["gitnexus", "context", "-r", repo_name, "-u", symbol_id, "--content"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False, shell=shell)
        if result.returncode != 0:
            return {}
        return json.loads(result.stdout)
    except Exception as e:
        logger.info(f"Error getting symbol context: {e}")
        return {}

def get_symbol_impact(repo_name: str, symbol_id: str) -> Dict[str, Any]:
    """
    Performs blast radius analysis of a symbol.
    """
    shell = (sys.platform == 'win32')
    cmd = ["gitnexus", "impact", "-r", repo_name, "-d", "upstream", "--depth", "3", symbol_id]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False, shell=shell)
        if result.returncode != 0:
            return {}
        return json.loads(result.stdout)
    except Exception as e:
        logger.info(f"Error getting symbol impact: {e}")
        return {}

MOCK_AST_CONTEXTS = {
    ("example.py", 12): {
        "symbol_id": "Function:example.py:run_dangerous_code",
        "symbol_name": "run_dangerous_code",
        "kind": "Function",
        "source_code": "def run_dangerous_code(user_input):\n    exec(user_input)\n",
        "callers": [
            {
                "uid": "Function:main.py:process_request",
                "name": "process_request",
                "filePath": "main.py",
                "relation": "calls"
            }
        ],
        "impact": {
            "target": {
                "id": "Function:example.py:run_dangerous_code",
                "name": "run_dangerous_code",
                "type": "Function",
                "filePath": "example.py"
            },
            "direction": "upstream",
            "impactedCount": 1,
            "risk": "MEDIUM",
            "summary": {
                "direct": 1,
                "processes_affected": 0,
                "modules_affected": 0
            },
            "affected_processes": [],
            "affected_modules": [],
            "byDepth": {
                "1": [
                    {
                        "depth": 1,
                        "id": "Function:main.py:process_request",
                        "name": "process_request",
                        "filePath": "main.py",
                        "relationType": "CALLS",
                        "confidence": 0.95
                    }
                ]
            }
        },
        "blast_radius": [
            {
                "uid": "Function:main.py:process_request",
                "name": "process_request",
                "filePath": "main.py",
                "depth": 1,
                "relation": "CALLS"
            }
        ]
    },
    ("db.py", 45): {
        "symbol_id": "Method:db.py:DatabaseConnection.connect",
        "symbol_name": "DatabaseConnection.connect",
        "kind": "Method",
        "source_code": "    def connect(self):\n        password = \"admin123\"\n        self.conn = pg.connect(user=\"admin\", password=password)\n",
        "callers": [
            {
                "uid": "Function:db.py:get_user_data",
                "name": "get_user_data",
                "filePath": "db.py",
                "relation": "calls"
            }
        ],
        "impact": {
            "target": {
                "id": "Method:db.py:DatabaseConnection.connect",
                "name": "DatabaseConnection.connect",
                "type": "Method",
                "filePath": "db.py"
            },
            "direction": "upstream",
            "impactedCount": 1,
            "risk": "LOW",
            "summary": {
                "direct": 1,
                "processes_affected": 0,
                "modules_affected": 0
            },
            "affected_processes": [],
            "affected_modules": [],
            "byDepth": {
                "1": [
                    {
                        "depth": 1,
                        "id": "Function:db.py:get_user_data",
                        "name": "get_user_data",
                        "filePath": "db.py",
                        "relationType": "CALLS",
                        "confidence": 0.95
                    }
                ]
            }
        },
        "blast_radius": [
            {
                "uid": "Function:db.py:get_user_data",
                "name": "get_user_data",
                "filePath": "db.py",
                "depth": 1,
                "relation": "CALLS"
            }
        ]
    }
}

if __name__ == "__main__":
    logger.info("Running GitNexus environment checks...")
    available = is_gitnexus_available()
    logger.info(f"GitNexus CLI available: {available}")
    if available:
        target = "."
        repo_name, repo_path = get_repo_info_for_path(target)
        logger.info(f"Target path: {os.path.abspath(target)}")
        logger.info(f"Mapped Repository Name: {repo_name}")
        logger.info(f"Mapped Repository Path: {repo_path}")
