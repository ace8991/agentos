from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.schemas import StartRequest, StopRequest
from app.services import runner

router = APIRouter()


@router.post("/start")
async def start_agent(req: StartRequest):
    """Create a new agent run and return its run_id."""
    if req.max_steps < 1 or req.max_steps > 100:
        raise HTTPException(400, "max_steps must be between 1 and 100")
    if req.capture_interval_ms < 100:
        raise HTTPException(400, "capture_interval_ms must be >= 100")

    run_id = runner.create_run()
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
    task: str,
    model: str = "claude-sonnet-4-6",
    max_steps: int = 20,
    capture_interval_ms: int = 1000,
):
    """
    SSE stream for a given run_id.
    Connect after calling /agent/start.
    Streams: { type, step, action, reasoning, screenshot_b64, memory, parsed_action }
    """
    if not runner.is_run_active(run_id):
        raise HTTPException(404, f"Run {run_id} not found")

    return StreamingResponse(
        runner.run_agent(
            run_id=run_id,
            task=task,
            model=model,
            max_steps=max_steps,
            capture_interval_ms=capture_interval_ms,
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
