import base64
from io import BytesIO

import mss
from PIL import Image, ImageDraw

from app.config import IS_CLOUD


def _placeholder_image(label: str) -> str:
    img = Image.new("RGB", (1280, 800), color=(24, 24, 27))
    draw = ImageDraw.Draw(img)
    draw.text((40, 40), label, fill=(240, 240, 240))
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=75)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def capture_screenshot(monitor_index: int = 1, quality: int = 75) -> str:
    """Capture screen and return base64-encoded JPEG."""
    if IS_CLOUD:
        return _placeholder_image("Cloud mode: no desktop screen is available. Use browser_* and web_* tools.")

    try:
        with mss.mss() as sct:
            monitor = sct.monitors[monitor_index] if len(sct.monitors) > monitor_index else sct.monitors[0]
            screenshot = sct.grab(monitor)
            img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
    except Exception as exc:
        return _placeholder_image(f"Screen capture unavailable: {exc}")

    max_width = 1280
    if img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=quality)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def capture_region(x: int, y: int, width: int, height: int) -> str:
    """Capture a specific screen region."""
    try:
        with mss.mss() as sct:
            region = {"top": y, "left": x, "width": width, "height": height}
            screenshot = sct.grab(region)
            img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
    except Exception as exc:
        return _placeholder_image(f"Region capture unavailable: {exc}")

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=80)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")
