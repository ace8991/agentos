"""Base class for OpenAI-compatible providers.

Used by: DeepSeek, OpenAI, Mistral, Groq, Qwen (OpenAI-compatible API format).
Ollama is also OpenAI-compatible via its /v1 endpoint.

All these providers use the same tool format:
{
    "type": "function",
    "function": {
        "name": str,
        "description": str,
        "parameters": {...}
    }
}
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from openai import AsyncOpenAI

from src.agent.core.types import AgentResponse, Message, StreamingChunk, ToolCall, ToolSchema
from src.agent.providers.base import LLMProvider

logger = logging.getLogger("agentos.agent.openai_compat")


class OpenAICompatProvider(LLMProvider):
    """Provider for any OpenAI-compatible API (DeepSeek, OpenAI, Mistral, Groq, Qwen, Ollama)."""

    def __init__(
        self,
        model: str,
        provider_name: str,
        api_key: str | None,
        base_url: str = "https://api.openai.com/v1",
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        self.model = model
        self._provider_name = provider_name
        self._extra_headers = extra_headers or {}

        client_kwargs: dict[str, Any] = {
            "api_key": api_key or "sk-placeholder",
            "base_url": base_url,
        }
        if extra_headers:
            client_kwargs["default_headers"] = extra_headers

        self._client = AsyncOpenAI(**client_kwargs)

    @property
    def provider_name(self) -> str:
        return self._provider_name

    def _translate_to_provider_tools(self, tools: list[ToolSchema]) -> list[dict]:
        """Translate internal ToolSchema to OpenAI format.

        OpenAI format:
        {
            "type": "function",
            "function": {
                "name": str,
                "description": str,
                "parameters": {...}
            }
        }
        """
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            }
            for t in tools
        ]

    def _build_messages(self, messages: list[Message], system_prompt: str | None) -> list[dict]:
        """Convert universal Messages to OpenAI format."""
        result: list[dict] = []

        if system_prompt:
            result.append({"role": "system", "content": system_prompt})

        for msg in messages:
            if msg.role == "system":
                result.append({"role": "system", "content": msg.content})
            elif msg.role == "tool":
                result.append(
                    {
                        "role": "tool",
                        "tool_call_id": msg.tool_call_id or "",
                        "content": msg.content,
                    }
                )
            elif msg.role == "assistant":
                entry: dict = {"role": "assistant", "content": msg.content or ""}
                if msg.name:  # Has tool calls
                    try:
                        args = json.loads(msg.content) if msg.content else {}
                    except json.JSONDecodeError:
                        args = {}
                    entry["tool_calls"] = [
                        {
                            "id": msg.tool_call_id or "",
                            "type": "function",
                            "function": {
                                "name": msg.name,
                                "arguments": json.dumps(args),
                            },
                        }
                    ]
                result.append(entry)
            else:
                result.append({"role": msg.role, "content": msg.content})

        return result

    def _translate_from_provider_response(self, response: Any) -> AgentResponse:
        """Translate OpenAI-style response to universal AgentResponse."""
        choice = response.choices[0] if response.choices else None
        if not choice:
            return AgentResponse(text="", stop_reason="end_turn")

        message = choice.message
        text = message.content or ""
        tool_calls: list[ToolCall] = []

        if message.tool_calls:
            for tc in message.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except (json.JSONDecodeError, TypeError):
                    args = {}
                tool_calls.append(
                    ToolCall(
                        id=tc.id,
                        name=tc.function.name,
                        args=args,
                    )
                )

        stop_reason = "end_turn"
        finish = choice.finish_reason
        if finish == "tool_calls":
            stop_reason = "tool_use"
        elif finish == "length":
            stop_reason = "max_tokens"

        return AgentResponse(
            text=text,
            tool_calls=tool_calls,
            stop_reason=stop_reason,
        )

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
        system_prompt: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.0,
    ) -> AgentResponse:
        openai_messages = self._build_messages(messages, system_prompt)
        openai_tools = self._translate_to_provider_tools(tools) if tools else None

        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": openai_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if openai_tools:
            kwargs["tools"] = openai_tools
            kwargs["tool_choice"] = "auto"

        try:
            response = await self._client.chat.completions.create(**kwargs)
            return self._translate_from_provider_response(response)
        except Exception as e:
            logger.error("%s API error: %s", self._provider_name, e)
            return AgentResponse(
                text="",
                stop_reason="error",
                error=f"{self._provider_name} API error: {e}",
            )

    async def chat_stream(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
        system_prompt: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.0,
    ) -> AsyncGenerator[StreamingChunk, None]:
        openai_messages = self._build_messages(messages, system_prompt)
        openai_tools = self._translate_to_provider_tools(tools) if tools else None

        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": openai_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
            "stream_options": {"include_usage": False},
        }
        if openai_tools:
            kwargs["tools"] = openai_tools
            kwargs["tool_choice"] = "auto"

        try:
            tool_calls_acc: dict[int, dict] = {}
            async for chunk in await self._client.chat.completions.create(**kwargs):
                if not chunk.choices:
                    continue

                choice = chunk.choices[0]
                delta = choice.delta

                # Text content
                if delta.content:
                    yield StreamingChunk(type="text", text=delta.content)

                # Reasoning content (DeepSeek-R1, Qwen3, etc.)
                reasoning = getattr(delta, "reasoning_content", None)
                if reasoning:
                    yield StreamingChunk(type="thinking", text=reasoning)

                # Tool call deltas
                if delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in tool_calls_acc:
                            tool_calls_acc[idx] = {
                                "id": tc_delta.id or f"call_{idx}",
                                "name": "",
                                "args": "",
                            }
                            yield StreamingChunk(
                                type="tool_call_start",
                                tool_call_id=tool_calls_acc[idx]["id"],
                                tool_name=tc_delta.function.name if tc_delta.function else None,
                            )
                        if tc_delta.function:
                            if tc_delta.function.name:
                                tool_calls_acc[idx]["name"] += tc_delta.function.name
                            if tc_delta.function.arguments:
                                tool_calls_acc[idx]["args"] += tc_delta.function.arguments
                                yield StreamingChunk(
                                    type="tool_call_delta",
                                    tool_call_id=tool_calls_acc[idx]["id"],
                                    tool_args=tc_delta.function.arguments,
                                )

                # Done?
                if choice.finish_reason:
                    yield StreamingChunk(type="done")

        except Exception as e:
            logger.exception("%s stream error", self._provider_name)
            yield StreamingChunk(type="error", error=str(e))
