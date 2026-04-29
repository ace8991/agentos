"""Universal JSON Schemas for all agent tools.

These schemas are in an internal universal format (ToolSchema).
Each provider translates them into its own format before calling the API:
- Anthropic: {name, description, input_schema}
- OpenAI/DeepSeek: {type: "function", function: {name, description, parameters}}
"""

from __future__ import annotations

from src.agent.core.types import ToolSchema

# ── Semantic UI Tree tools (used by ALL models except Claude CU) ──────────────

SEMANTIC_TOOLS: list[ToolSchema] = [
    ToolSchema(
        name="click_element",
        description=(
            "Click a UI element on screen by its element ID (from the UI tree). "
            "Use this instead of guessing pixel coordinates. "
            "Always call read_ui_tree first to get the current element IDs."
        ),
        parameters={
            "type": "object",
            "properties": {
                "element_id": {
                    "type": "string",
                    "description": "The element ID from the UI tree (e.g. 'e_42').",
                },
                "button": {
                    "type": "string",
                    "enum": ["left", "right", "middle"],
                    "description": "Mouse button to use (default: left).",
                },
            },
            "required": ["element_id"],
        },
    ),
    ToolSchema(
        name="type_in_field",
        description=(
            "Type text into a UI field identified by its element ID (from the UI tree). "
            "Clears existing content first unless append=True."
        ),
        parameters={
            "type": "object",
            "properties": {
                "element_id": {
                    "type": "string",
                    "description": "The element ID from the UI tree (e.g. 'e_43').",
                },
                "text": {
                    "type": "string",
                    "description": "Text to type into the field.",
                },
                "append": {
                    "type": "boolean",
                    "description": "If true, append to existing text instead of clearing.",
                },
            },
            "required": ["element_id", "text"],
        },
    ),
    ToolSchema(
        name="read_ui_tree",
        description=(
            "Get the current Windows UI Automation accessibility tree as JSON. "
            "This lists all visible UI elements (buttons, text fields, windows, menus) "
            "with their element IDs, names, types, and bounding boxes. "
            "Use this to understand what's on screen before clicking or typing."
        ),
        parameters={
            "type": "object",
            "properties": {
                "window_title": {
                    "type": "string",
                    "description": "Optional window title filter (substring match).",
                },
            },
        },
    ),
    ToolSchema(
        name="double_click_element",
        description="Double-click a UI element by its element ID.",
        parameters={
            "type": "object",
            "properties": {
                "element_id": {
                    "type": "string",
                    "description": "The element ID from the UI tree.",
                },
            },
            "required": ["element_id"],
        },
    ),
    ToolSchema(
        name="right_click_element",
        description="Right-click a UI element by its element ID.",
        parameters={
            "type": "object",
            "properties": {
                "element_id": {
                    "type": "string",
                    "description": "The element ID from the UI tree.",
                },
            },
            "required": ["element_id"],
        },
    ),
]

# ── Generic desktop tools (not UI-tree-dependent) ─────────────────────────────

GENERIC_TOOLS: list[ToolSchema] = [
    ToolSchema(
        name="screenshot",
        description="Capture the current screen as an image.",
        parameters={
            "type": "object",
            "properties": {},
        },
    ),
    ToolSchema(
        name="mouse_move",
        description="Move the mouse cursor to absolute pixel coordinates.",
        parameters={
            "type": "object",
            "properties": {
                "x": {"type": "integer", "description": "X coordinate."},
                "y": {"type": "integer", "description": "Y coordinate."},
            },
            "required": ["x", "y"],
        },
    ),
    ToolSchema(
        name="mouse_click",
        description=(
            "Click at absolute pixel coordinates. "
            "Prefer click_element with a UI element ID when possible."
        ),
        parameters={
            "type": "object",
            "properties": {
                "x": {"type": "integer", "description": "X coordinate."},
                "y": {"type": "integer", "description": "Y coordinate."},
                "button": {
                    "type": "string",
                    "enum": ["left", "right", "middle"],
                },
            },
            "required": ["x", "y"],
        },
    ),
    ToolSchema(
        name="type_text",
        description="Type the given text using the keyboard.",
        parameters={
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Text to type."},
            },
            "required": ["text"],
        },
    ),
    ToolSchema(
        name="press_keys",
        description="Press a keyboard shortcut (e.g. 'ctrl+s', 'alt+f4', 'win+r').",
        parameters={
            "type": "object",
            "properties": {
                "keys": {
                    "type": "string",
                    "description": "Key combination, e.g. 'ctrl+s' or 'alt+tab'.",
                },
            },
            "required": ["keys"],
        },
    ),
    ToolSchema(
        name="scroll",
        description="Scroll at the current mouse position.",
        parameters={
            "type": "object",
            "properties": {
                "amount": {
                    "type": "integer",
                    "description": "Positive = scroll down, negative = scroll up.",
                },
            },
            "required": ["amount"],
        },
    ),
    ToolSchema(
        name="drag",
        description="Drag from one point to another.",
        parameters={
            "type": "object",
            "properties": {
                "start_x": {"type": "integer"},
                "start_y": {"type": "integer"},
                "end_x": {"type": "integer"},
                "end_y": {"type": "integer"},
                "button": {
                    "type": "string",
                    "enum": ["left", "right"],
                },
            },
            "required": ["start_x", "start_y", "end_x", "end_y"],
        },
    ),
]

# ── File and command tools ────────────────────────────────────────────────────

FILE_TOOLS: list[ToolSchema] = [
    ToolSchema(
        name="bash_tool",
        description=(
            "Execute a shell command on the local Windows PC via PowerShell or CMD. "
            "Use for: running scripts, git operations, npm/pip installs, file system ops, "
            "getting system info, listing large files, checking processes."
        ),
        parameters={
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The PowerShell or CMD command to run."},
                "shell": {
                    "type": "string",
                    "enum": ["powershell", "cmd"],
                    "description": "Shell to use: powershell (default) or cmd.",
                },
                "timeout_ms": {
                    "type": "integer",
                    "description": "Timeout in ms (default 30000, max 120000).",
                },
                "cwd": {"type": "string", "description": "Working directory (optional)."},
            },
            "required": ["command"],
        },
    ),
    ToolSchema(
        name="str_replace_editor",
        description=(
            "View, create, or edit files. "
            "command=view: read file contents. "
            "command=str_replace: replace old_str with new_str in the file. "
            "command=create: create or overwrite a file with file_text. "
            "Always view a file before str_replace to confirm the exact string to replace."
        ),
        parameters={
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "enum": ["view", "str_replace", "create"],
                    "description": "Action to perform.",
                },
                "path": {"type": "string", "description": "Full Windows path to the file."},
                "old_str": {"type": "string", "description": "Exact string to replace (required for str_replace)."},
                "new_str": {"type": "string", "description": "Replacement string (required for str_replace)."},
                "file_text": {"type": "string", "description": "Full file content (required for create)."},
            },
            "required": ["command", "path"],
        },
    ),
    ToolSchema(
        name="list_directory",
        description="List files and folders in a directory.",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Directory path to list."},
                "depth": {
                    "type": "integer",
                    "description": "Recursion depth (default 1, max 3).",
                },
            },
            "required": ["path"],
        },
    ),
    ToolSchema(
        name="web_search",
        description="Search the web for current information.",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query."},
                "max_results": {"type": "integer", "description": "Number of results (default 5)."},
            },
            "required": ["query"],
        },
    ),
    ToolSchema(
        name="system_info",
        description="Get real system information: CPU usage, RAM, disk space, OS version.",
        parameters={
            "type": "object",
            "properties": {},
        },
    ),
    ToolSchema(
        name="finish",
        description=(
            "Call this when the task is complete. Provide a summary of what was accomplished."
        ),
        parameters={
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "Summary of what was accomplished.",
                },
            },
            "required": ["summary"],
        },
    ),
]

# ── Combined tool lists ───────────────────────────────────────────────────────

def get_semantic_tools() -> list[ToolSchema]:
    """Tools used for semantic UI tree mode (any LLM without native CU)."""
    return SEMANTIC_TOOLS + GENERIC_TOOLS + FILE_TOOLS


def get_pixel_tools() -> list[ToolSchema]:
    """Tools used for pixel-precise mode (Claude with native computer use)."""
    # For pixel mode we use Claude's native computer_20250124 tool,
    # so we only need file + command tools here.
    return GENERIC_TOOLS + FILE_TOOLS
