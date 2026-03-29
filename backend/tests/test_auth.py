from __future__ import annotations

import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app
from app.services import auth as auth_service


class AuthRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.tempdir.name) / "users.db")
        self.db_patch = patch.object(auth_service, "DB_PATH", self.db_path)
        self.db_patch.start()
        auth_service.init_db()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        self.db_patch.stop()
        for _ in range(5):
            try:
                self.tempdir.cleanup()
                break
            except PermissionError:
                time.sleep(0.05)

    def test_register_and_fetch_current_user(self) -> None:
        register_response = self.client.post(
            "/auth/register",
            json={
                "email": "alex@example.com",
                "display_name": "Alex",
                "password": "supersecret123",
            },
        )

        self.assertEqual(register_response.status_code, 200)
        payload = register_response.json()
        self.assertEqual(payload["user"]["email"], "alex@example.com")
        self.assertEqual(payload["user"]["display_name"], "Alex")
        self.assertTrue(payload["access_token"])

        me_response = self.client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {payload['access_token']}"},
        )

        self.assertEqual(me_response.status_code, 200)
        user = me_response.json()
        self.assertEqual(user["email"], "alex@example.com")
        self.assertEqual(user["display_name"], "Alex")
        self.assertIn("created_at", user)

    def test_duplicate_email_is_rejected(self) -> None:
        payload = {
            "email": "duplicate@example.com",
            "display_name": "Duplicate",
            "password": "supersecret123",
        }

        first = self.client.post("/auth/register", json=payload)
        second = self.client.post("/auth/register", json=payload)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["detail"], "Email already registered")

    def test_login_updates_last_login(self) -> None:
        self.client.post(
            "/auth/register",
            json={
                "email": "login@example.com",
                "display_name": "Log In",
                "password": "supersecret123",
            },
        )

        login_response = self.client.post(
            "/auth/login",
            json={
                "email": "login@example.com",
                "password": "supersecret123",
            },
        )

        self.assertEqual(login_response.status_code, 200)
        payload = login_response.json()
        self.assertEqual(payload["user"]["email"], "login@example.com")

        me_response = self.client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {payload['access_token']}"},
        )
        self.assertEqual(me_response.status_code, 200)
        self.assertIsNotNone(me_response.json()["last_login"])


if __name__ == "__main__":
    unittest.main()
