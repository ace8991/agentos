from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    OpenClawChannelUpdateRequest,
    OpenClawDeviceUpdateRequest,
    OpenClawGatewayUpdateRequest,
    OpenClawPairRequest,
    OpenClawState,
    OpenClawOverlayUpdateRequest,
)
from app.services.openclaw_hub import (
    create_pairing_session,
    get_openclaw_state,
    update_channel,
    update_device,
    update_gateway,
    update_overlays,
)

router = APIRouter(prefix="/openclaw", tags=["openclaw"])


@router.get("/state", response_model=OpenClawState)
async def openclaw_state():
    return get_openclaw_state()


@router.post("/pair", response_model=OpenClawState)
async def openclaw_pair(req: OpenClawPairRequest):
    return create_pairing_session(req.name, req.platform, req.role)


@router.post("/gateway", response_model=OpenClawState)
async def openclaw_update_gateway(req: OpenClawGatewayUpdateRequest):
    return update_gateway(req.model_dump())


@router.post("/overlays", response_model=OpenClawState)
async def openclaw_update_overlays(req: OpenClawOverlayUpdateRequest):
    return update_overlays(req.model_dump())


@router.post("/channels/{channel_id}", response_model=OpenClawState)
async def openclaw_update_channel(channel_id: str, req: OpenClawChannelUpdateRequest):
    return update_channel(channel_id, enabled=req.enabled, secret=req.secret)


@router.post("/devices/{device_id}", response_model=OpenClawState)
async def openclaw_update_device(device_id: str, req: OpenClawDeviceUpdateRequest):
    state = get_openclaw_state()
    if not any(device.id == device_id for device in state.devices):
        raise HTTPException(404, "Device not found")
    return update_device(device_id, req.model_dump())
