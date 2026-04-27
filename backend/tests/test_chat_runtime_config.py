from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app
from app.services import runtime_config


class _FakeStreamResponse:
    status_code = 200

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def aiter_lines(self):
        yield 'data: {"choices":[{"delta":{"content":"hello from deepseek"}}]}'
        yield "data: [DONE]"

    async def aread(self):
        return b""


class _FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def stream(self, *args, **kwargs):
        return _FakeStreamResponse()


class ChatRuntimeConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        runtime_config._runtime_overrides.clear()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        runtime_config._runtime_overrides.clear()

    def test_models_available_uses_runtime_overrides(self) -> None:
        response = self.client.post(
            "/runtime/config",
            json={"values": {"DEEPSEEK_API_KEY": "frontend-synced-key"}},
        )
        self.assertEqual(response.status_code, 200)

        models_response = self.client.get("/models/available")
        self.assertEqual(models_response.status_code, 200)
        payload = models_response.json()
        self.assertTrue(payload["providers"]["deepseek"])
        self.assertTrue(any(model["id"] == "deepseek-chat" for model in payload["models"]))

    def test_chat_accepts_runtime_synced_deepseek_key(self) -> None:
        response = self.client.post(
            "/runtime/config",
            json={"values": {"DEEPSEEK_API_KEY": "frontend-synced-key"}},
        )
        self.assertEqual(response.status_code, 200)

        with patch("app.routes.chat.httpx.AsyncClient", _FakeAsyncClient):
            chat_response = self.client.post(
                "/chat",
                json={
                    "messages": [{"role": "user", "content": "bonjour"}],
                    "model": "deepseek-chat",
                    "stream": True,
                },
            )

        self.assertEqual(chat_response.status_code, 200)
        self.assertIn("hello from deepseek", chat_response.text)
        self.assertNotIn("DEEPSEEK_API_KEY", chat_response.text)


if __name__ == "__main__":
    unittest.main()
