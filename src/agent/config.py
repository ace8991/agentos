"""Agent configuration loaded from .env and runtime config.

Provides a unified interface for all agent settings.
"""

from __future__ import annotations

import os
import logging

logger = logging.getLogger("agentos.agent")


class AgentConfig:
    """Holds all agent-related configuration from environment variables."""

    def __init__(self) -> None:
        self.default_model: str = os.getenv("AGENT_DEFAULT_MODEL", "claude-sonnet-4-6")
        self.max_iterations: int = int(os.getenv("AGENT_MAX_ITERATIONS", "25"))
        self.screenshot_on_every_step: bool = os.getenv("AGENT_SCREENSHOT_ON_EVERY_STEP", "true").lower() == "true"
        self.require_confirmation_for: list[str] = [
            x.strip().lower()
            for x in os.getenv("AGENT_REQUIRE_CONFIRMATION_FOR", "download,purchase,delete,financial").split(",")
            if x.strip()
        ]

        # Provider API keys
        self.anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY")
        self.openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
        self.deepseek_api_key: str | None = os.getenv("DEEPSEEK_API_KEY")
        self.gemini_api_key: str | None = os.getenv("GEMINI_API_KEY")
        self.mistral_api_key: str | None = os.getenv("MISTRAL_API_KEY")
        self.groq_api_key: str | None = os.getenv("GROQ_API_KEY")
        self.qwen_api_key: str | None = os.getenv("QWEN_API_KEY")

        # Base URLs for OpenAI-compatible providers
        self.deepseek_base_url: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self.ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.lmstudio_base_url: str = os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234")

        # Guardrails
        self.domain_blocklist: list[str] = [
            x.strip().lower()
            for x in os.getenv("AGENT_DOMAIN_BLOCKLIST", "bank,banque,paypal,credit-card,cb").split(",")
            if x.strip()
        ]

    def get_api_key(self, provider: str) -> str | None:
        """Get the API key for a given provider."""
        key_map = {
            "anthropic": self.anthropic_api_key,
            "openai": self.openai_api_key,
            "deepseek": self.deepseek_api_key,
            "gemini": self.gemini_api_key,
            "mistral": self.mistral_api_key,
            "groq": self.groq_api_key,
            "qwen": self.qwen_api_key,
        }
        return key_map.get(provider)

    def get_base_url(self, provider: str) -> str | None:
        """Get the base URL for OpenAI-compatible providers."""
        url_map = {
            "deepseek": self.deepseek_base_url,
            "ollama": self.ollama_base_url,
            "lmstudio": self.lmstudio_base_url,
        }
        return url_map.get(provider)


# Singleton
agent_config = AgentConfig()
