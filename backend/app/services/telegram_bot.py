"""
Telegram Bot Service — allows users to send tasks from Telegram
and have them executed by the AgentOS agent (like OpenClaw).

Architecture:
  - Uses python-telegram-bot (PTB v20+) with a polling-based approach
    (no webhook needed for local/self-hosted setups).
  - Runs in a background asyncio task managed via FastAPI lifespan.
  - When a user sends a message, the bot creates an agent run via
    runner.create_run() and streams results back to Telegram.
  - The bot token is stored in runtime_config (TELEGRAM_BOT_TOKEN).
  - Authorized chat IDs are stored in runtime_config (TELEGRAM_CHAT_IDS).
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

from app.services.runtime_config import get_runtime_value

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------

_bot_app = None  # holds the Application instance
_bot_task: Optional[asyncio.Task] = None
_bot_running = False

# Authorized chat IDs (persisted via runtime config as comma-separated)
AUTHORIZED_CHATS_KEY = "TELEGRAM_CHAT_IDS"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_token() -> str | None:
    return get_runtime_value("TELEGRAM_BOT_TOKEN")


def _get_authorized_chats() -> set[int]:
    raw = get_runtime_value(AUTHORIZED_CHATS_KEY, "")
    if not raw:
        return set()
    result: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if part.isdigit():
            result.add(int(part))
    return result


def _set_authorized_chats(chat_ids: set[int]) -> None:
    """Persist authorized chat IDs back to runtime config."""
    from app.services.runtime_config import set_runtime_config
    value = ",".join(str(cid) for cid in sorted(chat_ids))
    set_runtime_config({AUTHORIZED_CHATS_KEY: value})


# ---------------------------------------------------------------------------
# Bot logic
# ---------------------------------------------------------------------------

async def _start(update, context):
    """Handle /start command."""
    chat_id = update.effective_chat.id
    authorized = _get_authorized_chats()

    if chat_id not in authorized:
        await update.message.reply_text(
            "🤖 *AgentOS Telegram Bot*\n\n"
            "Your chat ID is not yet authorized.\n"
            f"Chat ID: `{chat_id}`\n\n"
            "Ask the admin to add this ID to the authorized list in Settings > Integrations.",
            parse_mode="Markdown",
        )
        return

    await update.message.reply_text(
        "🤖 *AgentOS Bot Ready*\n\n"
        "Send me any task and I'll execute it using the agent.\n\n"
        "Commands:\n"
        "/task <description> — Run a new agent task\n"
        "/status — Check current run status\n"
        "/stop — Stop the current run\n"
        "/help — Show this help",
        parse_mode="Markdown",
    )


async def _help(update, context):
    """Handle /help command."""
    await _start(update, context)


async def _task(update, context):
    """Handle /task command — run an agent task."""
    chat_id = update.effective_chat.id
    authorized = _get_authorized_chats()
    if chat_id not in authorized:
        await update.message.reply_text("⛔ Unauthorized. Your chat ID is not in the allowed list.")
        return

    text = update.message.text
    # Remove "/task" prefix
    task = text[len("/task"):].strip() if text.startswith("/task") else text.strip()
    if not task:
        await update.message.reply_text("❌ Please provide a task description.\nExample: `/task Open notepad and write hello`", parse_mode="Markdown")
        return

    # Get the default model from runtime config or use a sensible default
    model = get_runtime_value("TELEGRAM_MODEL", "deepseek-chat")
    max_steps_str = get_runtime_value("TELEGRAM_MAX_STEPS", "15")

    try:
        max_steps = int(max_steps_str)
    except (ValueError, TypeError):
        max_steps = 15

    await update.message.reply_text(
        f"✅ Task received! Running with model `{model}`...\n"
        f"📝 *Task:* {task[:200]}{'...' if len(task) > 200 else ''}",
        parse_mode="Markdown",
    )

    # Run the agent in a background task and send updates
    asyncio.create_task(_run_agent_and_report(chat_id, context, task, model, max_steps))


async def _status(update, context):
    """Handle /status command."""
    chat_id = update.effective_chat.id
    authorized = _get_authorized_chats()
    if chat_id not in authorized:
        return

    from app.services.runner import is_run_active, _active_runs

    if not _active_runs:
        await update.message.reply_text("📭 No active runs.")
        return

    active = [(rid, rs) for rid, rs in _active_runs.items() if rs.started and not rs.stop_event.is_set()]
    if not active:
        await update.message.reply_text("📭 No active runs.")
        return

    lines = ["*Active Runs:*"]
    for rid, rs in active:
        elapsed = int(time.monotonic() - rs.created_at) if hasattr(rs, 'created_at') else 0
        lines.append(f"• `{rid[:8]}...` — _{rs.task[:60]}..._ ({elapsed}s)")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def _stop(update, context):
    """Handle /stop command."""
    chat_id = update.effective_chat.id
    authorized = _get_authorized_chats()
    if chat_id not in authorized:
        return

    from app.services.runner import stop_run, _active_runs

    if not _active_runs:
        await update.message.reply_text("📭 No active runs to stop.")
        return

    for rid in list(_active_runs.keys()):
        stop_run(rid)

    await update.message.reply_text("🛑 All active runs stopped.")


async def _handle_message(update, context):
    """Handle non-command text messages — treat as a task."""
    chat_id = update.effective_chat.id
    authorized = _get_authorized_chats()
    if chat_id not in authorized:
        return

    text = update.message.text
    if not text or text.startswith("/"):
        return

    # Treat plain text as a task
    await _task(update, context)


async def _run_agent_and_report(chat_id: int, context, task: str, model: str, max_steps: int):
    """Run the agent and send progress updates to Telegram."""
    import time
    from app.services.runner import create_run, run_agent

    run_id = create_run(task=task, model=model, max_steps=max_steps, capture_interval_ms=2000)

    progress_msg = await context.bot.send_message(
        chat_id=chat_id,
        text=f"🔄 Starting agent run `{run_id[:8]}...`",
        parse_mode="Markdown",
    )

    last_update = time.time()
    step_count = 0
    final_result = ""

    try:
        async for event in run_agent(run_id):
            if event.startswith("data: "):
                import json
                try:
                    data = json.loads(event[6:])
                    event_type = data.get("type", "")
                    step = data.get("step", 0)
                    action = data.get("action", "")
                    result = data.get("result", "")

                    if event_type == "action" and action:
                        step_count = step
                        final_result = f"Step {step}: {action[:100]}"

                        # Send progress update every 5 seconds
                        now = time.time()
                        if now - last_update > 5:
                            try:
                                await progress_msg.edit_text(
                                    f"🔄 *Run in progress*\n"
                                    f"`{run_id[:8]}...`\n\n"
                                    f"Step {step}/{max_steps}: {action[:150]}",
                                    parse_mode="Markdown",
                                )
                            except Exception:
                                pass
                            last_update = now

                    elif event_type == "done":
                        outcome = data.get("outcome", "Completed")
                        await context.bot.send_message(
                            chat_id=chat_id,
                            text=f"✅ *Task Complete!*\n\n{outcome[:500]}",
                            parse_mode="Markdown",
                        )
                        return

                    elif event_type == "error":
                        error_msg = data.get("message", str(data))
                        await context.bot.send_message(
                            chat_id=chat_id,
                            text=f"❌ *Error:* {error_msg[:300]}",
                            parse_mode="Markdown",
                        )
                        return

                except json.JSONDecodeError:
                    pass

    except Exception as e:
        logger.exception("Telegram agent run failed")
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"❌ *Run failed:* {str(e)[:300]}",
            parse_mode="Markdown",
        )


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

async def start_bot() -> None:
    """Start the Telegram bot in the background."""
    global _bot_app, _bot_task, _bot_running

    token = _get_token()
    if not token:
        logger.info("Telegram bot not started: TELEGRAM_BOT_TOKEN not set")
        return

    if _bot_running:
        logger.info("Telegram bot already running")
        return

    try:
        from telegram import Update
        from telegram.ext import Application, CommandHandler, MessageHandler, filters

        _bot_app = Application.builder().token(token).build()

        # Register handlers
        _bot_app.add_handler(CommandHandler("start", _start))
        _bot_app.add_handler(CommandHandler("help", _help))
        _bot_app.add_handler(CommandHandler("task", _task))
        _bot_app.add_handler(CommandHandler("status", _status))
        _bot_app.add_handler(CommandHandler("stop", _stop))
        _bot_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _handle_message))

        # Initialize and start polling in a background task
        # Use start_polling() which is async-friendly and doesn't create its own loop
        await _bot_app.initialize()
        await _bot_app.start()
        _bot_task = asyncio.create_task(_bot_app.updater.start_polling(
            allowed_updates=Update.ALL_TYPES,
            drop_pending_updates=True,
        ))
        _bot_running = True
        logger.info("Telegram bot started successfully")

    except Exception as e:
        logger.error(f"Failed to start Telegram bot: {e}")
        _bot_running = False
        _bot_app = None


async def stop_bot() -> None:
    """Stop the Telegram bot."""
    global _bot_app, _bot_task, _bot_running

    if not _bot_running:
        return

    _bot_running = False

    if _bot_app:
        try:
            await _bot_app.stop()
            await _bot_app.shutdown()
        except Exception as e:
            logger.warning(f"Error stopping Telegram bot: {e}")
        _bot_app = None

    if _bot_task and not _bot_task.done():
        _bot_task.cancel()
        try:
            await _bot_task
        except asyncio.CancelledError:
            pass
        _bot_task = None

    logger.info("Telegram bot stopped")


def is_bot_running() -> bool:
    """Check if the Telegram bot is currently running."""
    return _bot_running


async def restart_bot() -> bool:
    """Restart the bot (e.g. after token change). Returns True if started."""
    await stop_bot()
    await start_bot()
    return _bot_running
