"""
Provider factory.

Given a ModelInfo from the registry, returns an instantiated LLMProvider.
This is the only place where "model id → provider class" mapping lives.
"""
from __future__ import annotations

from ..core.registry import ModelInfo
from .anthropic_provider import AnthropicProvider
from .base import LLMProvider
from .deepseek_provider import DeepSeekProvider
from .gemini_provider import GeminiProvider
from .ollama_provider import OllamaProvider
from .openai_provider import OpenAIProvider


def make_provider(model: ModelInfo, **kwargs) -> LLMProvider:
    """Create a provider instance for the given model.

    Args:
        model: ModelInfo from MODEL_REGISTRY
        **kwargs: Optional overrides forwarded to the provider constructor

    Returns:
        Instantiated LLMProvider ready to use.

    Raises:
        ValueError: If no provider class matches the model.provider field.
    """
    p = model.provider

    if p == "anthropic":
        return AnthropicProvider(model_id=model.id, **kwargs)
    if p == "deepseek":
        return DeepSeekProvider(model_id=model.id, **kwargs)
    if p == "openai":
        return OpenAIProvider(model_id=model.id, **kwargs)
    if p == "gemini":
        return GeminiProvider(model_id=model.id, **kwargs)
    if p == "ollama":
        return OllamaProvider(model_id=model.id, **kwargs)

    raise ValueError(
        f"No provider class registered for '{p}'. "
        f"Add a class in providers/ and register it in providers/factory.py"
    )
