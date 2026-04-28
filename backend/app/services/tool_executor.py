"""
Tool executor — runs the tools the model calls and returns results.
Each function returns a plain string (the tool_result content).
"""
from __future__ import annotations

import json
from typing import Any

from app.services import desktop_commander as dc
from app.services import web as web_svc


def _fmt(result: dict) -> str:
    """Format a Desktop Commander result dict as a readable string."""
    if not result.get("success"):
        return f"ERROR: {result.get('description', 'Unknown error')}"
    parts = []
    if result.get("description"):
        parts.append(result["description"])
    if result.get("content"):
        parts.append(result["content"])
    if result.get("items"):
        for item in result["items"][:100]:
            size = f"  ({item['size_bytes']} B)" if item.get("size_bytes") else ""
            parts.append(f"  {'📁' if item['type']=='directory' else '📄'} {item.get('relative_path', item['name'])}{size}")
    if result.get("stdout"):
        parts.append(result["stdout"])
    if result.get("stderr"):
        parts.append(f"[stderr] {result['stderr']}")
    if result.get("exit_code") is not None:
        parts.append(f"Exit code: {result['exit_code']}")
    return "\n".join(parts).strip() or "Done."


def execute(tool_name: str, tool_input: dict[str, Any]) -> str:
    """Execute a tool and return the result as a string."""
    try:
        if tool_name == "bash_tool":
            result = dc.dc_execute_command(
                tool_input["command"],
                shell=tool_input.get("shell", "powershell"),
                timeout_ms=min(int(tool_input.get("timeout_ms", 30000)), 120000),
                cwd=tool_input.get("cwd"),
            )
            return _fmt(result)

        elif tool_name == "str_replace_editor":
            cmd = tool_input.get("command", "view")
            path = tool_input["path"]

            if cmd == "view":
                result = dc.dc_read_file(path)
                if not result.get("success"):
                    return f"ERROR reading {path}: {result.get('description')}"
                content = result.get("content", "")
                lines = content.splitlines()
                numbered = "\n".join(f"{i+1:4d} | {l}" for i, l in enumerate(lines))
                return f"File: {path} ({len(lines)} lines)\n\n{numbered}"

            elif cmd == "str_replace":
                old_str = tool_input.get("old_str", "")
                new_str = tool_input.get("new_str", "")
                if not old_str:
                    return "ERROR: old_str is required for str_replace"
                result = dc.dc_edit_block(path, old_str, new_str)
                return _fmt(result)

            elif cmd == "create":
                file_text = tool_input.get("file_text", "")
                result = dc.dc_write_file(path, file_text)
                return _fmt(result)

            return f"ERROR: Unknown str_replace_editor command: {cmd}"

        elif tool_name == "list_directory":
            depth = min(int(tool_input.get("depth", 1)), 3)
            result = dc.dc_list_directory(tool_input["path"], depth=depth)
            return _fmt(result)

        elif tool_name == "web_search":
            query = tool_input["query"]
            max_results = int(tool_input.get("max_results", 5))
            result = web_svc.web_search(query, max_results)
            if not result.get("success"):
                return f"Search failed: {result.get('description', 'No results')}"
            lines = [f"Search: {query}\n"]
            for i, r in enumerate(result.get("results", []), 1):
                lines.append(f"{i}. {r.get('title', '')}")
                lines.append(f"   {r.get('url', '')}")
                lines.append(f"   {r.get('snippet', '')}\n")
            if result.get("answer"):
                lines.insert(1, f"Summary: {result['answer']}\n")
            return "\n".join(lines)

        elif tool_name == "system_info":
            result = dc.dc_get_system_info()
            if not result.get("success"):
                return f"ERROR: {result.get('description')}"
            info = {k: v for k, v in result.items() if k not in ("success", "description")}
            return json.dumps(info, indent=2, default=str)

        else:
            return f"ERROR: Unknown tool: {tool_name}"

    except Exception as exc:
        return f"TOOL ERROR ({tool_name}): {exc}"
