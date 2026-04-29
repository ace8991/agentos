"""File operations tools.

Delegates to the existing agentos services for file operations.
"""

from __future__ import annotations

import logging
from pathlib import Path

from src.agent.tools.base import registry

logger = logging.getLogger("agentos.agent.tools.file_ops")


def bash_tool(command: str, shell: str = "powershell", timeout_ms: int = 30000, cwd: str | None = None) -> str:
    """Execute a shell command via the backend executor."""
    try:
        from app.services.desktop_commander import dc_execute_command as execute
        result = execute(
            command,
            shell=shell,
            timeout_ms=min(timeout_ms, 120000),
            cwd=cwd,
        )
        if result.get("success"):
            output = result.get("stdout", "") or ""
            if result.get("stderr"):
                output += f"\n[stderr] {result['stderr']}"
            return output.strip() or "Command completed (no output)."
        else:
            error = result.get("stderr", "") or result.get("description", "Unknown error")
            return f"ERROR: {error}"
    except Exception as e:
        logger.exception("bash_tool execution error")
        return f"ERROR: {e}"


def str_replace_editor(command: str, path: str, **kwargs) -> str:
    """View, create, or edit files."""
    try:
        from app.services.desktop_commander import (
            dc_read_file,
            dc_write_file,
            dc_edit_block,
        )

        if command == "view":
            result = dc_read_file(path)
            if not result.get("success"):
                return f"ERROR: {result.get('description', 'Failed to read file')}"
            content = result.get("content", "")
            lines = content.splitlines()
            numbered = "\n".join(f"{i+1:4d} | {l}" for i, l in enumerate(lines))
            return f"File: {path} ({len(lines)} lines)\n\n{numbered}"

        elif command == "str_replace":
            old_str = kwargs.get("old_str", "")
            new_str = kwargs.get("new_str", "")
            if not old_str:
                return "ERROR: old_str is required for str_replace"
            result = dc_edit_block(path, old_str, new_str)
            if result.get("success"):
                return f"Replaced in {Path(path).name}"
            return f"ERROR: {result.get('description', 'Replace failed')}"

        elif command == "create":
            file_text = kwargs.get("file_text", "")
            result = dc_write_file(path, file_text)
            if result.get("success"):
                return f"Created {path}"
            return f"ERROR: {result.get('description', 'Create failed')}"

        return f"ERROR: Unknown command: {command}"
    except Exception as e:
        logger.exception("str_replace_editor error")
        return f"ERROR: {e}"


def list_directory(path: str, depth: int = 1) -> str:
    """List files and folders in a directory."""
    try:
        from app.services.desktop_commander import dc_list_directory
        result = dc_list_directory(path, depth=min(depth, 3))
        if not result.get("success"):
            return f"ERROR: {result.get('description', 'Failed to list directory')}"
        items = result.get("items", [])
        lines = [f"Directory: {path} ({result.get('total', len(items))} items)"]
        for item in items[:100]:
            icon = "📁" if item.get("type") == "directory" else "📄"
            size = f"  ({item.get('size_bytes', '?')} B)" if item.get("size_bytes") else ""
            lines.append(f"  {icon} {item.get('relative_path', item.get('name', '?'))}{size}")
        if len(items) > 100:
            lines.append(f"  ... and {len(items) - 100} more")
        return "\n".join(lines)
    except Exception as e:
        return f"ERROR: {e}"


def system_info() -> str:
    """Get system information."""
    try:
        from app.services.desktop_commander import dc_get_system_info
        result = dc_get_system_info()
        if not result.get("success"):
            return f"ERROR: {result.get('description', 'Failed')}"
        info = {k: v for k, v in result.items() if k not in ("success", "description")}
        import json
        return json.dumps(info, indent=2, default=str)
    except Exception as e:
        return f"ERROR: {e}"


# Register tools
registry.register("bash_tool", bash_tool)
registry.register("str_replace_editor", str_replace_editor)
registry.register("list_directory", list_directory)
registry.register("system_info", system_info)
