import importlib.util
import os
import platform

from app.config import IS_LOCAL, MODE
from app.services.remote_control import get_remote_config


def detect_capabilities() -> dict:
    playwright_available = importlib.util.find_spec("playwright") is not None
    pyautogui_available = IS_LOCAL and importlib.util.find_spec("pyautogui") is not None
    computer_use_available = IS_LOCAL and bool(os.getenv("ANTHROPIC_API_KEY"))
    remote_config = get_remote_config()

    return {
        "status": "ok",
        "version": "1.1.0",
        "mode": MODE,
        "available_tools": {
            "tavily": bool(os.getenv("TAVILY_API_KEY")),
            "playwright": playwright_available,
            "pyautogui": pyautogui_available,
            "computer_use": computer_use_available,
        },
        "providers": {
            "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
            "openai": bool(os.getenv("OPENAI_API_KEY")),
            "deepseek": bool(os.getenv("DEEPSEEK_API_KEY")),
            "google": bool(os.getenv("GOOGLE_API_KEY")),
            "tavily": bool(os.getenv("TAVILY_API_KEY")),
        },
        "runtime": {
            "supports_browser": playwright_available,
            "supports_terminal": IS_LOCAL,
            "supports_desktop": pyautogui_available,
            "supports_remote_commands": remote_config.enabled,
            "approval_required": remote_config.approval_required,
        },
        "remote": remote_config.model_dump(),
        "system": {
            "os": platform.system(),
            "anthropic_key": bool(os.getenv("ANTHROPIC_API_KEY")),
            "tavily_key": bool(os.getenv("TAVILY_API_KEY")),
            "openai_key": bool(os.getenv("OPENAI_API_KEY")),
            "deepseek_key": bool(os.getenv("DEEPSEEK_API_KEY")),
            "google_key": bool(os.getenv("GOOGLE_API_KEY")),
        },
    }
