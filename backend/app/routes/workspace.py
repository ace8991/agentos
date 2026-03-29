from __future__ import annotations

from io import BytesIO
from pathlib import Path
import zipfile

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

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
