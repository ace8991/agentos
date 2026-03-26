"""
Playwright + Brave Browser service.
Manages a single persistent browser session per agent run.
Brave executable is auto-detected per OS; falls back to Chromium.
"""

import base64
import logging
import os
import platform
from typing import Optional

from app.config import IS_CLOUD

logger = logging.getLogger(__name__)

_sessions: dict[str, object] = {}


def _brave_path() -> Optional[str]:
    system = platform.system()
    candidates = {
        "Darwin": [
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ],
        "Linux": [
            "/usr/bin/brave-browser",
            "/usr/bin/brave",
            "/snap/bin/brave",
        ],
        "Windows": [
            r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
            r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
        ],
    }
    for path in candidates.get(system, []):
        if os.path.exists(path):
            return path
    return None


async def get_session(run_id: str):
    if run_id in _sessions:
        return _sessions[run_id]

    from playwright.async_api import async_playwright

    pw = await async_playwright().start()
    brave = _brave_path()
    launch_kwargs = {
        "headless": IS_CLOUD,
        "args": [
            "--no-sandbox",
            "--disable-blink-features=AutomationControlled",
        ],
    }

    if brave:
        browser = await pw.chromium.launch(executable_path=brave, **launch_kwargs)
        logger.info("Launched Brave at %s", brave)
    else:
        browser = await pw.chromium.launch(**launch_kwargs)
        logger.info("Brave not found, using bundled Chromium")

    context = await browser.new_context(
        viewport={"width": 1280, "height": 800},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36 Brave/1.65"
        ),
    )
    page = await context.new_page()

    _sessions[run_id] = {"pw": pw, "browser": browser, "context": context, "page": page}
    return _sessions[run_id]


async def close_session(run_id: str):
    if run_id not in _sessions:
        return
    session = _sessions.pop(run_id)
    try:
        await session["browser"].close()
        await session["pw"].stop()
    except Exception as exc:
        logger.warning("Browser close error: %s", exc)


async def browser_open(run_id: str, url: str, timeout: int = 15000) -> dict:
    try:
        session = await get_session(run_id)
        await session["page"].goto(url, wait_until="domcontentloaded", timeout=timeout)
        title = await session["page"].title()
        return {"success": True, "url": url, "title": title, "description": f"Opened {url} - '{title}'"}
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_click(run_id: str, selector: str, timeout: int = 8000) -> dict:
    session = await get_session(run_id)
    try:
        await session["page"].click(selector, timeout=timeout)
        return {"success": True, "description": f"Clicked '{selector}'"}
    except Exception as exc:
        try:
            await session["page"].get_by_text(selector).first.click(timeout=timeout)
            return {"success": True, "description": f"Clicked text '{selector}'"}
        except Exception:
            return {"success": False, "description": str(exc)}


async def browser_type(run_id: str, selector: str, text: str, timeout: int = 8000) -> dict:
    try:
        session = await get_session(run_id)
        await session["page"].fill(selector, text, timeout=timeout)
        return {"success": True, "description": f"Typed in '{selector}': {text[:60]}"}
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_select(run_id: str, selector: str, value: str, timeout: int = 8000) -> dict:
    try:
        session = await get_session(run_id)
        await session["page"].select_option(selector, value=value, timeout=timeout)
        return {"success": True, "description": f"Selected '{value}' in '{selector}'"}
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_scroll(run_id: str, amount: int = 3) -> dict:
    try:
        session = await get_session(run_id)
        px = amount * 300
        await session["page"].evaluate(f"window.scrollBy(0, {px})")
        return {"success": True, "description": f"Scrolled {px}px"}
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_wait(run_id: str, selector: str, timeout: int = 10000) -> dict:
    try:
        session = await get_session(run_id)
        await session["page"].wait_for_selector(selector, timeout=timeout)
        return {"success": True, "description": f"Element visible: '{selector}'"}
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_snapshot(run_id: str) -> dict:
    try:
        session = await get_session(run_id)
        page = session["page"]
        url = page.url
        title = await page.title()
        text = await page.evaluate(
            """() => {
                const el = document.body;
                return el ? el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 3000) : '';
            }"""
        )
        jpeg = await page.screenshot(type="jpeg", quality=70)
        screenshot_b64 = base64.b64encode(jpeg).decode()
        return {
            "success": True,
            "url": url,
            "title": title,
            "text_preview": text,
            "screenshot_b64": screenshot_b64,
            "description": f"Snapshot of '{title}' at {url}",
        }
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_eval(run_id: str, script: str) -> dict:
    try:
        session = await get_session(run_id)
        result = await session["page"].evaluate(script)
        return {"success": True, "result": str(result)[:1000], "description": f"JS result: {str(result)[:200]}"}
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_back(run_id: str) -> dict:
    try:
        session = await get_session(run_id)
        await session["page"].go_back()
        return {"success": True, "description": "Navigated back"}
    except Exception as exc:
        return {"success": False, "description": str(exc)}
