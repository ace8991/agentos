"""
UI Automation tree tools (Windows-specific).

This is the SEMANTIC equivalent of the Chrome extension's accessibility tree.
Instead of asking the LLM to guess pixel coordinates, we expose the Windows
UI as a structured JSON tree. Any LLM with function calling (DeepSeek, GPT,
Gemini, local models) can reliably drive the desktop using element IDs.

Workflow:
  1. Agent calls read_ui_tree() → gets {elements: [{id, name, type, bbox}, ...]}
  2. Agent calls click_element(id="e_42") → we translate id → coords → click
  3. Agent calls type_in_field(id="e_43", text="hello") → focus + type

Linux/macOS support: leave as TODO. On OSes, fall back to pure
screenshot+pixel mode (which only Claude does well).
"""
from __future__ import annotations

import logging
import platform
import threading
from typing import Any

from ..core.types import ToolResult
from .base import Tool

logger = logging.getLogger("agentos.agent.ui_tree")

# In-memory mapping: element_id → (x, y, w, h) for the current snapshot
_ELEMENT_CACHE: dict[str, tuple[int, int, int, int]] = {}
_CACHE_LOCK = threading.Lock()


def _is_windows() -> bool:
    return platform.system() == "Windows"


def _read_uia_tree(max_depth: int = 6, max_elements: int = 200) -> dict:
    """Walk the Windows UIA tree of the foreground window and serialize.

    Returns a dict with `elements` (list) and `active_window` (str).
    Raises RuntimeError if not on Windows or uiautomation isn't installed.
    """
    if not _is_windows():
        raise RuntimeError("UI tree is Windows-only. On macOS/Linux, use mouse/keyboard tools with screenshots.")

    try:
        import uiautomation as auto
    except ImportError as e:
        raise RuntimeError(f"uiautomation library not installed: {e}")

    # Get the foreground window
    fg = auto.GetForegroundControl()
    if fg is None:
        return {"elements": [], "active_window": None}

    elements: list[dict] = []
    counter = [0]

    def walk(ctrl, depth: int):
        if counter[0] >= max_elements or depth > max_depth:
            return
        try:
            rect = ctrl.BoundingRectangle
            if rect.width() <= 0 or rect.height() <= 0:
                # Skip invisible elements but still walk children
                pass
            else:
                eid = f"e_{counter[0]}"
                elements.append({
                    "id": eid,
                    "name": (ctrl.Name or "").strip()[:80],
                    "type": ctrl.ControlTypeName,
                    "value": _get_value(ctrl),
                    "bbox": [rect.left, rect.top, rect.right, rect.bottom],
                    "enabled": ctrl.IsEnabled,
                })
                with _CACHE_LOCK:
                    _ELEMENT_CACHE[eid] = (
                        rect.left, rect.top,
                        rect.right - rect.left,
                        rect.bottom - rect.top,
                    )
                counter[0] += 1
        except Exception:
            return
        for child in ctrl.GetChildren():
            walk(child, depth + 1)

    # Clear and refill cache
    with _CACHE_LOCK:
        _ELEMENT_CACHE.clear()

    walk(fg, 0)

    return {
        "active_window": fg.Name,
        "window_bbox": [
            fg.BoundingRectangle.left,
            fg.BoundingRectangle.top,
            fg.BoundingRectangle.right,
            fg.BoundingRectangle.bottom,
        ],
        "elements": elements,
    }


def _get_value(ctrl) -> str | None:
    """Try to extract a value from a control (for Edit, ComboBox, etc.)."""
    try:
        if hasattr(ctrl, "GetValuePattern"):
            pattern = ctrl.GetValuePattern()
            if pattern:
                return (pattern.Value or "")[:120]
    except Exception:
        pass
    return None


def _resolve_element(element_id: str) -> tuple[int, int]:
    """Get the center coordinates of a previously-discovered element."""
    with _CACHE_LOCK:
        if element_id not in _ELEMENT_CACHE:
            raise KeyError(
                f"Element '{element_id}' not in cache. Call read_ui_tree first to refresh."
            )
        x, y, w, h = _ELEMENT_CACHE[element_id]
    return x + w // 2, y + h // 2


# ─────────────────────────────────────────────────────────────────
# TOOLS
# ─────────────────────────────────────────────────────────────────

class ReadUITreeTool(Tool):
    name = "read_ui_tree"
    description = (
        "Read the Windows accessibility tree of the foreground window. "
        "Returns a JSON list of UI elements with their IDs, names, types, "
        "and bounding boxes. ALWAYS call this before clicking or typing on "
        "non-Claude models — it gives you reliable element IDs to target."
    )
    parameters = {
        "type": "object",
        "properties": {
            "max_elements": {"type": "integer", "description": "Cap on number of elements to return (default 200)"},
            "max_depth": {"type": "integer", "description": "Max tree depth to walk (default 6)"},
        },
        "required": [],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        try:
            tree = _read_uia_tree(
                max_depth=args.get("max_depth", 6),
                max_elements=args.get("max_elements", 200),
            )
            return ToolResult(tool_call_id="", content=tree)
        except RuntimeError as e:
            return ToolResult(tool_call_id="", content=str(e), is_error=True)


class ClickElementTool(Tool):
    name = "click_element"
    description = (
        "Click on a UI element by its ID (obtained from read_ui_tree). "
        "More reliable than pixel coordinates for non-Claude models."
    )
    parameters = {
        "type": "object",
        "properties": {
            "element_id": {"type": "string", "description": "ID like 'e_42' from read_ui_tree"},
            "button": {"type": "string", "enum": ["left", "right"], "description": "Default 'left'"},
            "double_click": {"type": "boolean"},
        },
        "required": ["element_id"],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        try:
            x, y = _resolve_element(args["element_id"])
        except KeyError as e:
            return ToolResult(tool_call_id="", content=str(e), is_error=True)

        import pyautogui
        button = args.get("button", "left")
        clicks = 2 if args.get("double_click") else 1
        pyautogui.click(x=x, y=y, button=button, clicks=clicks)
        return ToolResult(
            tool_call_id="",
            content=f"Clicked {args['element_id']} at ({x},{y}) [{button} x{clicks}]",
        )


class TypeInFieldTool(Tool):
    name = "type_in_field"
    description = (
        "Click a UI element (typically an input field) and type text into it. "
        "Use this instead of separate click + type for reliability."
    )
    parameters = {
        "type": "object",
        "properties": {
            "element_id": {"type": "string"},
            "text": {"type": "string"},
            "clear_first": {"type": "boolean", "description": "Select all + delete before typing (default true)"},
        },
        "required": ["element_id", "text"],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        try:
            x, y = _resolve_element(args["element_id"])
        except KeyError as e:
            return ToolResult(tool_call_id="", content=str(e), is_error=True)

        import pyautogui
        pyautogui.click(x=x, y=y)
        if args.get("clear_first", True):
            pyautogui.hotkey("ctrl", "a")
            pyautogui.press("delete")
        pyautogui.write(args["text"], interval=0.02)
        return ToolResult(
            tool_call_id="",
            content=f"Typed into {args['element_id']}: '{args['text'][:40]}...'",
        )
