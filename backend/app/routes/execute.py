from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import (
    ExecutionPlanRequest,
    ExecutionRunRequest,
    ExecutionStatus,
    ExecutionStepsResponse,
)
from app.services import execution, runner
from app.services.model_catalog import is_agent_model_supported

router = APIRouter(prefix="/execute", tags=["execute"])


@router.post("/plan")
async def create_execution_plan(req: ExecutionPlanRequest):
    return execution.create_execution_plan(req)


@router.post("/runs")
async def create_execution_run(req: ExecutionRunRequest):
    if req.max_steps < 1 or req.max_steps > 100:
        raise HTTPException(400, "max_steps must be between 1 and 100")
    if req.capture_interval_ms < 100:
        raise HTTPException(400, "capture_interval_ms must be >= 100")
    if not is_agent_model_supported(req.model):
        raise HTTPException(400, f"Execution mode does not support model '{req.model}'")

    run_id = runner.create_run(
        task=req.task,
        model=req.model,
        max_steps=req.max_steps,
        capture_interval_ms=req.capture_interval_ms,
        reasoning_effort=req.reasoning_effort,
    )
    record = execution.create_run_record(
        run_id=run_id,
        task=req.task,
        model=req.model,
        max_steps=req.max_steps,
        capture_interval_ms=req.capture_interval_ms,
        reasoning_effort=req.reasoning_effort,
    )
    return record


@router.get("/runs/{run_id}")
async def get_execution_run(run_id: str):
    record = execution.get_run_record(run_id)
    if not record:
        raise HTTPException(404, "Run not found")
    active = runner.is_run_active(run_id)
    if record.status == ExecutionStatus.PLANNING and active:
        record.status = ExecutionStatus.RUNNING
    record.active = active
    return record


@router.get("/runs/{run_id}/steps", response_model=ExecutionStepsResponse)
async def get_execution_steps(run_id: str):
    record = execution.get_run_record(run_id)
    if not record:
        raise HTTPException(404, "Run not found")
    return ExecutionStepsResponse(run_id=run_id, steps=execution.list_run_steps(run_id))


@router.get("/runs/{run_id}/stream")
async def stream_execution_run(run_id: str):
    state = runner.get_run(run_id)
    if not state or not runner.is_run_active(run_id):
        raise HTTPException(404, f"Run {run_id} not found")

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
