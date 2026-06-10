import unittest
from unittest.mock import patch, MagicMock
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai_resolver import (
    safe_json_parse,
    sanitize_remediation_code,
    get_ai_config,
    resolve_findings,
    post_with_retry,
)
import requests


class TestSafeJsonParse(unittest.TestCase):

    def test_valid_json_object(self):
        result = safe_json_parse('{"key": "value", "num": 42}')
        self.assertEqual(result, {"key": "value", "num": 42})

    def test_valid_json_array(self):
        result = safe_json_parse('[1, 2, 3]')
        self.assertEqual(result, [1, 2, 3])

    def test_json_with_markdown_fences(self):
        text = '```json\n{"key": "value"}\n```'
        result = safe_json_parse(text)
        self.assertEqual(result, {"key": "value"})

    def test_json_with_trailing_garbage(self):
        text = '{"key": "value"} some extra trailing text'
        result = safe_json_parse(text)
        self.assertEqual(result, {"key": "value"})

    def test_malformed_json_raises_valueerror(self):
        with self.assertRaises(ValueError):
            safe_json_parse("not valid json at all")

    def test_empty_string_raises_valueerror(self):
        with self.assertRaises(ValueError):
            safe_json_parse("")

    def test_whitespace_only_raises_valueerror(self):
        with self.assertRaises(ValueError):
            safe_json_parse("   \n\t  ")


class TestSanitizeRemediationCode(unittest.TestCase):

    def test_empty_string_returns_empty(self):
        self.assertEqual(sanitize_remediation_code(""), "")

    def test_none_equivalent_returns_empty(self):
        self.assertEqual(sanitize_remediation_code(""), "")

    def test_all_comment_lines_returns_empty(self):
        code = "# This is a comment\n# Another comment"
        self.assertEqual(sanitize_remediation_code(code), "")

    def test_all_comment_lines_mixed_prefixes_returns_empty(self):
        code = "// TODO fix this\n// Another line"
        self.assertEqual(sanitize_remediation_code(code), "")

    def test_valid_code_preserved(self):
        code = "import os\npassword = os.environ.get('DB_PASSWORD')"
        result = sanitize_remediation_code(code)
        self.assertEqual(result, code)

    def test_code_with_some_comments_preserved(self):
        code = "# Header comment\nimport os\npassword = os.environ.get('KEY')"
        result = sanitize_remediation_code(code)
        self.assertEqual(result, code)

    def test_trailing_newlines_stripped(self):
        code = "x = 1\n\n"
        result = sanitize_remediation_code(code)
        self.assertEqual(result, "x = 1")


class TestGetAiConfig(unittest.TestCase):

    @patch('ai_resolver._reload_env_file')
    @patch.dict(os.environ, {}, clear=True)
    def test_no_provider_returns_empty(self, mock_reload):
        api_key, base_url, model, requires_key = get_ai_config()
        self.assertEqual(api_key, "")
        self.assertEqual(base_url, "")
        self.assertEqual(model, "")
        self.assertFalse(requires_key)

    @patch('ai_resolver._reload_env_file')
    @patch.dict(os.environ, {
        "AI_PROVIDER": "9router",
        "NINEROUTER_API_KEY": "key123",
        "NINEROUTER_BASE_URL": "http://localhost:20128/v1",
        "NINEROUTER_MODEL": "test-model",
    }, clear=True)
    def test_9router_provider_returns_correct_config(self, mock_reload):
        api_key, base_url, model, requires_key = get_ai_config()
        self.assertEqual(api_key, "key123")
        self.assertEqual(base_url, "http://localhost:20128/v1")
        self.assertEqual(model, "test-model")
        self.assertFalse(requires_key)

    @patch('ai_resolver._reload_env_file')
    @patch.dict(os.environ, {
        "AI_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-test",
        "OPENAI_BASE_URL": "https://api.openai.com/v1",
        "OPENAI_MODEL": "gpt-4",
    }, clear=True)
    def test_openai_provider_returns_correct_config(self, mock_reload):
        api_key, base_url, model, requires_key = get_ai_config()
        self.assertEqual(api_key, "sk-test")
        self.assertEqual(base_url, "https://api.openai.com/v1")
        self.assertEqual(model, "gpt-4")
        self.assertTrue(requires_key)

    @patch('ai_resolver._reload_env_file')
    @patch.dict(os.environ, {
        "AI_PROVIDER": "google",
        "GOOGLE_API_KEY": "google-key",
        "GOOGLE_BASE_URL": "https://generativelanguage.googleapis.com/v1",
        "GOOGLE_MODEL": "gemini-pro",
    }, clear=True)
    def test_google_provider_returns_correct_config(self, mock_reload):
        api_key, base_url, model, requires_key = get_ai_config()
        self.assertEqual(api_key, "google-key")
        self.assertEqual(base_url, "https://generativelanguage.googleapis.com/v1")
        self.assertEqual(model, "gemini-pro")
        self.assertTrue(requires_key)

    @patch('ai_resolver._reload_env_file')
    @patch.dict(os.environ, {
        "AI_PROVIDER": "anthropic",
        "ANTHROPIC_API_KEY": "anthro-key",
        "ANTHROPIC_BASE_URL": "https://api.anthropic.com/v1",
        "ANTHROPIC_MODEL": "claude-3",
    }, clear=True)
    def test_anthropic_provider_returns_correct_config(self, mock_reload):
        api_key, base_url, model, requires_key = get_ai_config()
        self.assertEqual(api_key, "anthro-key")
        self.assertEqual(base_url, "https://api.anthropic.com/v1")
        self.assertEqual(model, "claude-3")
        self.assertTrue(requires_key)

    @patch('ai_resolver._reload_env_file')
    @patch.dict(os.environ, {
        "AI_PROVIDER": "unknown_provider",
        "UNKNOWN_API_KEY": "some-key",
    }, clear=True)
    def test_unknown_provider_returns_empty(self, mock_reload):
        api_key, base_url, model, requires_key = get_ai_config()
        self.assertEqual(api_key, "")
        self.assertEqual(base_url, "")
        self.assertEqual(model, "")
        self.assertFalse(requires_key)


class TestResolveFindings(unittest.TestCase):

    @patch('ai_resolver._reload_env_file')
    @patch('ai_resolver.time.sleep')
    @patch('ai_resolver.requests.post')
    @patch.dict(os.environ, {
        "AI_PROVIDER": "9router",
        "NINEROUTER_API_KEY": "fake_key",
        "NINEROUTER_BASE_URL": "http://localhost:20128/v1",
        "NINEROUTER_MODEL": "test-model",
    }, clear=True)
    def test_resolve_findings_with_mocked_ai_response(self, mock_post, mock_sleep, mock_reload):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = json.dumps({
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "r0": {
                            "suggestion": "Use safe subprocess instead of exec",
                            "remediation_code": "import subprocess\nsubprocess.run(['echo', user_input])"
                        }
                    })
                }
            }]
        }).encode("utf-8")
        mock_post.return_value = mock_response

        findings = [
            {
                "file": "example.py",
                "line": 12,
                "rule_id": "python.lang.security.audit.dangerous-exec",
                "message": "dangerous exec vulnerability",
                "code_text": "exec(user_input)"
            }
        ]

        resolutions = resolve_findings(findings, use_mock=False)
        self.assertIn("python.lang.security.audit.dangerous-exec", resolutions)
        self.assertEqual(
            resolutions["python.lang.security.audit.dangerous-exec"]["suggestion"],
            "Use safe subprocess instead of exec"
        )
        self.assertIn("subprocess.run", resolutions["python.lang.security.audit.dangerous-exec"]["remediation_code"])

    @patch('ai_resolver._reload_env_file')
    @patch('ai_resolver.time.sleep')
    @patch('ai_resolver.requests.post')
    @patch.dict(os.environ, {
        "AI_PROVIDER": "9router",
        "NINEROUTER_API_KEY": "fake_key",
        "NINEROUTER_BASE_URL": "http://localhost:20128/v1",
        "NINEROUTER_MODEL": "test-model",
    }, clear=True)
    def test_resolve_findings_handles_http_error_gracefully(self, mock_post, mock_sleep, mock_reload):
        mock_post.side_effect = requests.exceptions.ConnectionError("Connection refused")

        findings = [
            {
                "file": "example.py",
                "line": 12,
                "rule_id": "python.lang.security.audit.dangerous-exec",
                "message": "dangerous exec vulnerability",
                "code_text": "exec(user_input)"
            }
        ]

        resolutions = resolve_findings(findings, use_mock=False)
        self.assertIn("python.lang.security.audit.dangerous-exec", resolutions)
        self.assertIn("False positive", resolutions["python.lang.security.audit.dangerous-exec"]["suggestion"])
        self.assertEqual(resolutions["python.lang.security.audit.dangerous-exec"]["remediation_code"], "")

    @patch('ai_resolver._reload_env_file')
    @patch.dict(os.environ, {}, clear=True)
    def test_resolve_findings_falls_back_to_mock_when_no_provider(self, mock_reload):
        findings = [
            {
                "file": "example.py",
                "line": 12,
                "rule_id": "python.lang.security.audit.dangerous-exec",
                "message": "dangerous exec vulnerability",
            }
        ]

        resolutions = resolve_findings(findings, use_mock=False)
        self.assertIn("python.lang.security.audit.dangerous-exec", resolutions)
        self.assertIn("suggestion", resolutions["python.lang.security.audit.dangerous-exec"])
        self.assertIn("remediation_code", resolutions["python.lang.security.audit.dangerous-exec"])

    def test_resolve_findings_with_explicit_mock(self):
        findings = [
            {
                "file": "example.py",
                "line": 12,
                "rule_id": "python.lang.security.audit.dangerous-exec",
                "message": "dangerous exec vulnerability",
            }
        ]

        resolutions = resolve_findings(findings, use_mock=True)
        self.assertIn("python.lang.security.audit.dangerous-exec", resolutions)
        self.assertEqual(
            resolutions["python.lang.security.audit.dangerous-exec"]["suggestion"],
            "Avoid using exec(). Use structured functions or parse inputs securely."
        )

    def test_resolve_findings_empty_list_returns_empty_dict(self):
        resolutions = resolve_findings([], use_mock=True)
        self.assertEqual(resolutions, {})

    def test_resolve_findings_unknown_rule_gets_generic_mock(self):
        findings = [
            {
                "file": "test.py",
                "line": 1,
                "rule_id": "some.unknown.rule.id",
                "message": "unknown issue",
            }
        ]

        resolutions = resolve_findings(findings, use_mock=True)
        self.assertIn("some.unknown.rule.id", resolutions)
        self.assertIn("Avoid this pattern", resolutions["some.unknown.rule.id"]["suggestion"])


class TestPostWithRetry(unittest.TestCase):

    @patch('ai_resolver.time.sleep')
    @patch('ai_resolver.requests.post')
    def test_500_returns_immediately_no_retry(self, mock_post, mock_sleep):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_post.return_value = mock_response

        response = post_with_retry(
            "http://localhost:20128/v1/chat/completions",
            headers={"Content-Type": "application/json"},
            payload={"model": "test"},
            timeout=30
        )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(mock_post.call_count, 1)

    @patch('ai_resolver.time.sleep')
    @patch('ai_resolver.requests.post')
    def test_429_retries_then_succeeds(self, mock_post, mock_sleep):
        mock_429 = MagicMock()
        mock_429.status_code = 429

        mock_200 = MagicMock()
        mock_200.status_code = 200

        mock_post.side_effect = [mock_429, mock_429, mock_200]

        response = post_with_retry(
            "http://localhost:20128/v1/chat/completions",
            headers={"Content-Type": "application/json"},
            payload={"model": "test"},
            timeout=30
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(mock_post.call_count, 3)

    @patch('ai_resolver.time.sleep')
    @patch('ai_resolver.requests.post')
    def test_timeout_retries_then_succeeds(self, mock_post, mock_sleep):
        mock_post.side_effect = [
            requests.exceptions.Timeout("Request timed out"),
            requests.exceptions.Timeout("Request timed out"),
            MagicMock(status_code=200),
        ]

        response = post_with_retry(
            "http://localhost:20128/v1/chat/completions",
            headers={"Content-Type": "application/json"},
            payload={"model": "test"},
            timeout=30
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(mock_post.call_count, 3)

    @patch('ai_resolver.time.sleep')
    @patch('ai_resolver.requests.post')
    def test_timeout_exhausts_retries_raises(self, mock_post, mock_sleep):
        mock_post.side_effect = requests.exceptions.Timeout("Request timed out")

        with self.assertRaises(requests.exceptions.Timeout):
            post_with_retry(
                "http://localhost:20128/v1/chat/completions",
                headers={"Content-Type": "application/json"},
                payload={"model": "test"},
                timeout=30
            )

        # AI_MAX_RETRIES=2 → 3 attempts (0, 1, 2)
        self.assertEqual(mock_post.call_count, 3)


if __name__ == '__main__':
    unittest.main()