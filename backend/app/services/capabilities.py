import importlib.util
import platform

from app.config import IS_LOCAL, MODE
from app.services.browser import get_browser_runtime_config
from app.services.computer_use import resolve_computer_use_runtime
from app.services.desktop_commander import get_config as get_desktop_commander_config
from app.services.mobile_hub import get_mobile_hub_state
from app.services.remote_control import get_remote_config
from app.services.runtime_config import has_runtime_value


def detect_capabilities() -> dict:
    playwright_available = importlib.util.find_spec("playwright") is not None
    pyautogui_available = IS_LOCAL and importlib.util.find_spec("pyautogui") is not None
    computer_use_runtime = resolve_computer_use_runtime()
    computer_use_available = IS_LOCAL and pyautogui_available and bool(computer_use_runtime["ready"])
    remote_config = get_remote_config()
    mobile_hub_state = get_mobile_hub_state()

    # Project generator is ready when at least one LLM provider is configured.
    _provider_keys = (
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "DEEPSEEK_API_KEY",
        "GOOGLE_API_KEY",
        "MISTRAL_API_KEY",
        "GROQ_API_KEY",
        "QWEN_API_KEY",
    )
    _provider_ready = [k.replace("_API_KEY", "").lower() for k in _provider_keys if has_runtime_value(k)]
    project_generator_ready = len(_provider_ready) > 0

    return {
        "status": "ok",
        "version": "1.1.0",
        "mode": MODE,
        "available_tools": {
            "desktop_commander": IS_LOCAL,
            "tavily": has_runtime_value("TAVILY_API_KEY"),
            "playwright": playwright_available,
            "pyautogui": pyautogui_available,
            "computer_use": computer_use_available,
        },
        "desktop_commander": get_desktop_commander_config() if IS_LOCAL else None,
        "providers": {
            "anthropic": has_runtime_value("ANTHROPIC_API_KEY"),
            "openai": has_runtime_value("OPENAI_API_KEY"),
            "deepseek": has_runtime_value("DEEPSEEK_API_KEY"),
            "google": has_runtime_value("GOOGLE_API_KEY"),
            "mistral": has_runtime_value("MISTRAL_API_KEY"),
            "groq": has_runtime_value("GROQ_API_KEY"),
            "qwen": has_runtime_value("QWEN_API_KEY"),
            "tavily": has_runtime_value("TAVILY_API_KEY"),
        },
        "runtime": {
            "supports_browser": playwright_available,
            "supports_terminal": IS_LOCAL,
            "supports_desktop": pyautogui_available,
            "supports_desktop_commander": IS_LOCAL,
            "supports_remote_commands": remote_config.enabled,
            "approval_required": remote_config.approval_required,
            "computer_use_provider": computer_use_runtime["provider"],
            "computer_use_model": computer_use_runtime["model"],
        },
        "browser": get_browser_runtime_config() if playwright_available else None,
        "remote": remote_config.model_dump(),
        "mobile_hub": {
            "gateway_status": mobile_hub_state.gateway.status,
            "connected_devices": mobile_hub_state.gateway.connected_devices,
            "configured_channels": sum(1 for channel in mobile_hub_state.channels if channel.configured),
            "voice_overlay": mobile_hub_state.overlays.voice_overlay,
            "mobile_hud": mobile_hub_state.overlays.mobile_hud,
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
            "desktop_commander_ready": IS_LOCAL,
        },
        "project_generator": {
            "ready": project_generator_ready,
            "providers": _provider_ready,
            "reason": None if project_generator_ready else "No LLM provider configured",
        },
    }

