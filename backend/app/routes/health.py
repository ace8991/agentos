import importlib.util
import os
import platform
from fastapi import APIRouter
from app.config import MODE, IS_LOCAL

router = APIRouter()

@router.get("/health")
async def health():
    playwright_available = importlib.util.find_spec("playwright") is not None
    pyautogui_available = IS_LOCAL and importlib.util.find_spec("pyautogui") is not None
    computer_use_available = IS_LOCAL and bool(os.getenv("ANTHROPIC_API_KEY"))
    info = {
        "status": "ok",
        "version": "1.0.0",
        "mode": MODE,
        "available_tools": {
            "tavily":       bool(os.getenv("TAVILY_API_KEY")),
            "playwright":   playwright_available,
            "pyautogui":    pyautogui_available,
            "computer_use": computer_use_available,
        },
        "system": {
            "os": platform.system(),
            "anthropic_key": bool(os.getenv("ANTHROPIC_API_KEY")),
            "tavily_key":    bool(os.getenv("TAVILY_API_KEY")),
            "openai_key":    bool(os.getenv("OPENAI_API_KEY")),
        },
    }
    if IS_LOCAL and pyautogui_available:
        try:
            import mss
            import pyautogui

            sw, sh = pyautogui.size()
            with mss.mss() as s:
                info["system"]["screen"] = f"{sw}x{sh}"
                info["system"]["monitors"] = len(s.monitors) - 1
        except Exception as exc:
            info["system"]["screen_error"] = str(exc)
    return info
