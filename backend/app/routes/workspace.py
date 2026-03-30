from __future__ import annotations

from io import BytesIO
from pathlib import Path
import zipfile

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from app.models.schemas import BuilderCreateRequest, WorkspaceFileContentResponse, WorkspaceFilesResponse
from app.services import builder as builder_svc

router = APIRouter()

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
ARCHIVE_NAME = "agentos-local-workspace.zip"

EXCLUDED_DIR_NAMES = {
    ".git",
    "node_modules",
    ".venv",
    "__pycache__",
    "dist",
    "coverage",
    ".pytest_cache",
}

EXCLUDED_FILE_NAMES = {
    ".DS_Store",
}

EXCLUDED_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".zip",
}

EXCLUDED_PATH_PARTS = {
    ".git",
    "backend/.venv",
    "backend/__pycache__",
    "backend/app/__pycache__",
    "dist",
}


def _should_exclude(path: Path, root: Path) -> bool:
    relative = path.relative_to(root)
    relative_str = relative.as_posix()

    if any(relative_str == part or relative_str.startswith(f"{part}/") for part in EXCLUDED_PATH_PARTS):
        return True

    if path.name in EXCLUDED_FILE_NAMES:
        return True

    if path.suffix.lower() in EXCLUDED_SUFFIXES:
        return True

    if any(part in EXCLUDED_DIR_NAMES for part in relative.parts):
        return True

    return False


def build_workspace_archive(root: Path = WORKSPACE_ROOT) -> bytes:
    buffer = BytesIO()

    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(root.rglob("*")):
            if path.is_dir():
                continue
            if _should_exclude(path, root):
                continue
            archive.write(path, path.relative_to(root).as_posix())

    buffer.seek(0)
    return buffer.getvalue()


@router.get("/workspace/download")
def download_workspace() -> StreamingResponse:
    data = build_workspace_archive()
    headers = {
        "Content-Disposition": f'attachment; filename="{ARCHIVE_NAME}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        BytesIO(data),
        media_type="application/zip",
        headers=headers,
    )


@router.post("/workspace/builder")
def create_builder_workspace(req: BuilderCreateRequest, request: Request):
    workspace = builder_svc.create_workspace(req.prompt, req.title)
    base_url = str(request.base_url).rstrip("/")
    return builder_svc.attach_preview_url(workspace, base_url)


@router.get("/workspace/builder/{workspace_id}")
def get_builder_workspace(workspace_id: str, request: Request):
    workspace = builder_svc.load_workspace(workspace_id)
    if not workspace:
        raise HTTPException(404, "Workspace not found")
    base_url = str(request.base_url).rstrip("/")
    return builder_svc.attach_preview_url(workspace, base_url)


@router.get("/workspace/builder/{workspace_id}/files", response_model=WorkspaceFilesResponse)
def get_builder_workspace_files(workspace_id: str):
    workspace = builder_svc.load_workspace(workspace_id)
    if not workspace:
        raise HTTPException(404, "Workspace not found")
    return WorkspaceFilesResponse(files=workspace.files)


@router.get("/workspace/builder/{workspace_id}/file/{file_path:path}", response_model=WorkspaceFileContentResponse)
def get_builder_workspace_file(workspace_id: str, file_path: str):
    try:
        resolved_path, content = builder_svc.read_workspace_file(workspace_id, file_path)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    language = resolved_path.suffix.lstrip(".").lower() or None
    return WorkspaceFileContentResponse(path=file_path, content=content, language=language)


@router.get("/workspace/builder/{workspace_id}/preview")
def get_builder_workspace_preview(workspace_id: str):
    try:
        preview_path = builder_svc.preview_file_path(workspace_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    return FileResponse(preview_path, media_type="text/html")


@router.get("/workspace/builder/{workspace_id}/download/{file_path:path}")
def download_builder_workspace_file(workspace_id: str, file_path: str):
    try:
        resolved_path, _content = builder_svc.read_workspace_file(workspace_id, file_path)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    media_type = "text/plain"
    if resolved_path.suffix.lower() == ".html":
        media_type = "text/html"
    elif resolved_path.suffix.lower() == ".json":
        media_type = "application/json"
    elif resolved_path.suffix.lower() == ".sql":
        media_type = "application/sql"
    return FileResponse(resolved_path, media_type=media_type, filename=resolved_path.name)
