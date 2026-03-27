from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    RemoteCommand,
    RemoteCommandStatus,
    RemoteCompleteRequest,
    RemoteConfigResponse,
    RemoteDecisionRequest,
    RemoteInboundRequest,
)
from app.services.remote_control import (
    approve_remote_command,
    claim_remote_command,
    complete_remote_command,
    get_remote_config,
    ingest_remote_command,
    list_remote_commands,
    reject_remote_command,
)

router = APIRouter()


@router.get("/config", response_model=RemoteConfigResponse)
async def remote_config():
    return get_remote_config()


@router.get("/commands", response_model=list[RemoteCommand])
async def remote_commands(
    status: RemoteCommandStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    return list_remote_commands(status=status, limit=limit)


@router.post("/commands/inbound", response_model=RemoteCommand)
async def remote_inbound(req: RemoteInboundRequest):
    try:
        return ingest_remote_command(
            channel=req.channel,
            text=req.text,
            secret=req.secret,
            sender=req.sender,
            metadata=req.metadata,
        )
    except ValueError as exc:
        raise HTTPException(403, str(exc)) from exc


@router.post("/commands/{command_id}/approve", response_model=RemoteCommand)
async def remote_approve(command_id: str, req: RemoteDecisionRequest):
    try:
        return approve_remote_command(command_id, actor=req.actor, note=req.note)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/commands/{command_id}/reject", response_model=RemoteCommand)
async def remote_reject(command_id: str, req: RemoteDecisionRequest):
    try:
        return reject_remote_command(command_id, actor=req.actor, note=req.note)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/commands/{command_id}/claim", response_model=RemoteCommand)
async def remote_claim(command_id: str, req: RemoteDecisionRequest):
    try:
        return claim_remote_command(command_id, actor=req.actor)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/commands/{command_id}/complete", response_model=RemoteCommand)
async def remote_complete(command_id: str, req: RemoteCompleteRequest):
    try:
        return complete_remote_command(
            command_id,
            actor=req.actor,
            success=req.success,
            note=req.note,
        )
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
