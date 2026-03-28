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
        self.assertIn("Computer Use is disabled for this website workflow", step_events[0]["action"])
        done_events = [event for event in events if event["type"] == "done"]
        self.assertTrue(done_events)


if __name__ == "__main__":
    unittest.main()
