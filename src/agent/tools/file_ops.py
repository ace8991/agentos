"""File operations — create, read, list."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from ..core.types import ToolResult
from .base import Tool


class FileCreateTool(Tool):
    name = "file_create"
    description = "Create a new file with the given content. Creates parent dirs as needed."
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Absolute or relative file path"},
            "content": {"type": "string"},
            "overwrite": {"type": "boolean", "description": "Default false"},
        },
        "required": ["path", "content"],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        path = Path(os.path.expanduser(args["path"]))
        if path.exists() and not args.get("overwrite", False):
            return ToolResult(
                tool_call_id="",
                content=f"File exists: {path}. Set overwrite=true to replace.",
                is_error=True,
            )
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(args["content"], encoding="utf-8")
        return ToolResult(tool_call_id="", content=f"Created {path} ({len(args['content'])} chars)")


class FileReadTool(Tool):
    name = "file_read"
    description = "Read the contents of a text file."
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "max_chars": {"type": "integer", "description": "Default 50000"},
        },
        "required": ["path"],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        path = Path(os.path.expanduser(args["path"]))
        if not path.exists():
            return ToolResult(tool_call_id="", content=f"Not found: {path}", is_error=True)
        max_chars = args.get("max_chars", 50_000)
        text = path.read_text(encoding="utf-8", errors="replace")[:max_chars]
        return ToolResult(tool_call_id="", content={"path": str(path), "content": text})
