from __future__ import annotations

import subprocess
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import desktop_commander as dc
from app.services import filesystem as fs

router = APIRouter(prefix="/desktop-commander", tags=["desktop-commander"])


# ─── Request models ───────────────────────────────────────────────────

class FileReadRequest(BaseModel):
    path: str
    offset: int = 0
    length: Optional[int] = None
    max_bytes: Optional[int] = None


class FileWriteRequest(BaseModel):
    path: str
    content: str
    mode: str = "rewrite"          # "rewrite" | "append"
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
    # legacy compat
    pattern: Optional[str] = None
    recursive: bool = True


class ExecuteCommandRequest(BaseModel):
    command: str
    shell: str = "powershell"
    timeout_ms: int = 30000
    cwd: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────

@router.get("/health")
async def desktop_commander_health():
    return dc.get_status()


@router.get("/config")
async def get_config():
    from pathlib import Path
    return {
        "allowed_directories": [str(Path.home())],
        "blocked_commands": ["mkfs", "format", "fdisk", "dd", "shutdown", "reboot"],
        "max_read_lines": 1000,
        "max_write_lines": 300,
        "home": str(Path.home()),
        "version": "1.1.0",
        "enabled": True,
    }


@router.post("/read-file")
async def read_file(req: FileReadRequest):
    result = fs.file_read(req.path, req.max_bytes)
    if result.get("success") and req.offset > 0:
        lines = result.get("content", "").splitlines()
        end = req.offset + req.length if req.length else len(lines)
        result["content"] = "\n".join(lines[req.offset:end])
        result["lines_read"] = len(lines[req.offset:end])
        result["total_lines"] = len(lines)
        result["offset"] = req.offset
    elif result.get("success"):
        lines = result.get("content", "").splitlines()
        limit = req.length or len(lines)
        result["content"] = "\n".join(lines[:limit])
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
        from pathlib import Path
        p = Path(req.file_path).expanduser().resolve()
        if not p.exists():
            return {"success": False, "description": f"File not found: {req.file_path}"}
        text = p.read_text(encoding="utf-8", errors="replace")
        count = text.count(req.old_string)
        if count == 0:
            return {"success": False, "description": f"String not found in file"}
        new_text = text.replace(req.old_string, req.new_string, 1)
        p.write_text(new_text, encoding="utf-8")
        return {"success": True, "path": str(p), "replacements": 1, "description": f"Edited {p.name}"}
    except Exception as e:
        return {"success": False, "description": str(e)}


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
        from pathlib import Path
        p = Path(req.path).expanduser().resolve()
        if not p.exists():
            return {"success": False, "description": f"Path not found: {req.path}"}
        stat = p.stat()
        info = {
            "success": True,
            "path": str(p),
            "type": "directory" if p.is_dir() else "file",
            "size": stat.st_size,
            "created": stat.st_ctime,
            "modified": stat.st_mtime,
            "permissions": oct(stat.st_mode)[-3:],
        }
        if p.is_file():
            try:
                info["line_count"] = len(p.read_text(encoding="utf-8", errors="replace").splitlines())
            except Exception:
                pass
        return info
    except Exception as e:
        return {"success": False, "description": str(e)}


@router.post("/search-files")
async def search_files(req: SearchFilesRequest):
    # Support both "query" (new) and "pattern" (legacy glob)
    query = req.query or (req.pattern or "").replace("*", "").replace(".", " ").strip()
    return fs.search_files(query, req.path, req.max_results)


@router.post("/execute-command")
async def execute_command(req: ExecuteCommandRequest):
    import asyncio
    from pathlib import Path

    BLOCKED = {"mkfs", "format", "fdisk", "dd", "shutdown", "reboot", "halt"}
    first = req.command.strip().split()[0].lower().lstrip("./\\")
    if first in BLOCKED:
        return {"success": False, "exit_code": -1, "stdout": "", "stderr": f"Command '{first}' is blocked.", "timed_out": False}

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
            return {"success": False, "exit_code": -1, "stdout": "", "stderr": f"Timed out after {req.timeout_ms}ms", "timed_out": True, "command": req.command}

        ok = proc.returncode == 0
        return {
            "success": ok,
            "exit_code": proc.returncode,
            "stdout": stdout.decode("utf-8", errors="replace"),
            "stderr": stderr.decode("utf-8", errors="replace"),
            "timed_out": False,
            "command": req.command,
            "description": f"Exit {proc.returncode}: {stdout.decode('utf-8', errors='replace')[:100]}",
        }
    except Exception as e:
        return {"success": False, "exit_code": -1, "stdout": "", "stderr": str(e), "timed_out": False, "command": req.command}


@router.get("/system-info")
async def system_info():
    return fs.system_info()
