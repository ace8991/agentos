"""
Universal types used across all providers.

The orchestrator and tools work with these types only — providers translate
to/from their native formats internally.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal


class Role(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass
class Message:
    """Universal message format. Providers translate to their native shape."""
    role: Role
    content: str | list[ContentBlock]
    tool_call_id: str | None = None  # For role=TOOL, references the call
    name: str | None = None          # Optional speaker name


@dataclass
class ContentBlock:
    """A piece of content within a message (text, image, or tool result)."""
    type: Literal["text", "image", "tool_result"]
    text: str | None = None
    image_data: bytes | None = None
    image_mime: str | None = None
    tool_call_id: str | None = None
    tool_result: Any = None
    is_error: bool = False


@dataclass
class ToolCall:
    """A tool invocation requested by the model."""
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ToolResult:
    """The result of executing a tool call."""
    tool_call_id: str
    content: str | dict | list
    is_error: bool = False
    image: bytes | None = None  # Optional screenshot attached to result


@dataclass
class AgentResponse:
    """What every provider returns from chat() — universal shape."""
    text: str = ""                          # The model's text output
    tool_calls: list[ToolCall] = field(default_factory=list)
    reasoning: str | None = None            # For thinking/reasoning models
    raw: dict | None = None                 # Original provider response (debug)
    finish_reason: str = "stop"             # stop | tool_use | length | error
    usage: dict | None = None               # token counts


@dataclass
class ToolSchema:
    """Universal tool definition. Providers convert to OpenAI/Anthropic format."""
    name: str
    description: str
    parameters: dict[str, Any]              # JSON Schema for arguments


@dataclass
class AgentStep:
    """One iteration of the agent loop, for streaming/audit."""
    iteration: int
    timestamp: float
    response: AgentResponse
    tool_results: list[ToolResult] = field(default_factory=list)
    screenshot_before: bytes | None = None
    screenshot_after: bytes | None = None
