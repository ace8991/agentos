"""Keyboard control tools using pyautogui.

Completely independent of any LLM.
"""

from __future__ import annotations

import logging

import pyautogui

from src.agent.tools.base import registry

logger = logging.getLogger("agentos.agent.tools.keyboard")


def type_text(text: str) -> str:
    """Type the given text using the keyboard."""
    if not text:
        return "ERROR: No text provided"
    pyautogui.write(str(text), interval=0.03)
    preview = text[:60] + ("..." if len(text) > 60 else "")
    return f"Typed: {preview}"


def press_keys(keys: str) -> str:
    """Press a keyboard shortcut (e.g. 'ctrl+s', 'alt+f4')."""
    if not keys:
        return "ERROR: No keys provided"
    key_list = [k.strip() for k in keys.split("+")]
    if len(key_list) > 1:
        pyautogui.hotkey(*key_list)
    else:
        pyautogui.press(key_list[0])
    return f"Pressed: {keys}"


# Register tools
registry.register("type_text", type_text)
registry.register("press_keys", press_keys)
