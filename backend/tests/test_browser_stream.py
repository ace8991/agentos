from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app
from app.services import runner


class BrowserStreamRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        runner._active_runs.clear()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        runner._active_runs.clear()

    def test_browser_stream_sends_live_frame(self) -> None:
        run_id = runner.create_run(
            task="open github",
            model="gpt-4o",
            max_steps=3,
            capture_interval_ms=100,
        )

        with patch(
            "app.routes.browser.browser_svc.session_exists",
            return_value=True,
        ), patch(
            "app.routes.browser.browser_svc.browser_live_state",
            new=AsyncMock(
                return_value={
                    "success": True,
                    "screenshot_b64": "ZmFrZQ==",
                    "url": "https://github.com/",
                    "title": "GitHub",
                    "description": "Live browser view",
                }
            ),
        ):
            with self.client.websocket_connect(f"/browser/stream/{run_id}?fps=10") as websocket:
                payload = websocket.receive_json()

        self.assertEqual(payload["type"], "frame")
        self.assertEqual(payload["url"], "https://github.com/")
        self.assertEqual(payload["title"], "GitHub")

    def test_browser_stream_reports_idle_while_session_initializes(self) -> None:
        run_id = runner.create_run(
            task="open amazon",
            model="gpt-4o",
            max_steps=3,
            capture_interval_ms=100,
        )

        with patch(
            "app.routes.browser.browser_svc.session_exists",
            return_value=False,
        ):
            with self.client.websocket_connect(f"/browser/stream/{run_id}") as websocket:
                payload = websocket.receive_json()

        self.assertEqual(payload["type"], "idle")
        self.assertIn("Preparing", payload["message"])
