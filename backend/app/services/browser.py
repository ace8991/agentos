"""
Playwright browser service used by the agent.

The browser runs inside a dedicated worker thread so it stays stable on
Windows/FastAPI, where async Playwright subprocess startup can fail inside the
main server event loop with blank NotImplementedError crashes.

This keeps the browser fully in-app while avoiding external windows by default.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
import platform
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from functools import partial
from threading import RLock
from typing import Optional
from urllib.parse import quote_plus

from app.config import IS_CLOUD
from app.services.runtime_config import get_runtime_value

logger = logging.getLogger(__name__)

_URL_PATTERN = re.compile(r"https?://[^\s]+", re.IGNORECASE)
_SEARCH_TRIGGER_PATTERN = re.compile(
    r"\b(site|website|page web|page|browser|navigue|navigate|open|ouvre|visit|aller sur|va sur|search|cherche|recherche|acheter|buy|commande|order)\b",
    re.IGNORECASE,
)
_ORDERS_PATTERN = re.compile(r"\b(order|commande|orders|commandes|purchase|achat)\b", re.IGNORECASE)
_PRIMARY_TASK_PATTERN = re.compile(r"primary task:\s*(.+)$", re.IGNORECASE | re.DOTALL)


@dataclass(frozen=True)
class BrowserBootstrapPlan:
    url: str
    description: str
    source: str


@dataclass
class BrowserSession:
    pw: object
    browser: object
    context: object
    page: object
    lock: RLock = field(default_factory=RLock)


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

_sessions: dict[str, BrowserSession] = {}
_BROWSER_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="agentos-browser")


def _normalize_task(task: str) -> str:
    return re.sub(r"\s+", " ", task or "").strip()


def extract_primary_task(task: str) -> str:
    normalized = task or ""
    match = _PRIMARY_TASK_PATTERN.search(normalized)
    if match:
        return _normalize_task(match.group(1))
    return _normalize_task(normalized)


def _describe_exception(exc: Exception, fallback: str = "Browser action failed") -> str:
    message = str(exc).strip()
    return message or exc.__class__.__name__ or fallback


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
    normalized = extract_primary_task(task)
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
                url=str(matched_target["orders_url"]),
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
    external = (get_runtime_value("PLAYWRIGHT_EXTERNAL_BROWSER", "false") or "false").strip().lower()
    return not IS_CLOUD and configured in {"1", "true", "yes", "on"} and external in {"1", "true", "yes", "on"}


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


def _sync_settle_page(page, timeout: int = 2000) -> None:
    try:
        page.wait_for_load_state("domcontentloaded", timeout=timeout)
    except Exception:
        pass
    try:
        page.wait_for_timeout(180)
    except Exception:
        pass


def _sync_snapshot_page(
    page,
    description: str,
    *,
    include_text_preview: bool = False,
    extra: Optional[dict] = None,
) -> dict:
    title = page.title()
    payload = {
        "success": True,
        "url": page.url,
        "title": title,
        "description": description,
    }

    if include_text_preview:
        text = page.evaluate(
            """() => {
                const el = document.body;
                return el ? el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 3000) : '';
            }"""
        )
        payload["text_preview"] = text

    jpeg = page.screenshot(type="jpeg", quality=72)
    payload["screenshot_b64"] = base64.b64encode(jpeg).decode()

    if extra:
        payload.update(extra)

    return payload


def _sync_get_session(run_id: str) -> BrowserSession:
    if run_id in _sessions:
        return _sessions[run_id]

    from playwright.sync_api import sync_playwright

    pw = sync_playwright().start()
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
        browser = pw.chromium.launch(executable_path=brave, **launch_kwargs)
        logger.info("Launched headful Brave at %s", brave)
    else:
        browser = pw.chromium.launch(**launch_kwargs)
        logger.info("Launched embedded Chromium browser (%s mode)", "headful" if headful else "headless")

    context = browser.new_context(
        viewport={"width": 1280, "height": 800},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36 Brave/1.65"
        ),
    )
    page = context.new_page()
    session = BrowserSession(pw=pw, browser=browser, context=context, page=page)
    _sessions[run_id] = session
    return session


def _sync_close_session(run_id: str) -> None:
    session = _sessions.pop(run_id, None)
    if not session:
        return
    with session.lock:
        try:
            session.browser.close()
        finally:
            session.pw.stop()


def _sync_browser_live_state(run_id: str) -> dict | None:
    session = _sessions.get(run_id)
    if not session:
        return None
    with session.lock:
        try:
            return _sync_snapshot_page(session.page, "Live browser view", include_text_preview=False)
        except Exception as exc:
            logger.warning("Live browser snapshot failed: %s", _describe_exception(exc))
            return None


def _sync_browser_open(run_id: str, url: str, timeout: int = 15000) -> dict:
    page = None
    try:
        if not url:
            return {"success": False, "description": "browser_open requires a valid url"}
        session = _sync_get_session(run_id)
        with session.lock:
            page = session.page
            page.goto(url, wait_until="commit", timeout=timeout)
            _sync_settle_page(page)
            return _sync_snapshot_page(page, f"Opened {url}")
    except Exception as exc:
        description = _describe_exception(exc, f"Could not open {url}")
        if page is not None:
            try:
                _sync_settle_page(page, timeout=1200)
                snapshot = _sync_snapshot_page(
                    page,
                    f"Opened {url} with a recoverable navigation issue",
                    extra={"navigation_warning": description},
                )
                snapshot["description"] = f"Opened {url} with a recoverable navigation issue: {description}"
                return snapshot
            except Exception:
                pass
        return {"success": False, "description": description}


def _sync_browser_click(run_id: str, selector: str, timeout: int = 8000) -> dict:
    try:
        if not selector:
            return {"success": False, "description": "browser_click requires a selector or visible text target"}
        session = _sync_get_session(run_id)
        with session.lock:
            page = session.page
            try:
                page.click(selector, timeout=timeout)
                _sync_settle_page(page)
                return _sync_snapshot_page(page, f"Clicked '{selector}'")
            except Exception as primary_exc:
                try:
                    page.get_by_text(selector).first.click(timeout=timeout)
                    _sync_settle_page(page)
                    return _sync_snapshot_page(page, f"Clicked text '{selector}'")
                except Exception:
                    return {"success": False, "description": _describe_exception(primary_exc)}
    except Exception as exc:
        return {"success": False, "description": _describe_exception(exc)}


def _sync_browser_type(run_id: str, selector: str, text: str, timeout: int = 8000) -> dict:
    try:
        session = _sync_get_session(run_id)
        with session.lock:
            page = session.page
            page.fill(selector, text, timeout=timeout)
            _sync_settle_page(page)
            return _sync_snapshot_page(page, f"Typed in '{selector}': {text[:60]}")
    except Exception as exc:
        return {"success": False, "description": _describe_exception(exc)}


def _sync_browser_select(run_id: str, selector: str, value: str, timeout: int = 8000) -> dict:
    try:
        session = _sync_get_session(run_id)
        with session.lock:
            page = session.page
            page.select_option(selector, value=value, timeout=timeout)
            _sync_settle_page(page)
            return _sync_snapshot_page(page, f"Selected '{value}' in '{selector}'")
    except Exception as exc:
        return {"success": False, "description": _describe_exception(exc)}


def _sync_browser_scroll(run_id: str, amount: int = 3) -> dict:
    try:
        session = _sync_get_session(run_id)
        with session.lock:
            page = session.page
            px = amount * 300
            page.evaluate(f"window.scrollBy(0, {px})")
            _sync_settle_page(page)
            return _sync_snapshot_page(page, f"Scrolled {px}px")
    except Exception as exc:
        return {"success": False, "description": _describe_exception(exc)}


def _sync_browser_wait(run_id: str, selector: str, timeout: int = 10000) -> dict:
    try:
        session = _sync_get_session(run_id)
        with session.lock:
            page = session.page
            page.wait_for_selector(selector, timeout=timeout)
            _sync_settle_page(page)
            return _sync_snapshot_page(page, f"Element visible: '{selector}'")
    except Exception as exc:
        return {"success": False, "description": _describe_exception(exc)}


def _sync_browser_snapshot(run_id: str) -> dict:
    try:
        session = _sync_get_session(run_id)
        with session.lock:
            page = session.page
            return _sync_snapshot_page(
                page,
                f"Snapshot of '{page.title()}' at {page.url}",
                include_text_preview=True,
            )
    except Exception as exc:
        return {"success": False, "description": _describe_exception(exc)}


def _sync_browser_eval(run_id: str, script: str) -> dict:
    try:
        session = _sync_get_session(run_id)
        with session.lock:
            page = session.page
            result = page.evaluate(script)
            return _sync_snapshot_page(
                page,
                f"JS result: {str(result)[:200]}",
                extra={"result": str(result)[:1000]},
            )
    except Exception as exc:
        return {"success": False, "description": _describe_exception(exc)}


def _sync_browser_back(run_id: str) -> dict:
    try:
        session = _sync_get_session(run_id)
        with session.lock:
            page = session.page
            page.go_back()
            _sync_settle_page(page)
            return _sync_snapshot_page(page, "Navigated back")
    except Exception as exc:
        return {"success": False, "description": _describe_exception(exc)}


async def _run_browser_call(fn, *args):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_BROWSER_EXECUTOR, partial(fn, *args))


def session_exists(run_id: str) -> bool:
    return run_id in _sessions


async def browser_live_state(run_id: str) -> dict | None:
    return await _run_browser_call(_sync_browser_live_state, run_id)


async def bootstrap_browser_task(run_id: str, task: str) -> dict | None:
    plan = infer_browser_bootstrap(task)
    if not plan:
        return None

    try:
        result = await browser_open(run_id, plan.url)
        if not result.get("success"):
            result["description"] = (
                f"Browser bootstrap could not open {plan.url}: {result.get('description') or 'unknown navigation issue'}"
            )
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
    except Exception as exc:
        return {
            "success": False,
            "description": f"Browser bootstrap failed while preparing {plan.url}: {_describe_exception(exc)}",
        }


async def close_session(run_id: str):
    await _run_browser_call(_sync_close_session, run_id)


async def browser_open(run_id: str, url: str, timeout: int = 15000) -> dict:
    return await _run_browser_call(_sync_browser_open, run_id, url, timeout)


async def browser_click(run_id: str, selector: str, timeout: int = 8000) -> dict:
    return await _run_browser_call(_sync_browser_click, run_id, selector, timeout)


async def browser_type(run_id: str, selector: str, text: str, timeout: int = 8000) -> dict:
    return await _run_browser_call(_sync_browser_type, run_id, selector, text, timeout)


async def browser_select(run_id: str, selector: str, value: str, timeout: int = 8000) -> dict:
    return await _run_browser_call(_sync_browser_select, run_id, selector, value, timeout)


async def browser_scroll(run_id: str, amount: int = 3) -> dict:
    return await _run_browser_call(_sync_browser_scroll, run_id, amount)


async def browser_wait(run_id: str, selector: str, timeout: int = 10000) -> dict:
    return await _run_browser_call(_sync_browser_wait, run_id, selector, timeout)


async def browser_snapshot(run_id: str) -> dict:
    return await _run_browser_call(_sync_browser_snapshot, run_id)


async def browser_eval(run_id: str, script: str) -> dict:
    return await _run_browser_call(_sync_browser_eval, run_id, script)


async def browser_back(run_id: str) -> dict:
    return await _run_browser_call(_sync_browser_back, run_id)
