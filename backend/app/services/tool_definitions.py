"""
Tool definitions in Anthropic format + OpenAI-compatible format.
These are the tools the model can call during the agentic loop.
"""
from __future__ import annotations

# ── Anthropic format ──────────────────────────────────────────────────────────

TOOLS_ANTHROPIC: list[dict] = [
    {
        "name": "bash_tool",
        "description": (
            "Execute a shell command on the local Windows PC via PowerShell or CMD. "
            "Use for: running scripts, git operations, npm/pip installs, file system ops, "
            "getting system info, listing large files, checking processes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command":    {"type": "string",  "description": "The PowerShell or CMD command to run"},
                "shell":      {"type": "string",  "description": "Shell to use: powershell (default) or cmd"},
                "timeout_ms": {"type": "integer", "description": "Timeout in ms (default 30000, max 120000)"},
                "cwd":        {"type": "string",  "description": "Working directory (optional)"},
            },
            "required": ["command"],
        },
    },
    {
        "name": "str_replace_editor",
        "description": (
            "View, create, or edit files. "
            "command=view: read file contents. "
            "command=str_replace: replace old_str with new_str in the file. "
            "command=create: create or overwrite a file with file_text. "
            "Always view a file before str_replace to confirm the exact string to replace."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command":   {"type": "string", "enum": ["view", "str_replace", "create"], "description": "Action to perform"},
                "path":      {"type": "string", "description": "Full Windows path to the file"},
                "old_str":   {"type": "string", "description": "Exact string to replace (required for str_replace)"},
                "new_str":   {"type": "string", "description": "Replacement string (required for str_replace)"},
                "file_text": {"type": "string", "description": "Full file content (required for create)"},
            },
            "required": ["command", "path"],
        },
    },
    {
        "name": "list_directory",
        "description": "List files and folders in a directory. Use before reading files to confirm they exist.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path":  {"type": "string",  "description": "Directory path to list"},
                "depth": {"type": "integer", "description": "Recursion depth (default 1, max 3)"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "web_search",
        "description": "Search the web for current information. Use for: latest docs, prices, news, any info not in training data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query":       {"type": "string",  "description": "Search query"},
                "max_results": {"type": "integer", "description": "Number of results (default 5)"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "system_info",
        "description": "Get real system information: CPU usage, RAM, disk space, OS version, running processes.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
]

# ── OpenAI / compatible format (Qwen, DeepSeek, Mistral, Groq) ───────────────

TOOLS_OPENAI: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": t["name"],
            "description": t["description"],
            "parameters": t["input_schema"],
        },
    }
    for t in TOOLS_ANTHROPIC
]

# ── Providers that support tool calling ──────────────────────────────────────

TOOL_CAPABLE_PROVIDERS = {
    "anthropic",
    "openai",
    "deepseek",
    "google",
    "mistral",
    "qwen",
    "groq",
}
