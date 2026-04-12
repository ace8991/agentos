from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from app.models.schemas import (
    MCPServerConfig,
    MCPServerCreateRequest,
    MCPServerStatus,
    MCPToolRecord,
    MCPServerUpdateRequest,
    MCPToolsResponse,
    MCPTransport,
    ToolProviderKind,
)
from app.services.tool_registry import list_internal_providers, list_mcp_tool_records

DATA_ROOT = Path(__file__).resolve().parents[2] / "data"
MCP_CONFIG_PATH = DATA_ROOT / "mcp_servers.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "mcp-server"


def _ensure_store() -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    if MCP_CONFIG_PATH.exists():
        return
    MCP_CONFIG_PATH.write_text("[]\n", encoding="utf-8")


def _read_external_servers() -> list[MCPServerConfig]:
    _ensure_store()
    try:
        payload = json.loads(MCP_CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    servers: list[MCPServerConfig] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            servers.append(MCPServerConfig.model_validate(item))
        except Exception:
            continue
    return servers


def _write_external_servers(servers: list[MCPServerConfig]) -> None:
    _ensure_store()
    MCP_CONFIG_PATH.write_text(
        json.dumps([server.model_dump() for server in servers], indent=2) + "\n",
        encoding="utf-8",
    )


def list_servers() -> list[MCPServerConfig]:
    internal_servers = [
        MCPServerConfig(
            id=provider.id,
            name=provider.name,
            description=provider.description,
            family=provider.family,
            transport=MCPTransport.INTERNAL,
            kind=ToolProviderKind.INTERNAL,
            enabled=provider.enabled,
            ready=provider.ready,
            status=MCPServerStatus.READY if provider.ready else MCPServerStatus.DISABLED,
            tool_names=[],
            tags=provider.tags,
            updated_at=_now_iso(),
        )
        for provider in list_internal_providers()
    ]
    return [*internal_servers, *_read_external_servers()]


def get_server(server_id: str) -> MCPServerConfig | None:
    return next((server for server in list_servers() if server.id == server_id), None)


def create_server(request: MCPServerCreateRequest) -> MCPServerConfig:
    external_servers = _read_external_servers()
    server_id = _slugify(request.name)
    suffix = 1
    existing_ids = {server.id for server in external_servers}
    while server_id in existing_ids:
        suffix += 1
        server_id = f"{_slugify(request.name)}-{suffix}"

    server = MCPServerConfig(
        id=server_id,
        name=request.name.strip(),
        description=request.description.strip(),
        family=request.family.strip().lower(),
        transport=MCPTransport.STDIO,
        kind=ToolProviderKind.MCP,
        enabled=request.enabled,
        ready=False,
        status=MCPServerStatus.CONFIGURED if request.enabled else MCPServerStatus.DISABLED,
        command=request.command.strip(),
        args=request.args,
        env=request.env,
        updated_at=_now_iso(),
    )
    external_servers.append(server)
    _write_external_servers(external_servers)
    return server


def update_server(server_id: str, request: MCPServerUpdateRequest) -> MCPServerConfig | None:
    external_servers = _read_external_servers()
    updated: MCPServerConfig | None = None
    for index, server in enumerate(external_servers):
        if server.id != server_id:
            continue
        payload = server.model_dump()
        patch = request.model_dump(exclude_unset=True)
        payload.update({key: value for key, value in patch.items() if value is not None})
        if "family" in payload and payload["family"]:
            payload["family"] = str(payload["family"]).strip().lower()
        payload["status"] = (
            MCPServerStatus.CONFIGURED.value
            if payload.get("enabled", True)
            else MCPServerStatus.DISABLED.value
        )
        payload["ready"] = False
        payload["updated_at"] = _now_iso()
        updated = MCPServerConfig.model_validate(payload)
        external_servers[index] = updated
        break

    if not updated:
        return None
    _write_external_servers(external_servers)
    return updated


def list_tools() -> MCPToolsResponse:
    tools = list_mcp_tool_records()
    external_servers = _read_external_servers()
    for server in external_servers:
        for tool_name in server.tool_names:
            tools.append(
                MCPToolRecord(
                    name=tool_name,
                    label=server.name,
                    family=server.family,
                    description=server.description,
                    provider_id=server.id,
                    provider_kind=server.kind,
                    available=server.enabled and server.ready,
                )
            )
    return MCPToolsResponse(tools=tools)
