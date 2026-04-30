"""
Ollama provider — for local models running on the user's machine.

Ollama exposes an OpenAI-compatible endpoint at http://localhost:11434/v1
so we reuse the same translation code.

Use this for offline mode or privacy-sensitive workflows.
"""
from __future__ import annotations

import os

from .deepseek_provider import DeepSeekProvider


class OllamaProvider(DeepSeekProvider):
    """Local Ollama models (Llama, Qwen, Mistral, etc.)."""
    name = "ollama"

    def __init__(
        self,
        model_id: str,
        *,
        base_url: str | None = None,
        max_tokens: int = 4096,
    ):
        super().__init__(
            model_id=model_id,
            api_key="ollama",  # Ollama ignores the key but openai SDK requires one
            base_url=base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            max_tokens=max_tokens,
            thinking=False,
        )
