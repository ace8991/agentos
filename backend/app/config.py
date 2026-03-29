"""
AgentOS runtime mode.

AGENT_MODE=cloud  → Tavily + Playwright headless only (no screen access)
AGENT_MODE=local  → All 4 tools including PyAutoGUI + Computer Use

Set via environment variable. Defaults to "local" when running from binary.
Defaults to "cloud" when DISPLAY is not available (Docker/server).
"""
import os
import sys

def _detect_mode() -> str:
    explicit = os.getenv("AGENT_MODE", "").lower()
    if explicit in ("cloud", "local"):
        return explicit
    # Auto-detect: no display = cloud mode
    if sys.platform == "linux" and not os.getenv("DISPLAY"):
        return "cloud"
    return "local"

MODE: str = _detect_mode()
IS_LOCAL: bool = MODE == "local"
IS_CLOUD: bool = MODE == "cloud"

DESKTOP_TOOLS = {"click", "type", "scroll", "key", "wait", "shell", "computer_use", "file_search", "file_read"}
CLOUD_TOOLS   = {"web_search", "web_extract", "web_qna", "web_crawl",
                 "browser_open", "browser_click", "browser_type", "browser_select",
                 "browser_scroll", "browser_wait", "browser_snapshot",
                 "browser_eval", "browser_back", "browser_close"}

def is_tool_available(action_type: str) -> bool:
    if action_type in CLOUD_TOOLS:
        return True
    if action_type in DESKTOP_TOOLS:
        return IS_LOCAL
    return True  # done, error always available
