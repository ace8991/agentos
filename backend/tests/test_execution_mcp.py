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
from app.services import execution as execution_service
from app.services import mcp_bridge


class ExecutionAndMcpTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.mcp_config_path = Path(self.temp_dir.name) / "mcp_servers.json"
        self.mcp_patcher = patch.object(mcp_bridge, "MCP_CONFIG_PATH", self.mcp_config_path)
        self.mcp_patcher.start()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.mcp_patcher.stop()
        self.temp_dir.cleanup()

    def test_execution_plan_classifies_builder_request(self) -> None:
        response = self.client.post(
            "/execute/plan",
            json={"task": "create a landing page for an AI design studio", "model": "claude-sonnet-4-6"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["intent"]["kind"], "builder")
        self.assertTrue(payload["intent"]["requires_builder"])
        self.assertGreaterEqual(len(payload["steps"]), 4)

    def test_execution_plan_classifies_filesystem_request(self) -> None:
        intent = execution_service.analyze_intent("read a file from my desktop")
        self.assertEqual(intent.kind.value, "filesystem")
        self.assertTrue(intent.requires_filesystem)
        self.assertIn("filesystem", intent.preferred_capabilities)

    def test_mcp_servers_include_internal_and_created_external(self) -> None:
        initial_response = self.client.get("/mcp/servers")
        self.assertEqual(initial_response.status_code, 200)
        initial_payload = initial_response.json()
        self.assertTrue(any(server["kind"] == "internal" for server in initial_payload["servers"]))

        create_response = self.client.post(
            "/mcp/servers",
            json={
                "name": "Filesystem MCP",
                "description": "External filesystem bridge",
                "family": "filesystem",
                "command": "node",
                "args": ["dist/index.js"],
                "env": {"ALLOWED_DIRECTORIES": "C:/Users/User/Documents"},
                "enabled": True,
            },
        )
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertEqual(created["kind"], "mcp")
        self.assertEqual(created["status"], "configured")

        list_response = self.client.get("/mcp/servers")
        self.assertEqual(list_response.status_code, 200)
        listed = list_response.json()["servers"]
        self.assertTrue(any(server["id"] == created["id"] for server in listed))

    def test_mcp_tools_endpoint_returns_internal_capabilities(self) -> None:
        response = self.client.get("/mcp/tools")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        tool_names = {tool["name"] for tool in payload["tools"]}
        self.assertIn("file_read", tool_names)
        self.assertIn("browser_open", tool_names)


if __name__ == "__main__":
    unittest.main()
