from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.computer_use import resolve_computer_use_runtime


class ComputerUseConfigTests(unittest.TestCase):
    def test_defaults_to_auto_sonnet(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            runtime = resolve_computer_use_runtime()

        self.assertEqual(runtime["provider"], "auto")
        self.assertEqual(runtime["model"], "claude-sonnet-4-6")

    def test_disabled_mode_reports_not_ready(self) -> None:
        with patch.dict(
            os.environ,
            {
                "COMPUTER_USE_PROVIDER": "disabled",
                "COMPUTER_USE_MODEL": "claude-opus-4-5",
                "ANTHROPIC_API_KEY": "sk-test",
            },
            clear=True,
        ):
            runtime = resolve_computer_use_runtime()

        self.assertFalse(runtime["enabled"])
        self.assertFalse(runtime["ready"])
        self.assertEqual(runtime["provider"], "disabled")

    def test_anthropic_mode_can_be_ready_independent_of_main_model(self) -> None:
        with patch.dict(
            os.environ,
            {
                "COMPUTER_USE_PROVIDER": "anthropic",
                "COMPUTER_USE_MODEL": "claude-opus-4-5",
                "ANTHROPIC_API_KEY": "sk-test",
            },
            clear=True,
        ):
            runtime = resolve_computer_use_runtime()

        self.assertTrue(runtime["enabled"])
        self.assertTrue(runtime["ready"])
        self.assertEqual(runtime["provider"], "anthropic")
        self.assertEqual(runtime["model"], "claude-opus-4-5")


if __name__ == "__main__":
    unittest.main()
