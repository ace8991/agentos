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
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_path = Path(self.temp_dir.name) / "desktop_commander_config.json"
        self.config_patcher = patch.object(desktop_commander_service, "_CONFIG_PATH", self.config_path)
        self.config_patcher.start()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.config_patcher.stop()
        self.temp_dir.cleanup()
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

    def test_config_patch_is_persisted_and_restricts_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            allowed = Path(temp_dir) / "allowed"
            disallowed = Path(temp_dir) / "blocked"
            allowed.mkdir()
            disallowed.mkdir()

            patch_response = self.client.patch(
                "/desktop-commander/config",
                json={"allowed_directories": [str(allowed)]},
            )
            self.assertEqual(patch_response.status_code, 200)
            payload = patch_response.json()
            self.assertEqual(payload["allowed_directories"], [str(allowed.resolve())])

            ok_response = self.client.post(
                "/desktop-commander/write-file",
                json={"path": str(allowed / "inside.txt"), "content": "ok"},
            )
            self.assertTrue(ok_response.json()["success"])

            blocked_response = self.client.post(
                "/desktop-commander/write-file",
                json={"path": str(disallowed / "outside.txt"), "content": "nope"},
            )
            self.assertFalse(blocked_response.json()["success"])
            self.assertIn("allowed directories", blocked_response.json()["description"])

    def test_blocked_command_policy_is_enforced(self) -> None:
        patch_response = self.client.patch(
            "/desktop-commander/config",
            json={"blocked_commands": ["powershell"]},
        )
        self.assertEqual(patch_response.status_code, 200)

        response = self.client.post(
            "/desktop-commander/execute-command",
            json={"command": "powershell -Command echo nope"},
        )
        payload = response.json()
        self.assertFalse(payload["success"])
        self.assertIn("blocked", payload["description"].lower())


if __name__ == "__main__":
    unittest.main()
