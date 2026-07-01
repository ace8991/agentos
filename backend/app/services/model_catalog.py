"""
Model catalog — now delegates to the unified model registry in src/agent/core/registry.py.

This file maintains backward compatibility while using the new Multi-LLM registry.
The old hardcoded _AGENT_MODEL_IDS set is replaced by the dynamic MODEL_REGISTRY.
"""

from __future__ import annotations

from app.models.schemas import ModelInfo
from src.agent.core.registry import MODEL_REGISTRY, get_model as registry_get_model, list_models_for_ui as registry_list_models

# ── Legacy model list (kept for backward compatibility) ───────────────────────

_MODELS: list[ModelInfo] = [
    ModelInfo(id="claude-opus-4-8", name="Claude Opus 4.8 (latest)", provider="anthropic", cost_per_step="server-key", vision=True),
    ModelInfo(id="claude-sonnet-4-7", name="Claude Sonnet 4.7 (latest)", provider="anthropic", cost_per_step="server-key", vision=True),
    ModelInfo(id="claude-opus-4-5", name="Claude Opus 4.5", provider="anthropic", cost_per_step="server-key", vision=True),
    ModelInfo(id="claude-sonnet-4-6", name="Claude Sonnet 4.6", provider="anthropic", cost_per_step="server-key", vision=True),
    ModelInfo(id="claude-haiku-4-5", name="Claude Haiku 4.5", provider="anthropic", cost_per_step="server-key", vision=True),
    ModelInfo(id="gpt-5.4", name="GPT-5.4", provider="openai", cost_per_step="server-key", vision=True),
    ModelInfo(id="gpt-5.3-codex", name="GPT-5.3-Codex", provider="openai", cost_per_step="server-key", vision=True),
    ModelInfo(id="gpt-5.2-codex", name="GPT-5.2-Codex", provider="openai", cost_per_step="server-key", vision=True),
    ModelInfo(id="gpt-5.1", name="GPT-5.1", provider="openai", cost_per_step="server-key", vision=True),
    ModelInfo(id="gpt-4o", name="GPT-4o", provider="openai", cost_per_step="server-key", vision=True),
    ModelInfo(id="gpt-4o-mini", name="GPT-4o Mini", provider="openai", cost_per_step="server-key", vision=True),
    ModelInfo(id="o1", name="o1", provider="openai", cost_per_step="server-key", vision=False),
    ModelInfo(id="o3-mini", name="o3-mini", provider="openai", cost_per_step="server-key", vision=False),
    ModelInfo(id="deepseek-chat", name="DeepSeek V3", provider="deepseek", cost_per_step="server-key", vision=False),
    ModelInfo(id="deepseek-reasoner", name="DeepSeek R1", provider="deepseek", cost_per_step="server-key", vision=False),
    ModelInfo(id="qwen-max", name="Qwen Max", provider="qwen", cost_per_step="server-key", vision=False),
    ModelInfo(id="qwen-plus", name="Qwen Plus", provider="qwen", cost_per_step="server-key", vision=False),
    ModelInfo(id="qwen-turbo", name="Qwen Turbo", provider="qwen", cost_per_step="server-key", vision=False),
    ModelInfo(id="qwen3-235b-a22b-instruct-2507", name="Qwen3 235B", provider="qwen", cost_per_step="server-key", vision=False),
    ModelInfo(id="gemini-2.5-pro", name="Gemini 2.5 Pro", provider="google", cost_per_step="server-key", vision=True),
    ModelInfo(id="gemini-2.5-flash", name="Gemini 2.5 Flash", provider="google", cost_per_step="server-key", vision=True),
    ModelInfo(id="mistral-large-latest", name="Mistral Large", provider="mistral", cost_per_step="server-key", vision=False),
    ModelInfo(id="mistral-medium-latest", name="Mistral Medium", provider="mistral", cost_per_step="server-key", vision=False),
    ModelInfo(id="codestral-latest", name="Codestral", provider="mistral", cost_per_step="server-key", vision=False),
    ModelInfo(id="llama-3.3-70b-versatile", name="Llama 3.3 70B", provider="groq", cost_per_step="server-key", vision=False),
    ModelInfo(id="mixtral-8x7b-32768", name="Mixtral 8x7B", provider="groq", cost_per_step="server-key", vision=False),
    ModelInfo(id="ollama/llama3", name="Llama 3", provider="ollama", cost_per_step="local", vision=False),
    ModelInfo(id="ollama/mistral", name="Mistral 7B", provider="ollama", cost_per_step="local", vision=False),
    ModelInfo(id="ollama/codellama", name="Code Llama", provider="ollama", cost_per_step="local", vision=False),
    ModelInfo(id="ollama/deepseek-r1", name="DeepSeek R1", provider="ollama", cost_per_step="local", vision=False),
    ModelInfo(id="lmstudio/local-model", name="Local Model", provider="lmstudio", cost_per_step="local", vision=False),
]


def list_models() -> list[ModelInfo]:
    return _MODELS


def get_model(model_id: str) -> ModelInfo | None:
    return next((model for model in _MODELS if model.id == model_id), None)


# ── Agent model support — now using the new dynamic registry ──────────────────

def is_agent_model_supported(model_id: str) -> bool:
    """Check if a model is supported by the agent mode.

    Uses the new dynamic MODEL_REGISTRY from src/agent/core/registry.py.
    This means any model in the registry is automatically supported — no more
    hardcoded list! Adding a new model = adding one entry in the registry.
    """
    return registry_get_model(model_id) is not None


def list_agent_models() -> list[ModelInfo]:
    """List all models supported by the agent mode.

    Now returns ALL models from the registry (filtered by those in _MODELS
    for backward compatibility, plus any new models from the registry).
    """
    registry_models = registry_list_models()
    registry_ids = {m.id for m in registry_models}

    # Return all legacy models that are also in the registry
    legacy_supported = [m for m in _MODELS if m.id in registry_ids]

    # Also include new registry models not in legacy list
    legacy_ids = {m.id for m in _MODELS}
    new_models = [
        ModelInfo(
            id=m.id,
            name=m.label,
            provider=m.provider,
            cost_per_step="server-key" if m.provider != "ollama" else "local",
            vision=m.supports_vision,
        )
        for m in registry_models
        if m.id not in legacy_ids
    ]

    return legacy_supported + sorted(new_models, key=lambda x: x.name)
