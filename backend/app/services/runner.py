import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass
from typing import AsyncGenerator, Optional

from app.services.capture import capture_screenshot
from app.services.brain import think_and_act, extract_memory_updates
from app.services.computer_use import is_computer_use_unavailable_error
from app.services.executor import execute
from app.services import browser as browser_svc
from app.models.schemas import AgentAction, ActionType

logger = logging.getLogger(__name__)

STALE_RUN_TTL_SECONDS = 600


@dataclass
class RunState:
    stop_event: asyncio.Event
    task: str
    model: str
    max_steps: int
    capture_interval_ms: int
    reasoning_effort: Optional[str]
    created_at: float
    started: bool = False


_active_runs: dict[str, RunState] = {}

_BROWSER_RECOVERY_ACTIONS = {
    ActionType.BROWSER_CLICK,
    ActionType.BROWSER_TYPE,
    ActionType.BROWSER_SELECT,
    ActionType.BROWSER_SCROLL,
    ActionType.BROWSER_WAIT,
    ActionType.BROWSER_EVAL,
    ActionType.BROWSER_BACK,
}

_DESKTOP_RECOVERY_ACTIONS = {
    ActionType.CLICK,
    ActionType.TYPE,
    ActionType.KEY,
    ActionType.SCROLL,
}


def cleanup_stale_runs() -> None:
    now = time.monotonic()
    stale_run_ids = [
        run_id
        for run_id, state in _active_runs.items()
        if not state.started and (state.stop_event.is_set() or now - state.created_at > STALE_RUN_TTL_SECONDS)
    ]
    for run_id in stale_run_ids:
        _active_runs.pop(run_id, None)


def create_run(task: str, model: str, max_steps: int, capture_interval_ms: int, reasoning_effort: Optional[str] = None) -> str:
    cleanup_stale_runs()
    run_id = str(uuid.uuid4())
    _active_runs[run_id] = RunState(
        stop_event=asyncio.Event(),
        task=task,
        model=model,
        max_steps=max_steps,
        capture_interval_ms=capture_interval_ms,
        reasoning_effort=reasoning_effort,
        created_at=time.monotonic(),
    )
    return run_id


def stop_run(run_id: str) -> bool:
    state = _active_runs.get(run_id)
    if state:
        state.stop_event.set()
        return True
    return False


def is_run_active(run_id: str) -> bool:
    cleanup_stale_runs()
    state = _active_runs.get(run_id)
    return state is not None and not state.stop_event.is_set()


def get_run(run_id: str) -> RunState | None:
    cleanup_stale_runs()
    return _active_runs.get(run_id)


def _fallback_subtask(action: AgentAction) -> str:
    if action.type == ActionType.CLICK:
        return f"Click the right UI element near coordinates ({action.x}, {action.y}) and continue the task."
    if action.type == ActionType.TYPE:
        return f"Enter the required text '{action.text or ''}' into the correct field and continue the task."
    if action.type == ActionType.KEY:
        return f"Use the keyboard shortcut or key '{action.key or ''}' to continue the task."
    if action.type == ActionType.SCROLL:
        return "Scroll the current view to reveal the required content and continue the task."
    return action.reason or "Continue the visible desktop task."


async def _apply_automatic_fallback(
    *,
    action: AgentAction,
    result: dict,
    run_id: str,
    task: str,
    web_task_mode: bool,
) -> dict:
    if result.get("success"):
        return result

    description = str(result.get("description") or "")

    if action.type == ActionType.BROWSER_OPEN:
        fallback = await browser_svc.bootstrap_browser_task(run_id, task)
        if fallback and fallback.get("success"):
            fallback["description"] = (
                f"Browser open failed, so AgentOS switched to a guided live browser workspace for this task. "
                f"Original error: {description}"
            )
            fallback["auto_fallback"] = "browser_bootstrap"
            fallback["failed_action"] = action.type.value
            return fallback
        return result

    if action.type in _BROWSER_RECOVERY_ACTIONS:
        fallback = await browser_svc.browser_snapshot(run_id)
        if fallback.get("success"):
            fallback["description"] = (
                f"Browser action failed, so AgentOS refreshed the live browser context and continued from the current page. "
                f"Original error: {description}"
            )
            fallback["auto_fallback"] = "browser_snapshot"
            fallback["failed_action"] = action.type.value
            return fallback
        return result

    if action.type == ActionType.COMPUTER_USE and web_task_mode:
        fallback = await browser_svc.browser_snapshot(run_id)
        if fallback.get("success"):
            fallback["description"] = (
                "Computer Use was unavailable for this web workflow, so AgentOS kept the task inside the browser and refreshed the live page context."
            )
            fallback["auto_fallback"] = "browser_snapshot"
            fallback["failed_action"] = action.type.value
            return fallback
        return result

    if action.type in _DESKTOP_RECOVERY_ACTIONS and not web_task_mode:
        fallback_action = AgentAction(
            type=ActionType.COMPUTER_USE,
            subtask=_fallback_subtask(action),
            cu_max_iterations=3,
            reason="Automatic fallback from a lower-level desktop control failure",
        )
        fallback = await execute(fallback_action, run_id)
        if fallback.get("success"):
            fallback["description"] = (
                f"Primary desktop action failed, so AgentOS switched to the higher-level Computer Use engine automatically. "
                f"Original error: {description}"
            )
            fallback["auto_fallback"] = "computer_use"
            fallback["failed_action"] = action.type.value
            return fallback

    return result


async def run_agent(
    run_id: str,
    task: str | None = None,
    model: str | None = None,
    max_steps: int | None = None,
    capture_interval_ms: int | None = None,
    reasoning_effort: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    state = _active_runs.get(run_id)
    if not state:
        yield _err("Run not found")
        return

    state.started = True
    stop_event = state.stop_event
    task = task or state.task
    model = model or state.model
    max_steps = max_steps or state.max_steps
    capture_interval_ms = capture_interval_ms or state.capture_interval_ms
    reasoning_effort = reasoning_effort or state.reasoning_effort

    history: list[dict] = []
    memory: dict = {}
    last_tool_result: Optional[dict] = None
    consecutive_errors = 0
    MAX_ERRORS = 3
    interval = capture_interval_ms / 1000.0
    bootstrap_done = False
    web_task_mode = False
    computer_use_blocked_reason: Optional[str] = None

    bootstrap_result = await browser_svc.bootstrap_browser_task(run_id, task)
    if bootstrap_result:
        bootstrap_done = True
        web_task_mode = True
        last_tool_result = bootstrap_result
        bootstrap_screenshot = bootstrap_result.get("screenshot_b64", "")
        if bootstrap_result.get("success"):
            memory["task_surface"] = "browser"
            memory["computer_use_guidance"] = "Use browser_* tools for this task unless a native desktop app is explicitly required."
        history.append({
            "step": 0,
            "action_type": ActionType.BROWSER_OPEN.value,
            "action": bootstrap_result.get("description", "Prepared browser workspace"),
            "result": "ok" if bootstrap_result.get("success") else "failed",
        })
        if bootstrap_result.get("success"):
            yield _event(
                "info",
                0,
                bootstrap_result.get("description", "Prepared browser workspace"),
                "The agent pre-opened the right web workspace so it can continue directly inside the chat instead of spending early steps figuring out which site to open.",
                bootstrap_screenshot,
                memory,
                AgentAction(
                    type=ActionType.BROWSER_OPEN,
                    url=bootstrap_result.get("bootstrap_url") or bootstrap_result.get("url"),
                    reason="Automatic browser bootstrap for a website-oriented task",
                ),
                bootstrap_result,
            )
        else:
            consecutive_errors = 1
            yield _event(
                "info",
                0,
                bootstrap_result.get("description", "Browser bootstrap failed"),
                "Automatic browser bootstrap failed, so the planner will continue in fallback mode.",
                bootstrap_screenshot,
                memory,
                None,
                bootstrap_result,
            )

    for step in range(1, max_steps + 1):
        if stop_event.is_set():
            yield _event("done", step, "Stopped by user", "Agent stopped.", "", memory)
            break

        # ── PERCEIVE: screenshot ──────────────────────────────────────────
        try:
            browser_state = await browser_svc.browser_live_state(run_id)
            if browser_state and browser_state.get("screenshot_b64"):
                screenshot_b64 = browser_state["screenshot_b64"]
            else:
                screenshot_b64 = await asyncio.to_thread(capture_screenshot)
        except Exception as e:
            consecutive_errors += 1
            if consecutive_errors >= MAX_ERRORS:
                yield _err(f"Screen capture failed: {e}"); break
            await asyncio.sleep(1); continue

        # ── PLAN: LLM decides next action ─────────────────────────────────
        if bootstrap_done and step == 1 and last_tool_result and last_tool_result.get("success"):
            browser_text_preview = last_tool_result.get("text_preview")
            if browser_text_preview and "browser_text_preview" not in memory:
                memory["browser_text_preview"] = str(browser_text_preview)[:1200]

        try:
            reasoning, action = await asyncio.to_thread(
                think_and_act,
                task, screenshot_b64, step, max_steps,
                history, memory, model, last_tool_result, reasoning_effort,
            )
        except Exception as e:
            consecutive_errors += 1
            msg = str(e)
            if any(k in msg.lower() for k in ("api_key", "api key", "authentication")):
                yield _err(f"API key error: {msg}"); break
            if consecutive_errors >= MAX_ERRORS:
                yield _err(f"LLM failed {MAX_ERRORS}x: {msg}"); break
            yield _event("step", step, f"LLM error: {msg}", msg, screenshot_b64, memory)
            await asyncio.sleep(2); continue

        # ── ACT ───────────────────────────────────────────────────────────
        last_tool_result = None
        result_desc = "No action parsed"

        if action:
            if action.type == ActionType.DONE:
                yield _event("done", step, action.reason or "Done", reasoning, screenshot_b64, memory)
                break

            if action.type == ActionType.COMPUTER_USE and web_task_mode:
                result = {
                    "success": False,
                    "description": "Computer Use is disabled for this website workflow. Continue with browser_* tools inside the live browser view.",
                    "blocked_action": "computer_use",
                    "fallback": "browser",
                }
            elif action.type == ActionType.COMPUTER_USE and computer_use_blocked_reason:
                result = {
                    "success": False,
                    "description": computer_use_blocked_reason,
                    "blocked_action": "computer_use",
                    "fallback": "browser" if web_task_mode else "desktop",
                }
            else:
                result = await execute(action, run_id)

            result = await _apply_automatic_fallback(
                action=action,
                result=result,
                run_id=run_id,
                task=task,
                web_task_mode=web_task_mode,
            )

            last_tool_result = result
            result_desc = result.get("description", "")

            if result.get("screenshot_b64"):
                screenshot_b64 = result["screenshot_b64"]

            auto_fallback = result.get("auto_fallback")
            if auto_fallback:
                memory["last_recovery_strategy"] = str(auto_fallback)
                if auto_fallback in {"browser_bootstrap", "browser_snapshot"}:
                    web_task_mode = True
                    memory["task_surface"] = "browser"
                    memory["computer_use_guidance"] = (
                        "Stay inside browser_* tools while the live browser workspace is active."
                    )
                if auto_fallback == "computer_use":
                    memory["task_surface"] = "desktop"

            if action.type == ActionType.COMPUTER_USE and is_computer_use_unavailable_error(result_desc):
                computer_use_blocked_reason = (
                    "Computer Use is unavailable for this run because Anthropic billing or API access is not available. "
                    "Do not retry computer_use; continue with browser_* or other available tools."
                )
                memory["computer_use_guidance"] = computer_use_blocked_reason

            if result.get("success"):
                consecutive_errors = 0
            else:
                consecutive_errors += 1
        else:
            consecutive_errors += 1
            result_desc = "Could not parse action from LLM response"

        history.append({
            "step": step,
            "action_type": action.type if action else "none",
            "action": result_desc,
            "result": "ok" if (action and last_tool_result and last_tool_result.get("success")) else "failed",
        })

        # Update memory every 3 steps
        if step % 3 == 0:
            memory = await asyncio.to_thread(
                extract_memory_updates, reasoning, last_tool_result, memory
            )

        yield _event("step", step, result_desc, reasoning, screenshot_b64, memory, action, last_tool_result)

        if consecutive_errors >= MAX_ERRORS:
            yield _err(f"Too many consecutive errors — stopping."); break

        await asyncio.sleep(interval)

    else:
        yield _event("done", max_steps, "Max steps reached", "Exhausted max steps.", "", memory)

    # Cleanup
    await browser_svc.close_session(run_id)
    _active_runs.pop(run_id, None)


def _event(
    type_: str, step: int, action: str, reasoning: str,
    screenshot_b64: str, memory: dict,
    parsed_action: AgentAction = None,
    tool_result: dict = None,
) -> str:
    return "data: " + json.dumps({
        "type": type_, "step": step, "action": action,
        "reasoning": reasoning, "screenshot_b64": screenshot_b64,
        "memory": [{"key": k, "value": str(v)} for k, v in memory.items()],
        "tool_result": tool_result,
        "parsed_action": parsed_action.model_dump() if parsed_action else None,
    }) + "\n\n"


def _err(msg: str) -> str:
    return "data: " + json.dumps({
        "type": "error", "step": 0, "action": msg,
        "reasoning": msg, "screenshot_b64": "",
        "memory": [], "tool_result": None, "parsed_action": None,
    }) + "\n\n"
