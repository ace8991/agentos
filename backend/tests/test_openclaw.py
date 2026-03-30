from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app


class OpenClawRoutesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.state_path = Path(self.temp_dir.name) / "openclaw_state.json"
        self.client = TestClient(app)
        patcher = patch("app.services.openclaw_hub.STATE_PATH", self.state_path)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.temp_dir.cleanup)

    def test_openclaw_state_and_pairing_flow(self) -> None:
        response = self.client.get("/openclaw/state")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["gateway"]["protocol_version"], 3)
        self.assertGreaterEqual(len(payload["devices"]), 1)

        pair_response = self.client.post(
            "/openclaw/pair",
            json={"name": "Pixel 9", "platform": "android", "role": "operator"},
        )
        self.assertEqual(pair_response.status_code, 200)
        paired = pair_response.json()
        self.assertTrue(any(device["name"] == "Pixel 9" for device in paired["devices"]))

    def test_channel_and_overlay_updates(self) -> None:
        channel_response = self.client.post(
            "/openclaw/channels/telegram",
            json={"enabled": True, "secret": "secret-1234"},
        )
        self.assertEqual(channel_response.status_code, 200)
        payload = channel_response.json()
        telegram = next(channel for channel in payload["channels"] if channel["id"] == "telegram")
        self.assertTrue(telegram["configured"])
        self.assertTrue(telegram["enabled"])

        overlay_response = self.client.post(
            "/openclaw/overlays",
            json={"floating_dock": False, "mobile_hud": False, "voice_overlay": True, "voice_wake": True},
        )
        self.assertEqual(overlay_response.status_code, 200)
        overlays = overlay_response.json()["overlays"]
        self.assertFalse(overlays["floating_dock"])
        self.assertFalse(overlays["mobile_hud"])
        self.assertTrue(overlays["voice_wake"])


if __name__ == "__main__":
    unittest.main()
