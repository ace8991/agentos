"""Keyboard control tools using pyautogui."""
from __future__ import annotations

from typing import Any

from ..core.types import ToolResult
from .base import Tool


def _pyautogui():
    import pyautogui
    pyautogui.FAILSAFE = True
    return pyautogui


class KeyboardTypeTool(Tool):
    name = "keyboard_type"
    description = (
        "Type a string of text at the current cursor position. "
        "Use this for entering text into focused fields."
    )
    parameters = {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "Text to type"},
            "interval": {"type": "number", "description": "Seconds between keystrokes (default 0.02)"},
        },
        "required": ["text"],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        pg = _pyautogui()
        text = args["text"]
        interval = args.get("interval", 0.02)
        pg.write(text, interval=interval)
        return ToolResult(tool_call_id="", content=f"Typed {len(text)} chars")


class KeyboardPressTool(Tool):
    name = "keyboard_press"
    description = (
        "Press a key combination, e.g. 'enter', 'ctrl+s', 'alt+tab', 'win+r'. "
        "Use '+' to combine modifiers."
    )
    parameters = {
        "type": "object",
        "properties": {
            "keys": {
                "type": "string",
                "description": "Key combo like 'ctrl+s', 'enter', 'alt+f4', 'win+r'",
            },
        },
        "required": ["keys"],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        pg = _pyautogui()
        combo = args["keys"].lower().split("+")
        if len(combo) == 1:
            pg.press(combo[0])
        else:
            pg.hotkey(*combo)
        return ToolResult(tool_call_id="", content=f"Pressed {args['keys']}")
