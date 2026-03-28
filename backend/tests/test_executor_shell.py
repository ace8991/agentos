from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services import executor


@unittest.skipUnless(sys.platform.startswith("win"), "PowerShell shell test is Windows-specific")
class ExecutorShellTests(unittest.TestCase):
    def test_shell_runs_powershell_commands(self) -> None:
        result = executor._shell("Write-Output 'agentos-shell-ok'")

        self.assertTrue(result["success"])
        self.assertIn("agentos-shell-ok", result["stdout"])


if __name__ == "__main__":
    unittest.main()
