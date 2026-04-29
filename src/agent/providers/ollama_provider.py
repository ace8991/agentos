"""Ollama provider — for local models served via Ollama.

Uses OpenAI-compatible /v1 endpoint.
"""

from src.agent.config import agent_config
from src.agent.providers.openai_compat import OpenAICompatProvider


def create_ollama_provider(model: str) -> OpenAICompatProvider:
    """Create an Ollama provider instance."""
    return OpenAICompatProvider(
        model=model,
        provider_name="ollama",
        api_key=None,  # Ollama doesn't need an API key
        base_url=f"{agent_config.ollama_base_url}/v1",
    )
