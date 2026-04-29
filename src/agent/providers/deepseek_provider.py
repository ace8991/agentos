"""DeepSeek provider — OpenAI-compatible, uses OpenAICompatProvider.

DeepSeek models: deepseek-chat (V3), deepseek-reasoner (R1).
"""

from src.agent.config import agent_config
from src.agent.providers.openai_compat import OpenAICompatProvider


def create_deepseek_provider(model: str) -> OpenAICompatProvider:
    """Create a DeepSeek provider instance."""
    return OpenAICompatProvider(
        model=model,
        provider_name="deepseek",
        api_key=agent_config.get_api_key("deepseek"),
        base_url=agent_config.deepseek_base_url,
    )
