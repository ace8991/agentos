from fastapi import APIRouter
from app.config import IS_LOCAL
from app.services.capabilities import detect_capabilities

router = APIRouter()

@router.get("/health")
async def health():
    info = detect_capabilities()
    if IS_LOCAL and info["available_tools"]["pyautogui"]:
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
