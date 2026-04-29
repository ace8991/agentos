"""Universal dataclasses for the AgentOS multi-LLM agent system.

These types are provider-agnostic — every LLM provider translates to/from them.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class Message:
    """A single message in the conversation history."""

    role: Literal["system", "user", "assistant", "tool"]
    content: str
    tool_call_id: str | None = None
    name: str | None = None


@dataclass
class ToolCall:
    """A tool call requested by the LLM."""

    id: str
    name: str
    args: dict[str, Any]


@dataclass
class ToolResult:
    """Result of executing a tool call."""

    tool_call_id: str
    content: str
    success: bool = True


@dataclass
class AgentResponse:
    """Standardised response from any LLM provider."""

    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    stop_reason: Literal["end_turn", "tool_use", "error", "max_tokens"] = "end_turn"
    error: str | None = None
    thinking: str | None = None


@dataclass
class StreamingChunk:
    """A single chunk from a streaming LLM response."""

    type: Literal["text", "thinking", "tool_call_start", "tool_call_delta", "done", "error"]
    text: str = ""
    tool_call_id: str | None = None
    tool_name: str | None = None
    tool_args: str | None = None  # partial JSON
    error: str | None = None


@dataclass
class ToolSchema:
    """Internal universal tool schema — translated per-provider before API calls."""

    name: str
    description: str
    parameters: dict[str, Any]


# Vision mode enumeration
VisionMode = Literal["pixel_computer_use", "semantic_ui_tree", "none"]
"""pixel_computer_use → native computer_20250124 tool (Claude only)
   semantic_ui_tree → UI tree JSON + semantic click_element/type_in tools (any LLM)
   none → no vision, text-only
"""
