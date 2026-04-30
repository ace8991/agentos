"""Mouse control tools using pyautogui."""
from __future__ import annotations

from typing import Any

from ..core.types import ToolResult
from .base import Tool


def _pyautogui():
    """Lazy import to avoid loading display libs unless needed."""
    import pyautogui
    pyautogui.FAILSAFE = True   # Move mouse to corner = abort
    pyautogui.PAUSE = 0.05      # Small pause between actions for stability
    return pyautogui


class MouseMoveTool(Tool):
    name = "mouse_move"
    description = "Move the mouse cursor to absolute screen coordinates (x, y)."
    parameters = {
        "type": "object",
        "properties": {
            "x": {"type": "integer", "description": "X coordinate in pixels"},
            "y": {"type": "integer", "description": "Y coordinate in pixels"},
            "duration": {"type": "number", "description": "Movement duration in seconds (default 0.2)"},
        },
        "required": ["x", "y"],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        pg = _pyautogui()
        pg.moveTo(args["x"], args["y"], duration=args.get("duration", 0.2))
        return ToolResult(tool_call_id="", content=f"Moved to ({args['x']}, {args['y']})")


class MouseClickTool(Tool):
    name = "mouse_click"
    description = (
        "Click at coordinates (x, y). If x/y omitted, clicks at current position. "
        "Button can be 'left', 'right', or 'middle'. Set clicks=2 for double-click."
    )
    parameters = {
        "type": "object",
        "properties": {
            "x": {"type": "integer"},
            "y": {"type": "integer"},
            "button": {"type": "string", "enum": ["left", "right", "middle"]},
            "clicks": {"type": "integer", "description": "Number of clicks (1 or 2)"},
        },
        "required": [],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        pg = _pyautogui()
        x = args.get("x")
        y = args.get("y")
        button = args.get("button", "left")
        clicks = args.get("clicks", 1)
        if x is not None and y is not None:
            pg.click(x=x, y=y, button=button, clicks=clicks)
            return ToolResult(tool_call_id="", content=f"{button} click at ({x},{y}) x{clicks}")
        pg.click(button=button, clicks=clicks)
        return ToolResult(tool_call_id="", content=f"{button} click at current pos x{clicks}")


class MouseDragTool(Tool):
    name = "mouse_drag"
    description = "Drag from (x1, y1) to (x2, y2) holding the left mouse button."
    parameters = {
        "type": "object",
        "properties": {
            "x1": {"type": "integer"},
            "y1": {"type": "integer"},
            "x2": {"type": "integer"},
            "y2": {"type": "integer"},
            "duration": {"type": "number"},
        },
        "required": ["x1", "y1", "x2", "y2"],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        pg = _pyautogui()
        pg.moveTo(args["x1"], args["y1"])
        pg.dragTo(args["x2"], args["y2"], duration=args.get("duration", 0.5), button="left")
        return ToolResult(
            tool_call_id="",
            content=f"Dragged ({args['x1']},{args['y1']}) → ({args['x2']},{args['y2']})",
        )


class MouseScrollTool(Tool):
    name = "mouse_scroll"
    description = "Scroll the mouse wheel. Positive = up, negative = down."
    parameters = {
        "type": "object",
        "properties": {
            "amount": {"type": "integer", "description": "Scroll amount (positive=up, negative=down)"},
            "x": {"type": "integer"},
            "y": {"type": "integer"},
        },
        "required": ["amount"],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        pg = _pyautogui()
        x = args.get("x")
        y = args.get("y")
        if x is not None and y is not None:
            pg.scroll(args["amount"], x=x, y=y)
        else:
            pg.scroll(args["amount"])
        return ToolResult(tool_call_id="", content=f"Scrolled {args['amount']}")
