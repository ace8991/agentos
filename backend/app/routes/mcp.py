from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import MCPServerCreateRequest, MCPServerUpdateRequest, MCPServersResponse
from app.services import mcp_bridge

router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.get("/servers", response_model=MCPServersResponse)
async def list_mcp_servers():
    return MCPServersResponse(servers=mcp_bridge.list_servers())


@router.post("/servers")
async def create_mcp_server(req: MCPServerCreateRequest):
    return mcp_bridge.create_server(req)


@router.patch("/servers/{server_id}")
async def update_mcp_server(server_id: str, req: MCPServerUpdateRequest):
    server = mcp_bridge.update_server(server_id, req)
    if not server:
        raise HTTPException(404, "MCP server not found")
    return server


@router.get("/tools")
async def list_mcp_tools():
    return mcp_bridge.list_tools()
