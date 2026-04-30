"""
Model registry — single source of truth for which models AgentOS Pro supports.

Each ModelInfo declares the model's capabilities so the orchestrator can adapt:
- supports_computer_use → use Anthropic's native pixel-precise computer tool
- supports_function_calling → required (we won't support models without it)
- supports_vision → can we send screenshots to it?

To add a new model: add an entry below. That's it. No other code changes needed.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelInfo:
    id: str                              # API model id
    provider: str                        # Provider key (anthropic, deepseek, openai...)
    label: str                           # Human-readable label for UI
    supports_function_calling: bool = True
    supports_vision: bool = False
    supports_computer_use: bool = False  # Native pixel-precise computer use
    supports_thinking: bool = False      # Reasoning/thinking mode
    max_context: int = 128_000
    default_max_tokens: int = 4096


# ─────────────────────────────────────────────────────────────────
# REGISTRY — add new models here
# ─────────────────────────────────────────────────────────────────
MODEL_REGISTRY: dict[str, ModelInfo] = {
    # Anthropic — native computer use
    "claude-opus-4-7": ModelInfo(
        id="claude-opus-4-7",
        provider="anthropic",
        label="Claude Opus 4.7",
        supports_vision=True,
        supports_computer_use=True,
        supports_thinking=True,
        max_context=200_000,
    ),
    "claude-opus-4-6": ModelInfo(
        id="claude-opus-4-6",
        provider="anthropic",
        label="Claude Opus 4.6",
        supports_vision=True,
        supports_computer_use=True,
        max_context=200_000,
    ),
    "claude-sonnet-4-6": ModelInfo(
        id="claude-sonnet-4-6",
        provider="anthropic",
        label="Claude Sonnet 4.6",
        supports_vision=True,
        supports_computer_use=True,
        max_context=200_000,
    ),
    "claude-haiku-4-5": ModelInfo(
        id="claude-haiku-4-5-20251001",
        provider="anthropic",
        label="Claude Haiku 4.5",
        supports_vision=True,
        supports_computer_use=True,
        max_context=200_000,
    ),

    # DeepSeek — function calling + vision, no native computer use
    "deepseek-v4-pro": ModelInfo(
        id="deepseek-v4-pro",
        provider="deepseek",
        label="DeepSeek V4 Pro",
        supports_vision=True,
        supports_thinking=True,
        max_context=1_000_000,
    ),
    "deepseek-v4-flash": ModelInfo(
        id="deepseek-v4-flash",
        provider="deepseek",
        label="DeepSeek V4 Flash",
        supports_vision=True,
        max_context=128_000,
    ),

    # OpenAI
    "gpt-5": ModelInfo(
        id="gpt-5",
        provider="openai",
        label="GPT-5",
        supports_vision=True,
        supports_thinking=True,
        max_context=400_000,
    ),
    "gpt-4o": ModelInfo(
        id="gpt-4o",
        provider="openai",
        label="GPT-4o",
        supports_vision=True,
        max_context=128_000,
    ),

    # Gemini
    "gemini-2.5-pro": ModelInfo(
        id="gemini-2.5-pro",
        provider="gemini",
        label="Gemini 2.5 Pro",
        supports_vision=True,
        max_context=1_000_000,
    ),

    # Local / Ollama — example entries
    "ollama/qwen3-vl": ModelInfo(
        id="qwen3-vl:latest",
        provider="ollama",
        label="Qwen3 VL (local)",
        supports_vision=True,
        max_context=128_000,
    ),
    "ollama/llama3.3": ModelInfo(
        id="llama3.3:latest",
        provider="ollama",
        label="Llama 3.3 (local)",
        supports_vision=False,   # Text only — agent will work but no screenshots
        max_context=128_000,
    ),
}


def get_model(model_id: str) -> ModelInfo:
    """Get model info or raise ValueError with helpful message."""
    if model_id not in MODEL_REGISTRY:
        available = ", ".join(MODEL_REGISTRY.keys())
        raise ValueError(
            f"Unknown model '{model_id}'. Available: {available}"
        )
    return MODEL_REGISTRY[model_id]


def list_models_for_ui() -> list[dict]:
    """Return models in a format ready for the frontend dropdown."""
    return [
        {
            "id": key,
            "provider": info.provider,
            "label": info.label,
            "computer_use": info.supports_computer_use,
            "vision": info.supports_vision,
            "thinking": info.supports_thinking,
            "max_context": info.max_context,
        }
        for key, info in MODEL_REGISTRY.items()
    ]
