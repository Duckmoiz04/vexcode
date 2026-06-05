import unittest
from unittest.mock import patch, MagicMock
import os
import sys
import json

# Ensure analysis-core is on python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ast_graph import (
    is_gitnexus_available,
    get_repo_name_for_path,
    get_repo_info_for_path,
    parse_markdown_table,
    resolve_location_to_symbol,
    get_symbol_context,
    get_symbol_impact,
    get_relative_repo_path,
    MOCK_AST_CONTEXTS
)
from ai_resolver import resolve_findings

class TestASTGraph(unittest.TestCase):

    @patch('subprocess.run')
    def test_is_gitnexus_available_true(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_run.return_value = mock_result
        self.assertTrue(is_gitnexus_available())

    @patch('subprocess.run')
    def test_is_gitnexus_available_false(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_run.return_value = mock_result
        self.assertFalse(is_gitnexus_available())

    def test_parse_markdown_table_empty(self):
        self.assertEqual(parse_markdown_table(""), [])
        self.assertEqual(parse_markdown_table("   "), [])
        self.assertEqual(parse_markdown_table("| col1 |"), [])

    def test_parse_markdown_table_valid(self):
        md = (
            "| n.id | n.name | n.startLine | n.endLine | LABEL(n._ID,[File,Function]) |\n"
            "| --- | --- | --- | --- | --- |\n"
            "| Function:foo:bar | bar | 10 | 25 | Function |\n"
            "| Const:foo:x | x | 12 | 12 | Const |\n"
        )
        rows = parse_markdown_table(md)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['id'], "Function:foo:bar")
        self.assertEqual(rows[0]['name'], "bar")
        self.assertEqual(rows[0]['startLine'], 10)
        self.assertEqual(rows[0]['endLine'], 25)
        self.assertEqual(rows[0]['label'], "Function")

        self.assertEqual(rows[1]['id'], "Const:foo:x")
        self.assertEqual(rows[1]['name'], "x")
        self.assertEqual(rows[1]['startLine'], 12)
        self.assertEqual(rows[1]['endLine'], 12)
        self.assertEqual(rows[1]['label'], "Const")

    @patch('subprocess.run')
    def test_get_repo_name_for_path_matched(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = (
            "  Indexed Repositories (2)\n\n"
            "  DATN2\n"
            "    Path:    d:\\DATN2\n"
            "    Indexed: 5/31/2026\n"
            "  some-other-repo\n"
            "    Path:    d:\\other\n"
        )
        mock_run.return_value = mock_result

        # Match exact path
        self.assertEqual(get_repo_name_for_path("d:\\DATN2"), "DATN2")
        # Match subpath
        self.assertEqual(get_repo_name_for_path("d:\\DATN2\\packages\\analysis-core"), "DATN2")
        # No match
        self.assertIsNone(get_repo_name_for_path("d:\\unregistered"))

    @patch('subprocess.run')
    def test_resolve_location_to_symbol_sorting(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps({
            "markdown": (
                "| n.id | n.name | n.startLine | n.endLine | LABEL(n) |\n"
                "| --- | --- | --- | --- | --- |\n"
                "| Const:test.py:x | x | 15 | 15 | Const |\n"
                "| Function:test.py:outer | outer | 10 | 30 | Function |\n"
                "| Function:test.py:inner | inner | 12 | 20 | Function |\n"
            )
        })
        mock_run.return_value = mock_result

        symbol = resolve_location_to_symbol("DATN2", "test.py", 15)
        # Should prefer Function over Const, and smaller span (inner has span 8 vs outer span 20)
        self.assertIsNotNone(symbol)
        self.assertEqual(symbol['id'], "Function:test.py:inner")
        self.assertEqual(symbol['name'], "inner")

    @patch('subprocess.run')
    def test_get_symbol_context(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 0
        context_payload = {
            "status": "found",
            "symbol": {"uid": "Function:test.py:inner", "content": "def inner(): pass"},
            "incoming": {"calls": [{"uid": "File:main.py"}]}
        }
        mock_result.stdout = json.dumps(context_payload)
        mock_run.return_value = mock_result

        ctx = get_symbol_context("DATN2", "Function:test.py:inner")
        self.assertEqual(ctx["status"], "found")
        self.assertEqual(ctx["symbol"]["content"], "def inner(): pass")

    @patch('subprocess.run')
    def test_get_symbol_impact(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 0
        impact_payload = {
            "target": {"id": "Function:test.py:inner"},
            "risk": "LOW",
            "impactedCount": 1,
            "byDepth": {"1": [{"id": "File:main.py", "relationType": "CALLS"}]}
        }
        mock_result.stdout = json.dumps(impact_payload)
        mock_run.return_value = mock_result

        impact = get_symbol_impact("DATN2", "Function:test.py:inner")
        self.assertEqual(impact["risk"], "LOW")
        self.assertEqual(impact["impactedCount"], 1)

    def test_get_relative_repo_path(self):
        # target_path: "d:\DATN2", repo_path: "d:\DATN2"
        # file_path: "packages/analysis-core/main.py"
        rel = get_relative_repo_path("packages/analysis-core/main.py", "d:\\DATN2", "d:\\DATN2")
        self.assertEqual(rel, "packages/analysis-core/main.py")

        # Mixed slashes
        rel2 = get_relative_repo_path("packages\\analysis-core\\main.py", "d:\\DATN2", "d:\\DATN2")
        self.assertEqual(rel2, "packages/analysis-core/main.py")

    @patch('requests.post')
    @patch.dict(os.environ, {"NINEROUTER_API_KEY": "fake_key"})
    def test_ai_resolver_prompt_assembly(self, mock_post):
        # We test that resolve_findings formats user prompt with the detailed AST context
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "python.lang.security.audit.dangerous-exec": {
                            "suggestion": "suggestion here",
                            "remediation_code": "remediation code here"
                        }
                    })
                }
            }]
        }
        mock_post.return_value = mock_response

        findings = [
            {
                "file": "example.py",
                "line": 12,
                "rule_id": "python.lang.security.audit.dangerous-exec",
                "message": "dangerous exec vulnerability",
                "ast_context": MOCK_AST_CONTEXTS[("example.py", 12)]
            }
        ]

        resolutions = resolve_findings(findings, use_mock=False)
        self.assertIn("python.lang.security.audit.dangerous-exec", resolutions)
        
        # Verify requests.post payload contains detailed AST text inside messages
        args, kwargs = mock_post.call_args
        json_data = kwargs.get('json', {})
        messages = json_data.get('messages', [])
        user_message = next(msg['content'] for msg in messages if msg['role'] == 'user')
        
        # Verify presence of AST details (source_code is stripped to reduce payload size)
        self.assertIn("Affected Symbol: run_dangerous_code (Function)", user_message)
        self.assertIn("File: example.py (Line 12)", user_message)
        self.assertIn("Direct Callers:", user_message)
        self.assertIn("main.py", user_message)
        self.assertIn("Blast Radius / Upstream Impact:", user_message)

if __name__ == '__main__':
    unittest.main()
