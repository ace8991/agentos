"""Tool registry — maps tool names to executable functions.

The tool layer is completely independent of the LLM provider.
It just knows how to execute actions on the local machine.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from src.agent.core.types import ToolResult, ToolSchema

logger = logging.getLogger("agentos.agent.tools")

# Type for a tool handler function
ToolHandler = Callable[..., str]


class ToolRegistry:
    """Registry that maps tool names to their implementations."""

    def __init__(self) -> None:
        self._handlers: dict[str, ToolHandler] = {}

    def register(self, name: str, handler: ToolHandler) -> None:
        """Register a tool handler."""
        self._handlers[name] = handler

    def execute(self, name: str, args: dict[str, Any]) -> ToolResult:
        """Execute a tool by name with the given arguments.

        Args:
            name: The tool name.
            args: Arguments dict.

        Returns:
            ToolResult with the execution result.
        """
        handler = self._handlers.get(name)
        if not handler:
            return ToolResult(
                tool_call_id="",
                content=f"ERROR: Unknown tool: {name}",
                success=False,
            )

        try:
            content = handler(**args)
            return ToolResult(tool_call_id="", content=content, success=True)
        except Exception as e:
            logger.exception("Tool %s execution error", name)
            return ToolResult(
                tool_call_id="",
                content=f"ERROR executing {name}: {e}",
                success=False,
            )

    def list_tools(self) -> list[str]:
        """List all registered tool names."""
        return list(self._handlers.keys())


# Global tool registry
registry = ToolRegistry()
