"""
FastAPI route for the agent.

Endpoints:
  GET  /api/agent/models        — list all available models for UI dropdown
  POST /api/agent/run           — run a task synchronously (blocks until done)
  POST /api/agent/run/stream    — stream the task as Server-Sent Events
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.agent.core.orchestrator import AgentOrchestrator
from src.agent.core.registry import (
    MODEL_REGISTRY,
    get_model,
    list_models_for_ui,
)
from src.agent.providers.factory import make_provider
from src.agent.tools.base import build_default_registry

logger = logging.getLogger("agentos.api.agent")
router = APIRouter(prefix="/api/agent", tags=["agent"])


# Default system prompt for the agent
DEFAULT_SYSTEM_PROMPT = """You are AgentOS, an autonomous desktop assistant running on the user's Windows PC.

You can:
- Read the screen via screenshots
- Read the Windows UI Automation tree (read_ui_tree) to see element IDs and names
- Click UI elements by ID (click_element) — preferred over raw pixel clicks
- Type text into fields (type_in_field, keyboard_type)
- Press key combinations (keyboard_press) — examples: "win+r", "ctrl+s", "alt+tab"
- Move/click the mouse (mouse_move, mouse_click, mouse_drag, mouse_scroll)
- Create/read files (file_create, file_read)
- Run shell commands (shell)

WORKFLOW (semantic mode — non-Claude models):
1. Take a screenshot to understand the current state
2. Call read_ui_tree to get the structured list of UI elements
3. Use click_element/type_in_field with element IDs (NOT pixel coordinates)
4. After each action, take a new screenshot or re-read the tree to verify

WORKFLOW (Claude with computer tool):
- Use the `computer` tool directly with pixel coordinates — Claude is trained for this

SAFETY:
- ALWAYS confirm with the user before: downloads, purchases, deletions, financial actions
- If you're unsure what the user wants, ask before acting
- Stop and report if something looks wrong (unexpected dialog, error message)

Be concise. After completing the task, briefly summarize what you did."""


# ─────────────────────────────────────────────────────────────────
# Request/response models
# ─────────────────────────────────────────────────────────────────

class AgentRunRequest(BaseModel):
    task: str = Field(..., description="Natural language task description")
    model: str = Field(..., description="Model ID from /api/agent/models")
    max_iterations: int = Field(25, ge=1, le=100)
    system_prompt: str | None = None
    display_width: int = 1920
    display_height: int = 1080


class StepDTO(BaseModel):
    iteration: int
    timestamp: float
    text: str
    reasoning: str | None = None
    tool_calls: list[dict]
    tool_results: list[dict]
    finish_reason: str
    has_screenshot: bool


# ─────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────

@router.get("/models")
async def list_models():
    """List all models available to the agent (for the UI dropdown)."""
    return {"models": list_models_for_ui()}


@router.post("/run")
async def run_agent(req: AgentRunRequest):
    """Run the agent synchronously. Returns the full step history."""
    try:
        model = get_model(req.model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    provider = make_provider(
        model,
        display_width=req.display_width,
        display_height=req.display_height,
    ) if model.provider == "anthropic" else make_provider(model)

    tools = build_default_registry()

    orchestrator = AgentOrchestrator(
        provider=provider,
        model=model,
        tools=tools,
        system_prompt=req.system_prompt or DEFAULT_SYSTEM_PROMPT,
        max_iterations=req.max_iterations,
    )

    steps = await orchestrator.run(req.task)

    return {
        "model": req.model,
        "iterations": len(steps),
        "final_text": steps[-1].response.text if steps else "",
        "steps": [_step_to_dto(s) for s in steps],
    }


@router.post("/run/stream")
async def run_agent_stream(req: AgentRunRequest):
    """Stream agent execution as Server-Sent Events (SSE)."""
    try:
        model = get_model(req.model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    provider = make_provider(
        model,
        display_width=req.display_width,
        display_height=req.display_height,
    ) if model.provider == "anthropic" else make_provider(model)

    tools = build_default_registry()

    async def event_generator():
        orchestrator = AgentOrchestrator(
            provider=provider,
            model=model,
            tools=tools,
            system_prompt=req.system_prompt or DEFAULT_SYSTEM_PROMPT,
            max_iterations=req.max_iterations,
        )

        try:
            async for step in orchestrator.run_stream(req.task):
                payload = _step_to_dto(step).model_dump()
                yield f"event: step\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                # Cooperative cancel point
                await asyncio.sleep(0)
            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            logger.exception("Stream error")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def _step_to_dto(step) -> StepDTO:
    return StepDTO(
        iteration=step.iteration,
        timestamp=step.timestamp,
        text=step.response.text,
        reasoning=step.response.reasoning,
        tool_calls=[
            {"id": tc.id, "name": tc.name, "arguments": tc.arguments}
            for tc in step.response.tool_calls
        ],
        tool_results=[
            {
                "tool_call_id": tr.tool_call_id,
                "content": tr.content if not tr.image else "[image]",
                "is_error": tr.is_error,
                "has_image": tr.image is not None,
            }
            for tr in step.tool_results
        ],
        finish_reason=step.response.finish_reason,
        has_screenshot=step.screenshot_before is not None,
    )
