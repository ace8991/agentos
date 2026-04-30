"""
Smoke tests for the multi-provider agent system.

Run with:
    pytest tests/test_providers.py -v

These tests verify the architecture WITHOUT making real API calls.
Add real-call integration tests in a separate file marked @pytest.mark.live.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agent.core.registry import (
    MODEL_REGISTRY,
    get_model,
    list_models_for_ui,
)
from src.agent.core.types import (
    AgentResponse,
    Message,
    Role,
    ToolCall,
    ToolSchema,
)
from src.agent.providers.factory import make_provider


# ─────────────────────────────────────────────────────────────────
# Registry
# ─────────────────────────────────────────────────────────────────

def test_registry_contains_expected_models():
    """All key providers must be representable in the registry."""
    providers_present = {info.provider for info in MODEL_REGISTRY.values()}
    assert {"anthropic", "deepseek", "openai", "gemini", "ollama"} <= providers_present


def test_get_model_unknown_raises_with_helpful_message():
    with pytest.raises(ValueError, match="Available"):
        get_model("does-not-exist")


def test_list_models_for_ui_has_required_fields():
    models = list_models_for_ui()
    assert len(models) > 0
    for m in models:
        assert {"id", "provider", "label", "computer_use", "vision"} <= m.keys()


def test_only_anthropic_models_have_computer_use():
    """Computer use is currently Anthropic-only — registry must reflect that."""
    for info in MODEL_REGISTRY.values():
        if info.supports_computer_use:
            assert info.provider == "anthropic", (
                f"{info.id} marked supports_computer_use=True but provider={info.provider}"
            )


# ─────────────────────────────────────────────────────────────────
# Factory
# ─────────────────────────────────────────────────────────────────

def test_factory_creates_correct_provider_class(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    from src.agent.providers import (
        AnthropicProvider,
        DeepSeekProvider,
        OpenAIProvider,
        GeminiProvider,
        OllamaProvider,
    )

    assert isinstance(make_provider(get_model("claude-opus-4-7")), AnthropicProvider)
    assert isinstance(make_provider(get_model("deepseek-v4-pro")), DeepSeekProvider)
    assert isinstance(make_provider(get_model("gpt-5")), OpenAIProvider)
    assert isinstance(make_provider(get_model("gemini-2.5-pro")), GeminiProvider)
    assert isinstance(make_provider(get_model("ollama/qwen3-vl")), OllamaProvider)


# ─────────────────────────────────────────────────────────────────
# Tool schema translation
# ─────────────────────────────────────────────────────────────────

def test_anthropic_translates_computer_tool_natively(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    from src.agent.providers.anthropic_provider import AnthropicProvider

    p = AnthropicProvider("claude-opus-4-7")
    schemas = [
        ToolSchema(name="computer", description="x", parameters={}),
        ToolSchema(name="file_create", description="x", parameters={"type": "object"}),
    ]
    translated = p._translate_tools(schemas)

    # The computer tool must use the native typed format
    computer_tool = next(t for t in translated if t.get("name") == "computer")
    assert computer_tool["type"] == "computer_20251124"
    assert "display_width_px" in computer_tool

    # Other tools use standard input_schema
    file_tool = next(t for t in translated if t.get("name") == "file_create")
    assert "input_schema" in file_tool


def test_deepseek_skips_computer_tool(monkeypatch):
    """DeepSeek can't use the native computer tool — it must be filtered out."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    from src.agent.providers.deepseek_provider import DeepSeekProvider

    p = DeepSeekProvider("deepseek-v4-pro")
    schemas = [
        ToolSchema(name="computer", description="x", parameters={}),
        ToolSchema(name="click_element", description="x", parameters={"type": "object"}),
    ]
    translated = p._translate_tools(schemas)
    names = [t["function"]["name"] for t in translated]
    assert "computer" not in names
    assert "click_element" in names


# ─────────────────────────────────────────────────────────────────
# Tool registry
# ─────────────────────────────────────────────────────────────────

def test_tool_registry_separates_semantic_and_computer_use():
    from src.agent.tools.base import build_default_registry

    reg = build_default_registry()
    semantic = {t.name for t in reg.all() if t.is_semantic}
    computer = {t.name for t in reg.all() if t.is_computer_use_native}

    # Semantic toolkit must include the UI tree tools
    assert {"read_ui_tree", "click_element", "type_in_field"} <= semantic
    # Computer use native must include only the dispatcher
    assert "computer" in computer


# ─────────────────────────────────────────────────────────────────
# Critical: the "model not supported" error must be GONE
# ─────────────────────────────────────────────────────────────────

def test_no_model_is_rejected_by_design():
    """
    The CRITICAL test. Every model in the registry must produce a working
    provider + orchestrator combo without raising 'model not supported'.
    """
    from src.agent.core.orchestrator import AgentOrchestrator
    from src.agent.tools.base import build_default_registry

    tools = build_default_registry()
    for model_id, info in MODEL_REGISTRY.items():
        # We don't actually call the API — just verify the wiring
        with patch.dict("os.environ", {
            "ANTHROPIC_API_KEY": "x",
            "DEEPSEEK_API_KEY": "x",
            "OPENAI_API_KEY": "x",
            "GEMINI_API_KEY": "x",
        }):
            provider = make_provider(info)
            orch = AgentOrchestrator(
                provider=provider,
                model=info,
                tools=tools,
                system_prompt="test",
                max_iterations=1,
            )
            # The orchestrator must build tool schemas appropriate for the model
            schemas = orch._build_tool_schemas()
            assert len(schemas) > 0, f"No tools available for {model_id}"
