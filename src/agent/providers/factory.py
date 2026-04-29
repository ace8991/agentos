"""Provider factory — creates the right provider for any model.

Maps model IDs to their corresponding provider instances.
"""

from __future__ import annotations

import logging

from src.agent.config import agent_config
from src.agent.core.registry import MODEL_REGISTRY, ModelInfo
from src.agent.providers.anthropic_provider import AnthropicProvider
from src.agent.providers.base import LLMProvider
from src.agent.providers.openai_compat import OpenAICompatProvider

logger = logging.getLogger("agentos.agent.factory")

# Mapping of provider names to their API configuration
_PROVIDER_CONFIG: dict[str, dict] = {
    "deepseek": {
        "base_url": agent_config.deepseek_base_url,
        "api_key": agent_config.get_api_key("deepseek"),
        "extra_headers": {},
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "api_key": agent_config.get_api_key("openai"),
        "extra_headers": {},
    },
    "mistral": {
        "base_url": "https://api.mistral.ai/v1",
        "api_key": agent_config.get_api_key("mistral"),
        "extra_headers": {},
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "api_key": agent_config.get_api_key("groq"),
        "extra_headers": {},
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_key": agent_config.get_api_key("qwen"),
        "extra_headers": {},
    },
    "ollama": {
        "base_url": f"{agent_config.ollama_base_url}/v1",
        "api_key": None,  # Ollama doesn't need an API key
        "extra_headers": {},
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "api_key": agent_config.get_api_key("gemini"),
        "extra_headers": {},
    },
}


def create_provider(model_id: str) -> LLMProvider:
    """Create the appropriate provider for the given model ID.

    Args:
        model_id: The model identifier (e.g. 'claude-sonnet-4-6', 'deepseek-chat').

    Returns:
        An LLMProvider instance.

    Raises:
        ValueError: If the model is not found in the registry or the provider
                    is not supported.
    """
    model_info = MODEL_REGISTRY.get(model_id)
    if not model_info:
        available = list(MODEL_REGISTRY.keys())
        raise ValueError(
            f"Unknown model: '{model_id}'. "
            f"Available models: {available}"
        )

    return _create_provider_for_model(model_info)


def _create_provider_for_model(model_info: ModelInfo) -> LLMProvider:
    """Internal: create provider based on ModelInfo."""
    provider = model_info.provider

    # Anthropic uses its own SDK
    if provider == "anthropic":
        return AnthropicProvider(model=model_info.id)

    # OpenAI-compatible providers
    config = _PROVIDER_CONFIG.get(provider)
    if not config:
        raise ValueError(
            f"Provider '{provider}' for model '{model_info.id}' is not configured. "
            f"Supported providers: {list(_PROVIDER_CONFIG.keys())}"
        )

    return OpenAICompatProvider(
        model=model_info.id,
        provider_name=provider,
        api_key=config["api_key"],
        base_url=config["base_url"],
        extra_headers=config.get("extra_headers"),
    )


def list_available_models() -> list[dict]:
    """Return all models with their frontend-friendly metadata.

    Returns a list of dicts suitable for the GET /api/agent/models endpoint.
    """
    results: list[dict] = []
    for model_id, info in MODEL_REGISTRY.items():
        if info.legacy:
            continue
        results.append(
            {
                "id": info.id,
                "provider": info.provider,
                "label": info.label,
                "computer_use": info.supports_computer_use,
                "vision": info.supports_vision,
                "max_context": info.max_context,
            }
        )
    return sorted(results, key=lambda m: (m["provider"], m["label"]))
