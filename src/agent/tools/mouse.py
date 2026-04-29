"""Mouse control tools using pyautogui.

Completely independent of any LLM.
"""

from __future__ import annotations

import logging

import pyautogui

from src.agent.tools.base import registry

logger = logging.getLogger("agentos.agent.tools.mouse")

# Safety settings
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.05


def mouse_move(x: int, y: int) -> str:
    """Move mouse to absolute pixel coordinates."""
    screen_w, screen_h = pyautogui.size()
    if not (0 <= x <= screen_w and 0 <= y <= screen_h):
        return f"ERROR: Coordinates ({x}, {y}) out of screen bounds ({screen_w}x{screen_h})"
    pyautogui.moveTo(x, y, duration=0.15)
    return f"Moved mouse to ({x}, {y})"


def mouse_click(x: int, y: int, button: str = "left") -> str:
    """Click at absolute pixel coordinates."""
    screen_w, screen_h = pyautogui.size()
    if not (0 <= x <= screen_w and 0 <= y <= screen_h):
        return f"ERROR: Coordinates ({x}, {y}) out of screen bounds ({screen_w}x{screen_h})"

    button_map = {
        "left": pyautogui.click,
        "right": pyautogui.rightClick,
        "middle": pyautogui.middleClick,
        "double": pyautogui.doubleClick,
    }
    click_fn = button_map.get(button, pyautogui.click)
    pyautogui.moveTo(x, y, duration=0.15)
    click_fn(x, y)
    return f"Clicked {button} at ({x}, {y})"


def double_click(x: int, y: int) -> str:
    """Double-click at coordinates."""
    return mouse_click(x, y, button="double")


def right_click(x: int, y: int) -> str:
    """Right-click at coordinates."""
    return mouse_click(x, y, button="right")


def drag(start_x: int, start_y: int, end_x: int, end_y: int, button: str = "left") -> str:
    """Drag from one point to another."""
    pyautogui.moveTo(start_x, start_y, duration=0.1)
    pyautogui.dragTo(end_x, end_y, duration=0.3, button=button)
    return f"Dragged from ({start_x},{start_y}) to ({end_x},{end_y})"


def scroll(amount: int) -> str:
    """Scroll at current mouse position. Positive = down, negative = up."""
    pyautogui.scroll(amount)
    direction = "down" if amount > 0 else "up"
    return f"Scrolled {direction} by {abs(amount)}"


# Register tools
registry.register("mouse_move", mouse_move)
registry.register("mouse_click", mouse_click)
registry.register("double_click", double_click)
registry.register("right_click", right_click)
registry.register("drag", drag)
registry.register("scroll", scroll)
