"""
Claude Computer Use service.
Used as intelligent fallback when Playwright/PyAutoGUI fail or
when the UI is too complex for standard selectors.

Claude CU returns typed tool_use blocks (computer, text_editor, bash)
which we translate back into our AgentAction schema.
"""
import base64
import logging
import os
import re
from typing import Optional
import anthropic
from app.services.capture import capture_screenshot
from app.services.executor import _click, _type, _key, _shell

logger = logging.getLogger(__name__)

CU_SYSTEM = """You are a computer control agent. You can see the screen and must
accomplish the given subtask using the available tools.
Be precise with coordinates. Prefer clicking over typing when possible.
Stop as soon as the subtask is complete."""


def _client():
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError("ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=key)


def run_computer_use(
    subtask: str,
    screenshot_b64: Optional[str] = None,
    max_iterations: int = 5,
) -> dict:
    """
    Run Claude Computer Use for a specific subtask.
    Handles the inner tool_use loop autonomously (up to max_iterations).
    Returns a summary dict with success, actions_taken, description.
    """
    client = _client()

    # Get fresh screenshot if not provided
    if not screenshot_b64:
        screenshot_b64 = capture_screenshot()

    import pyautogui
    screen_w, screen_h = pyautogui.size()

    tools = [
        {
            "type": "computer_20250124",
            "name": "computer",
            "display_width_px": screen_w,
            "display_height_px": screen_h,
            "display_number": 1,
        },
        {
            "type": "text_editor_20250124",
            "name": "str_replace_editor",
        },
        {
            "type": "bash_20250124",
            "name": "bash",
        },
    ]

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": screenshot_b64,
                    },
                },
                {"type": "text", "text": f"Subtask: {subtask}"},
            ],
        }
    ]

    actions_taken = []
    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        try:
            response = client.messages.create(
                model="claude-opus-4-5",  # CU requires Opus or Sonnet 3.5+
                max_tokens=1024,
                system=CU_SYSTEM,
                tools=tools,
                messages=messages,
            )
        except Exception as e:
            logger.error(f"CU API call failed: {e}")
            return {
                "success": False,
                "actions_taken": actions_taken,
                "description": f"Computer Use API error: {e}",
            }

        # Collect tool use blocks
        tool_uses = [b for b in response.content if b.type == "tool_use"]
        text_blocks = [b for b in response.content if b.type == "text"]

        if not tool_uses:
            # No more tools needed — done
            final_text = text_blocks[0].text if text_blocks else "Subtask complete"
            return {
                "success": True,
                "actions_taken": actions_taken,
                "description": final_text[:300],
            }

        # Execute each tool use and collect results
        tool_results = []
        for tu in tool_uses:
            result = _execute_cu_tool(tu, actions_taken)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu.id,
                "content": result["content"],
            })

        # Feed results back — take a new screenshot for next iteration
        fresh_screenshot = capture_screenshot()
        messages.append({"role": "assistant", "content": response.content})
        messages.append({
            "role": "user",
            "content": tool_results + [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": fresh_screenshot,
                    },
                }
            ],
        })

        if response.stop_reason == "end_turn":
            break

    return {
        "success": True,
        "actions_taken": actions_taken,
        "description": f"Computer Use completed {len(actions_taken)} actions: "
                       + "; ".join(actions_taken[-3:]),
    }


def _execute_cu_tool(tool_use, actions_log: list) -> dict:
    """Execute a single tool_use block from Claude CU."""
    name = tool_use.name
    inp = tool_use.input

    try:
        if name == "computer":
            return _handle_computer(inp, actions_log)
        elif name == "str_replace_editor":
            return _handle_editor(inp, actions_log)
        elif name == "bash":
            cmd = inp.get("command", "")
            result = _shell(cmd)
            actions_log.append(f"bash: {cmd[:60]}")
            return {"content": result.get("stdout", "") or result.get("stderr", "")}
        else:
            return {"content": f"Unknown tool: {name}"}
    except Exception as e:
        logger.error(f"CU tool execution error ({name}): {e}")
        return {"content": f"Error: {e}"}


def _handle_computer(inp: dict, actions_log: list) -> dict:
    action = inp.get("action", "")
    coord = inp.get("coordinate", [0, 0])
    x, y = int(coord[0]), int(coord[1])

    if action == "screenshot":
        fresh = capture_screenshot()
        return {"content": [{"type": "image", "source": {"type": "base64",
                "media_type": "image/jpeg", "data": fresh}}]}

    elif action in ("left_click", "double_click", "right_click", "middle_click"):
        import pyautogui
        pyautogui.moveTo(x, y, duration=0.15)
        if action == "double_click":
            pyautogui.doubleClick(x, y)
        elif action == "right_click":
            pyautogui.rightClick(x, y)
        elif action == "middle_click":
            pyautogui.middleClick(x, y)
        else:
            pyautogui.click(x, y)
        actions_log.append(f"{action} ({x},{y})")
        return {"content": f"Performed {action} at ({x}, {y})"}

    elif action == "type":
        text = inp.get("text", "")
        import pyautogui
        pyautogui.write(text, interval=0.03)
        actions_log.append(f"type: {text[:40]}")
        return {"content": f"Typed: {text[:60]}"}

    elif action == "key":
        key_combo = inp.get("text", "")
        import pyautogui
        keys = [k.strip() for k in key_combo.split("+")]
        pyautogui.hotkey(*keys) if len(keys) > 1 else pyautogui.press(keys[0])
        actions_log.append(f"key: {key_combo}")
        return {"content": f"Pressed: {key_combo}"}

    elif action == "scroll":
        direction = inp.get("direction", "down")
        amount = inp.get("amount", 3)
        import pyautogui
        pyautogui.moveTo(x, y, duration=0.1)
        pyautogui.scroll(amount if direction == "up" else -amount)
        actions_log.append(f"scroll {direction} at ({x},{y})")
        return {"content": f"Scrolled {direction} at ({x}, {y})"}

    elif action == "mouse_move":
        import pyautogui
        pyautogui.moveTo(x, y, duration=0.15)
        actions_log.append(f"move ({x},{y})")
        return {"content": f"Moved mouse to ({x}, {y})"}

    elif action in ("left_click_drag", "right_click_drag"):
        end = inp.get("end_coordinate", coord)
        import pyautogui
        pyautogui.moveTo(x, y, duration=0.1)
        pyautogui.dragTo(int(end[0]), int(end[1]), duration=0.3, button="left")
        actions_log.append(f"drag ({x},{y})→({end[0]},{end[1]})")
        return {"content": f"Dragged from ({x},{y}) to ({end[0]},{end[1]})"}

    else:
        return {"content": f"Unhandled computer action: {action}"}


def _handle_editor(inp: dict, actions_log: list) -> dict:
    command = inp.get("command", "")
    path = inp.get("path", "")
    if command == "view":
        try:
            with open(path, "r") as f:
                return {"content": f.read()[:3000]}
        except Exception as e:
            return {"content": str(e)}
    elif command == "str_replace":
        old = inp.get("old_str", "")
        new = inp.get("new_str", "")
        try:
            with open(path, "r") as f:
                content = f.read()
            content = content.replace(old, new, 1)
            with open(path, "w") as f:
                f.write(content)
            actions_log.append(f"edit: {path}")
            return {"content": "Replaced successfully"}
        except Exception as e:
            return {"content": str(e)}
    elif command == "create":
        file_text = inp.get("file_text", "")
        try:
            import os
            os.makedirs(os.path.dirname(path), exist_ok=True) if os.path.dirname(path) else None
            with open(path, "w") as f:
                f.write(file_text)
            actions_log.append(f"create: {path}")
            return {"content": f"Created {path}"}
        except Exception as e:
            return {"content": str(e)}
    return {"content": f"Unknown editor command: {command}"}
