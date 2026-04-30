"""
Gemini provider.

Google now exposes an OpenAI-compatible endpoint for Gemini models, so we
reuse the DeepSeek/OpenAI translation code with a different base_url.

If you prefer the native google-generativeai SDK, see the alternative
implementation comment below.
"""
from __future__ import annotations

import os

from .deepseek_provider import DeepSeekProvider


class GeminiProvider(DeepSeekProvider):
    """Gemini via Google's OpenAI-compat endpoint."""
    name = "gemini"

    def __init__(
        self,
        model_id: str = "gemini-2.5-pro",
        *,
        api_key: str | None = None,
        max_tokens: int = 4096,
    ):
        super().__init__(
            model_id=model_id,
            api_key=api_key or os.getenv("GEMINI_API_KEY"),
            base_url="https://generativelanguage.googleapis.com/v1beta/openai",
            max_tokens=max_tokens,
            thinking=False,
        )

# ─────────────────────────────────────────────────────────────────
# Alternative: native google-generativeai SDK (more feature-complete)
# Uncomment and implement if you need features not exposed in OpenAI compat
# ─────────────────────────────────────────────────────────────────
# from google import generativeai as genai
# class GeminiNativeProvider(LLMProvider):
#     def __init__(self, model_id, api_key=None):
#         genai.configure(api_key=api_key or os.getenv("GEMINI_API_KEY"))
#         self.model = genai.GenerativeModel(model_id)
#     async def chat(self, messages, tools, image=None):
#         ... # translate to/from Gemini's native format
