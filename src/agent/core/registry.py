"""Model registry — declares ALL supported models with their capabilities.

Each model entry declares what it can do. The orchestrator reads these
capabilities and adapts the tool suite accordingly.

Adding a new model = adding one entry here (and optionally a provider file).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


ProviderName = Literal[
    "anthropic", "deepseek", "openai", "gemini", "ollama", "mistral", "qwen", "groq"
]


@dataclass
class ModelInfo:
    """Declarative model capability descriptor."""

    id: str
    """Unique model identifier (e.g. 'deepseek-v4-pro')."""

    provider: ProviderName
    """Which provider serves this model."""

    label: str
    """Human-readable label for the frontend dropdown."""

    supports_function_calling: bool = True
    """Can this model call tools/functions?"""

    supports_vision: bool = False
    """Can this model accept image inputs?"""

    supports_computer_use: bool = False
    """Does this model support native computer_20250124 tool (Claude only)?"""

    supports_thinking: bool = False
    """Does this model support extended thinking/reasoning?"""

    max_context: int = 128_000
    """Maximum context window in tokens."""

    max_output: int = 8_192
    """Maximum output tokens."""

    legacy: bool = False
    """Is this model deprecated?"""

    extra: dict = field(default_factory=dict)
    """Provider-specific extra params (e.g. reasoning_effort levels)."""


# ── Master registry ───────────────────────────────────────────────────────────

MODEL_REGISTRY: dict[str, ModelInfo] = {
    # ── Anthropic ──────────────────────────────────────────────────────────────
    "claude-opus-4-5": ModelInfo(
        id="claude-opus-4-5",
        provider="anthropic",
        label="Claude Opus 4.5",
        supports_vision=True,
        supports_computer_use=True,
        supports_thinking=True,
        max_context=200_000,
        max_output=8_192,
    ),
    "claude-sonnet-4-6": ModelInfo(
        id="claude-sonnet-4-6",
        provider="anthropic",
        label="Claude Sonnet 4.6",
        supports_vision=True,
        supports_computer_use=True,
        supports_thinking=True,
        max_context=200_000,
        max_output=8_192,
    ),
    "claude-haiku-3-5": ModelInfo(
        id="claude-haiku-3-5",
        provider="anthropic",
        label="Claude Haiku 3.5",
        supports_vision=True,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=200_000,
        max_output=8_192,
    ),
    # ── DeepSeek (OpenAI-compatible) ─────────────────────────────────────────
    "deepseek-chat": ModelInfo(
        id="deepseek-chat",
        provider="deepseek",
        label="DeepSeek V3",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=64_000,
        max_output=8_192,
    ),
    "deepseek-reasoner": ModelInfo(
        id="deepseek-reasoner",
        provider="deepseek",
        label="DeepSeek R1",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=64_000,
        max_output=8_192,
    ),
    # ── OpenAI ────────────────────────────────────────────────────────────────
    "gpt-5.4": ModelInfo(
        id="gpt-5.4",
        provider="openai",
        label="GPT-5.4",
        supports_vision=True,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=128_000,
        max_output=16_384,
    ),
    "gpt-5.3-codex": ModelInfo(
        id="gpt-5.3-codex",
        provider="openai",
        label="GPT-5.3-Codex",
        supports_vision=True,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=128_000,
        max_output=16_384,
    ),
    "gpt-5.2-codex": ModelInfo(
        id="gpt-5.2-codex",
        provider="openai",
        label="GPT-5.2-Codex",
        supports_vision=True,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=128_000,
        max_output=16_384,
    ),
    "gpt-5.1": ModelInfo(
        id="gpt-5.1",
        provider="openai",
        label="GPT-5.1",
        supports_vision=True,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=128_000,
        max_output=16_384,
    ),
    "gpt-4o": ModelInfo(
        id="gpt-4o",
        provider="openai",
        label="GPT-4o",
        supports_vision=True,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=128_000,
        max_output=8_192,
    ),
    "gpt-4o-mini": ModelInfo(
        id="gpt-4o-mini",
        provider="openai",
        label="GPT-4o Mini",
        supports_vision=True,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=128_000,
        max_output=16_384,
    ),
    "o1": ModelInfo(
        id="o1",
        provider="openai",
        label="o1",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=200_000,
        max_output=100_000,
    ),
    "o3-mini": ModelInfo(
        id="o3-mini",
        provider="openai",
        label="o3-mini",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=200_000,
        max_output=100_000,
    ),
    # ── Google Gemini ─────────────────────────────────────────────────────────
    "gemini-2.5-pro": ModelInfo(
        id="gemini-2.5-pro",
        provider="gemini",
        label="Gemini 2.5 Pro",
        supports_vision=True,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=1_000_000,
        max_output=8_192,
    ),
    "gemini-2.5-flash": ModelInfo(
        id="gemini-2.5-flash",
        provider="gemini",
        label="Gemini 2.5 Flash",
        supports_vision=True,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=1_000_000,
        max_output=8_192,
    ),
    # ── Mistral ───────────────────────────────────────────────────────────────
    "mistral-large-latest": ModelInfo(
        id="mistral-large-latest",
        provider="mistral",
        label="Mistral Large",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=128_000,
        max_output=8_192,
    ),
    "mistral-medium-latest": ModelInfo(
        id="mistral-medium-latest",
        provider="mistral",
        label="Mistral Medium",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=32_000,
        max_output=8_192,
    ),
    "codestral-latest": ModelInfo(
        id="codestral-latest",
        provider="mistral",
        label="Codestral",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=256_000,
        max_output=8_192,
    ),
    # ── Qwen ──────────────────────────────────────────────────────────────────
    "qwen-max": ModelInfo(
        id="qwen-max",
        provider="qwen",
        label="Qwen Max",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=32_000,
        max_output=8_192,
    ),
    "qwen-plus": ModelInfo(
        id="qwen-plus",
        provider="qwen",
        label="Qwen Plus",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=131_072,
        max_output=8_192,
    ),
    "qwen-turbo": ModelInfo(
        id="qwen-turbo",
        provider="qwen",
        label="Qwen Turbo",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=1_000_000,
        max_output=8_192,
    ),
    "qwen3-235b-a22b-instruct-2507": ModelInfo(
        id="qwen3-235b-a22b-instruct-2507",
        provider="qwen",
        label="Qwen3 235B",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=32_000,
        max_output=8_192,
    ),
    # ── Groq ──────────────────────────────────────────────────────────────────
    "llama-3.3-70b-versatile": ModelInfo(
        id="llama-3.3-70b-versatile",
        provider="groq",
        label="Llama 3.3 70B",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=128_000,
        max_output=8_192,
    ),
    "mixtral-8x7b-32768": ModelInfo(
        id="mixtral-8x7b-32768",
        provider="groq",
        label="Mixtral 8x7B",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=32_000,
        max_output=8_192,
    ),
    # ── Ollama (local) ────────────────────────────────────────────────────────
    "ollama/llama3": ModelInfo(
        id="ollama/llama3",
        provider="ollama",
        label="Llama 3 (Ollama)",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=8_192,
        max_output=4_096,
    ),
    "ollama/mistral": ModelInfo(
        id="ollama/mistral",
        provider="ollama",
        label="Mistral 7B (Ollama)",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=8_192,
        max_output=4_096,
    ),
    "ollama/codellama": ModelInfo(
        id="ollama/codellama",
        provider="ollama",
        label="Code Llama (Ollama)",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=16_384,
        max_output=4_096,
    ),
    "ollama/deepseek-r1": ModelInfo(
        id="ollama/deepseek-r1",
        provider="ollama",
        label="DeepSeek R1 (Ollama)",
        supports_vision=False,
        supports_computer_use=False,
        supports_thinking=True,
        max_context=32_000,
        max_output=8_192,
    ),
    "ollama/qwen3-vl": ModelInfo(
        id="ollama/qwen3-vl",
        provider="ollama",
        label="Qwen3 VL (Ollama)",
        supports_vision=True,
        supports_computer_use=False,
        supports_thinking=False,
        max_context=32_000,
        max_output=8_192,
    ),
}


def get_model(model_id: str) -> ModelInfo | None:
    """Look up a model by its ID. Returns None if not found."""
    return MODEL_REGISTRY.get(model_id)


def list_models() -> list[ModelInfo]:
    """Return all registered models (non-legacy first)."""
    return sorted(
        [m for m in MODEL_REGISTRY.values() if not m.legacy],
        key=lambda m: (m.provider, m.label),
    )


def list_models_for_provider(provider: str) -> list[ModelInfo]:
    """Return all models belonging to a given provider."""
    return [m for m in list_models() if m.provider == provider]
