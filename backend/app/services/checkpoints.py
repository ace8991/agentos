from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.models.schemas import ExecutionCheckpoint

DATA_ROOT = Path(__file__).resolve().parents[2] / "data" / "checkpoints"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_logical_checkpoint(summary: str, files: list[str] | None = None) -> ExecutionCheckpoint:
    return ExecutionCheckpoint(
        id=f"checkpoint-{uuid.uuid4().hex[:10]}",
        kind="logical",
        summary=summary,
        created_at=_now_iso(),
        files=files or [],
    )


def create_file_checkpoint(summary: str, paths: list[str]) -> ExecutionCheckpoint:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    snapshot_id = f"checkpoint-{uuid.uuid4().hex[:10]}"
    storage_path = DATA_ROOT / f"{snapshot_id}.json"
    payload: dict[str, str | None] = {}

    for raw_path in paths:
        if not raw_path:
            continue
        try:
            target = Path(raw_path).expanduser().resolve()
        except Exception:
            continue
        if target.exists() and target.is_file():
            try:
                payload[str(target)] = target.read_text(encoding="utf-8", errors="replace")
            except Exception:
                payload[str(target)] = None
        else:
            payload[str(target)] = None

    storage_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return ExecutionCheckpoint(
        id=snapshot_id,
        kind="files",
        summary=summary,
        created_at=_now_iso(),
        files=list(payload.keys()),
        storage_path=str(storage_path),
    )
