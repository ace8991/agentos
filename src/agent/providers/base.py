"""
Base provider interface.

Every concrete provider (Anthropic, DeepSeek, OpenAI, Gemini, Ollama) must
implement this interface. The orchestrator never knows which one it's using.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from ..core.types import AgentResponse, Message, ToolSchema


class LLMProvider(ABC):
    """Abstract interface every provider implements.

    Implementations are responsible for:
      - Translating universal Message/ToolSchema → provider-native format
      - Calling the provider's API
      - Translating the response → universal AgentResponse

    All providers must be ASYNC (use `async def chat`).
    """

    name: str = "base"  # Override in subclass

    @abstractmethod
    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolSchema],
        image: bytes | None = None,
    ) -> AgentResponse:
        """Send messages to the LLM and get a response.

        Args:
            messages: Conversation history in universal format.
            tools: Available tools the model can call.
            image: Optional screenshot (PNG bytes) attached to the latest user
                turn. Providers should attach it to the last user message in
                their native format.

        Returns:
            AgentResponse with text and/or tool_calls.
        """
        ...

    # ─────────────────────────────────────────────────────────────────
    # SHARED HELPERS (used by multiple providers)
    # ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _image_to_base64(image: bytes) -> str:
        import base64
        return base64.b64encode(image).decode()
