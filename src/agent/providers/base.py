"""Abstract base class for all LLM providers.

Every provider must implement the `chat` method. The orchestrator calls it
with universal Message/ToolSchema types and receives a universal AgentResponse.

Providers handle their own format translation internally.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator

from src.agent.core.types import AgentResponse, Message, StreamingChunk, ToolSchema


class LLMProvider(ABC):
    """Abstract interface for an LLM provider."""

    @abstractmethod
    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
        system_prompt: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.0,
    ) -> AgentResponse:
        """Send messages to the LLM and get a response.

        Args:
            messages: Conversation history.
            tools: Available tool definitions (in internal ToolSchema format).
            system_prompt: Optional system prompt.
            max_tokens: Maximum tokens in the response.
            temperature: Sampling temperature.

        Returns:
            AgentResponse with text and/or tool_calls.
        """
        ...

    @abstractmethod
    async def chat_stream(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
        system_prompt: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.0,
    ) -> AsyncGenerator[StreamingChunk, None]:
        """Stream a response from the LLM.

        Args:
            Same as chat().

        Yields:
            StreamingChunk events (text, thinking, tool_call_*, error, done).
        """
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name (e.g. 'anthropic', 'deepseek')."""
        ...

    def _translate_to_provider_tools(self, tools: list[ToolSchema]) -> list[dict]:
        """Translate internal ToolSchema list to provider-specific format.

        Override this if the provider uses a different tool format.
        Default implementation raises NotImplementedError.
        """
        raise NotImplementedError("Provider must implement tool translation")

    def _translate_from_provider_response(self, response: dict) -> AgentResponse:
        """Translate provider-specific response to universal AgentResponse.

        Override this for each provider.
        """
        raise NotImplementedError("Provider must implement response translation")
