"""
Playwright + Brave Browser service.
Manages a single persistent browser session per agent run.
Defaults to an embedded headless browser so live navigation stays inside the chat UI.
Brave/headful mode can be enabled explicitly for local debugging.
"""

import base64
import logging
import os
import platform
import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import quote_plus

from app.config import IS_CLOUD
from app.services.runtime_config import get_runtime_value

logger = logging.getLogger(__name__)

_sessions: dict[str, object] = {}
_URL_PATTERN = re.compile(r"https?://[^\s]+", re.IGNORECASE)
_SEARCH_TRIGGER_PATTERN = re.compile(
    r"\b(site|website|page web|page|browser|navigue|navigate|open|ouvre|visit|aller sur|va sur|search|cherche|recherche|acheter|buy|commande|order)\b",
    re.IGNORECASE,
)
_ORDERS_PATTERN = re.compile(r"\b(order|commande|orders|commandes|purchase|achat)\b", re.IGNORECASE)


@dataclass(frozen=True)
class BrowserBootstrapPlan:
    url: str
    description: str
    source: str


_SITE_TARGETS: tuple[dict[str, object], ...] = (
    {
        "id": "amazon",
        "keywords": ("amazon", "amazone"),
        "default_url": "https://www.amazon.com/",
        "search_url": "https://www.amazon.com/s?k={query}",
        "orders_url": "https://www.amazon.com/gp/css/order-history",
    },
    {
        "id": "github",
        "keywords": ("github",),
        "default_url": "https://github.com/",
        "search_url": "https://github.com/search?q={query}&type=repositories",
    },
    {
        "id": "google",
        "keywords": ("google",),
        "default_url": "https://www.google.com/",
        "search_url": "https://www.google.com/search?q={query}",
    },
    {
        "id": "youtube",
        "keywords": ("youtube",),
        "default_url": "https://www.youtube.com/",
        "search_url": "https://www.youtube.com/results?search_query={query}",
    },
    {
        "id": "wikipedia",
        "keywords": ("wikipedia", "wiki"),
        "default_url": "https://www.wikipedia.org/",
        "search_url": "https://en.wikipedia.org/w/index.php?search={query}",
    },
    {
        "id": "linkedin",
        "keywords": ("linkedin",),
        "default_url": "https://www.linkedin.com/",
        "search_url": "https://www.linkedin.com/search/results/all/?keywords={query}",
    },
    {
        "id": "notion",
        "keywords": ("notion",),
        "default_url": "https://www.notion.so/",
    },
    {
        "id": "canva",
        "keywords": ("canva",),
        "default_url": "https://www.canva.com/",
    },
)


def _normalize_task(task: str) -> str:
    return re.sub(r"\s+", " ", task or "").strip()


def _extract_explicit_url(task: str) -> Optional[str]:
    match = _URL_PATTERN.search(task)
    return match.group(0).rstrip(".,);!?") if match else None


def _strip_keywords(task: str, keywords: tuple[str, ...]) -> str:
    cleaned = task
    for keyword in keywords:
        cleaned = re.sub(rf"\b{re.escape(keyword)}\b", " ", cleaned, flags=re.IGNORECASE)
    return _normalize_task(cleaned)


def _infer_search_query(task: str, keywords: tuple[str, ...]) -> str:
    cleaned = _strip_keywords(task, keywords)
    cleaned = re.sub(
        r"\b(va sur|aller sur|ouvre|open|visit|navigue|navigate|cherche|search|recherche|buy|acheter|find|find me|trouve|verify|verifier|v[ée]rifie|commande|order|orders|commandes)\b",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"[^\w\s\-']", " ", cleaned)
    return _normalize_task(cleaned)


def infer_browser_bootstrap(task: str) -> Optional[BrowserBootstrapPlan]:
    normalized = _normalize_task(task)
    if not normalized:
        return None

    explicit_url = _extract_explicit_url(normalized)
    if explicit_url:
        return BrowserBootstrapPlan(
            url=explicit_url,
            description=f"Prepared browser workspace from the provided link: {explicit_url}",
            source="explicit-url",
        )

    lowered = normalized.lower()
    matched_target = next(
        (
            target
            for target in _SITE_TARGETS
            if any(keyword in lowered for keyword in target["keywords"])
        ),
        None,
    )

    if matched_target:
        keywords = matched_target["keywords"]
        query = _infer_search_query(normalized, keywords)
        if matched_target["id"] == "amazon" and _ORDERS_PATTERN.search(lowered):
            return BrowserBootstrapPlan(
                url=matched_target["orders_url"],
                description="Prepared browser workspace on Amazon order history so the agent can inspect your latest orders immediately.",
                source="amazon-orders",
            )
        if query and matched_target.get("search_url"):
            return BrowserBootstrapPlan(
                url=str(matched_target["search_url"]).format(query=quote_plus(query)),
                description=f"Prepared browser workspace on {matched_target['id']} search results for: {query}",
                source=f"{matched_target['id']}-search",
            )
        return BrowserBootstrapPlan(
            url=str(matched_target["default_url"]),
            description=f"Prepared browser workspace on {matched_target['id']}.",
            source=str(matched_target["id"]),
        )

    if _SEARCH_TRIGGER_PATTERN.search(normalized):
        return BrowserBootstrapPlan(
            url=f"https://duckduckgo.com/?q={quote_plus(normalized)}&ia=web",
            description=f"Prepared browser workspace with live web search results for: {normalized}",
            source="duckduckgo-search",
        )

    return None


def _should_launch_headful() -> bool:
    configured = (get_runtime_value("PLAYWRIGHT_HEADFUL", "false") or "false").strip().lower()
    return not IS_CLOUD and configured in {"1", "true", "yes", "on"}


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
    headful = _should_launch_headful()
    launch_kwargs = {
        "headless": not headful,
        "args": [
            "--no-sandbox",
            "--disable-blink-features=AutomationControlled",
        ],
    }

    if headful and brave:
        browser = await pw.chromium.launch(executable_path=brave, **launch_kwargs)
        logger.info("Launched headful Brave at %s", brave)
    else:
        browser = await pw.chromium.launch(**launch_kwargs)
        logger.info("Launched embedded Chromium browser (%s mode)", "headful" if headful else "headless")

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


async def bootstrap_browser_task(run_id: str, task: str) -> dict | None:
    plan = infer_browser_bootstrap(task)
    if not plan:
        return None

    result = await browser_open(run_id, plan.url)
    if not result.get("success"):
        return result

    snapshot = await browser_snapshot(run_id)
    if snapshot.get("success"):
        snapshot["description"] = plan.description
        snapshot["bootstrap_source"] = plan.source
        snapshot["bootstrap_url"] = plan.url
        return snapshot

    result["description"] = plan.description
    result["bootstrap_source"] = plan.source
    result["bootstrap_url"] = plan.url
    return result


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
