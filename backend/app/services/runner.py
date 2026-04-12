import asyncio
import json
import logging
import re
import time
import uuid
from dataclasses import dataclass
from typing import AsyncGenerator, Optional

from app.services.capture import capture_screenshot
from app.services.brain import think_and_act, extract_memory_updates
from app.services.computer_use import is_computer_use_unavailable_error
from app.services.executor import execute
from app.services import browser as browser_svc, execution
from app.models.schemas import AgentAction, ActionType

logger = logging.getLogger(__name__)

STALE_RUN_TTL_SECONDS = 600
BROWSER_FRAME_SYNC_RETRIES = 4
BROWSER_FRAME_SYNC_DELAY_SECONDS = 0.35


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


def _humanize_action(action_type: ActionType) -> str:
    labels = {
        ActionType.FILE_SEARCH: "Search local files",
        ActionType.FILE_READ: "Read file",
        ActionType.FILE_WRITE: "Write file",
        ActionType.FILE_APPEND: "Append file",
        ActionType.DIR_LIST: "List folder",
        ActionType.DIR_CREATE: "Create folder",
        ActionType.DIR_DELETE: "Delete folder",
        ActionType.BROWSER_OPEN: "Open browser page",
        ActionType.BROWSER_CLICK: "Interact with page",
        ActionType.BROWSER_TYPE: "Type in browser",
        ActionType.BROWSER_SELECT: "Select browser option",
        ActionType.BROWSER_SNAPSHOT: "Refresh browser view",
        ActionType.WEB_SEARCH: "Search the web",
        ActionType.WEB_EXTRACT: "Extract web page",
        ActionType.SHELL: "Run terminal command",
        ActionType.COMPUTER_USE: "Use desktop automation",
        ActionType.SYSTEM_INFO: "Read system information",
        ActionType.PROCESS_LIST: "Read process list",
        ActionType.TERMINAL_OPEN: "Open terminal",
    }
    return labels.get(action_type, action_type.value.replace("_", " ").title())


def _is_browser_first_task(task: str | None) -> bool:
    return bool(task and browser_svc.infer_browser_bootstrap(task))


def _is_local_file_task(task: str | None) -> bool:
    if not task:
        return False
    lowered = task.lower()
    return any(
        keyword in lowered
        for keyword in (
            "file",
            "fichier",
            "document",
            "folder",
            "dossier",
            "documents",
            "downloads",
            "desktop",
            "bureau",
            "passport",
            "passeport",
            ".pdf",
            ".doc",
            ".docx",
            ".xlsx",
            ".csv",
        )
    )


def _has_file_activity(history: list[dict]) -> bool:
    file_actions = {
        "file_search",
        "file_read",
        "file_write",
        "file_append",
        "file_delete",
        "file_move",
        "file_copy",
        "file_exists",
        "dir_list",
        "dir_create",
        "dir_delete",
    }
    return any(item.get("action_type") in file_actions for item in history)


def _infer_file_query(task: str) -> str:
    if not task:
        return "document"
    lowered = task.lower()
    match = re.search(r"([\\w\\-.]+\\.(pdf|docx|doc|txt|csv|xlsx))", lowered)
    if match:
        return match.group(1)
    keywords = [
        "passport",
        "passeport",
        "invoice",
        "facture",
        "cv",
        "resume",
        "contrat",
        "contract",
        "receipt",
        "order",
        "commande",
    ]
    for keyword in keywords:
        if keyword in lowered:
            return keyword
    cleaned = re.sub(r"[^a-z0-9\\s-]", " ", lowered)
    tokens = [
        t
        for t in cleaned.split()
        if t
        not in {
            "find",
            "search",
            "read",
            "open",
            "file",
            "files",
            "document",
            "documents",
            "fichier",
            "dossier",
            "folder",
            "mon",
            "ma",
            "mes",
            "sur",
            "dans",
            "de",
        }
    ]
    return " ".join(tokens[:3]) if tokens else "document"


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


async def _acquire_browser_screenshot(
    *,
    run_id: str,
    last_screenshot_b64: str,
    web_task_mode: bool,
) -> tuple[str, Optional[dict], bool]:
    browser_mode = browser_svc.session_exists(run_id)
    recovery_state: Optional[dict] = None

    if not browser_mode:
        if web_task_mode and last_screenshot_b64:
            return last_screenshot_b64, None, True
        return "", None, False

    for attempt in range(BROWSER_FRAME_SYNC_RETRIES):
        live_state = await browser_svc.browser_live_state(run_id)
        if live_state and live_state.get("screenshot_b64"):
            return str(live_state["screenshot_b64"]), live_state, True

        recovery_state = await browser_svc.browser_snapshot(run_id)
        if recovery_state.get("screenshot_b64"):
            return str(recovery_state["screenshot_b64"]), recovery_state, True

        if attempt < BROWSER_FRAME_SYNC_RETRIES - 1:
            await asyncio.sleep(BROWSER_FRAME_SYNC_DELAY_SECONDS)

    if last_screenshot_b64:
        return last_screenshot_b64, recovery_state, True

    return "", recovery_state, True


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
    execution.mark_run_started(run_id)
    stop_event = state.stop_event
    task = task or state.task
    primary_task = browser_svc.extract_primary_task(task)
    model = model or state.model
    max_steps = max_steps or state.max_steps
    capture_interval_ms = capture_interval_ms or state.capture_interval_ms
    reasoning_effort = reasoning_effort or state.reasoning_effort

    history: list[dict] = []
    memory: dict = {}
    last_tool_result: Optional[dict] = None
    last_screenshot_b64 = ""
    consecutive_errors = 0
    MAX_ERRORS = 3
    interval = capture_interval_ms / 1000.0
    bootstrap_done = False
    web_task_mode = _is_browser_first_task(primary_task)
    computer_use_blocked_reason: Optional[str] = None

    if web_task_mode:
        memory["task_surface"] = "browser"
        memory["computer_use_guidance"] = (
            "This is a browser-first task. Keep the workflow inside browser_* tools and the in-app live browser view."
        )

    try:
        bootstrap_result = await browser_svc.bootstrap_browser_task(run_id, primary_task)
        if bootstrap_result:
            bootstrap_done = True
            web_task_mode = True
            last_tool_result = bootstrap_result
            bootstrap_screenshot = bootstrap_result.get("screenshot_b64", "")
            last_screenshot_b64 = bootstrap_screenshot or last_screenshot_b64
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
                execution.record_info_step(
                    run_id,
                    step_number=0,
                    title="Prepare browser workspace",
                    description=bootstrap_result.get("description", "Prepared browser workspace"),
                )
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
                execution.record_info_step(
                    run_id,
                    step_number=0,
                    title="Browser bootstrap warning",
                    description=bootstrap_result.get("description", "Browser bootstrap failed"),
                )
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
    except Exception as exc:
        logger.exception("Browser bootstrap failed for run %s", run_id)
        execution.record_info_step(
            run_id,
            step_number=0,
            title="Browser bootstrap warning",
            description=f"Browser bootstrap failed: {exc or exc.__class__.__name__}",
        )
        yield _event(
            "info",
            0,
            f"Browser bootstrap failed: {exc or exc.__class__.__name__}",
            "AgentOS could not prepare the browser workspace immediately, so it will retry during the live run.",
            "",
            memory,
        )

    for step in range(1, max_steps + 1):
        if stop_event.is_set():
            execution.finish_run(
                run_id,
                status=execution.ExecutionStatus.STOPPED,
                outcome="Run stopped by the user.",
                validated=False,
            )
            yield _event("done", step, "Stopped by user", "Agent stopped.", "", memory)
            break

        # ── PERCEIVE: screenshot ──────────────────────────────────────────
        try:
            browser_session_ready = browser_svc.session_exists(run_id)
            if web_task_mode or browser_session_ready:
                if not browser_session_ready and primary_task:
                    recovery_state = await browser_svc.bootstrap_browser_task(run_id, primary_task)
                    if recovery_state:
                        last_tool_result = recovery_state
                        if recovery_state.get("screenshot_b64"):
                            last_screenshot_b64 = recovery_state["screenshot_b64"]
                        if recovery_state.get("success"):
                            web_task_mode = True
                            memory["task_surface"] = "browser"
                            memory["computer_use_guidance"] = (
                                "Use browser_* tools for this task unless a native desktop app is explicitly required."
                            )

                screenshot_b64, recovery_state, browser_mode_active = await _acquire_browser_screenshot(
                    run_id=run_id,
                    last_screenshot_b64=last_screenshot_b64,
                    web_task_mode=web_task_mode,
                )
                if browser_mode_active:
                    web_task_mode = True
                    memory["task_surface"] = "browser"

                if screenshot_b64:
                    last_screenshot_b64 = screenshot_b64
                    if recovery_state and recovery_state.get("success"):
                        last_tool_result = recovery_state
                else:
                    status_message = "Live browser workspace is synchronizing..."
                    if recovery_state and recovery_state.get("description"):
                        status_message = str(recovery_state.get("description"))
                    yield _event(
                        "info",
                        step,
                        status_message,
                        "AgentOS is waiting for the in-app browser frame to become available before continuing the next browser step.",
                        last_screenshot_b64,
                        memory,
                    )
                    await asyncio.sleep(max(interval, BROWSER_FRAME_SYNC_DELAY_SECONDS))
                    continue
            else:
                screenshot_b64 = await asyncio.to_thread(capture_screenshot)
                last_screenshot_b64 = screenshot_b64
        except Exception as e:
            consecutive_errors += 1
            if consecutive_errors >= MAX_ERRORS:
                execution.finish_run(
                    run_id,
                    status=execution.ExecutionStatus.ERROR,
                    outcome=f"Screen capture failed: {e}",
                    validated=False,
                )
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
                primary_task, screenshot_b64, step, max_steps,
                history, memory, model, last_tool_result, reasoning_effort,
            )
        except Exception as e:
            consecutive_errors += 1
            msg = str(e)
            if any(k in msg.lower() for k in ("api_key", "api key", "authentication")):
                execution.finish_run(
                    run_id,
                    status=execution.ExecutionStatus.ERROR,
                    outcome=f"API key error: {msg}",
                    validated=False,
                )
                yield _err(f"API key error: {msg}"); break
            if consecutive_errors >= MAX_ERRORS:
                execution.finish_run(
                    run_id,
                    status=execution.ExecutionStatus.ERROR,
                    outcome=f"LLM failed {MAX_ERRORS} times: {msg}",
                    validated=False,
                )
                yield _err(f"LLM failed {MAX_ERRORS}x: {msg}"); break
            yield _event("step", step, f"LLM error: {msg}", msg, screenshot_b64, memory)
            await asyncio.sleep(2); continue

        # ── ACT ───────────────────────────────────────────────────────────
        last_tool_result = None
        result_desc = "No action parsed"

        try:
            if action:
                if (
                    action.type == ActionType.DONE
                    and _is_local_file_task(primary_task)
                    and not _has_file_activity(history)
                ):
                    action = AgentAction(
                        type=ActionType.FILE_SEARCH,
                        query=_infer_file_query(primary_task),
                        reason="Local file task requires a real file search before finishing.",
                    )

                if action.type == ActionType.DONE:
                    execution.finish_run(
                        run_id,
                        status=execution.ExecutionStatus.COMPLETED,
                        outcome=action.reason or "Task completed.",
                        validated=True,
                    )
                    yield _event("done", step, action.reason or "Done", reasoning, screenshot_b64, memory)
                    break

                action_arguments = {
                    key: value
                    for key, value in action.model_dump().items()
                    if value is not None and key != "reason"
                }
                execution.begin_tool_step(
                    run_id,
                    step_number=step,
                    action_type=action.type.value,
                    title=_humanize_action(action.type),
                    description=action.reason or reasoning or _humanize_action(action.type),
                    arguments=action_arguments,
                )

                if action.type == ActionType.COMPUTER_USE and web_task_mode:
                    result = {
                        "success": False,
                        "description": "Computer Use is disabled for this website workflow. Stay inside the in-app browser workspace and continue with browser_* tools only.",
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
                    task=primary_task,
                    web_task_mode=web_task_mode,
                )

                last_tool_result = result
                result_desc = result.get("description", "")

                if result.get("screenshot_b64"):
                    screenshot_b64 = result["screenshot_b64"]
                    last_screenshot_b64 = screenshot_b64

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

                execution.complete_tool_step(
                    run_id,
                    step_number=step,
                    result_summary=result_desc,
                    success=bool(result.get("success")),
                    workspace_id=str(result.get("workspace_id")) if result.get("workspace_id") else None,
                )
            else:
                consecutive_errors += 1
                result_desc = "Could not parse action from LLM response"
        except Exception as exc:
            logger.exception("Agent action failed unexpectedly for run %s", run_id)
            consecutive_errors += 1
            result_desc = f"Agent action failed unexpectedly: {exc}"
            last_tool_result = {
                "success": False,
                "description": result_desc,
            }
            execution.complete_tool_step(
                run_id,
                step_number=step,
                result_summary=result_desc,
                success=False,
            )

        history.append({
            "step": step,
            "action_type": action.type.value if action else "none",
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
            execution.finish_run(
                run_id,
                status=ExecutionStatus.ERROR,
                outcome="Execution stopped after too many consecutive tool failures.",
                validated=False,
                next_step="Review the failing step details and retry with adjusted permissions or a narrower task.",
            )
            yield _err("Too many consecutive errors - stopping.")
            break

        await asyncio.sleep(interval)

    else:
        execution.finish_run(
            run_id,
            status=ExecutionStatus.ERROR,
            outcome="Execution stopped because the run reached the configured maximum number of steps.",
            validated=False,
            next_step="Increase the step limit or break the request into smaller tasks.",
        )
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
    }, default=str) + "\n\n"


def _err(msg: str) -> str:
    return "data: " + json.dumps({
        "type": "error", "step": 0, "action": msg,
        "reasoning": msg, "screenshot_b64": "",
        "memory": [], "tool_result": None, "parsed_action": None,
    }, default=str) + "\n\n"
