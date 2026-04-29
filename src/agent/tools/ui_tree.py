"""Windows UI Automation (UIA) accessibility tree tools.

This is the CRITICAL piece that makes the agent work with ANY LLM.
Instead of guessing pixel coordinates, the LLM gets a structured UI tree
and calls click_element(element_id) to interact with specific UI elements.

The element IDs are stable within a single tree snapshot and map to
bounding boxes that are then used for mouse actions.

This is the Windows equivalent of the Chrome extension's accessibility tree DOM.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field, asdict
from typing import Any

import pyautogui

from src.agent.tools.base import registry

logger = logging.getLogger("agentos.agent.tools.ui_tree")

try:
    import uiautomation as uia
    UIA_AVAILABLE = True
except ImportError:
    UIA_AVAILABLE = False
    logger.warning(
        "uiautomation not available. UI tree tools will return placeholder data. "
        "Install with: pip install uiautomation"
    )


@dataclass
class UIElement:
    """A single UI element from the accessibility tree."""

    id: str
    name: str
    type: str
    bbox: tuple[int, int, int, int]  # left, top, right, bottom
    children: list[UIElement] = field(default_factory=list)


@dataclass
class UITree:
    """The full UI tree snapshot."""

    elements: list[dict[str, Any]]
    active_window: str = ""
    collected_at: float = 0.0


_element_counter: int = 0
_cached_tree: UITree | None = None
_cache_time: float = 0
_CACHE_TTL = 1.0  # seconds


def _get_control_type(control: Any) -> str:
    """Get a human-readable control type name."""
    if not UIA_AVAILABLE:
        return "Unknown"
    type_map = {
        uia.ControlType.Button: "Button",
        uia.ControlType.Edit: "Edit",
        uia.ControlType.Text: "Text",
        uia.ControlType.List: "List",
        uia.ControlType.ListItem: "ListItem",
        uia.ControlType.ComboBox: "ComboBox",
        uia.ControlType.CheckBox: "CheckBox",
        uia.ControlType.RadioButton: "RadioButton",
        uia.ControlType.Tab: "Tab",
        uia.ControlType.Tree: "Tree",
        uia.ControlType.Menu: "Menu",
        uia.ControlType.MenuItem: "MenuItem",
        uia.ControlType.ToolBar: "ToolBar",
        uia.ControlType.TitleBar: "TitleBar",
        uia.ControlType.Window: "Window",
        uia.ControlType.Pane: "Pane",
        uia.ControlType.Document: "Document",
        uia.ControlType.ScrollBar: "ScrollBar",
        uia.ControlType.Image: "Image",
        uia.ControlType.Link: "Link",
        uia.ControlType.Hyperlink: "Hyperlink",
        uia.ControlType.ProgressBar: "ProgressBar",
        uia.ControlType.Slider: "Slider",
        uia.ControlType.Spinner: "Spinner",
        uia.ControlType.StatusBar: "StatusBar",
        uia.ControlType.Table: "Table",
        uia.ControlType.Header: "Header",
        uia.ControlType.HeaderItem: "HeaderItem",
        uia.ControlType.DataGrid: "DataGrid",
        uia.ControlType.DataItem: "DataItem",
        uia.ControlType.TreeItem: "TreeItem",
        uia.ControlType.Group: "Group",
        uia.ControlType.ToolTip: "ToolTip",
        uia.ControlType.Thumb: "Thumb",
        uia.ControlType.Custom: "Custom",
        uia.ControlType.Separator: "Separator",
    }
    try:
        return type_map.get(control.ControlType, "Unknown")
    except Exception:
        return "Unknown"


def _is_interactive(control_type: str) -> bool:
    """Check if a control type is likely interactive."""
    interactive_types = {
        "Button", "Edit", "ComboBox", "CheckBox", "RadioButton",
        "Tab", "MenuItem", "Link", "Hyperlink", "TreeItem",
        "ListItem", "Slider", "Spinner", "DataItem", "HeaderItem",
        "ScrollBar", "Thumb",
    }
    return control_type in interactive_types


def get_ui_tree(window_title: str | None = None) -> str:
    """Get the current Windows UI Automation tree as JSON.

    Args:
        window_title: Optional window title filter (substring match).

    Returns:
        JSON string with elements list and active window info.
    """
    global _element_counter, _cached_tree, _cache_time

    now = time.monotonic()
    if _cached_tree and (now - _cache_time) < _CACHE_TTL and not window_title:
        return json.dumps(asdict(_cached_tree), ensure_ascii=False)

    if not UIA_AVAILABLE:
        return json.dumps(
            {
                "elements": [],
                "active_window": "UI Automation not available",
                "note": "Install uiautomation: pip install uiautomation",
            },
            ensure_ascii=False,
        )

    _element_counter = 0
    elements: list[dict[str, Any]] = []
    active_window = ""

    try:
        root = uia.GetRootControl()
        if not root:
            return json.dumps({"elements": [], "active_window": "No root control found"})

        active_window = root.Name or "Desktop"

        # Get the foreground window
        foreground = uia.GetForegroundControl()
        if not foreground:
            foreground = root

        # Walk the UI tree
        _walk_tree(foreground, elements, window_title, depth=0, max_depth=5)

    except Exception as exc:
        logger.exception("UI tree walk failed")
        return json.dumps(
            {"elements": [], "active_window": f"Error: {exc}"},
            ensure_ascii=False,
        )

    tree = UITree(elements=elements, active_window=active_window, collected_at=time.time())
    _cached_tree = tree
    _cache_time = now

    return json.dumps(asdict(tree), ensure_ascii=False)


def _walk_tree(
    control: Any,
    elements: list[dict],
    window_filter: str | None,
    depth: int = 0,
    max_depth: int = 5,
) -> None:
    """Recursively walk the UIA tree and collect interactive elements."""
    global _element_counter

    if depth > max_depth:
        return

    if not control:
        return

    try:
        name = control.Name or ""
        if window_filter and window_filter.lower() not in name.lower():
            pass  # Don't filter, still walk children

        control_type = _get_control_type(control)

        # Get bounding box
        try:
            bbox = control.BoundingRectangle
            if bbox:
                left, top, right, bottom = int(bbox.left), int(bbox.top), int(bbox.right), int(bbox.bottom)
            else:
                left, top, right, bottom = 0, 0, 0, 0
        except Exception:
            left, top, right, bottom = 0, 0, 0, 0

        # Only include visible elements with reasonable size
        is_visible = (right - left) > 5 and (bottom - top) > 5
        is_interactive = _is_interactive(control_type)
        has_name = bool(name.strip())

        if is_visible and (is_interactive or has_name) and depth > 0:
            _element_counter += 1
            elem = {
                "id": f"e_{_element_counter}",
                "name": name[:80],
                "type": control_type,
                "bbox": [left, top, right, bottom],
            }
            elements.append(elem)

        # Walk children
        try:
            child = control.GetFirstChildControl()
            while child:
                _walk_tree(child, elements, window_filter, depth + 1, max_depth)
                child = child.GetNextSiblingControl()
        except Exception:
            pass

    except Exception:
        pass


def click_element(element_id: str, button: str = "left") -> str:
    """Click a UI element by its element ID from the tree.

    Looks up the element ID in the cached tree and performs a mouse click
    at the center of its bounding box.

    Args:
        element_id: The element ID (e.g. 'e_42').
        button: Mouse button ('left', 'right', 'middle').

    Returns:
        Status string.
    """
    global _cached_tree

    if not _cached_tree:
        # Refresh the tree
        get_ui_tree()

    if not _cached_tree:
        return "ERROR: No UI tree available. Call read_ui_tree first."

    # Find the element in the cached tree
    target = None
    for elem in _cached_tree.elements:
        if elem.get("id") == element_id:
            target = elem
            break

    if not target:
        return (
            f"ERROR: Element '{element_id}' not found in the current UI tree. "
            "The UI may have changed. Call read_ui_tree to refresh."
        )

    bbox = target.get("bbox")
    if not bbox or len(bbox) < 4:
        return f"ERROR: Element '{element_id}' has no bounding box."

    left, top, right, bottom = bbox[:4]
    center_x = (left + right) // 2
    center_y = (top + bottom) // 2

    # Perform the click
    try:
        button_map = {
            "left": pyautogui.click,
            "right": pyautogui.rightClick,
            "middle": pyautogui.middleClick,
        }
        click_fn = button_map.get(button, pyautogui.click)
        pyautogui.moveTo(center_x, center_y, duration=0.15)
        click_fn(center_x, center_y)
        return f"Clicked '{target.get('name', element_id)}' ({target.get('type', '?')}) at ({center_x}, {center_y})"
    except Exception as e:
        return f"ERROR clicking element '{element_id}': {e}"


def type_in_field(element_id: str, text: str, append: bool = False) -> str:
    """Type text into a UI field identified by its element ID.

    Args:
        element_id: The element ID from the UI tree.
        text: Text to type.
        append: If True, append to existing text instead of clearing.

    Returns:
        Status string.
    """
    global _cached_tree

    if not _cached_tree:
        get_ui_tree()

    if not _cached_tree:
        return "ERROR: No UI tree available. Call read_ui_tree first."

    target = None
    for elem in _cached_tree.elements:
        if elem.get("id") == element_id:
            target = elem
            break

    if not target:
        return (
            f"ERROR: Field '{element_id}' not found in the current UI tree. "
            "Call read_ui_tree to refresh."
        )

    bbox = target.get("bbox")
    if not bbox or len(bbox) < 4:
        return f"ERROR: Field '{element_id}' has no bounding box."

    left, top, right, bottom = bbox[:4]
    center_x = (left + right) // 2
    center_y = (top + bottom) // 2

    try:
        # Click the field first to focus it
        pyautogui.moveTo(center_x, center_y, duration=0.15)
        pyautogui.click(center_x, center_y)

        import time as _time
        _time.sleep(0.1)

        if not append:
            # Select all and delete existing content
            pyautogui.hotkey("ctrl", "a")
            _time.sleep(0.05)
            pyautogui.press("delete")
            _time.sleep(0.05)

        # Type the text
        pyautogui.write(str(text), interval=0.03)
        preview = text[:40] + ("..." if len(text) > 40 else "")
        action = "Appended" if append else "Typed"
        return f"{action} '{preview}' into '{target.get('name', element_id)}'"
    except Exception as e:
        return f"ERROR typing into field '{element_id}': {e}"


def double_click_element(element_id: str) -> str:
    """Double-click a UI element by its element ID."""
    return click_element(element_id, button="double")


def right_click_element(element_id: str) -> str:
    """Right-click a UI element by its element ID."""
    return click_element(element_id, button="right")


# Register all UI tree tools
registry.register("read_ui_tree", get_ui_tree)
registry.register("click_element", click_element)
registry.register("type_in_field", type_in_field)
registry.register("double_click_element", double_click_element)
registry.register("right_click_element", right_click_element)
