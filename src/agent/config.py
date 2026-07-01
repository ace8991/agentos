"""Centralized configuration loaded from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class AgentConfig:
    # Default model when none specified
    default_model: str = os.getenv("AGENT_DEFAULT_MODEL", "claude-opus-4-8")

    # API keys
    anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY")
    deepseek_api_key: str | None = os.getenv("DEEPSEEK_API_KEY")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY")

    # Endpoints
    deepseek_base_url: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")

    # Agent settings
    max_iterations: int = int(os.getenv("AGENT_MAX_ITERATIONS", "25"))
    screenshot_each_step: bool = os.getenv("AGENT_SCREENSHOT_ON_EVERY_STEP", "true").lower() == "true"

    # Safety
    confirm_actions: list[str] = None

    def __post_init__(self):
        if self.confirm_actions is None:
            raw = os.getenv("AGENT_REQUIRE_CONFIRMATION_FOR", "download,purchase,delete,financial")
            self.confirm_actions = [a.strip() for a in raw.split(",") if a.strip()]


CONFIG = AgentConfig()
