from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app
from app.services import connectors as connectors_service


class ConnectorValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_github_requires_token(self) -> None:
        response = self.client.post(
            "/connectors/validate",
            json={"connector_id": "github", "values": {}},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["integration_mode"], "native")
        self.assertEqual(payload["status"], "not_configured")
        self.assertFalse(payload["ready"])

    def test_manual_connector_reports_saved_locally(self) -> None:
        response = self.client.post(
            "/connectors/validate",
            json={
                "connector_id": "canva",
                "values": {"CANVA_ACCESS_TOKEN": "demo-token"},
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["integration_mode"], "manual")
        self.assertEqual(payload["status"], "saved")
        self.assertFalse(payload["ready"])

    def test_github_verified_when_provider_accepts_token(self) -> None:
        mock_response = Mock()
        mock_response.is_success = True
        mock_response.json.return_value = {"login": "ace8991"}

        with patch.object(connectors_service, "_http_status_ok", AsyncMock(return_value=mock_response)):
            response = self.client.post(
                "/connectors/validate",
                json={
                    "connector_id": "github",
                    "values": {"GITHUB_TOKEN": "github_pat_demo"},
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "verified")
        self.assertTrue(payload["ready"])
        self.assertIn("ace8991", payload["message"])

    def test_local_connector_reports_local_server_failure(self) -> None:
        with patch.object(connectors_service, "IS_LOCAL", True):
            response = self.client.post(
                "/connectors/validate",
                json={
                    "connector_id": "desktop-commander",
                    "values": {"DESKTOP_COMMANDER_SERVER_URL": "http://localhost:9999"},
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["integration_mode"], "local")
        self.assertEqual(payload["status"], "error")
        self.assertFalse(payload["ready"])


if __name__ == "__main__":
    unittest.main()
