"""Tests for ai_resolver.py — JSON parsing, remediation sanitization, API calls with retry."""

import json
import os
from unittest.mock import MagicMock

import pytest
import requests

from engine.core.ai_resolver import (
    safe_json_parse,
    sanitize_remediation_code,
    resolve_findings,
    post_with_retry,
)
from engine.config.ai_config import get_ai_config


class TestSafeJsonParse:
    """Tests for safe_json_parse()."""

    def test_valid_json_object(self):
        assert safe_json_parse('{"key": "value", "num": 42}') == {"key": "value", "num": 42}

    def test_valid_json_array(self):
        assert safe_json_parse("[1, 2, 3]") == [1, 2, 3]

    def test_json_with_markdown_fences(self):
        assert safe_json_parse('```json\n{"key": "value"}\n```') == {"key": "value"}

    def test_json_with_trailing_garbage(self):
        assert safe_json_parse('{"key": "value"} some extra trailing text') == {"key": "value"}

    def test_malformed_json_raises_valueerror(self):
        with pytest.raises(ValueError):
            safe_json_parse("not valid json at all")

    def test_empty_string_raises_valueerror(self):
        with pytest.raises(ValueError):
            safe_json_parse("")

    def test_whitespace_only_raises_valueerror(self):
        with pytest.raises(ValueError):
            safe_json_parse("   \n\t  ")


class TestSanitizeRemediationCode:
    """Tests for sanitize_remediation_code()."""

    def test_empty_string_returns_empty(self):
        assert sanitize_remediation_code("") == ""

    def test_none_equivalent_returns_empty(self):
        assert sanitize_remediation_code("") == ""

    def test_all_comment_lines_returns_empty(self):
        code = "# This is a comment\n# Another comment"
        assert sanitize_remediation_code(code) == ""

    def test_all_comment_lines_mixed_prefixes_returns_empty(self):
        code = "// TODO fix this\n// Another line"
        assert sanitize_remediation_code(code) == ""

    def test_valid_code_preserved(self):
        code = "import os\npassword = os.environ.get('DB_PASSWORD')"
        assert sanitize_remediation_code(code) == code

    def test_code_with_some_comments_preserved(self):
        code = "# Header comment\nimport os\npassword = os.environ.get('KEY')"
        assert sanitize_remediation_code(code) == code

    def test_trailing_newlines_stripped(self):
        code = "x = 1\n\n"
        assert sanitize_remediation_code(code) == "x = 1"


class TestGetAiConfig:
    """Tests for get_ai_config() with various providers."""

    def test_no_provider_returns_empty(self, mocker):
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch.dict(os.environ, {}, clear=True)
        api_key, base_url, model, requires_key = get_ai_config()
        assert api_key == ""
        assert base_url == ""
        assert model == ""
        assert requires_key is False

    def test_9router_provider_returns_correct_config(self, mocker):
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch.dict(os.environ, {
            "AI_PROVIDER": "9router",
            "NINEROUTER_API_KEY": "key123",
            "NINEROUTER_BASE_URL": "http://localhost:20128/v1",
            "NINEROUTER_MODEL": "test-model",
        }, clear=True)
        api_key, base_url, model, requires_key = get_ai_config()
        assert api_key == "key123"
        assert base_url == "http://localhost:20128/v1"
        assert model == "test-model"
        assert requires_key is False

    def test_openai_provider_returns_correct_config(self, mocker):
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch.dict(os.environ, {
            "AI_PROVIDER": "openai",
            "OPENAI_API_KEY": "sk-test",
            "OPENAI_BASE_URL": "https://api.openai.com/v1",
            "OPENAI_MODEL": "gpt-4",
        }, clear=True)
        api_key, base_url, model, requires_key = get_ai_config()
        assert api_key == "sk-test"
        assert base_url == "https://api.openai.com/v1"
        assert model == "gpt-4"
        assert requires_key is True

    def test_google_provider_returns_correct_config(self, mocker):
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch.dict(os.environ, {
            "AI_PROVIDER": "google",
            "GOOGLE_API_KEY": "google-key",
            "GOOGLE_BASE_URL": "https://generativelanguage.googleapis.com/v1",
            "GOOGLE_MODEL": "gemini-pro",
        }, clear=True)
        api_key, base_url, model, requires_key = get_ai_config()
        assert api_key == "google-key"
        assert base_url == "https://generativelanguage.googleapis.com/v1"
        assert model == "gemini-pro"
        assert requires_key is True

    def test_anthropic_provider_returns_correct_config(self, mocker):
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch.dict(os.environ, {
            "AI_PROVIDER": "anthropic",
            "ANTHROPIC_API_KEY": "anthro-key",
            "ANTHROPIC_BASE_URL": "https://api.anthropic.com/v1",
            "ANTHROPIC_MODEL": "claude-3",
        }, clear=True)
        api_key, base_url, model, requires_key = get_ai_config()
        assert api_key == "anthro-key"
        assert base_url == "https://api.anthropic.com/v1"
        assert model == "claude-3"
        assert requires_key is True

    def test_unknown_provider_returns_empty(self, mocker):
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch.dict(os.environ, {
            "AI_PROVIDER": "unknown_provider",
            "UNKNOWN_API_KEY": "some-key",
        }, clear=True)
        api_key, base_url, model, requires_key = get_ai_config()
        assert api_key == ""
        assert base_url == ""
        assert model == ""
        assert requires_key is False


class TestResolveFindings:
    """Tests for resolve_findings()."""

    def test_with_mocked_ai_response(self, mocker):
        """resolve_findings with mock HTTP response returns parsed resolutions."""
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch("engine.core.ai_resolver.time.sleep")
        mocker.patch.dict(os.environ, {
            "AI_PROVIDER": "9router",
            "NINEROUTER_API_KEY": "fake_key",
            "NINEROUTER_BASE_URL": "http://localhost:20128/v1",
            "NINEROUTER_MODEL": "test-model",
        }, clear=True)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = json.dumps({
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "r0": {
                            "suggestion": "Use safe subprocess instead of exec",
                            "remediation_code": "import subprocess\nsubprocess.run(['echo', user_input])",
                        },
                    }),
                },
            }],
        }).encode("utf-8")
        mocker.patch("engine.core.ai_resolver.requests.post", return_value=mock_response)

        findings = [{
            "file": "example.py",
            "line": 12,
            "rule_id": "python.lang.security.audit.dangerous-exec",
            "message": "dangerous exec vulnerability",
            "code_text": "exec(user_input)",
        }]

        resolutions = resolve_findings(findings, use_mock=False)
        assert "python.lang.security.audit.dangerous-exec" in resolutions
        assert (resolutions["python.lang.security.audit.dangerous-exec"]["suggestion"]
                == "Use safe subprocess instead of exec")
        assert "subprocess.run" in resolutions[
            "python.lang.security.audit.dangerous-exec"]["remediation_code"]

    def test_handles_http_error_gracefully(self, mocker):
        """resolve_findings with ConnectionError returns fallback suggestion."""
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch("engine.core.ai_resolver.time.sleep")
        mocker.patch.dict(os.environ, {
            "AI_PROVIDER": "9router",
            "NINEROUTER_API_KEY": "fake_key",
            "NINEROUTER_BASE_URL": "http://localhost:20128/v1",
            "NINEROUTER_MODEL": "test-model",
        }, clear=True)
        mocker.patch("engine.core.ai_resolver.requests.post",
                      side_effect=requests.exceptions.ConnectionError("Connection refused"))

        findings = [{
            "file": "example.py",
            "line": 12,
            "rule_id": "python.lang.security.audit.dangerous-exec",
            "message": "dangerous exec vulnerability",
            "code_text": "exec(user_input)",
        }]

        resolutions = resolve_findings(findings, use_mock=False)
        assert "python.lang.security.audit.dangerous-exec" in resolutions
        assert "False positive" in resolutions[
            "python.lang.security.audit.dangerous-exec"]["suggestion"]
        assert resolutions["python.lang.security.audit.dangerous-exec"]["remediation_code"] == ""

    def test_falls_back_to_mock_when_no_provider(self, mocker):
        """resolve_findings with no env provider falls back to mock data."""
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch.dict(os.environ, {}, clear=True)

        findings = [{
            "file": "example.py",
            "line": 12,
            "rule_id": "python.lang.security.audit.dangerous-exec",
            "message": "dangerous exec vulnerability",
        }]

        resolutions = resolve_findings(findings, use_mock=False)
        assert "python.lang.security.audit.dangerous-exec" in resolutions
        assert "suggestion" in resolutions["python.lang.security.audit.dangerous-exec"]
        assert "remediation_code" in resolutions["python.lang.security.audit.dangerous-exec"]

    def test_with_explicit_mock(self):
        """resolve_findings with use_mock=True returns mock resolutions."""
        findings = [{
            "file": "example.py",
            "line": 12,
            "rule_id": "python.lang.security.audit.dangerous-exec",
            "message": "dangerous exec vulnerability",
        }]

        resolutions = resolve_findings(findings, use_mock=True)
        assert "python.lang.security.audit.dangerous-exec" in resolutions
        assert (resolutions["python.lang.security.audit.dangerous-exec"]["suggestion"]
                == "Avoid using exec(). Use structured functions or parse inputs securely.")

    def test_empty_list_returns_empty_dict(self):
        assert resolve_findings([], use_mock=True) == {}

    def test_unknown_rule_gets_generic_mock(self):
        """resolve_findings with unknown rule ID returns generic mock suggestion."""
        findings = [{
            "file": "test.py",
            "line": 1,
            "rule_id": "some.unknown.rule.id",
            "message": "unknown issue",
        }]

        resolutions = resolve_findings(findings, use_mock=True)
        assert "some.unknown.rule.id" in resolutions
        assert "Avoid this pattern" in resolutions["some.unknown.rule.id"]["suggestion"]


class TestPostWithRetry:
    """Tests for post_with_retry()."""

    def test_500_returns_immediately_no_retry(self, mocker):
        """HTTP 500 should not be retried."""
        mocker.patch("engine.core.ai_resolver.time.sleep")
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_post = mocker.patch("engine.core.ai_resolver.requests.post", return_value=mock_response)

        response = post_with_retry(
            "http://localhost:20128/v1/chat/completions",
            headers={"Content-Type": "application/json"},
            payload={"model": "test"},
            timeout=30,
        )

        assert response.status_code == 500
        assert mock_post.call_count == 1

    def test_429_retries_then_succeeds(self, mocker):
        """HTTP 429 should retry up to AI_MAX_RETRIES, then succeed."""
        mocker.patch("engine.core.ai_resolver.time.sleep")
        mock_429 = MagicMock()
        mock_429.status_code = 429
        mock_200 = MagicMock()
        mock_200.status_code = 200
        mock_post = mocker.patch(
            "engine.core.ai_resolver.requests.post", side_effect=[mock_429, mock_429, mock_200],
        )

        response = post_with_retry(
            "http://localhost:20128/v1/chat/completions",
            headers={"Content-Type": "application/json"},
            payload={"model": "test"},
            timeout=30,
        )

        assert response.status_code == 200
        assert mock_post.call_count == 3

    def test_timeout_retries_then_succeeds(self, mocker):
        """Timeout should retry, then succeed on 3rd attempt."""
        mocker.patch("engine.core.ai_resolver.time.sleep")
        mock_post = mocker.patch(
            "engine.core.ai_resolver.requests.post",
            side_effect=[
                requests.exceptions.Timeout("Request timed out"),
                requests.exceptions.Timeout("Request timed out"),
                MagicMock(status_code=200),
            ],
        )

        response = post_with_retry(
            "http://localhost:20128/v1/chat/completions",
            headers={"Content-Type": "application/json"},
            payload={"model": "test"},
            timeout=30,
        )

        assert response.status_code == 200
        assert mock_post.call_count == 3

    def test_timeout_exhausts_retries_raises(self, mocker):
        """Timeout that exhausts all retries should raise."""
        mocker.patch("engine.core.ai_resolver.time.sleep")
        mock_post = mocker.patch(
            "engine.core.ai_resolver.requests.post",
            side_effect=requests.exceptions.Timeout("Request timed out"),
        )

        with pytest.raises(requests.exceptions.Timeout):
            post_with_retry(
                "http://localhost:20128/v1/chat/completions",
                headers={"Content-Type": "application/json"},
                payload={"model": "test"},
                timeout=30,
            )

        # AI_MAX_RETRIES=2 → 3 attempts (0, 1, 2)
        assert mock_post.call_count == 3
