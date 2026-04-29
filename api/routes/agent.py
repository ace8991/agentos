"""FastAPI endpoints for the Multi-LLM Agent system.

Endpoints:
  GET  /api/agent/models     — list all supported models
  POST /api/agent/run        — run a task (sync SSE streaming)
  POST /api/agent/run/stream — run a task (SSE streaming)
  POST /api/agent/stop       — stop a running agent
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.agent.core.orchestrator import AgentOrchestrator, OrchestratorConfig
from src.agent.core.registry import get_model, list_models
from src.agent.providers.factory import list_available_models

logger = logging.getLogger("agentos.api.agent")

router = APIRouter(prefix="/api/agent", tags=["agent"])


# ── Request/Response models ───────────────────────────────────────────────────

class AgentRunRequest(BaseModel):
    task: str
    model: str = "claude-sonnet-4-6"
    max_iterations: int = 25
    temperature: float = 0.0
    max_tokens: int = 4096
    system_prompt_extra: str = ""


class AgentStopRequest(BaseModel):
    run_id: str


class AgentModelInfo(BaseModel):
    id: str
    provider: str
    label: str
    computer_use: bool
    vision: bool
    max_context: int


# ── Active runs management ────────────────────────────────────────────────────

@dataclass
class RunState:
    task: str
    model: str
    stop_event: asyncio.Event = field(default_factory=asyncio.Event)
    created_at: float = 0.0


_active_runs: dict[str, RunState] = {}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/models", response_model=list[AgentModelInfo])
async def get_models():
    """List all available models for the agent.

    Returns models from the registry with their capabilities.
    The frontend uses this to populate the model dropdown.
    """
    return list_available_models()


@router.post("/run")
async def run_agent(req: AgentRunRequest):
    """Run an agent task and return streaming SSE events.

    The client receives Server-Sent Events:
      event: start    → {task, model}
      event: thinking → {text}
      event: text     → {text}
      event: tool_call → {name, args}
      event: tool_result → {content, success}
      event: done     → {summary}
      event: error    → {error}
    """
    # Validate model
    model_info = get_model(req.model)
    if not model_info:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model: '{req.model}'. Available models: {[m['id'] for m in list_available_models()]}",
        )

    run_id = str(uuid.uuid4())
    _active_runs[run_id] = RunState(
        task=req.task,
        model=req.model,
        created_at=asyncio.get_event_loop().time(),
    )

    async def event_stream():
        try:
            config = OrchestratorConfig(
                model=req.model,
                max_iterations=min(req.max_iterations, 100),
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                system_prompt_extra=req.system_prompt_extra,
            )
            orchestrator = AgentOrchestrator(config)

            # Check for stop signal before starting
            if _active_runs.get(run_id, None) and _active_runs[run_id].stop_event.is_set():
                yield _sse_event("done", {"summary": "Stopped before starting.", "run_id": run_id})
                return

            async for event in orchestrator.run(req.task):
                # Check stop signal
                run_state = _active_runs.get(run_id)
                if run_state and run_state.stop_event.is_set():
                    yield _sse_event("done", {"summary": "Stopped by user.", "run_id": run_id})
                    return

                event["run_id"] = run_id
                yield _sse_event(event["type"], event)

                if event["type"] == "done":
                    return

        except Exception as e:
            logger.exception("Agent run error")
            yield _sse_event("error", {"error": str(e), "run_id": run_id})
        finally:
            _active_runs.pop(run_id, None)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/run/stream")
async def run_agent_stream(req: AgentRunRequest):
    """Stream raw chunks from the agent loop (lower-level than /run)."""
    model_info = get_model(req.model)
    if not model_info:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model: '{req.model}'",
        )

    run_id = str(uuid.uuid4())
    _active_runs[run_id] = RunState(task=req.task, model=req.model)

    async def event_stream():
        try:
            config = OrchestratorConfig(
                model=req.model,
                max_iterations=min(req.max_iterations, 100),
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                system_prompt_extra=req.system_prompt_extra,
            )
            orchestrator = AgentOrchestrator(config)

            async for chunk in orchestrator.run_stream(req.task):
                yield _sse_event("chunk", {
                    "type": chunk.type,
                    "text": chunk.text,
                    "tool_call_id": chunk.tool_call_id,
                    "tool_name": chunk.tool_name,
                    "tool_args": chunk.tool_args,
                    "error": chunk.error,
                    "run_id": run_id,
                })

                if chunk.type == "done":
                    return

        except Exception as e:
            logger.exception("Agent stream error")
            yield _sse_event("error", {"error": str(e), "run_id": run_id})
        finally:
            _active_runs.pop(run_id, None)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/stop")
async def stop_agent(req: AgentStopRequest):
    """Signal a running agent to stop gracefully."""
    run_state = _active_runs.get(req.run_id)
    if not run_state:
        raise HTTPException(status_code=404, detail=f"Run {req.run_id} not found")
    run_state.stop_event.set()
    return {"status": "stopping", "run_id": req.run_id}


@router.get("/status/{run_id}")
async def agent_status(run_id: str):
    """Check if a run is still active."""
    run_state = _active_runs.get(run_id)
    active = run_state is not None and not run_state.stop_event.is_set()
    return {
        "run_id": run_id,
        "active": active,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sse_event(event_type: str, data: dict) -> str:
    """Format an SSE event."""
    return f"event: {event_type}\ndata: {json.dumps(data, default=str)}\n\n"
