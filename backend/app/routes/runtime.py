from fastapi import APIRouter

from app.models.schemas import RuntimeConfigRequest, RuntimeConfigResponse
from app.services.runtime_config import set_runtime_config

router = APIRouter()


@router.post("/config", response_model=RuntimeConfigResponse)
async def update_runtime_config(req: RuntimeConfigRequest):
    return RuntimeConfigResponse(applied=set_runtime_config(req.values))
