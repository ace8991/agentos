from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

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
        self.assertIn("Desktop Commander-style local tools", prompt)
        self.assertIn("dc_read_file -> file_read", prompt)
        self.assertIn("React + Vite + TypeScript + Tailwind CSS", prompt)
        self.assertIn("done", prompt)

    def test_chat_prompt_adds_builder_stack_guidance(self) -> None:
        prompt = build_chat_system_prompt(
            [ChatMessage(role="user", content="create a landing page for a fintech startup")],
            web_search=False,
        )

        self.assertIn("Lovable-style web stack", prompt)
        self.assertIn("shadcn/ui", prompt)
        self.assertIn("primary app/page artifact", prompt)

    def test_chat_prompt_includes_relevant_imported_skill_guidance(self) -> None:
        with patch("app.services.prompting.skills_registry.build_skill_guidance", return_value="- Web Artifacts Builder: Use React + Vite + Tailwind CSS."):
            prompt = build_chat_system_prompt(
                [ChatMessage(role="user", content="create a product website")],
                web_search=False,
            )

        self.assertIn("Skill guidance:", prompt)
        self.assertIn("Web Artifacts Builder", prompt)
        self.assertIn("Respect these imported skill instructions", prompt)


if __name__ == "__main__":
    unittest.main()
