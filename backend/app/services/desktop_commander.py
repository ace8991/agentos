from __future__ import annotations

from typing import Optional

from app.config import IS_LOCAL
from app.services import filesystem as fs


SUPPORTED_TOOLS = [
    "dc_read_file",
    "dc_write_file",
    "dc_list_directory",
    "dc_execute_command",
    "dc_search_files",
    "dc_get_system_info",
]


def _local_only() -> dict | None:
    if IS_LOCAL:
        return None
    return {
        "success": False,
        "ready": False,
        "description": "Desktop Commander MCP is available only when AgentOS runs in local mode.",
    }


def get_status() -> dict:
    return {
        "success": True,
        "ready": IS_LOCAL,
        "mode": "local" if IS_LOCAL else "cloud",
        "tools": SUPPORTED_TOOLS,
        "description": (
            "Desktop Commander MCP is ready on this machine."
            if IS_LOCAL
            else "Desktop Commander MCP requires a local AgentOS runtime."
        ),
    }


def dc_read_file(path: str, max_bytes: Optional[int] = None) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    return fs.file_read(path, max_bytes)


def dc_write_file(path: str, content: str, encoding: str = "utf-8") -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    return fs.file_write(path, content, encoding)


def dc_list_directory(path: str) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    return fs.dir_list(path)


def dc_search_files(query: str, path: Optional[str] = None, max_results: int = 8) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    return fs.search_files(query, path, max_results)


def dc_get_system_info() -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    return fs.system_info()


def dc_execute_command(command: str) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked

    from app.services.executor import _shell

    return _shell(command)
