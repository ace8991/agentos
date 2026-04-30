"""
DeepSeek provider.

DeepSeek exposes an OpenAI-compatible API at https://api.deepseek.com.
We use the openai SDK with a custom base_url.

DeepSeek does NOT support the native computer_use tool. Instead, we send the
semantic toolkit (click_element, type_in_field, read_ui_tree, etc.) which
lets the model drive the desktop without pixel-precise coordinates.
"""
from __future__ import annotations

import logging
import os

from openai import AsyncOpenAI

from ..core.types import (
    AgentResponse,
    Message,
    Role,
    ToolCall,
    ToolSchema,
)
from .base import LLMProvider

logger = logging.getLogger("agentos.agent.deepseek")


class DeepSeekProvider(LLMProvider):
    name = "deepseek"

    def __init__(
        self,
        model_id: str = "deepseek-v4-pro",
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        max_tokens: int = 4096,
        thinking: bool = False,
        reasoning_effort: str = "high",
    ):
        self.model_id = model_id
        self.client = AsyncOpenAI(
            api_key=api_key or os.getenv("DEEPSEEK_API_KEY"),
            base_url=base_url or os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        )
        self.max_tokens = max_tokens
        self.thinking = thinking
        self.reasoning_effort = reasoning_effort

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolSchema],
        image: bytes | None = None,
    ) -> AgentResponse:
        openai_messages = self._translate_messages(messages, image)
        openai_tools = self._translate_tools(tools)

        kwargs = {
            "model": self.model_id,
            "messages": openai_messages,
            "max_tokens": self.max_tokens,
        }
        if openai_tools:
            kwargs["tools"] = openai_tools
            kwargs["tool_choice"] = "auto"
        if self.thinking:
            kwargs["thinking"] = {"type": "enabled"}
            kwargs["reasoning_effort"] = self.reasoning_effort

        response = await self.client.chat.completions.create(**kwargs)
        return self._translate_response(response)

    # ─────────────────────────────────────────────────────────────────
    # TRANSLATION : universal → OpenAI-compat (works for DeepSeek)
    # ─────────────────────────────────────────────────────────────────

    def _translate_messages(self, messages: list[Message], image: bytes | None) -> list[dict]:
        out: list[dict] = []
        last_user_idx = max(
            (i for i, m in enumerate(messages) if m.role == Role.USER),
            default=-1,
        )

        for i, msg in enumerate(messages):
            attach = image if (i == last_user_idx and image) else None
            out.append(self._translate_message(msg, attach))
        return out

    def _translate_message(self, msg: Message, attach_image: bytes | None) -> dict:
        # Tool result
        if msg.role == Role.TOOL:
            return {
                "role": "tool",
                "tool_call_id": msg.tool_call_id or "",
                "content": str(msg.content),
            }

        role_map = {
            Role.SYSTEM: "system",
            Role.USER: "user",
            Role.ASSISTANT: "assistant",
        }
        role = role_map[msg.role]

        # Assistant turn with tool calls
        if msg.role == Role.ASSISTANT and isinstance(msg.content, list):
            text_parts = []
            tool_calls = []
            for block in msg.content:
                if block.type == "text" and block.text:
                    text_parts.append(block.text)
                elif block.type == "tool_result" and block.tool_call_id:
                    # Internal flag for "assistant requested this tool"
                    import json as _json
                    tool_calls.append({
                        "id": block.tool_call_id,
                        "type": "function",
                        "function": {
                            "name": block.tool_result["name"],
                            "arguments": _json.dumps(block.tool_result["args"]),
                        },
                    })
            result = {"role": "assistant", "content": "\n".join(text_parts) or None}
            if tool_calls:
                result["tool_calls"] = tool_calls
            return result

        # Plain text + optional image
        if attach_image:
            return {
                "role": role,
                "content": [
                    {"type": "text", "text": msg.content if isinstance(msg.content, str) else ""},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{self._image_to_base64(attach_image)}",
                        },
                    },
                ],
            }

        text = msg.content if isinstance(msg.content, str) else ""
        return {"role": role, "content": text}

    @staticmethod
    def _translate_tools(tools: list[ToolSchema]) -> list[dict]:
        result = []
        for tool in tools:
            # Skip the special Anthropic-only computer tool — DeepSeek can't use it
            if tool.name == "computer":
                continue
            result.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters,
                },
            })
        return result

    # ─────────────────────────────────────────────────────────────────
    # TRANSLATION : OpenAI-compat → universal
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _translate_response(response) -> AgentResponse:
        import json as _json

        choice = response.choices[0]
        msg = choice.message

        tool_calls: list[ToolCall] = []
        if msg.tool_calls:
            for tc in msg.tool_calls:
                try:
                    args = _json.loads(tc.function.arguments) if tc.function.arguments else {}
                except _json.JSONDecodeError:
                    args = {"_raw": tc.function.arguments}
                tool_calls.append(ToolCall(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=args,
                ))

        # DeepSeek exposes reasoning via reasoning_content
        reasoning = getattr(msg, "reasoning_content", None)

        return AgentResponse(
            text=msg.content or "",
            tool_calls=tool_calls,
            reasoning=reasoning,
            finish_reason=choice.finish_reason or "stop",
            usage={
                "input_tokens": response.usage.prompt_tokens if response.usage else 0,
                "output_tokens": response.usage.completion_tokens if response.usage else 0,
            },
            raw=response.model_dump() if hasattr(response, "model_dump") else None,
        )
