from __future__ import annotations

import os
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.config import IS_LOCAL
from app.models.schemas import (
    RemoteChannel,
    RemoteCommand,
    RemoteCommandStatus,
    RemoteConfigResponse,
)
from app.services.openclaw_hub import get_channel_secret


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
      return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class RemoteCommandRecord:
    id: str
    channel: RemoteChannel
    text: str
    sender: str | None
    status: RemoteCommandStatus
    created_at: str
    updated_at: str
    actor: str | None = None
    note: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_model(self) -> RemoteCommand:
        return RemoteCommand(
            id=self.id,
            channel=self.channel,
            text=self.text,
            sender=self.sender,
            status=self.status,
            created_at=self.created_at,
            updated_at=self.updated_at,
            actor=self.actor,
            note=self.note,
            metadata=self.metadata,
        )


_commands: dict[str, RemoteCommandRecord] = {}
_lock = threading.Lock()


def _channel_secret(channel: RemoteChannel) -> str:
    mapping = {
        RemoteChannel.TELEGRAM: "REMOTE_TELEGRAM_SECRET",
        RemoteChannel.WHATSAPP: "REMOTE_WHATSAPP_SECRET",
        RemoteChannel.WEBHOOK: "REMOTE_WEBHOOK_SECRET",
    }
    env_secret = os.getenv(mapping[channel], "").strip()
    if env_secret:
        return env_secret
    return get_channel_secret(channel.value).strip()


def get_remote_config() -> RemoteConfigResponse:
    configured_channels = {
        RemoteChannel.TELEGRAM.value: bool(_channel_secret(RemoteChannel.TELEGRAM)),
        RemoteChannel.WHATSAPP.value: bool(_channel_secret(RemoteChannel.WHATSAPP)),
        RemoteChannel.WEBHOOK.value: bool(_channel_secret(RemoteChannel.WEBHOOK)),
    }
    approval_required = _env_flag("REMOTE_REQUIRE_APPROVAL", True)

    return RemoteConfigResponse(
        enabled=any(configured_channels.values()),
        local_execution_available=IS_LOCAL,
        approval_required=approval_required,
        configured_channels=configured_channels,
        inbound_path="/remote/commands/inbound",
    )


def ingest_remote_command(
    channel: RemoteChannel,
    text: str,
    secret: str,
    sender: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> RemoteCommand:
    expected_secret = _channel_secret(channel)
    if not expected_secret:
        raise ValueError(f"{channel.value} inbound is not configured")
    if secret.strip() != expected_secret:
        raise ValueError("Invalid remote secret")

    config = get_remote_config()
    now = _utc_now()
    record = RemoteCommandRecord(
        id=str(uuid.uuid4()),
        channel=channel,
        text=text.strip(),
        sender=sender.strip() if sender else None,
        status=RemoteCommandStatus.PENDING if config.approval_required else RemoteCommandStatus.APPROVED,
        created_at=now,
        updated_at=now,
        metadata=metadata or {},
    )

    with _lock:
        _commands[record.id] = record

    return record.to_model()


def list_remote_commands(status: RemoteCommandStatus | None = None, limit: int = 50) -> list[RemoteCommand]:
    with _lock:
        records = list(_commands.values())

    records.sort(key=lambda item: item.created_at, reverse=True)
    if status is not None:
        records = [record for record in records if record.status == status]

    return [record.to_model() for record in records[:limit]]


def _get_command(command_id: str) -> RemoteCommandRecord:
    with _lock:
        record = _commands.get(command_id)
    if not record:
        raise KeyError("Remote command not found")
    return record


def approve_remote_command(command_id: str, actor: str, note: str | None = None) -> RemoteCommand:
    with _lock:
        record = _commands.get(command_id)
        if not record:
            raise KeyError("Remote command not found")
        if record.status not in {RemoteCommandStatus.PENDING, RemoteCommandStatus.APPROVED}:
            raise ValueError(f"Cannot approve a command in status '{record.status.value}'")
        record.status = RemoteCommandStatus.APPROVED
        record.actor = actor
        record.note = note
        record.updated_at = _utc_now()
        return record.to_model()


def reject_remote_command(command_id: str, actor: str, note: str | None = None) -> RemoteCommand:
    with _lock:
        record = _commands.get(command_id)
        if not record:
            raise KeyError("Remote command not found")
        if record.status not in {
            RemoteCommandStatus.PENDING,
            RemoteCommandStatus.APPROVED,
            RemoteCommandStatus.CLAIMED,
        }:
            raise ValueError(f"Cannot reject a command in status '{record.status.value}'")
        record.status = RemoteCommandStatus.REJECTED
        record.actor = actor
        record.note = note
        record.updated_at = _utc_now()
        return record.to_model()


def claim_remote_command(command_id: str, actor: str) -> RemoteCommand:
    with _lock:
        record = _commands.get(command_id)
        if not record:
            raise KeyError("Remote command not found")
        if record.status != RemoteCommandStatus.APPROVED:
            raise ValueError(f"Cannot claim a command in status '{record.status.value}'")
        record.status = RemoteCommandStatus.CLAIMED
        record.actor = actor
        record.updated_at = _utc_now()
        return record.to_model()


def complete_remote_command(command_id: str, actor: str, success: bool, note: str | None = None) -> RemoteCommand:
    with _lock:
        record = _commands.get(command_id)
        if not record:
            raise KeyError("Remote command not found")
        if record.status not in {RemoteCommandStatus.CLAIMED, RemoteCommandStatus.APPROVED}:
            raise ValueError(f"Cannot complete a command in status '{record.status.value}'")
        record.status = RemoteCommandStatus.COMPLETED
        record.actor = actor
        record.note = note or ("Completed successfully" if success else "Execution failed")
        record.metadata = {
            **record.metadata,
            "success": success,
        }
        record.updated_at = _utc_now()
        return record.to_model()
