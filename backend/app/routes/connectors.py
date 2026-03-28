from fastapi import APIRouter

from app.models.schemas import ConnectorValidateRequest, ConnectorValidateResponse
from app.services.connectors import validate_connector

router = APIRouter()


@router.post("/validate", response_model=ConnectorValidateResponse)
async def validate_connector_route(req: ConnectorValidateRequest):
    return await validate_connector(req.connector_id, req.values)
