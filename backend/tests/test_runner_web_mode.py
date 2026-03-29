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

    def test_web_mode_does_not_fall_back_to_desktop_capture(self) -> None:
        run_id = runner.create_run(
            task="verify amazon order history",
            model="gpt-5.4",
            max_steps=2,
            capture_interval_ms=100,
        )

        bootstrap_payload = {
            "success": True,
            "description": "Prepared browser workspace on Amazon order history.",
            "url": "https://www.amazon.com/gp/css/order-history",
            "bootstrap_url": "https://www.amazon.com/gp/css/order-history",
            "bootstrap_source": "amazon-orders",
            "screenshot_b64": "Ym9vdHN0cmFw",
            "text_preview": "Amazon order history",
        }
        snapshot_payload = {
            "success": True,
            "description": "Snapshot of Amazon order history",
            "url": "https://www.amazon.com/gp/css/order-history",
            "title": "Your Orders",
            "screenshot_b64": "c25hcHNob3Q=",
            "text_preview": "Latest Amazon order status",
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
            new=AsyncMock(return_value=None),
        ), patch(
            "app.services.runner.browser_svc.session_exists",
            return_value=True,
        ), patch(
            "app.services.runner.browser_svc.browser_snapshot",
            new=AsyncMock(return_value=snapshot_payload),
        ), patch(
            "app.services.runner.browser_svc.close_session",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.services.runner.capture_screenshot",
            side_effect=AssertionError("desktop capture should not be used in web mode"),
        ), patch(
            "app.services.runner.think_and_act",
            side_effect=[
                (
                    "Continue using the in-app browser session",
                    AgentAction(type=ActionType.DONE, reason="Verified the latest order in-browser."),
                ),
            ],
        ):
            events = asyncio.run(collect_events())

        done_events = [event for event in events if event["type"] == "done"]
        self.assertTrue(done_events)

    def test_runner_waits_for_browser_frame_instead_of_failing_immediately(self) -> None:
        run_id = runner.create_run(
            task="verify amazon order history",
            model="gpt-5.4",
            max_steps=3,
            capture_interval_ms=100,
        )

        bootstrap_payload = {
            "success": False,
            "description": "Navigation committed, waiting for the first in-app frame.",
        }
        snapshot_payload = {
            "success": True,
            "description": "Snapshot of Amazon sign-in",
            "url": "https://www.amazon.com/ap/signin",
            "title": "Amazon Sign-In",
            "screenshot_b64": "c25hcHNob3Q=",
            "text_preview": "Amazon sign-in page",
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
            "app.services.runner.browser_svc.session_exists",
            return_value=True,
        ), patch(
            "app.services.runner.browser_svc.browser_live_state",
            new=AsyncMock(side_effect=[None, None, {"screenshot_b64": "c25hcHNob3Q="}]),
        ), patch(
            "app.services.runner.browser_svc.browser_snapshot",
            new=AsyncMock(side_effect=[
                {"success": False, "description": "Still synchronizing browser frame"},
                snapshot_payload,
            ]),
        ), patch(
            "app.services.runner.browser_svc.close_session",
            new=AsyncMock(return_value=None),
        ), patch(
            "app.services.runner.capture_screenshot",
            side_effect=AssertionError("desktop capture should not be used while browser session is synchronizing"),
        ), patch(
            "app.services.runner.think_and_act",
            side_effect=[
                (
                    "Review the Amazon page once it appears",
                    AgentAction(type=ActionType.DONE, reason="The browser frame synchronized successfully."),
                ),
            ],
        ):
            events = asyncio.run(collect_events())

        error_events = [event for event in events if event["type"] == "error"]
        self.assertFalse(error_events)
        done_events = [event for event in events if event["type"] == "done"]
        self.assertTrue(done_events)

    def test_browser_first_task_blocks_computer_use_even_if_bootstrap_raises(self) -> None:
        run_id = runner.create_run(
            task="verifier ma derniere commande sur amazone",
            model="gpt-5.4",
            max_steps=3,
            capture_interval_ms=100,
        )

        snapshot_payload = {
            "success": True,
            "description": "Recovered browser snapshot after a failed bootstrap.",
            "url": "https://www.amazon.com/gp/css/order-history",
            "title": "Amazon Orders",
            "screenshot_b64": "c25hcHNob3Q=",
            "text_preview": "Latest Amazon order page",
        }

        async def collect_events():
            events = []
            async for chunk in runner.run_agent(run_id):
                payload = json.loads(chunk.removeprefix("data: ").strip())
                events.append(payload)
            return events

        with patch(
            "app.services.runner.browser_svc.bootstrap_browser_task",
            new=AsyncMock(side_effect=NotImplementedError()),
        ), patch(
            "app.services.runner.browser_svc.session_exists",
            return_value=True,
        ), patch(
            "app.services.runner.browser_svc.browser_live_state",
            new=AsyncMock(return_value={"screenshot_b64": "c25hcHNob3Q="}),
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
                    "Try computer use",
                    AgentAction(type=ActionType.COMPUTER_USE, subtask="inspect latest order"),
                ),
                (
                    "Done after staying in-browser",
                    AgentAction(type=ActionType.DONE, reason="Verified the latest order from the browser workspace."),
                ),
            ],
        ), patch(
            "app.services.runner.execute",
            new=AsyncMock(side_effect=AssertionError("execute() should not run blocked computer_use")),
        ):
            events = asyncio.run(collect_events())

        info_events = [event for event in events if event["type"] == "info"]
        self.assertTrue(info_events)
        self.assertIn("Browser bootstrap failed", info_events[0]["action"])

        step_events = [event for event in events if event["type"] == "step"]
        self.assertTrue(step_events)
        self.assertIn("kept the task inside the browser", step_events[0]["action"])
        self.assertEqual(step_events[0]["tool_result"].get("auto_fallback"), "browser_snapshot")

        done_events = [event for event in events if event["type"] == "done"]
        self.assertTrue(done_events)


if __name__ == "__main__":
    unittest.main()
