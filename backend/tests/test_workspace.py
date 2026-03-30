from __future__ import annotations

import io
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app
from app.routes.workspace import build_workspace_archive
from app.services import builder as builder_svc


class WorkspaceArchiveTests(unittest.TestCase):
    def test_build_workspace_archive_excludes_heavy_runtime_dirs(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / "src").mkdir()
            (root / "node_modules").mkdir()
            (root / "backend").mkdir()
            (root / "backend" / ".venv").mkdir()
            (root / ".git").mkdir()

            (root / "src" / "App.tsx").write_text("export default 'ok';", encoding="utf-8")
            (root / "README.md").write_text("# AgentOS", encoding="utf-8")
            (root / "node_modules" / "ignore.txt").write_text("skip", encoding="utf-8")
            (root / "backend" / ".venv" / "ignore.py").write_text("skip", encoding="utf-8")
            (root / ".git" / "config").write_text("skip", encoding="utf-8")

            archive_bytes = build_workspace_archive(root)
            archive = zipfile.ZipFile(io.BytesIO(archive_bytes))
            names = set(archive.namelist())

            self.assertIn("src/App.tsx", names)
            self.assertIn("README.md", names)
            self.assertNotIn("node_modules/ignore.txt", names)
            self.assertNotIn("backend/.venv/ignore.py", names)
            self.assertNotIn(".git/config", names)


class BuilderWorkspaceRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.tmpdir = tempfile.TemporaryDirectory()
        builder_svc.WORKSPACES_ROOT = Path(self.tmpdir.name)
        builder_svc.WORKSPACES_ROOT.mkdir(parents=True, exist_ok=True)

    def tearDown(self) -> None:
        self.tmpdir.cleanup()

    def test_builder_workspace_frontend_only(self) -> None:
        response = self.client.post("/workspace/builder", json={"prompt": "create a landing page for a saas product"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["kind"], "landing")
        self.assertEqual(payload["stack"]["frontend"], "React + Vite + TypeScript + Tailwind CSS")
        self.assertFalse(payload["database_files"])
        self.assertTrue(any(file_item["path"] == "client/src/App.tsx" for file_item in payload["files"]))
        self.assertIn("/workspace/builder/", payload["preview_url"])

        preview = self.client.get(payload["preview_url"].replace("http://testserver", ""))
        self.assertEqual(preview.status_code, 200)
        self.assertIn("Workspace generated locally", preview.text)

    def test_builder_workspace_with_database_surface(self) -> None:
        response = self.client.post(
            "/workspace/builder",
            json={"prompt": "create a dashboard app with auth, api, and sqlite database"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["kind"], "dashboard")
        self.assertEqual(payload["stack"]["backend"], "FastAPI service")
        self.assertEqual(payload["stack"]["database"], "SQLite schema")
        self.assertTrue(payload["database_files"])

        workspace_id = payload["workspace_id"]
        file_response = self.client.get(f"/workspace/builder/{workspace_id}/file/database/schema.sql")
        self.assertEqual(file_response.status_code, 200)
        self.assertIn("create table if not exists", file_response.json()["content"])


if __name__ == "__main__":
    unittest.main()
