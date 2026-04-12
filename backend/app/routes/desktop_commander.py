from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import desktop_commander as dc

router = APIRouter(prefix="/desktop-commander", tags=["desktop-commander"])


class FileReadRequest(BaseModel):
    path: str
    offset: int = 0
    length: Optional[int] = None
    max_bytes: Optional[int] = None


class FileWriteRequest(BaseModel):
    path: str
    content: str
    mode: str = "rewrite"
    encoding: str = "utf-8"


class EditBlockRequest(BaseModel):
    file_path: str
    old_string: str
    new_string: str


class DirectoryRequest(BaseModel):
    path: str
    depth: int = 1


class CreateDirRequest(BaseModel):
    path: str


class MoveFileRequest(BaseModel):
    source: str
    destination: str


class FileInfoRequest(BaseModel):
    path: str


class SearchFilesRequest(BaseModel):
    query: str
    path: Optional[str] = None
    max_results: int = 20
    pattern: Optional[str] = None
    recursive: bool = True


class ExecuteCommandRequest(BaseModel):
    command: str
    shell: str = "powershell"
    timeout_ms: int = 30000
    cwd: Optional[str] = None


class DesktopCommanderConfigPatchRequest(BaseModel):
    allowed_directories: Optional[list[str]] = None
    blocked_commands: Optional[list[str]] = None
    max_read_lines: Optional[int] = None
    max_write_lines: Optional[int] = None


@router.get("/health")
async def desktop_commander_health():
    return dc.get_status()


@router.get("/config")
async def desktop_commander_config():
    return dc.get_config()


@router.patch("/config")
async def patch_desktop_commander_config(req: DesktopCommanderConfigPatchRequest):
    return dc.update_config(
        allowed_directories=req.allowed_directories,
        blocked_commands=req.blocked_commands,
        max_read_lines=req.max_read_lines,
        max_write_lines=req.max_write_lines,
    )


@router.post("/read-file")
async def read_file(req: FileReadRequest):
    result = dc.dc_read_file(req.path, req.max_bytes)
    if result.get("success") and req.offset > 0:
        lines = result.get("content", "").splitlines()
        end = req.offset + req.length if req.length else len(lines)
        selected = lines[req.offset:end]
        result["content"] = "\n".join(selected)
        result["lines_read"] = len(selected)
        result["total_lines"] = len(lines)
        result["offset"] = req.offset
    elif result.get("success"):
        lines = result.get("content", "").splitlines()
        limit = req.length or len(lines)
        selected = lines[:limit]
        result["content"] = "\n".join(selected)
        result["lines_read"] = min(limit, len(lines))
        result["total_lines"] = len(lines)
        result["offset"] = 0
    return result


@router.post("/write-file")
async def write_file(req: FileWriteRequest):
    return dc.dc_write_file(req.path, req.content, req.encoding, req.mode)


@router.post("/edit-block")
async def edit_block(req: EditBlockRequest):
    return dc.dc_edit_block(req.file_path, req.old_string, req.new_string)


@router.post("/list-directory")
async def list_directory(req: DirectoryRequest):
    return dc.dc_list_directory(req.path, req.depth)


@router.post("/create-directory")
async def create_directory(req: CreateDirRequest):
    return dc.dc_create_directory(req.path)


@router.post("/move-file")
async def move_file(req: MoveFileRequest):
    return dc.dc_move_file(req.source, req.destination)


@router.post("/get-file-info")
async def get_file_info(req: FileInfoRequest):
    return dc.dc_get_file_info(req.path)


@router.post("/search-files")
async def search_files(req: SearchFilesRequest):
    query = req.query or (req.pattern or "").replace("*", "").replace(".", " ").strip()
    return dc.dc_search_files(query, req.path, req.max_results)


@router.post("/execute-command")
async def execute_command(req: ExecuteCommandRequest):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: dc.dc_execute_command(
            req.command,
            shell=req.shell,
            timeout_ms=req.timeout_ms,
            cwd=req.cwd,
        ),
    )


@router.get("/system-info")
async def system_info():
    return dc.dc_get_system_info()
