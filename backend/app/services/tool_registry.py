from __future__ import annotations

from app.models.schemas import MCPToolRecord, ToolCapability, ToolProvider, ToolProviderKind
from app.services.capabilities import detect_capabilities

ACTION_FAMILY_MAP: dict[str, str] = {
    "click": "desktop",
    "type": "desktop",
    "scroll": "desktop",
    "key": "desktop",
    "wait": "desktop",
    "shell": "terminal",
    "browser_open": "browser",
    "browser_click": "browser",
    "browser_type": "browser",
    "browser_select": "browser",
    "browser_scroll": "browser",
    "browser_wait": "browser",
    "browser_snapshot": "browser",
    "browser_eval": "browser",
    "browser_back": "browser",
    "browser_close": "browser",
    "web_search": "web_search",
    "web_extract": "web_search",
    "web_qna": "web_search",
    "web_crawl": "web_search",
    "computer_use": "desktop",
    "file_search": "filesystem",
    "file_read": "filesystem",
    "file_write": "filesystem",
    "file_append": "filesystem",
    "file_delete": "filesystem",
    "file_move": "filesystem",
    "file_copy": "filesystem",
    "file_exists": "filesystem",
    "dir_list": "filesystem",
    "dir_create": "filesystem",
    "dir_delete": "filesystem",
    "app_open": "system",
    "process_list": "system",
    "process_kill": "system",
    "system_info": "system",
    "clipboard_get": "system",
    "clipboard_set": "system",
    "terminal_open": "terminal",
}

_CAPABILITY_DEFS: list[dict[str, object]] = [
    {
        "id": "filesystem",
        "family": "filesystem",
        "label": "Filesystem",
        "description": "Read, write, search, and manage local files and directories.",
        "provider_id": "desktop-commander-internal",
        "tool_names": [
            "file_search",
            "file_read",
            "file_write",
            "file_append",
            "file_delete",
            "file_move",
            "file_copy",
            "file_exists",
            "dir_list",
            "dir_create",
            "dir_delete",
        ],
        "readiness_key": ("available_tools", "desktop_commander"),
    },
    {
        "id": "terminal",
        "family": "terminal",
        "label": "Terminal",
        "description": "Execute shell commands and launch local terminals.",
        "provider_id": "desktop-commander-internal",
        "tool_names": ["shell", "terminal_open"],
        "readiness_key": ("runtime", "supports_terminal"),
    },
    {
        "id": "system",
        "family": "system",
        "label": "System",
        "description": "Inspect system info, apps, processes, and clipboard.",
        "provider_id": "desktop-commander-internal",
        "tool_names": ["app_open", "process_list", "process_kill", "system_info", "clipboard_get", "clipboard_set"],
        "readiness_key": ("runtime", "supports_terminal"),
    },
    {
        "id": "browser",
        "family": "browser",
        "label": "Browser Live",
        "description": "Live in-app browser automation with screenshots and targeted actions.",
        "provider_id": "browser-internal",
        "tool_names": [
            "browser_open",
            "browser_click",
            "browser_type",
            "browser_select",
            "browser_scroll",
            "browser_wait",
            "browser_snapshot",
            "browser_eval",
            "browser_back",
            "browser_close",
        ],
        "readiness_key": ("available_tools", "playwright"),
    },
    {
        "id": "desktop",
        "family": "desktop",
        "label": "Desktop Automation",
        "description": "Mouse, keyboard, OCR, and window control loops for desktop automation.",
        "provider_id": "desktop-control-internal",
        "tool_names": ["click", "type", "scroll", "key", "wait", "computer_use"],
        "readiness_key": ("runtime", "supports_desktop"),
    },
    {
        "id": "web_search",
        "family": "web_search",
        "label": "Web Research",
        "description": "Search, fetch, extract, and synthesize web sources with citations.",
        "provider_id": "web-tavily-internal",
        "tool_names": ["web_search", "web_extract", "web_qna", "web_crawl"],
        "readiness_key": ("available_tools", "tavily"),
    },
    {
        "id": "builder",
        "family": "builder",
        "label": "Builder Workspace",
        "description": "Generate structured workspaces with preview, code, database, and files surfaces.",
        "provider_id": "builder-internal",
        "tool_names": ["workspace_builder"],
        "readiness_key": ("status", None),
    },
    {
        "id": "code",
        "family": "code",
        "label": "Code Workspace",
        "description": "Analyze, edit, test, review, and inspect code workspaces.",
        "provider_id": "code-internal",
        "tool_names": ["workspace_files", "workspace_preview"],
        "readiness_key": ("status", None),
    },
    {
        "id": "git",
        "family": "git",
        "label": "Git",
        "description": "Checkpoint, snapshot, and repository-oriented automation.",
        "provider_id": "git-internal",
        "tool_names": ["git_checkpoint"],
        "readiness_key": ("status", None),
    },
]


def _nested_bool(payload: dict, section: str, key: str | None) -> bool:
    if key is None:
        return payload.get(section) == "ok"
    section_value = payload.get(section)
    if not isinstance(section_value, dict):
        return False
    return bool(section_value.get(key))


def tool_family_for_action(action_type: str | None) -> str:
    if not action_type:
        return "general"
    return ACTION_FAMILY_MAP.get(action_type, "general")


def list_internal_providers() -> list[ToolProvider]:
    capabilities = detect_capabilities()
    return [
        ToolProvider(
            id="desktop-commander-internal",
            name="Desktop Commander",
            family="filesystem",
            kind=ToolProviderKind.INTERNAL,
            description="Unified local filesystem, terminal, and system provider.",
            enabled=True,
            ready=bool(capabilities["available_tools"].get("desktop_commander")),
            tags=["local", "filesystem", "terminal", "system"],
            priority=100,
        ),
        ToolProvider(
            id="browser-internal",
            name="Browser Live",
            family="browser",
            kind=ToolProviderKind.INTERNAL,
            description="In-app Playwright browser runtime.",
            enabled=True,
            ready=bool(capabilities["available_tools"].get("playwright")),
            tags=["browser", "live", "playwright"],
            priority=100,
        ),
        ToolProvider(
            id="desktop-control-internal",
            name="Desktop Control",
            family="desktop",
            kind=ToolProviderKind.INTERNAL,
            description="Local desktop automation and Computer Use.",
            enabled=True,
            ready=bool(capabilities["runtime"].get("supports_desktop")),
            tags=["desktop", "ocr", "computer-use"],
            priority=90,
        ),
        ToolProvider(
            id="web-tavily-internal",
            name="Web Research",
            family="web_search",
            kind=ToolProviderKind.INTERNAL,
            description="Tavily-backed search with fetch/extract/browser fallback.",
            enabled=True,
            ready=bool(capabilities["available_tools"].get("tavily")),
            tags=["web", "research", "tavily"],
            priority=95,
        ),
        ToolProvider(
            id="builder-internal",
            name="Workspace Builder",
            family="builder",
            kind=ToolProviderKind.INTERNAL,
            description="Structured builder workspace generator.",
            enabled=True,
            ready=True,
            tags=["builder", "preview", "workspace"],
            priority=100,
        ),
        ToolProvider(
            id="code-internal",
            name="Code Workspace",
            family="code",
            kind=ToolProviderKind.INTERNAL,
            description="Code analysis and workspace surfaces.",
            enabled=True,
            ready=True,
            tags=["code", "workspace"],
            priority=80,
        ),
        ToolProvider(
            id="git-internal",
            name="Git Checkpoints",
            family="git",
            kind=ToolProviderKind.INTERNAL,
            description="Local checkpoint and git-aware safety helper.",
            enabled=True,
            ready=True,
            tags=["git", "checkpoint"],
            priority=70,
        ),
    ]


def list_capabilities() -> list[ToolCapability]:
    capabilities = detect_capabilities()
    items: list[ToolCapability] = []
    for definition in _CAPABILITY_DEFS:
        section, key = definition["readiness_key"]  # type: ignore[assignment]
        items.append(
            ToolCapability(
                id=str(definition["id"]),
                family=str(definition["family"]),
                label=str(definition["label"]),
                description=str(definition["description"]),
                provider_id=str(definition["provider_id"]),
                provider_kind=ToolProviderKind.INTERNAL,
                tool_names=list(definition["tool_names"]),  # type: ignore[arg-type]
                ready=_nested_bool(capabilities, str(section), key if isinstance(key, str) else None),
            )
        )
    return items


def list_mcp_tool_records() -> list[MCPToolRecord]:
    return [
        MCPToolRecord(
            name=tool_name,
            label=capability.label,
            family=capability.family,
            description=capability.description,
            provider_id=capability.provider_id,
            provider_kind=capability.provider_kind,
            available=capability.ready,
        )
        for capability in list_capabilities()
        for tool_name in capability.tool_names
    ]
