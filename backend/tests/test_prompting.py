from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.schemas import ChatMessage
from app.services.prompting import build_agent_system_prompt, build_chat_system_prompt


class PromptingTests(unittest.TestCase):
    def test_chat_prompt_adds_live_search_contract(self) -> None:
        prompt = build_chat_system_prompt(
            [ChatMessage(role="user", content="cherche les dernieres infos sur Tavily")],
            web_search=True,
        )

        self.assertIn("AgentOS Pro", prompt)
        self.assertIn("cite sources", prompt)
        self.assertIn("live web context", prompt)

    def test_agent_prompt_includes_file_and_browser_rules(self) -> None:
        prompt = build_agent_system_prompt(is_cloud=False)

        self.assertIn("file_search", prompt)
        self.assertIn("file_write", prompt)
        self.assertIn("app_open", prompt)
        self.assertIn("browser_* tools", prompt)
        self.assertIn("dir_list before file_read", prompt)
        self.assertIn("done", prompt)


if __name__ == "__main__":
    unittest.main()
