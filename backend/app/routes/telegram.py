"""
Telegram Bot API routes — manage the Telegram bot lifecycle and configuration.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import telegram_bot
from app.services.runtime_config import get_runtime_value, set_runtime_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["telegram"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class TelegramStatusResponse(BaseModel):
    running: bool
    token_configured: bool
    chat_ids: list[int]


class TelegramStartResponse(BaseModel):
    success: bool
    message: str


class TelegramConfigRequest(BaseModel):
    token: str = ""
    chat_ids: str = ""


class TelegramConfigResponse(BaseModel):
    success: bool
    message: str


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/status", response_model=TelegramStatusResponse)
async def get_telegram_status():
    """Get the current status of the Telegram bot."""
    token = get_runtime_value("TELEGRAM_BOT_TOKEN", "")
    chat_ids_raw = get_runtime_value("TELEGRAM_CHAT_IDS", "")

    chat_ids: list[int] = []
    if chat_ids_raw:
        for part in chat_ids_raw.split(","):
            part = part.strip()
            if part.isdigit():
                chat_ids.append(int(part))

    return TelegramStatusResponse(
        running=telegram_bot.is_bot_running(),
        token_configured=bool(token and token.strip()),
        chat_ids=chat_ids,
    )


@router.post("/start", response_model=TelegramStartResponse)
async def start_telegram_bot():
    """Start the Telegram bot."""
    token = get_runtime_value("TELEGRAM_BOT_TOKEN", "")
    if not token or not token.strip():
        raise HTTPException(
            status_code=400,
            detail="TELEGRAM_BOT_TOKEN is not configured. Set it in Settings > Integrations first.",
        )

    success = await telegram_bot.restart_bot()
    if success:
        return TelegramStartResponse(success=True, message="Telegram bot started successfully")
    else:
        raise HTTPException(status_code=500, detail="Failed to start Telegram bot. Check the token.")


@router.post("/stop", response_model=TelegramStartResponse)
async def stop_telegram_bot():
    """Stop the Telegram bot."""
    await telegram_bot.stop_bot()
    return TelegramStartResponse(success=True, message="Telegram bot stopped")


@router.post("/restart", response_model=TelegramStartResponse)
async def restart_telegram_bot():
    """Restart the Telegram bot."""
    success = await telegram_bot.restart_bot()
    if success:
        return TelegramStartResponse(success=True, message="Telegram bot restarted successfully")
    else:
        raise HTTPException(status_code=500, detail="Failed to restart Telegram bot. Check the token.")


@router.post("/config", response_model=TelegramConfigResponse)
async def update_telegram_config(req: TelegramConfigRequest):
    """Update Telegram bot configuration (token and authorized chat IDs)."""
    updates: dict[str, str] = {}

    if req.token:
        updates["TELEGRAM_BOT_TOKEN"] = req.token.strip()
    if req.chat_ids:
        updates["TELEGRAM_CHAT_IDS"] = req.chat_ids.strip()

    if updates:
        set_runtime_config(updates)

    # Restart the bot if token was updated
    if "TELEGRAM_BOT_TOKEN" in updates:
        await telegram_bot.restart_bot()

    return TelegramConfigResponse(
        success=True,
        message="Telegram configuration updated",
    )
