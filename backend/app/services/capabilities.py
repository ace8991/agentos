import importlib.util
import platform

from app.config import IS_LOCAL, MODE
from app.services.computer_use import resolve_computer_use_runtime
from app.services.openclaw_hub import get_openclaw_state
from app.services.remote_control import get_remote_config
from app.services.runtime_config import has_runtime_value


def detect_capabilities() -> dict:
    playwright_available = importlib.util.find_spec("playwright") is not None
    pyautogui_available = IS_LOCAL and importlib.util.find_spec("pyautogui") is not None
    computer_use_runtime = resolve_computer_use_runtime()
    computer_use_available = IS_LOCAL and pyautogui_available and bool(computer_use_runtime["ready"])
    remote_config = get_remote_config()
    openclaw_state = get_openclaw_state()

    return {
        "status": "ok",
        "version": "1.1.0",
        "mode": MODE,
        "available_tools": {
            "tavily": has_runtime_value("TAVILY_API_KEY"),
            "playwright": playwright_available,
            "pyautogui": pyautogui_available,
            "computer_use": computer_use_available,
        },
        "providers": {
            "anthropic": has_runtime_value("ANTHROPIC_API_KEY"),
            "openai": has_runtime_value("OPENAI_API_KEY"),
            "deepseek": has_runtime_value("DEEPSEEK_API_KEY"),
            "google": has_runtime_value("GOOGLE_API_KEY"),
            "tavily": has_runtime_value("TAVILY_API_KEY"),
        },
        "runtime": {
            "supports_browser": playwright_available,
            "supports_terminal": IS_LOCAL,
            "supports_desktop": pyautogui_available,
            "supports_remote_commands": remote_config.enabled,
            "approval_required": remote_config.approval_required,
            "computer_use_provider": computer_use_runtime["provider"],
            "computer_use_model": computer_use_runtime["model"],
        },
        "remote": remote_config.model_dump(),
        "openclaw": {
            "gateway_status": openclaw_state.gateway.status,
            "connected_devices": openclaw_state.gateway.connected_devices,
            "configured_channels": sum(1 for channel in openclaw_state.channels if channel.configured),
            "voice_overlay": openclaw_state.overlays.voice_overlay,
            "mobile_hud": openclaw_state.overlays.mobile_hud,
        },
        "system": {
            "os": platform.system(),
            "anthropic_key": has_runtime_value("ANTHROPIC_API_KEY"),
            "tavily_key": has_runtime_value("TAVILY_API_KEY"),
            "openai_key": has_runtime_value("OPENAI_API_KEY"),
            "deepseek_key": has_runtime_value("DEEPSEEK_API_KEY"),
            "google_key": has_runtime_value("GOOGLE_API_KEY"),
            "computer_use_provider": computer_use_runtime["provider"],
            "computer_use_model": computer_use_runtime["model"],
            "computer_use_ready": computer_use_runtime["ready"],
        },
    }
