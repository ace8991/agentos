from __future__ import annotations

import sys
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
import platform

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app
from app.services import desktop_commander as desktop_commander_service


class DesktopCommanderRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.local_patcher = patch.object(desktop_commander_service, "IS_LOCAL", True)
        self.local_patcher.start()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.local_patcher.stop()

    def test_health_exposes_supported_tools(self) -> None:
        response = self.client.get("/desktop-commander/health")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertIn("dc_read_file", payload["tools"])
        self.assertIn("dc_execute_command", payload["tools"])

    def test_file_and_directory_routes_work(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            nested = root / "notes"
            file_path = nested / "passport.txt"

            write_response = self.client.post(
                "/desktop-commander/write-file",
                json={"path": str(file_path), "content": "passport copy"},
            )
            self.assertEqual(write_response.status_code, 200)
            self.assertTrue(write_response.json()["success"])

            list_response = self.client.post(
                "/desktop-commander/list-directory",
                json={"path": str(nested)},
            )
            self.assertEqual(list_response.status_code, 200)
            self.assertTrue(list_response.json()["success"])
            self.assertEqual(list_response.json()["items"][0]["name"], "passport.txt")

            search_response = self.client.post(
                "/desktop-commander/search-files",
                json={"query": "passport", "path": str(root), "max_results": 4},
            )
            self.assertEqual(search_response.status_code, 200)
            self.assertTrue(search_response.json()["success"])
            self.assertEqual(search_response.json()["results"][0]["name"], "passport.txt")

            read_response = self.client.post(
                "/desktop-commander/read-file",
                json={"path": str(file_path)},
            )
            self.assertEqual(read_response.status_code, 200)
            self.assertTrue(read_response.json()["success"])
            self.assertIn("passport copy", read_response.json()["content"])

    def test_execute_command_and_system_info_routes_work(self) -> None:
        command = "Write-Output 'dc-ok'" if platform.system() == "Windows" else "printf dc-ok"
        response = self.client.post(
            "/desktop-commander/execute-command",
            json={"command": command},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertIn("dc-ok", payload.get("stdout", ""))

        system_response = self.client.get("/desktop-commander/system-info")
        self.assertEqual(system_response.status_code, 200)
        system_payload = system_response.json()
        self.assertTrue(system_payload["success"])
        self.assertIn("os", system_payload)


if __name__ == "__main__":
    unittest.main()
