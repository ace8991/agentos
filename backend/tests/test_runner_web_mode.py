from __future__ import annotations

import asyncio
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.schemas import AgentAction, ActionType
from app.services import runner


class RunnerWebModeTests(unittest.TestCase):
    def tearDown(self) -> None:
        runner._active_runs.clear()

    def test_web_bootstrap_blocks_computer_use(self) -> None:
        run_id = runner.create_run(
            task="verify my latest amazon order",
            model="gpt-4o",
            max_steps=3,
            capture_interval_ms=100,
        )

        bootstrap_payload = {
            "success": True,
            "description": "Prepared browser workspace on Amazon order history.",
            "url": "https://www.amazon.com/gp/css/order-history",
            "bootstrap_url": "https://www.amazon.com/gp/css/order-history",
            "bootstrap_source": "amazon-orders",
            "screenshot_b64": "ZmFrZQ==",
            "text_preview": "Amazon order history page",
        }

        async def collect_events():
            events = []
            async for chunk in runner.run_agent(run_id):
                payload = json.loads(chunk.removeprefix("data: ").strip())
                events.append(payload)
            return events

        with patch(
            "app.services.runner.browser_svc.bootstrap_browser_task",
            new=AsyncMock(return_value=bootstrap_payload),
        ), patch(
            "app.services.runner.browser_svc.browser_live_state",
            new=AsyncMock(return_value={"screenshot_b64": "ZmFrZQ=="}),
        ), patch(
            "app.services.runner.browser_svc.close_session",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.services.runner.think_and_act",
            side_effect=[
                (
                    "Trying desktop controls first",
                    AgentAction(type=ActionType.COMPUTER_USE, subtask="inspect order status"),
                ),
                (
                    "Done after using browser flow",
                    AgentAction(type=ActionType.DONE, reason="Verified the latest order."),
                ),
            ],
        ), patch(
            "app.services.runner.execute",
            new=AsyncMock(side_effect=AssertionError("execute() should not be called for blocked computer_use")),
        ):
            events = asyncio.run(collect_events())

        step_events = [event for event in events if event["type"] == "step"]
        self.assertTrue(step_events)
        self.assertIn("kept the task inside the browser", step_events[0]["action"])
        self.assertEqual(step_events[0]["tool_result"].get("auto_fallback"), "browser_snapshot")
        done_events = [event for event in events if event["type"] == "done"]
        self.assertTrue(done_events)

    def test_browser_action_failure_falls_back_to_live_snapshot(self) -> None:
        run_id = runner.create_run(
            task="check a product page on amazon",
            model="gpt-5.4",
            max_steps=3,
            capture_interval_ms=100,
        )

        bootstrap_payload = {
            "success": True,
            "description": "Prepared browser workspace on Amazon.",
            "url": "https://www.amazon.com/",
            "bootstrap_url": "https://www.amazon.com/",
            "bootstrap_source": "amazon",
            "screenshot_b64": "Ym9vdHN0cmFw",
            "text_preview": "Amazon homepage",
        }
        snapshot_payload = {
            "success": True,
            "description": "Browser action failed, so AgentOS refreshed the live browser context and stayed inside the chat workspace. Original error: selector not found",
            "url": "https://www.amazon.com/s?k=gift",
            "title": "Amazon search",
            "screenshot_b64": "c25hcHNob3Q=",
            "text_preview": "Search results page",
        }

        async def collect_events():
            events = []
            async for chunk in runner.run_agent(run_id):
                payload = json.loads(chunk.removeprefix("data: ").strip())
                events.append(payload)
            return events

        execute_mock = AsyncMock(
            side_effect=[
                {"success": False, "description": "selector not found"},
            ]
        )

        with patch(
            "app.services.runner.browser_svc.bootstrap_browser_task",
            new=AsyncMock(return_value=bootstrap_payload),
        ), patch(
            "app.services.runner.browser_svc.browser_live_state",
            new=AsyncMock(return_value={"screenshot_b64": "c2NyZWVu"}),
        ), patch(
            "app.services.runner.browser_svc.browser_snapshot",
            new=AsyncMock(return_value=snapshot_payload),
        ), patch(
            "app.services.runner.browser_svc.close_session",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.services.runner.think_and_act",
            side_effect=[
                (
                    "Click the first relevant result",
                    AgentAction(type=ActionType.BROWSER_CLICK, selector='a[data-testid="result-link"]'),
                ),
                (
                    "Summarize what was found",
                    AgentAction(type=ActionType.DONE, reason="Captured the product page context."),
                ),
            ],
        ), patch(
            "app.services.runner.execute",
            new=execute_mock,
        ):
            events = asyncio.run(collect_events())

        self.assertEqual(execute_mock.await_count, 1)
        step_events = [event for event in events if event["type"] == "step"]
        self.assertTrue(step_events)
        self.assertIn("refreshed the live browser context", step_events[0]["action"])
        self.assertEqual(step_events[0]["tool_result"].get("auto_fallback"), "browser_snapshot")
        done_events = [event for event in events if event["type"] == "done"]
        self.assertTrue(done_events)


if __name__ == "__main__":
    unittest.main()
