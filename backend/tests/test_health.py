from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app
from app.services import remote_control


class HealthRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        remote_control._commands.clear()
        self.client = TestClient(app)

    def test_health_reports_runtime_and_remote_flags(self) -> None:
        with patch.dict(
            os.environ,
            {
                "REMOTE_TELEGRAM_SECRET": "telegram-secret",
                "REMOTE_REQUIRE_APPROVAL": "false",
            },
            clear=False,
        ):
            response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn(payload["mode"], {"local", "cloud"})
        self.assertIn("available_tools", payload)
        self.assertIn("runtime", payload)
        self.assertIn("remote", payload)
        self.assertIn("computer_use_provider", payload["runtime"])
        self.assertIn("computer_use_model", payload["runtime"])
        self.assertTrue(payload["remote"]["configured_channels"]["telegram"])
        self.assertTrue(payload["runtime"]["supports_remote_commands"])
        self.assertFalse(payload["runtime"]["approval_required"])


if __name__ == "__main__":
    unittest.main()
