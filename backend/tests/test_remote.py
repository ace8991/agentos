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


class RemoteRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        remote_control._commands.clear()
        self.client = TestClient(app)

    def test_remote_command_flow_from_inbound_to_complete(self) -> None:
        with patch.dict(
            os.environ,
            {
                "REMOTE_WEBHOOK_SECRET": "webhook-secret",
                "REMOTE_REQUIRE_APPROVAL": "true",
            },
            clear=False,
        ):
            inbound = self.client.post(
                "/remote/commands/inbound",
                json={
                    "channel": "webhook",
                    "secret": "webhook-secret",
                    "sender": "qa-bot",
                    "text": "Export the latest report",
                },
            )
            self.assertEqual(inbound.status_code, 200)
            command = inbound.json()
            self.assertEqual(command["status"], "pending")

            approve = self.client.post(
                f"/remote/commands/{command['id']}/approve",
                json={"actor": "reviewer", "note": "Looks safe"},
            )
            self.assertEqual(approve.status_code, 200)
            self.assertEqual(approve.json()["status"], "approved")

            claim = self.client.post(
                f"/remote/commands/{command['id']}/claim",
                json={"actor": "local-workspace"},
            )
            self.assertEqual(claim.status_code, 200)
            self.assertEqual(claim.json()["status"], "claimed")

            complete = self.client.post(
                f"/remote/commands/{command['id']}/complete",
                json={"actor": "local-workspace", "success": True},
            )
            self.assertEqual(complete.status_code, 200)
            completed = complete.json()
            self.assertEqual(completed["status"], "completed")
            self.assertTrue(completed["metadata"]["success"])

    def test_remote_inbound_rejects_invalid_secret(self) -> None:
        with patch.dict(
            os.environ,
            {"REMOTE_TELEGRAM_SECRET": "telegram-secret"},
            clear=False,
        ):
            response = self.client.post(
                "/remote/commands/inbound",
                json={
                    "channel": "telegram",
                    "secret": "wrong",
                    "sender": "@owner",
                    "text": "Run the task",
                },
            )

        self.assertEqual(response.status_code, 403)
        self.assertIn("Invalid remote secret", response.text)


if __name__ == "__main__":
    unittest.main()
