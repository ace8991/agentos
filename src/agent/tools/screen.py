"""Screenshot tool using mss (fast, cross-platform)."""
from __future__ import annotations

import io
from typing import Any

from ..core.types import ToolResult
from .base import Tool


class ScreenshotTool(Tool):
    name = "screenshot"
    description = (
        "Capture a screenshot of the entire primary monitor. "
        "Returns the image as PNG bytes embedded in the result."
    )
    parameters = {
        "type": "object",
        "properties": {
            "monitor": {
                "type": "integer",
                "description": "Monitor index (0 = all, 1 = primary). Default: 1",
            },
        },
        "required": [],
    }
    is_semantic = True
    is_computer_use_native = False  # Claude has its own screenshot built into computer

    def execute(self, args: dict[str, Any]) -> ToolResult:
        try:
            import mss
            from PIL import Image
        except ImportError as e:
            return ToolResult(
                tool_call_id="",
                content=f"mss/Pillow not installed: {e}",
                is_error=True,
            )

        monitor = args.get("monitor", 1)
        with mss.mss() as sct:
            try:
                shot = sct.grab(sct.monitors[monitor])
            except IndexError:
                shot = sct.grab(sct.monitors[1])
            img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            png_bytes = buf.getvalue()

        return ToolResult(
            tool_call_id="",
            content={"width": img.width, "height": img.height, "size_bytes": len(png_bytes)},
            image=png_bytes,
        )
