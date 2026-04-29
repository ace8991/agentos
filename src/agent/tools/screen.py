"""Screen capture tools using mss.

Completely independent of any LLM.
"""

from __future__ import annotations

import base64
import logging
from io import BytesIO

import mss
from PIL import Image

from src.agent.tools.base import registry

logger = logging.getLogger("agentos.agent.tools.screen")


def take_screenshot() -> str:
    """Capture the primary monitor and return base64-encoded JPEG.

    Returns:
        Base64-encoded JPEG string.
    """
    try:
        with mss.mss() as sct:
            monitor = sct.monitors[1]  # Primary monitor
            screenshot = sct.grab(monitor)
            img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
    except Exception as exc:
        logger.error("Screenshot failed: %s", exc)
        return f"ERROR: Screenshot failed: {exc}"

    # Resize if too large
    max_width = 1280
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=75)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


# Register tool
registry.register("screenshot", lambda: f"[SCREENSHOT:{take_screenshot()}]")
