"""Shell command execution."""
from __future__ import annotations

import subprocess
from typing import Any

from ..core.types import ToolResult
from .base import Tool


class ShellTool(Tool):
    name = "shell"
    description = (
        "Execute a shell command and return stdout/stderr. "
        "On Windows uses PowerShell. Use this for system tasks that don't need a GUI."
    )
    parameters = {
        "type": "object",
        "properties": {
            "command": {"type": "string"},
            "cwd": {"type": "string", "description": "Working directory (optional)"},
            "timeout": {"type": "integer", "description": "Seconds (default 30)"},
        },
        "required": ["command"],
    }

    def execute(self, args: dict[str, Any]) -> ToolResult:
        import platform
        is_win = platform.system() == "Windows"
        try:
            result = subprocess.run(
                args["command"],
                shell=True,
                capture_output=True,
                text=True,
                cwd=args.get("cwd"),
                timeout=args.get("timeout", 30),
                executable="powershell.exe" if is_win else None,
            )
            return ToolResult(
                tool_call_id="",
                content={
                    "stdout": result.stdout[-4000:],
                    "stderr": result.stderr[-2000:],
                    "returncode": result.returncode,
                },
                is_error=result.returncode != 0,
            )
        except subprocess.TimeoutExpired:
            return ToolResult(tool_call_id="", content="Command timed out", is_error=True)
        except Exception as e:
            return ToolResult(tool_call_id="", content=f"Shell error: {e}", is_error=True)
