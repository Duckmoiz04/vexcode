"""Tests for naming_audit.py — robust content extraction for multimodal/null responses."""

import json
import os
from unittest.mock import MagicMock

import pytest

from engine.core.naming_audit import run_naming_audit


@pytest.fixture
def nvidia_env(mocker):
    mocker.patch("engine.core.ai_resolver.time.sleep")
    mocker.patch("engine.core.naming_audit.time.sleep")
    mocker.patch.dict(os.environ, {
        "AI_PROVIDER": "nvidia",
        "NVIDIA_API_KEY": "nvapi-test",
        "NVIDIA_BASE_URL": "https://integrate.api.nvidia.com/v1",
        "NVIDIA_MODEL": "minimaxai/minimax-m3",
    }, clear=True)


def _mock_response(body: dict) -> MagicMock:
    r = MagicMock()
    r.status_code = 200
    r.content = json.dumps(body).encode("utf-8")
    return r


class TestNamingAuditContentExtraction:
    """Robust content extraction in naming audit, mirroring ai_resolver behavior."""

    def test_handles_multimodal_list_content(self, mocker, nvidia_env, tmp_path):
        """NVIDIA NIM returns content as list-of-parts; extractor must flatten text."""
        target = tmp_path
        file = target / "example.py"
        file.write_text("def do_it(x):\n    return x\n", encoding="utf-8")

        mock_resp = _mock_response({
            "choices": [{
                "finish_reason": "stop",
                "message": {
                    "content": [
                        {"type": "text", "text": json.dumps([
                            {"line": 1, "code_text": "def do_it(x):", "message": "obscure name"}
                        ])},
                    ],
                },
            }],
        })
        mocker.patch("engine.core.naming_audit.requests.post", return_value=mock_resp)

        findings, resolutions = run_naming_audit([str(file)], str(target))
        assert len(findings) == 1
        assert findings[0]["file"].endswith("example.py")
        assert "obscure" in findings[0]["message"]

    def test_handles_null_content_without_crashing(self, mocker, nvidia_env, tmp_path):
        """When content is null, skip the file rather than raising IndexError."""
        target = tmp_path
        file = target / "example.py"
        file.write_text("def do_it(x):\n    return x\n", encoding="utf-8")

        mock_resp = _mock_response({
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {"content": None, "tool_calls": [{"id": "1"}]},
            }],
        })
        mocker.patch("engine.core.naming_audit.requests.post", return_value=mock_resp)

        # Should not raise
        findings, resolutions = run_naming_audit([str(file)], str(target))
        assert findings == []
        assert resolutions == {}

    def test_handles_empty_choices_list(self, mocker, nvidia_env, tmp_path):
        """A response with no choices at all must not raise IndexError."""
        target = tmp_path
        file = target / "example.py"
        file.write_text("def do_it(x):\n    return x\n", encoding="utf-8")

        mock_resp = _mock_response({"unexpected": "shape"})
        mocker.patch("engine.core.naming_audit.requests.post", return_value=mock_resp)

        # Should not raise
        findings, resolutions = run_naming_audit([str(file)], str(target))
        assert findings == []
        assert resolutions == {}

    def test_handles_string_content_normal_path(self, mocker, nvidia_env, tmp_path):
        """Sanity check: standard string content still works after the refactor."""
        target = tmp_path
        file = target / "example.py"
        file.write_text("def do_it(x):\n    return x\n", encoding="utf-8")

        mock_resp = _mock_response({
            "choices": [{
                "message": {
                    "content": json.dumps([
                        {"line": 1, "code_text": "def do_it(x):", "message": "obscure"}
                    ]),
                },
            }],
        })
        mocker.patch("engine.core.naming_audit.requests.post", return_value=mock_resp)

        findings, resolutions = run_naming_audit([str(file)], str(target))
        assert len(findings) == 1
