from __future__ import annotations

import json
import os
import secrets
import socket
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.models.schemas import (
    OpenClawChannel,
    OpenClawCliCommand,
    OpenClawDevice,
    OpenClawGatewayState,
    OpenClawOverlayState,
    OpenClawState,
)

STATE_PATH = Path(__file__).resolve().parents[2] / "openclaw_state.json"
INBOUND_PATH = "/remote/commands/inbound"
PAIRING_CODE_LENGTH = 6
_LOCK = threading.Lock()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_host() -> str:
    try:
        return socket.gethostname() or "127.0.0.1"
    except Exception:
        return "127.0.0.1"


def _new_pairing_code() -> str:
    return secrets.token_hex(3).upper()


def _secret_hint(value: str | None) -> str | None:
    if not value:
        return None
    tail = value[-4:] if len(value) > 4 else value
    return f"••••{tail}"


def _env_secret_for_channel(channel_id: str) -> str:
    mapping = {
        "telegram": "REMOTE_TELEGRAM_SECRET",
        "whatsapp": "REMOTE_WHATSAPP_SECRET",
        "webhook": "REMOTE_WEBHOOK_SECRET",
    }
    env_key = mapping.get(channel_id)
    if not env_key:
        return ""
    return os.getenv(env_key, "").strip()


def _default_channels() -> list[dict[str, Any]]:
    return [
        {
            "id": "telegram",
            "name": "Telegram operator channel",
            "transport": "messaging",
            "enabled": False,
            "configured": False,
            "secret": "",
            "description": "Receive commands from Telegram and push them into the local gateway.",
            "relay_path": INBOUND_PATH,
        },
        {
            "id": "whatsapp",
            "name": "WhatsApp relay",
            "transport": "messaging",
            "enabled": False,
            "configured": False,
            "secret": "",
            "description": "Route WhatsApp Business commands through the AgentOS multi-device gateway.",
            "relay_path": INBOUND_PATH,
        },
        {
            "id": "webhook",
            "name": "Generic webhook ingress",
            "transport": "gateway",
            "enabled": True,
            "configured": False,
            "secret": "",
            "description": "Bridge automation tools, bots, or mobile devices with a signed webhook ingress.",
            "relay_path": INBOUND_PATH,
        },
        {
            "id": "slack",
            "name": "Slack escalation",
            "transport": "messaging",
            "enabled": False,
            "configured": False,
            "secret": "",
            "description": "Send summaries and urgent approvals to Slack operators.",
            "relay_path": None,
        },
        {
            "id": "discord",
            "name": "Discord control room",
            "transport": "messaging",
            "enabled": False,
            "configured": False,
            "secret": "",
            "description": "Mirror workflow updates into a Discord control room.",
            "relay_path": None,
        },
        {
            "id": "email",
            "name": "Email fallback",
            "transport": "mail",
            "enabled": False,
            "configured": False,
            "secret": "",
            "description": "Deliver onboarding and task summaries when real-time messaging is unavailable.",
            "relay_path": None,
        },
        {
            "id": "sms",
            "name": "SMS escalation",
            "transport": "sms",
            "enabled": False,
            "configured": False,
            "secret": "",
            "description": "Use SMS as a last-resort notification path for time-sensitive requests.",
            "relay_path": None,
        },
        {
            "id": "push",
            "name": "Push notifications",
            "transport": "mobile",
            "enabled": False,
            "configured": False,
            "secret": "",
            "description": "Prepare mobile push notifications for paired OpenClaw devices.",
            "relay_path": None,
        },
    ]


def _default_devices() -> list[dict[str, Any]]:
    return [
        {
            "id": "desktop-local",
            "name": "Local desktop workspace",
            "platform": "desktop",
            "role": "node",
            "status": "online",
            "last_seen": _utc_now(),
            "battery_percent": None,
            "overlay_enabled": True,
            "voice_wake_enabled": False,
            "pair_code": None,
        }
    ]


def _default_state() -> dict[str, Any]:
    return {
        "gateway": {
            "enabled": True,
            "status": "ready",
            "protocol_version": 3,
            "discovery_mode": "bonjour+manual",
            "host": _safe_host(),
            "port": 8000,
            "tls_enabled": False,
            "tls_fingerprint": None,
            "inbound_path": INBOUND_PATH,
            "pairing_code": _new_pairing_code(),
            "connected_devices": 1,
        },
        "devices": _default_devices(),
        "channels": _default_channels(),
        "overlays": {
            "floating_dock": True,
            "mobile_hud": True,
            "voice_overlay": True,
            "voice_wake": False,
            "camera_hud": False,
            "push_to_talk": "Ctrl+Shift+Space",
        },
    }


def _load_raw_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        state = _default_state()
        _write_raw_state(state)
        return state

    try:
        with STATE_PATH.open("r", encoding="utf-8") as handle:
            loaded = json.load(handle)
    except Exception:
        loaded = {}

    state = _default_state()
    state["gateway"].update(loaded.get("gateway", {}))
    if isinstance(loaded.get("devices"), list) and loaded["devices"]:
        state["devices"] = loaded["devices"]
    if isinstance(loaded.get("channels"), list) and loaded["channels"]:
        state["channels"] = loaded["channels"]
    state["overlays"].update(loaded.get("overlays", {}))
    _normalize_state(state)
    _write_raw_state(state)
    return state


def _write_raw_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with STATE_PATH.open("w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2)


def _normalize_state(state: dict[str, Any]) -> None:
    gateway = state.setdefault("gateway", {})
    gateway.setdefault("enabled", True)
    gateway.setdefault("status", "ready")
    gateway.setdefault("protocol_version", 3)
    gateway.setdefault("discovery_mode", "bonjour+manual")
    gateway.setdefault("host", _safe_host())
    gateway.setdefault("port", 8000)
    gateway.setdefault("tls_enabled", False)
    gateway.setdefault("tls_fingerprint", None)
    gateway.setdefault("inbound_path", INBOUND_PATH)
    gateway.setdefault("pairing_code", _new_pairing_code())

    devices = state.setdefault("devices", _default_devices())
    channels = state.setdefault("channels", _default_channels())
    overlays = state.setdefault("overlays", _default_state()["overlays"])

    if not devices:
        state["devices"] = _default_devices()
        devices = state["devices"]
    if not channels:
        state["channels"] = _default_channels()
        channels = state["channels"]

    gateway["connected_devices"] = sum(1 for device in devices if device.get("status") == "online")
    if gateway.get("connected_devices", 0) == 0 and gateway.get("enabled", True):
        gateway["status"] = "pairing"
    elif gateway.get("enabled", True):
        gateway["status"] = "ready"
    else:
        gateway["status"] = "offline"

    overlays.setdefault("floating_dock", True)
    overlays.setdefault("mobile_hud", True)
    overlays.setdefault("voice_overlay", True)
    overlays.setdefault("voice_wake", False)
    overlays.setdefault("camera_hud", False)
    overlays.setdefault("push_to_talk", "Ctrl+Shift+Space")


def _build_cli_commands(state: dict[str, Any]) -> list[OpenClawCliCommand]:
    gateway = state["gateway"]
    pair_code = gateway.get("pairing_code") or _new_pairing_code()
    host = gateway.get("host", "127.0.0.1")
    port = gateway.get("port", 8000)
    return [
        OpenClawCliCommand(
            label="Doctor",
            command="python backend/openclaw_cli.py doctor",
            description="Check gateway health, overlays, and channel readiness.",
        ),
        OpenClawCliCommand(
            label="Gateway status",
            command="python backend/openclaw_cli.py status",
            description="Inspect the current multi-device gateway and paired devices.",
        ),
        OpenClawCliCommand(
            label="Pair Android device",
            command=f'python backend/openclaw_cli.py pair --name "Pixel 9" --platform android --role operator --host "{host}" --port {port} --pair-code {pair_code}',
            description="Generate a pairing session for an Android operator device.",
        ),
        OpenClawCliCommand(
            label="Enable Telegram bridge",
            command='python backend/openclaw_cli.py channel --id telegram --secret "replace-with-secret" --enable',
            description="Configure the Telegram messaging bridge for remote commands.",
        ),
        OpenClawCliCommand(
            label="Enable overlays",
            command='python backend/openclaw_cli.py overlay --floating-dock on --mobile-hud on --voice-overlay on',
            description="Turn on the OpenClaw-style floating desktop and mobile overlays.",
        ),
    ]


def _to_model(state: dict[str, Any]) -> OpenClawState:
    gateway = OpenClawGatewayState(**state["gateway"])
    devices = [OpenClawDevice(**device) for device in state["devices"]]
    channels = [
        OpenClawChannel(
            id=channel["id"],
            name=channel["name"],
            transport=channel["transport"],
            enabled=bool(channel.get("enabled", False)),
            configured=bool(channel.get("configured", False) or channel.get("secret") or _env_secret_for_channel(channel["id"])),
            secret_hint=_secret_hint(channel.get("secret") or _env_secret_for_channel(channel["id"])),
            description=channel["description"],
            relay_path=channel.get("relay_path"),
        )
        for channel in state["channels"]
    ]
    overlays = OpenClawOverlayState(**state["overlays"])
    summary = (
        f"Gateway {gateway.status} on {gateway.host}:{gateway.port} · "
        f"{gateway.connected_devices} device(s) · "
        f"{sum(1 for channel in channels if channel.configured)} channel(s) configured"
    )
    return OpenClawState(
        gateway=gateway,
        devices=devices,
        channels=channels,
        overlays=overlays,
        cli_commands=_build_cli_commands(state),
        summary=summary,
    )


def get_openclaw_state() -> OpenClawState:
    with _LOCK:
        state = _load_raw_state()
        return _to_model(state)


def get_channel_secret(channel_id: str) -> str:
    with _LOCK:
        state = _load_raw_state()
        for channel in state["channels"]:
            if channel.get("id") == channel_id:
                return str(channel.get("secret", "") or _env_secret_for_channel(channel_id) or "")
    return ""


def create_pairing_session(name: str, platform: str, role: str) -> OpenClawState:
    with _LOCK:
        state = _load_raw_state()
        device_id = f"{platform}-{secrets.token_hex(4)}"
        pair_code = _new_pairing_code()
        state["devices"].append(
            {
                "id": device_id,
                "name": name.strip(),
                "platform": platform,
                "role": role,
                "status": "pairing",
                "last_seen": _utc_now(),
                "battery_percent": 100 if platform in {"android", "ios"} else None,
                "overlay_enabled": True,
                "voice_wake_enabled": state["overlays"].get("voice_wake", False),
                "pair_code": pair_code,
            }
        )
        state["gateway"]["pairing_code"] = pair_code
        _normalize_state(state)
        _write_raw_state(state)
        return _to_model(state)


def update_gateway(values: dict[str, Any]) -> OpenClawState:
    with _LOCK:
        state = _load_raw_state()
        gateway = state["gateway"]
        for key in ["enabled", "discovery_mode", "tls_enabled", "host", "port", "pairing_code"]:
            if key in values and values[key] is not None:
                gateway[key] = values[key]
        if values.get("tls_enabled") and not gateway.get("tls_fingerprint"):
            gateway["tls_fingerprint"] = secrets.token_hex(16)
        elif values.get("tls_enabled") is False:
            gateway["tls_fingerprint"] = None
        _normalize_state(state)
        _write_raw_state(state)
        return _to_model(state)


def update_overlays(values: dict[str, Any]) -> OpenClawState:
    with _LOCK:
        state = _load_raw_state()
        overlays = state["overlays"]
        for key in ["floating_dock", "mobile_hud", "voice_overlay", "voice_wake", "camera_hud", "push_to_talk"]:
            if key in values and values[key] is not None:
                overlays[key] = values[key]
        for device in state["devices"]:
            if values.get("voice_wake") is not None:
                device["voice_wake_enabled"] = bool(values["voice_wake"])
        _normalize_state(state)
        _write_raw_state(state)
        return _to_model(state)


def update_channel(channel_id: str, enabled: bool | None = None, secret: str | None = None) -> OpenClawState:
    with _LOCK:
        state = _load_raw_state()
        for channel in state["channels"]:
            if channel.get("id") != channel_id:
                continue
            if enabled is not None:
                channel["enabled"] = enabled
            if secret is not None:
                channel["secret"] = secret.strip()
            channel["configured"] = bool(channel.get("secret"))
            break
        _normalize_state(state)
        _write_raw_state(state)
        return _to_model(state)


def update_device(device_id: str, values: dict[str, Any]) -> OpenClawState:
    with _LOCK:
        state = _load_raw_state()
        for device in state["devices"]:
            if device.get("id") != device_id:
                continue
            for key in ["status", "overlay_enabled", "voice_wake_enabled", "battery_percent"]:
                if key in values and values[key] is not None:
                    device[key] = values[key]
            device["last_seen"] = _utc_now()
            break
        _normalize_state(state)
        _write_raw_state(state)
        return _to_model(state)


