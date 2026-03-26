import asyncio, json, logging, uuid
from typing import AsyncGenerator, Optional
from app.services.capture import capture_screenshot
from app.services.brain import think_and_act, extract_memory_updates
from app.services.executor import execute
from app.services import browser as browser_svc
from app.models.schemas import AgentAction, ActionType

logger = logging.getLogger(__name__)

_active_runs: dict[str, asyncio.Event] = {}


def create_run() -> str:
    run_id = str(uuid.uuid4())
    _active_runs[run_id] = asyncio.Event()
    return run_id


def stop_run(run_id: str) -> bool:
    if run_id in _active_runs:
        _active_runs[run_id].set()
        return True
    return False


def is_run_active(run_id: str) -> bool:
    return run_id in _active_runs and not _active_runs[run_id].is_set()


async def run_agent(
    run_id: str,
    task: str,
    model: str,
    max_steps: int,
    capture_interval_ms: int,
) -> AsyncGenerator[str, None]:
    stop_event = _active_runs.get(run_id)
    if not stop_event:
        yield _err("Run not found"); return

    history: list[dict] = []
    memory: dict = {}
    last_tool_result: Optional[dict] = None
    consecutive_errors = 0
    MAX_ERRORS = 3
    interval = capture_interval_ms / 1000.0

    for step in range(1, max_steps + 1):
        if stop_event.is_set():
            yield _event("done", step, "Stopped by user", "Agent stopped.", "", memory)
            break

        # ── PERCEIVE: screenshot ──────────────────────────────────────────
        try:
            screenshot_b64 = await asyncio.to_thread(capture_screenshot)
        except Exception as e:
            consecutive_errors += 1
            if consecutive_errors >= MAX_ERRORS:
                yield _err(f"Screen capture failed: {e}"); break
            await asyncio.sleep(1); continue

        # ── PLAN: LLM decides next action ─────────────────────────────────
        try:
            reasoning, action = await asyncio.to_thread(
                think_and_act,
                task, screenshot_b64, step, max_steps,
                history, memory, model, last_tool_result,
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

            result = await execute(action, run_id)
            last_tool_result = result
            result_desc = result.get("description", "")

            # If browser_snapshot returned a screenshot, use it as the current frame
            if action.type == ActionType.BROWSER_SNAPSHOT and result.get("screenshot_b64"):
                screenshot_b64 = result["screenshot_b64"]

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
