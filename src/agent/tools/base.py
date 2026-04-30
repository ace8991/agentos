"""
Tool layer base classes.

Every tool inherits from `Tool` and implements `execute()`. Tools are
registered in a `ToolRegistry` that the orchestrator queries.

Tools are LLM-agnostic — they don't know which model is calling them.
They just take arguments, do their job, and return a ToolResult.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ..core.types import ToolResult, ToolSchema


class Tool(ABC):
    """A single tool the agent can invoke."""
    name: str = ""
    description: str = ""
    parameters: dict[str, Any] = {}

    # If True, this tool is for Anthropic's native computer use only
    is_computer_use_native: bool = False
    # If True, this tool is for the semantic toolkit (works with all models)
    is_semantic: bool = True

    @abstractmethod
    def execute(self, args: dict[str, Any]) -> ToolResult:
        """Execute the tool with the given arguments."""
        ...

    def schema(self) -> ToolSchema:
        return ToolSchema(
            name=self.name,
            description=self.description,
            parameters=self.parameters,
        )


class ToolRegistry:
    """Holds all registered tools and exposes them to the orchestrator."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        if not tool.name:
            raise ValueError(f"Tool {tool.__class__.__name__} has no name")
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool:
        if name not in self._tools:
            raise KeyError(f"Tool '{name}' is not registered")
        return self._tools[name]

    def all(self) -> list[Tool]:
        return list(self._tools.values())

    def get_semantic_schemas(self) -> list[ToolSchema]:
        """Return tool schemas for non-Computer-Use models (DeepSeek, GPT, etc.)."""
        return [t.schema() for t in self._tools.values() if t.is_semantic]

    def get_computer_use_schemas(self) -> list[ToolSchema]:
        """Return tool schemas for Computer-Use-capable models (Claude).

        Includes the native `computer` tool plus auxiliary tools (file ops,
        shell) that are useful even with computer use enabled.
        """
        out: list[ToolSchema] = []
        for t in self._tools.values():
            if t.is_computer_use_native or t.name in {"file_create", "file_read", "shell"}:
                out.append(t.schema())
        return out


def build_default_registry() -> ToolRegistry:
    """Build the standard tool registry with all desktop-control tools."""
    from .file_ops import FileCreateTool, FileReadTool
    from .keyboard import KeyboardPressTool, KeyboardTypeTool
    from .mouse import MouseClickTool, MouseDragTool, MouseMoveTool, MouseScrollTool
    from .screen import ScreenshotTool
    from .shell import ShellTool
    from .ui_tree import (
        ClickElementTool,
        ReadUITreeTool,
        TypeInFieldTool,
    )
    from .computer_native import ComputerUseTool

    registry = ToolRegistry()

    # Core sensor
    registry.register(ScreenshotTool())

    # Semantic toolkit (works with ANY model)
    registry.register(ReadUITreeTool())
    registry.register(ClickElementTool())
    registry.register(TypeInFieldTool())
    registry.register(MouseMoveTool())
    registry.register(MouseClickTool())
    registry.register(MouseDragTool())
    registry.register(MouseScrollTool())
    registry.register(KeyboardTypeTool())
    registry.register(KeyboardPressTool())
    registry.register(FileCreateTool())
    registry.register(FileReadTool())
    registry.register(ShellTool())

    # Native Computer Use (Claude only — provider filters out for others)
    registry.register(ComputerUseTool())

    return registry
