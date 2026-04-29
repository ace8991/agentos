"""Shell execution tool.

Lightweight wrapper that uses the existing Desktop Commander executor.
"""

from __future__ import annotations

import logging

from src.agent.tools.base import registry

logger = logging.getLogger("agentos.agent.tools.shell")


def run_command(command: str, timeout_ms: int = 30000) -> str:
    """Run a shell command and return the output."""
    try:
        from app.services.desktop_commander import dc_execute_command
        result = dc_execute_command(command, timeout_ms=min(timeout_ms, 120000))
        if result.get("success"):
            output = result.get("stdout", "") or ""
            if result.get("stderr"):
                output += f"\n[stderr] {result['stderr']}"
            return output.strip() or "Command completed (no output)."
        else:
            error = result.get("stderr", "") or result.get("description", "Unknown error")
            return f"ERROR: {error}"
    except Exception as e:
        logger.exception("Shell execution error")
        return f"ERROR: {e}"


# Register
registry.register("shell", run_command)
