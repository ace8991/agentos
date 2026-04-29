"""Anthropic Claude provider with native Computer Use support.

Uses the official anthropic Python SDK.
Supports:
- computer_20250124 tool (pixel-precise computer use)
- text_editor_20250124
- bash_20250124
- Extended thinking
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

import anthropic

from src.agent.config import agent_config
from src.agent.core.types import AgentResponse, Message, StreamingChunk, ToolCall, ToolSchema
from src.agent.providers.base import LLMProvider

logger = logging.getLogger("agentos.agent.anthropic")


class AnthropicProvider(LLMProvider):
    """Provider for Anthropic Claude models."""

    def __init__(self, model: str = "claude-sonnet-4-6") -> None:
        self.model = model
        api_key = agent_config.get_api_key("anthropic")
        if not api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY is not configured. "
                "Save it in Settings or set the ANTHROPIC_API_KEY environment variable."
            )
        self._client = anthropic.AsyncAnthropic(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "anthropic"

    def _translate_to_provider_tools(self, tools: list[ToolSchema]) -> list[dict]:
        """Translate internal ToolSchema to Anthropic format.

        Anthropic format:
        {
            "name": str,
            "description": str,
            "input_schema": {...}
        }
        """
        return [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.parameters,
            }
            for t in tools
        ]

    def _translate_from_provider_response(self, response: anthropic.types.Message) -> AgentResponse:
        """Translate Anthropic Message to universal AgentResponse."""
        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        thinking: str | None = None

        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append(
                    ToolCall(
                        id=block.id,
                        name=block.name,
                        args=dict(block.input) if isinstance(block.input, dict) else {},
                    )
                )
            elif block.type == "thinking":
                thinking = (thinking or "") + block.thinking

        stop_reason_map = {
            "end_turn": "end_turn",
            "tool_use": "tool_use",
            "max_tokens": "max_tokens",
            "stop_sequence": "end_turn",
        }

        return AgentResponse(
            text="".join(text_parts),
            tool_calls=tool_calls,
            stop_reason=stop_reason_map.get(response.stop_reason, "end_turn"),
            thinking=thinking,
        )

    def _build_messages(self, messages: list[Message]) -> list[dict]:
        """Convert universal Messages to Anthropic format."""
        result: list[dict] = []
        for msg in messages:
            if msg.role == "system":
                continue  # Anthropic uses system parameter, not in messages
            if msg.role == "tool":
                # Tool result format for Anthropic
                result.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "tool_result",
                                "tool_use_id": msg.tool_call_id or "",
                                "content": msg.content,
                            }
                        ],
                    }
                )
            elif msg.role == "assistant":
                content: list[dict] = [{"type": "text", "text": msg.content}] if msg.content else []
                if msg.name:  # It's a tool call response
                    try:
                        content.append(
                            {
                                "type": "tool_use",
                                "id": msg.tool_call_id or "",
                                "name": msg.name,
                                "input": json.loads(msg.content) if msg.content else {},
                            }
                        )
                    except json.JSONDecodeError:
                        content.append(
                            {
                                "type": "tool_use",
                                "id": msg.tool_call_id or "",
                                "name": msg.name,
                                "input": {},
                            }
                        )
                result.append({"role": "assistant", "content": content})
            else:
                result.append({"role": msg.role, "content": msg.content})
        return result

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
        system_prompt: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.0,
    ) -> AgentResponse:
        anthropic_messages = self._build_messages(messages)
        anthropic_tools = self._translate_to_provider_tools(tools) if tools else None

        kwargs: dict = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": anthropic_messages,
            "temperature": temperature,
        }
        if system_prompt:
            kwargs["system"] = system_prompt
        if anthropic_tools:
            kwargs["tools"] = anthropic_tools

        try:
            response = await self._client.messages.create(**kwargs)
            return self._translate_from_provider_response(response)
        except anthropic.APIStatusError as e:
            logger.error("Anthropic API error: %s", e)
            return AgentResponse(
                text="",
                stop_reason="error",
                error=f"Anthropic API error ({e.status_code}): {e.message}",
            )
        except anthropic.APIConnectionError:
            logger.error("Cannot connect to Anthropic API")
            return AgentResponse(
                text="",
                stop_reason="error",
                error="Cannot connect to Anthropic API. Check your internet connection.",
            )
        except Exception as e:
            logger.exception("Anthropic chat error")
            return AgentResponse(
                text="",
                stop_reason="error",
                error=f"Anthropic error: {e}",
            )

    async def chat_stream(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
        system_prompt: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.0,
    ) -> AsyncGenerator[StreamingChunk, None]:
        anthropic_messages = self._build_messages(messages)
        anthropic_tools = self._translate_to_provider_tools(tools) if tools else None

        kwargs: dict = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": anthropic_messages,
            "temperature": temperature,
        }
        if system_prompt:
            kwargs["system"] = system_prompt
        if anthropic_tools:
            kwargs["tools"] = anthropic_tools

        try:
            current_tool_call: dict | None = None
            async with self._client.messages.stream(**kwargs) as stream:
                async for event in stream:
                    if event.type == "content_block_start":
                        block = event.content_block
                        if block.type == "tool_use":
                            current_tool_call = {"id": block.id, "name": block.name, "args": ""}
                            yield StreamingChunk(
                                type="tool_call_start",
                                tool_call_id=block.id,
                                tool_name=block.name,
                            )
                    elif event.type == "content_block_delta":
                        delta = event.delta
                        if delta.type == "text_delta":
                            yield StreamingChunk(type="text", text=delta.text)
                        elif delta.type == "thinking_delta":
                            yield StreamingChunk(type="thinking", text=delta.thinking)
                        elif delta.type == "input_json_delta":
                            if current_tool_call:
                                current_tool_call["args"] += delta.partial_json
                            yield StreamingChunk(
                                type="tool_call_delta",
                                tool_call_id=current_tool_call.get("id") if current_tool_call else None,
                                tool_args=delta.partial_json,
                            )
                    elif event.type == "message_delta":
                        if event.delta.stop_reason == "end_turn":
                            yield StreamingChunk(type="done")
        except Exception as e:
            logger.exception("Anthropic stream error")
            yield StreamingChunk(type="error", error=str(e))
