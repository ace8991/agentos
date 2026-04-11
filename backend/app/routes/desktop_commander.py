from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import desktop_commander as dc


router = APIRouter(prefix="/desktop-commander", tags=["desktop-commander"])


class FileReadRequest(BaseModel):
    path: str
    max_bytes: Optional[int] = None


class FileWriteRequest(BaseModel):
    path: str
    content: str
    encoding: str = "utf-8"


class DirectoryRequest(BaseModel):
    path: str


class SearchFilesRequest(BaseModel):
    query: str
    path: Optional[str] = None
    max_results: int = 8


class ExecuteCommandRequest(BaseModel):
    command: str


@router.get("/health")
async def desktop_commander_health():
    return dc.get_status()


@router.post("/read-file")
async def read_file(req: FileReadRequest):
    return dc.dc_read_file(req.path, req.max_bytes)


@router.post("/write-file")
async def write_file(req: FileWriteRequest):
    return dc.dc_write_file(req.path, req.content, req.encoding)


@router.post("/list-directory")
async def list_directory(req: DirectoryRequest):
    return dc.dc_list_directory(req.path)


@router.post("/search-files")
async def search_files(req: SearchFilesRequest):
    return dc.dc_search_files(req.query, req.path, req.max_results)


@router.post("/execute-command")
async def execute_command(req: ExecuteCommandRequest):
    return dc.dc_execute_command(req.command)


@router.get("/system-info")
async def system_info():
    return dc.dc_get_system_info()
