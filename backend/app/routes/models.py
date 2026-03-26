from fastapi import APIRouter

from app.models.schemas import ModelsResponse
from app.services.model_catalog import list_models

router = APIRouter()


@router.get("/all", response_model=ModelsResponse)
async def all_models() -> ModelsResponse:
    return ModelsResponse(models=list_models())
