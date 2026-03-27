from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.schemas import StartRequest, StopRequest
from app.services.model_catalog import is_agent_model_supported
from app.services import runner

router = APIRouter()


@router.post("/start")
async def start_agent(req: StartRequest):
    """Create a new agent run and return its run_id."""
    if req.max_steps < 1 or req.max_steps > 100:
        raise HTTPException(400, "max_steps must be between 1 and 100")
    if req.capture_interval_ms < 100:
        raise HTTPException(400, "capture_interval_ms must be >= 100")
    if not is_agent_model_supported(req.model):
        raise HTTPException(400, f"Agent mode does not support model '{req.model}'")

    run_id = runner.create_run(
        task=req.task,
        model=req.model,
        max_steps=req.max_steps,
        capture_interval_ms=req.capture_interval_ms,
        reasoning_effort=req.reasoning_effort,
    )
    return {"run_id": run_id}


@router.post("/stop")
async def stop_agent(req: StopRequest):
    """Signal a running agent to stop gracefully."""
    stopped = runner.stop_run(req.run_id)
    if not stopped:
        raise HTTPException(404, f"Run {req.run_id} not found or already stopped")
    return {"status": "stopping", "run_id": req.run_id}


@router.get("/stream/{run_id}")
async def stream_agent(
    run_id: str,
    task: str | None = None,
    model: str | None = None,
    max_steps: int | None = None,
    capture_interval_ms: int | None = None,
    reasoning_effort: str | None = None,
):
    """
    SSE stream for a given run_id.
    Connect after calling /agent/start.
    Streams: { type, step, action, reasoning, screenshot_b64, memory, parsed_action }
    """
    state = runner.get_run(run_id)
    if not state or not runner.is_run_active(run_id):
        raise HTTPException(404, f"Run {run_id} not found")
    if task is not None and task != state.task:
        raise HTTPException(400, "task must match the values used in /agent/start")
    if model is not None and model != state.model:
        raise HTTPException(400, "model must match the values used in /agent/start")
    if max_steps is not None and max_steps != state.max_steps:
        raise HTTPException(400, "max_steps must match the values used in /agent/start")
    if capture_interval_ms is not None and capture_interval_ms != state.capture_interval_ms:
        raise HTTPException(400, "capture_interval_ms must match the values used in /agent/start")
    if reasoning_effort is not None and reasoning_effort != state.reasoning_effort:
        raise HTTPException(400, "reasoning_effort must match the values used in /agent/start")

    return StreamingResponse(
        runner.run_agent(
            run_id=run_id,
            task=state.task,
            model=state.model,
            max_steps=state.max_steps,
            capture_interval_ms=state.capture_interval_ms,
            reasoning_effort=state.reasoning_effort,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/status/{run_id}")
async def run_status(run_id: str):
    """Check if a run is still active."""
    return {
        "run_id": run_id,
        "active": runner.is_run_active(run_id),
    }
