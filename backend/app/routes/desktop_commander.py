from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import desktop_commander as dc
from app.services import filesystem as fs

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


@router.get("/health")
async def desktop_commander_health():
    return dc.get_status()


@router.get("/config")
async def desktop_commander_config():
    return dc.get_config()


@router.patch("/config")
async def patch_desktop_commander_config(_req: DesktopCommanderConfigPatchRequest):
    # The current local runtime exposes informational config only.
    # Accept the request to keep the UI stable without failing hard.
    return dc.get_config()


@router.post("/read-file")
async def read_file(req: FileReadRequest):
    result = fs.file_read(req.path, req.max_bytes)
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
    if req.mode == "append":
        return fs.file_append(req.path, req.content, req.encoding)
    return fs.file_write(req.path, req.content, req.encoding)


@router.post("/edit-block")
async def edit_block(req: EditBlockRequest):
    try:
        path = Path(req.file_path).expanduser().resolve()
        if not path.exists():
            return {"success": False, "description": f"File not found: {req.file_path}"}
        text = path.read_text(encoding="utf-8", errors="replace")
        if req.old_string not in text:
            return {"success": False, "description": "String not found in file"}
        path.write_text(text.replace(req.old_string, req.new_string, 1), encoding="utf-8")
        return {
            "success": True,
            "path": str(path),
            "replacements": 1,
            "description": f"Edited {path.name}",
        }
    except Exception as exc:
        return {"success": False, "description": str(exc)}


@router.post("/list-directory")
async def list_directory(req: DirectoryRequest):
    return fs.dir_list(req.path)


@router.post("/create-directory")
async def create_directory(req: CreateDirRequest):
    return fs.dir_create(req.path)


@router.post("/move-file")
async def move_file(req: MoveFileRequest):
    return fs.file_move(req.source, req.destination)


@router.post("/get-file-info")
async def get_file_info(req: FileInfoRequest):
    try:
        path = Path(req.path).expanduser().resolve()
        if not path.exists():
            return {"success": False, "description": f"Path not found: {req.path}"}
        stat = path.stat()
        info = {
            "success": True,
            "path": str(path),
            "type": "directory" if path.is_dir() else "file",
            "size": stat.st_size,
            "created": stat.st_ctime,
            "modified": stat.st_mtime,
            "permissions": oct(stat.st_mode)[-3:],
        }
        if path.is_file():
            try:
                info["line_count"] = len(path.read_text(encoding="utf-8", errors="replace").splitlines())
            except Exception:
                pass
        return info
    except Exception as exc:
        return {"success": False, "description": str(exc)}


@router.post("/search-files")
async def search_files(req: SearchFilesRequest):
    query = req.query or (req.pattern or "").replace("*", "").replace(".", " ").strip()
    return fs.search_files(query, req.path, req.max_results)


@router.post("/execute-command")
async def execute_command(req: ExecuteCommandRequest):
    blocked = {"mkfs", "format", "fdisk", "dd", "shutdown", "reboot", "halt"}
    first = req.command.strip().split()[0].lower().lstrip("./\\")
    if first in blocked:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Command '{first}' is blocked.",
            "timed_out": False,
        }

    cwd = str(Path(req.cwd).expanduser().resolve()) if req.cwd else str(Path.home())
    shell = req.shell.lower()
    timeout_s = req.timeout_ms / 1000

    if "powershell" in shell:
        args = ["powershell.exe", "-NoProfile", "-Command", req.command]
    elif shell == "cmd":
        args = ["cmd.exe", "/c", req.command]
    else:
        args = ["powershell.exe", "-NoProfile", "-Command", req.command]

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_s)
        except asyncio.TimeoutError:
            proc.kill()
            return {
                "success": False,
                "exit_code": -1,
                "stdout": "",
                "stderr": f"Timed out after {req.timeout_ms}ms",
                "timed_out": True,
                "command": req.command,
            }

        decoded_stdout = stdout.decode("utf-8", errors="replace")
        decoded_stderr = stderr.decode("utf-8", errors="replace")
        return {
            "success": proc.returncode == 0,
            "exit_code": proc.returncode,
            "stdout": decoded_stdout,
            "stderr": decoded_stderr,
            "timed_out": False,
            "command": req.command,
            "description": f"Exit {proc.returncode}: {decoded_stdout[:100]}",
        }
    except Exception as exc:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": str(exc),
            "timed_out": False,
            "command": req.command,
        }


@router.get("/system-info")
async def system_info():
    return fs.system_info()
