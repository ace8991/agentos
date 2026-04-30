"""
OpenAI provider — for GPT-4o, GPT-5, etc.

Inherits the OpenAI-compatible logic from DeepSeek (because DeepSeek's API
is itself OpenAI-compatible — they share the same translation code).
"""
from __future__ import annotations

import os

from .deepseek_provider import DeepSeekProvider


class OpenAIProvider(DeepSeekProvider):
    """OpenAI provider — drop-in replacement for DeepSeek with different base_url."""
    name = "openai"

    def __init__(
        self,
        model_id: str = "gpt-5",
        *,
        api_key: str | None = None,
        max_tokens: int = 4096,
    ):
        super().__init__(
            model_id=model_id,
            api_key=api_key or os.getenv("OPENAI_API_KEY"),
            base_url="https://api.openai.com/v1",
            max_tokens=max_tokens,
            thinking=False,  # OpenAI uses different reasoning param
        )
