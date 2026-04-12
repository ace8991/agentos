from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    MobileHubChannelUpdateRequest,
    MobileHubDeviceUpdateRequest,
    MobileHubGatewayUpdateRequest,
    MobileHubPairRequest,
    MobileHubState,
    MobileHubOverlayUpdateRequest,
)
from app.services.mobile_hub import (
    create_pairing_session,
    get_mobile_hub_state,
    update_channel,
    update_device,
    update_gateway,
    update_overlays,
)

router = APIRouter(prefix="/mobile-hub", tags=["mobile-hub"])


@router.get("/state", response_model=MobileHubState)
async def mobile_hub_state():
    return get_mobile_hub_state()


@router.post("/pair", response_model=MobileHubState)
async def mobile_hub_pair(req: MobileHubPairRequest):
    return create_pairing_session(req.name, req.platform, req.role)


@router.post("/gateway", response_model=MobileHubState)
async def mobile_hub_update_gateway(req: MobileHubGatewayUpdateRequest):
    return update_gateway(req.model_dump())


@router.post("/overlays", response_model=MobileHubState)
async def mobile_hub_update_overlays(req: MobileHubOverlayUpdateRequest):
    return update_overlays(req.model_dump())


@router.post("/channels/{channel_id}", response_model=MobileHubState)
async def mobile_hub_update_channel(channel_id: str, req: MobileHubChannelUpdateRequest):
    return update_channel(channel_id, enabled=req.enabled, secret=req.secret)


@router.post("/devices/{device_id}", response_model=MobileHubState)
async def mobile_hub_update_device(device_id: str, req: MobileHubDeviceUpdateRequest):
    state = get_mobile_hub_state()
    if not any(device.id == device_id for device in state.devices):
        raise HTTPException(404, "Device not found")
    return update_device(device_id, req.model_dump())

