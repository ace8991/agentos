"""
Native Computer Use tool dispatcher.

This tool routes to the Anthropic computer_20251124 actions:
  - screenshot
  - mouse_move, left_click, right_click, double_click, left_click_drag
  - type, key
  - cursor_position, scroll, zoom

When Claude (Opus 4.5+, Sonnet 4.6+, Haiku 4.5) is active, the provider sends
this as a `computer_20251124` typed tool. When other models are active, the
provider filters this out — they use the semantic toolkit instead.
"""
from __future__ import annotations

import io
from typing import Any

from ..core.types import ToolResult
from .base import Tool


class ComputerUseTool(Tool):
    name = "computer"
    description = (
        "Anthropic-native pixel-precise computer control. Available actions: "
        "screenshot, mouse_move, left_click, right_click, double_click, "
        "left_click_drag, type, key, cursor_position, scroll, zoom."
    )
    # Anthropic auto-injects the schema based on tool type, but we provide a
    # generic fallback so non-Anthropic providers can ignore it cleanly.
    parameters = {
        "type": "object",
        "properties": {
            "action": {"type": "string"},
            "coordinate": {"type": "array"},
            "text": {"type": "string"},
        },
        "required": ["action"],
    }
    is_computer_use_native = True
    is_semantic = False  # Hide from non-Claude models

    def execute(self, args: dict[str, Any]) -> ToolResult:
        action = args.get("action")
        try:
            import pyautogui
            from PIL import Image
            import mss
        except ImportError as e:
            return ToolResult(tool_call_id="", content=f"Missing dep: {e}", is_error=True)

        if action == "screenshot":
            with mss.mss() as sct:
                shot = sct.grab(sct.monitors[1])
                img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                return ToolResult(tool_call_id="", content="Screenshot taken", image=buf.getvalue())

        if action == "mouse_move":
            x, y = args["coordinate"]
            pyautogui.moveTo(x, y, duration=0.2)
            return ToolResult(tool_call_id="", content=f"Moved to ({x},{y})")

        if action in ("left_click", "right_click", "middle_click"):
            button = action.split("_")[0]
            coord = args.get("coordinate")
            if coord:
                pyautogui.click(coord[0], coord[1], button=button)
            else:
                pyautogui.click(button=button)
            return ToolResult(tool_call_id="", content=f"{action} at {coord or 'current'}")

        if action == "double_click":
            coord = args.get("coordinate")
            if coord:
                pyautogui.doubleClick(coord[0], coord[1])
            else:
                pyautogui.doubleClick()
            return ToolResult(tool_call_id="", content=f"double_click at {coord or 'current'}")

        if action == "left_click_drag":
            start = args["start_coordinate"]
            end = args["coordinate"]
            pyautogui.moveTo(start[0], start[1])
            pyautogui.dragTo(end[0], end[1], duration=0.5, button="left")
            return ToolResult(tool_call_id="", content=f"drag {start} → {end}")

        if action == "type":
            text = args["text"]
            pyautogui.write(text, interval=0.02)
            return ToolResult(tool_call_id="", content=f"Typed {len(text)} chars")

        if action == "key":
            keys = args["text"].lower().split("+")
            if len(keys) == 1:
                pyautogui.press(keys[0])
            else:
                pyautogui.hotkey(*keys)
            return ToolResult(tool_call_id="", content=f"Pressed {args['text']}")

        if action == "cursor_position":
            x, y = pyautogui.position()
            return ToolResult(tool_call_id="", content={"x": x, "y": y})

        if action == "scroll":
            direction = args.get("scroll_direction", "down")
            amount = args.get("scroll_amount", 3)
            sign = 1 if direction in ("up", "left") else -1
            pyautogui.scroll(sign * amount * 100)
            return ToolResult(tool_call_id="", content=f"Scrolled {direction} {amount}")

        return ToolResult(
            tool_call_id="",
            content=f"Unknown action: {action}",
            is_error=True,
        )
