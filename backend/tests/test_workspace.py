from __future__ import annotations

import io
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.routes.workspace import build_workspace_archive


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


if __name__ == "__main__":
    unittest.main()
