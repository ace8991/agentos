from __future__ import annotations

import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services import brain


class _FakeResponse:
    def __init__(self) -> None:
        self.choices = [types.SimpleNamespace(message=types.SimpleNamespace(content='done<action>{"type":"done","reason":"ok"}</action>'))]


class _FakeOpenAIClient:
    def __init__(self, recorder: dict) -> None:
        def _create(**kwargs):
            recorder["payload"] = kwargs
            return _FakeResponse()

        self.chat = types.SimpleNamespace(
            completions=types.SimpleNamespace(create=_create)
        )


class BrainOpenAITests(unittest.TestCase):
    def test_gpt5_agent_uses_max_completion_tokens(self) -> None:
        recorded: dict = {}

        with patch("app.services.brain.get_runtime_value", return_value="sk-test"), patch(
            "openai.OpenAI", side_effect=lambda api_key: _FakeOpenAIClient(recorded)
        ):
            brain.think_and_act(
                task="Open amazon and verify my latest order",
                screenshot_b64="ZmFrZQ==",
                step=1,
                max_steps=8,
                history=[],
                memory={},
                model="gpt-5.4",
                reasoning_effort="medium",
            )

        payload = recorded["payload"]
        self.assertIn("max_completion_tokens", payload)
        self.assertNotIn("max_tokens", payload)
        self.assertEqual(payload["max_completion_tokens"], 1024)
        self.assertEqual(payload["reasoning_effort"], "medium")

    def test_gpt4o_agent_keeps_max_tokens(self) -> None:
        recorded: dict = {}

        with patch("app.services.brain.get_runtime_value", return_value="sk-test"), patch(
            "openai.OpenAI", side_effect=lambda api_key: _FakeOpenAIClient(recorded)
        ):
            brain.think_and_act(
                task="Open amazon and verify my latest order",
                screenshot_b64="ZmFrZQ==",
                step=1,
                max_steps=8,
                history=[],
                memory={},
                model="gpt-4o",
            )

        payload = recorded["payload"]
        self.assertIn("max_tokens", payload)
        self.assertNotIn("max_completion_tokens", payload)
        self.assertEqual(payload["max_tokens"], 1024)


if __name__ == "__main__":
    unittest.main()
