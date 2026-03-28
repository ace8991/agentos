"""
Central dispatcher. Checks app.config.is_tool_available() before executing
any desktop action and returns a clear error if called from cloud mode.
"""

import asyncio
import logging
import os
import subprocess
import sys
import time

from app.config import is_tool_available
from app.models.schemas import ActionType, AgentAction
from app.services import browser, web

logger = logging.getLogger(__name__)


def _pyautogui():
    import pyautogui

    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.05
    return pyautogui


async def execute(action: AgentAction, run_id: str) -> dict:
    tool = action.type

    if not is_tool_available(tool.value):
        return {
            "success": False,
            "description": f"Tool '{tool}' is not available in cloud mode. Use web_search, web_extract or browser_* instead.",
            "mode_error": True,
        }

    try:
        if tool == ActionType.WEB_SEARCH:
            return await asyncio.to_thread(web.web_search, action.query, action.max_results or 5)
        if tool == ActionType.WEB_EXTRACT:
            return await asyncio.to_thread(web.web_extract, action.url)
        if tool == ActionType.WEB_QNA:
            return await asyncio.to_thread(web.web_qna, action.query)
        if tool == ActionType.WEB_CRAWL:
            return await asyncio.to_thread(web.web_crawl, action.url, action.instructions)

        if tool == ActionType.BROWSER_OPEN:
            return await browser.browser_open(run_id, action.url, action.timeout or 15000)
        if tool == ActionType.BROWSER_CLICK:
            return await browser.browser_click(run_id, action.selector, action.timeout or 8000)
        if tool == ActionType.BROWSER_TYPE:
            return await browser.browser_type(run_id, action.selector, action.text, action.timeout or 8000)
        if tool == ActionType.BROWSER_SELECT:
            return await browser.browser_select(run_id, action.selector, action.value, action.timeout or 8000)
        if tool == ActionType.BROWSER_SCROLL:
            return await browser.browser_scroll(run_id, action.amount or 3)
        if tool == ActionType.BROWSER_WAIT:
            return await browser.browser_wait(run_id, action.selector, action.timeout or 10000)
        if tool == ActionType.BROWSER_SNAPSHOT:
            return await browser.browser_snapshot(run_id)
        if tool == ActionType.BROWSER_EVAL:
            return await browser.browser_eval(run_id, action.script)
        if tool == ActionType.BROWSER_BACK:
            return await browser.browser_back(run_id)
        if tool == ActionType.BROWSER_CLOSE:
            await browser.close_session(run_id)
            return {"success": True, "description": "Browser closed"}

        if tool == ActionType.COMPUTER_USE:
            from app.services.computer_use import run_computer_use

            return await asyncio.to_thread(
                run_computer_use,
                action.subtask or action.reason or "complete visible task",
                None,
                action.cu_max_iterations or 5,
            )

        if tool == ActionType.CLICK:
            return await asyncio.to_thread(_click, action.x, action.y)
        if tool == ActionType.TYPE:
            return await asyncio.to_thread(_type, action.text)
        if tool == ActionType.KEY:
            return await asyncio.to_thread(_key, action.key)
        if tool == ActionType.SCROLL:
            return await asyncio.to_thread(_scroll, action.x, action.y, action.amount)
        if tool == ActionType.WAIT:
            return await asyncio.to_thread(_wait, action.amount or 1)
        if tool == ActionType.SHELL:
            return await asyncio.to_thread(_shell, action.command)
        if tool == ActionType.DONE:
            return {"success": True, "description": "Task completed"}

        return {"success": False, "description": f"Unknown action: {tool}"}
    except Exception as exc:
        if exc.__class__.__name__ == "FailSafeException":
            return {"success": False, "description": "Fail-safe triggered, move mouse away from the corner"}
        logger.error("execute(%s): %s", tool, exc)
        return {"success": False, "description": str(exc)}


def _click(x, y):
    pyautogui = _pyautogui()
    if x is None or y is None:
        return {"success": False, "description": "click requires x and y"}
    sw, sh = pyautogui.size()
    if not (0 <= x <= sw and 0 <= y <= sh):
        return {"success": False, "description": f"({x},{y}) out of screen {sw}x{sh}"}
    pyautogui.moveTo(x, y, duration=0.15)
    pyautogui.click()
    return {"success": True, "description": f"Clicked ({x}, {y})"}


def _type(text):
    pyautogui = _pyautogui()
    if not text:
        return {"success": False, "description": "no text"}
    pyautogui.write(str(text), interval=0.03)
    return {"success": True, "description": f"Typed: {str(text)[:60]}"}


def _key(combo):
    pyautogui = _pyautogui()
    if not combo:
        return {"success": False, "description": "no key"}
    keys = [key.strip() for key in str(combo).split("+")]
    if len(keys) > 1:
        pyautogui.hotkey(*keys)
    else:
        pyautogui.press(keys[0])
    return {"success": True, "description": f"Key: {combo}"}


def _scroll(x, y, amount):
    pyautogui = _pyautogui()
    amount = amount or 3
    if x and y:
        pyautogui.moveTo(x, y, duration=0.1)
    pyautogui.scroll(amount)
    return {"success": True, "description": f"Scrolled {amount}"}


def _wait(seconds):
    time.sleep(min(int(seconds), 15))
    return {"success": True, "description": f"Waited {seconds}s"}


def _shell(cmd):
    if not cmd:
        return {"success": False, "description": "no command"}
    try:
        if sys.platform.startswith("win"):
            powershell = os.environ.get("ComSpec", r"C:\Windows\System32\cmd.exe")
            powershell = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
            result = subprocess.run(
                [
                    powershell,
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    cmd,
                ],
                capture_output=True,
                text=True,
                timeout=45,
            )
        else:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=45)
        stdout = (result.stdout or "").replace("\x00", "")
        stderr = (result.stderr or "").replace("\x00", "")
        summary = (stdout or stderr or "").strip()[:120]
        return {
            "success": result.returncode == 0,
            "stdout": stdout[:2000],
            "stderr": stderr[:400],
            "description": f"Exit {result.returncode}: {summary}",
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "description": "timed out"}
