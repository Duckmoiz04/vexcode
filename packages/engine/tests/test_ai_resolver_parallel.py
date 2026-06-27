"""Tests for parallel AI resolution in ai_resolver.py."""

import json
import os
from unittest.mock import MagicMock

import pytest

from engine.core.ai_resolver import (
    call_ai_for_rule,
    resolve_findings,
)


def _extract_rule_id_from_prompt(payload: dict) -> str:
    """Parse the rule_id from the user prompt in the AI payload."""
    user_prompt = payload["messages"][1]["content"]
    for line in user_prompt.splitlines():
        if line.startswith("Full Rule:"):
            return line.split(":", 1)[1].strip()
    return "unknown"


class TestCallAiForRule:
    """Tests for the public call_ai_for_rule() worker."""

    @pytest.fixture(autouse=True)
    def _reset_ai_config_cache(self, mocker):
        mocker.patch("engine.config.ai_config._PROVIDERS", None)
        mocker.patch("engine.core.ai_resolver.get_resolved_provider_for_agent", return_value=None)

    def test_returns_tuple(self, mocker):
        """call_ai_for_rule returns (rule_id, resolution) tuple."""
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch("engine.core.ai_resolver.time.sleep")
        mocker.patch.dict(
            os.environ,
            {
                "AI_PROVIDER": "9router",
                "NINEROUTER_API_KEY": "fake_key",
                "NINEROUTER_BASE_URL": "http://localhost:20128/v1",
                "NINEROUTER_MODEL": "test-model",
            },
            clear=True,
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = json.dumps(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "r0": {
                                        "suggestion": "Use safe subprocess instead of exec",
                                        "remediation_code": "import subprocess\nsubprocess.run(['echo', user_input])",
                                    },
                                }
                            ),
                        },
                    }
                ],
            }
        ).encode("utf-8")
        mocker.patch("engine.core.ai_resolver.requests.post", return_value=mock_response)

        item = {
            "rule_id": "python.lang.security.audit.dangerous-exec",
            "file": "example.py",
            "line": 12,
            "message": "dangerous exec",
            "code_text": "exec(user_input)",
            "url": "http://localhost:20128/v1/chat/completions",
            "headers": {"Authorization": "Bearer fake_key", "Content-Type": "application/json"},
            "model": "test-model",
            "idx": 0,
            "total": 1,
        }

        rule_id, resolution = call_ai_for_rule(item)
        assert rule_id == "python.lang.security.audit.dangerous-exec"
        assert resolution["suggestion"] == "Use safe subprocess instead of exec"
        assert "subprocess.run" in resolution["remediation_code"]
        assert resolution["ai_status"] == "success"


class TestResolveFindingsParallel:
    """Tests for 3-stage pipeline resolution."""

    @pytest.fixture(autouse=True)
    def _reset_ai_config_cache(self, mocker):
        mocker.patch("engine.config.ai_config._PROVIDERS", None)
        mocker.patch("engine.core.ai_resolver.get_resolved_provider_for_agent", return_value=None)

    def test_resolves_multiple_rules_in_parallel_and_sorts_by_rule_id(self, mocker):
        mocker.patch("engine.config.ai_config._reload_env_file")
        mocker.patch("engine.core.ai_resolver.time.sleep")
        mocker.patch.dict(
            os.environ,
            {
                "AI_PROVIDER": "9router",
                "NINEROUTER_API_KEY": "fake_key",
                "NINEROUTER_BASE_URL": "http://localhost:20128/v1",
                "NINEROUTER_MODEL": "test-model",
            },
            clear=True,
        )

        call_count = {"count": 0}

        def _mock_post(url, headers, json, timeout):
            import json as json_module

            rule_id = _extract_rule_id_from_prompt(json)
            c = call_count["count"]
            call_count["count"] = c + 1

            stage_index = c % 3
            if stage_index == 0:  # analyze
                content = {"classification": "confirmed", "reasoning": f"exploitable: {rule_id}"}
            elif stage_index == 1:  # fix
                content = {"suggestion": f"Fix for {rule_id}", "remediation_code": f"fixed_code_{rule_id.replace('.', '_')} = 1"}
            else:  # review
                content = {"decision": "approved", "suggestion": f"Fix for {rule_id}", "remediation_code": f"fixed_code_{rule_id.replace('.', '_')} = 1"}

            response = MagicMock()
            response.status_code = 200
            response.content = json_module.dumps(
                {"choices": [{"message": {"content": json_module.dumps(content)}}]}
            ).encode("utf-8")
            return response

        mock_post = mocker.patch("engine.core.ai_resolver.requests.post", side_effect=_mock_post)
        mocker.patch("engine.core.ai_resolver._cache_get", return_value=None)

        findings = [
            {"file": "a.py", "line": 1, "rule_id": "rule.b", "message": "issue b", "code_text": "b", "severity": "HIGH", "confidence": "HIGH"},
            {"file": "a.py", "line": 2, "rule_id": "rule.a", "message": "issue a", "code_text": "a", "severity": "HIGH", "confidence": "HIGH"},
            {"file": "a.py", "line": 3, "rule_id": "rule.c", "message": "issue c", "code_text": "c", "severity": "HIGH", "confidence": "HIGH"},
        ]

        resolutions = resolve_findings(findings, use_mock=False)

        assert set(resolutions.keys()) == {"rule.a", "rule.b", "rule.c"}
        assert list(resolutions.keys()) == ["rule.a", "rule.b", "rule.c"]
        assert mock_post.call_count == 9  # 3 findings × 3 stages
        assert "Fix for rule.a" in resolutions["rule.a"]["suggestion"]
        assert "Fix for rule.b" in resolutions["rule.b"]["suggestion"]
        assert "Fix for rule.c" in resolutions["rule.c"]["suggestion"]
