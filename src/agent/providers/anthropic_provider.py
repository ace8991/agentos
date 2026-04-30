"""
Anthropic provider — supports native Computer Use tool (computer_20251124).

When the model supports computer use, we send the special `computer` tool
that Claude is trained to use with pixel coordinates. Otherwise we fall back
to standard function-calling tools.
"""
from __future__ import annotations

import logging
import os
from typing import Any

from anthropic import AsyncAnthropic

from ..core.types import (
    AgentResponse,
    ContentBlock,
    Message,
    Role,
    ToolCall,
    ToolSchema,
)
from .base import LLMProvider

logger = logging.getLogger("agentos.agent.anthropic")


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    # Models that support the native computer use tool
    COMPUTER_USE_MODELS = {
        "claude-opus-4-7",
        "claude-opus-4-6",
        "claude-opus-4-5",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
    }

    def __init__(
        self,
        model_id: str,
        *,
        api_key: str | None = None,
        max_tokens: int = 4096,
        display_width: int = 1920,
        display_height: int = 1080,
        enable_computer_use: bool = True,
    ):
        self.model_id = model_id
        self.client = AsyncAnthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))
        self.max_tokens = max_tokens
        self.display_width = display_width
        self.display_height = display_height
        self.enable_computer_use = enable_computer_use and model_id in self.COMPUTER_USE_MODELS

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolSchema],
        image: bytes | None = None,
    ) -> AgentResponse:
        anthropic_messages = self._translate_messages(messages, image)
        anthropic_tools = self._translate_tools(tools)

        # Extract system prompt
        system_prompt = ""
        non_system_messages = []
        for m in anthropic_messages:
            if m["role"] == "system":
                system_prompt = m["content"] if isinstance(m["content"], str) else ""
            else:
                non_system_messages.append(m)

        kwargs: dict[str, Any] = {
            "model": self.model_id,
            "max_tokens": self.max_tokens,
            "messages": non_system_messages,
            "tools": anthropic_tools,
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        # Add computer use beta header when applicable
        extra_headers = {}
        if self.enable_computer_use:
            extra_headers["anthropic-beta"] = "computer-use-2025-01-24"

        if extra_headers:
            kwargs["extra_headers"] = extra_headers

        response = await self.client.messages.create(**kwargs)

        return self._translate_response(response)

    # ─────────────────────────────────────────────────────────────────
    # TRANSLATION : universal → Anthropic
    # ─────────────────────────────────────────────────────────────────

    def _translate_messages(
        self,
        messages: list[Message],
        image: bytes | None,
    ) -> list[dict]:
        result = []
        for i, msg in enumerate(messages):
            is_last_user = (
                msg.role == Role.USER and i == len(messages) - 1
            )
            result.append(self._translate_message(msg, attach_image=image if is_last_user else None))
        return result

    def _translate_message(self, msg: Message, attach_image: bytes | None = None) -> dict:
        role_map = {
            Role.SYSTEM: "system",
            Role.USER: "user",
            Role.ASSISTANT: "assistant",
            Role.TOOL: "user",  # Anthropic puts tool results in user turns
        }
        anthropic_role = role_map[msg.role]

        # Tool result message
        if msg.role == Role.TOOL:
            return {
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": msg.tool_call_id,
                    "content": str(msg.content),
                }],
            }

        # Plain text
        if isinstance(msg.content, str):
            content_blocks: list[dict] = [{"type": "text", "text": msg.content}]
            if attach_image:
                content_blocks.insert(0, {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": self._image_to_base64(attach_image),
                    },
                })
            return {"role": anthropic_role, "content": content_blocks}

        # Structured content (e.g., assistant turn with tool calls)
        anthropic_blocks = []
        for block in msg.content:
            if block.type == "text" and block.text:
                anthropic_blocks.append({"type": "text", "text": block.text})
            elif block.type == "tool_result" and block.tool_call_id:
                # This is actually our internal format for "assistant requested a tool"
                anthropic_blocks.append({
                    "type": "tool_use",
                    "id": block.tool_call_id,
                    "name": block.tool_result["name"],
                    "input": block.tool_result["args"],
                })
        return {"role": anthropic_role, "content": anthropic_blocks}

    def _translate_tools(self, tools: list[ToolSchema]) -> list[dict]:
        result = []
        for tool in tools:
            # Special case: native computer use tool
            if tool.name == "computer" and self.enable_computer_use:
                result.append({
                    "type": "computer_20251124",
                    "name": "computer",
                    "display_width_px": self.display_width,
                    "display_height_px": self.display_height,
                })
                continue
            # Standard tool
            result.append({
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.parameters,
            })
        return result

    # ─────────────────────────────────────────────────────────────────
    # TRANSLATION : Anthropic → universal
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _translate_response(response) -> AgentResponse:
        text_parts = []
        tool_calls: list[ToolCall] = []

        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append(ToolCall(
                    id=block.id,
                    name=block.name,
                    arguments=dict(block.input) if block.input else {},
                ))

        return AgentResponse(
            text="\n".join(text_parts),
            tool_calls=tool_calls,
            finish_reason=response.stop_reason or "stop",
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
            raw=response.model_dump() if hasattr(response, "model_dump") else None,
        )
