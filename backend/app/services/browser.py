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


async def _settle_page(page, timeout: int = 2000) -> None:
    try:
        await page.wait_for_load_state("domcontentloaded", timeout=timeout)
    except Exception:
        pass
    try:
        await page.wait_for_timeout(180)
    except Exception:
        pass


async def _snapshot_page(
    page,
    description: str,
    *,
    include_text_preview: bool = False,
    extra: Optional[dict] = None,
) -> dict:
    title = await page.title()
    payload = {
        "success": True,
        "url": page.url,
        "title": title,
        "description": description,
    }

    if include_text_preview:
        text = await page.evaluate(
            """() => {
                const el = document.body;
                return el ? el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 3000) : '';
            }"""
        )
        payload["text_preview"] = text

    jpeg = await page.screenshot(type="jpeg", quality=72)
    payload["screenshot_b64"] = base64.b64encode(jpeg).decode()

    if extra:
        payload.update(extra)

    return payload


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


def session_exists(run_id: str) -> bool:
    return run_id in _sessions


async def browser_live_state(run_id: str) -> dict | None:
    if run_id not in _sessions:
        return None

    try:
        session = _sessions[run_id]
        return await _snapshot_page(
            session["page"],
            "Live browser view",
            include_text_preview=False,
        )
    except Exception as exc:
        logger.warning("Live browser snapshot failed: %s", exc)
        return None


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
        page = session["page"]
        await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
        await _settle_page(page)
        return await _snapshot_page(page, f"Opened {url}")
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_click(run_id: str, selector: str, timeout: int = 8000) -> dict:
    session = await get_session(run_id)
    page = session["page"]
    try:
        await page.click(selector, timeout=timeout)
        await _settle_page(page)
        return await _snapshot_page(page, f"Clicked '{selector}'")
    except Exception as exc:
        try:
            await page.get_by_text(selector).first.click(timeout=timeout)
            await _settle_page(page)
            return await _snapshot_page(page, f"Clicked text '{selector}'")
        except Exception:
            return {"success": False, "description": str(exc)}


async def browser_type(run_id: str, selector: str, text: str, timeout: int = 8000) -> dict:
    try:
        session = await get_session(run_id)
        page = session["page"]
        await page.fill(selector, text, timeout=timeout)
        await _settle_page(page)
        return await _snapshot_page(page, f"Typed in '{selector}': {text[:60]}")
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_select(run_id: str, selector: str, value: str, timeout: int = 8000) -> dict:
    try:
        session = await get_session(run_id)
        page = session["page"]
        await page.select_option(selector, value=value, timeout=timeout)
        await _settle_page(page)
        return await _snapshot_page(page, f"Selected '{value}' in '{selector}'")
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_scroll(run_id: str, amount: int = 3) -> dict:
    try:
        session = await get_session(run_id)
        page = session["page"]
        px = amount * 300
        await page.evaluate(f"window.scrollBy(0, {px})")
        await _settle_page(page)
        return await _snapshot_page(page, f"Scrolled {px}px")
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_wait(run_id: str, selector: str, timeout: int = 10000) -> dict:
    try:
        session = await get_session(run_id)
        page = session["page"]
        await page.wait_for_selector(selector, timeout=timeout)
        await _settle_page(page)
        return await _snapshot_page(page, f"Element visible: '{selector}'")
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_snapshot(run_id: str) -> dict:
    try:
        session = await get_session(run_id)
        page = session["page"]
        return await _snapshot_page(page, f"Snapshot of '{await page.title()}' at {page.url}", include_text_preview=True)
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_eval(run_id: str, script: str) -> dict:
    try:
        session = await get_session(run_id)
        page = session["page"]
        result = await page.evaluate(script)
        return await _snapshot_page(
            page,
            f"JS result: {str(result)[:200]}",
            extra={"result": str(result)[:1000]},
        )
    except Exception as exc:
        return {"success": False, "description": str(exc)}


async def browser_back(run_id: str) -> dict:
    try:
        session = await get_session(run_id)
        page = session["page"]
        await page.go_back()
        await _settle_page(page)
        return await _snapshot_page(page, "Navigated back")
    except Exception as exc:
        return {"success": False, "description": str(exc)}
