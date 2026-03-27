from app.models.schemas import ModelInfo


_MODELS: list[ModelInfo] = [
    ModelInfo(id="claude-opus-4-5", name="Claude Opus 4.5", provider="anthropic", cost_per_step="server-key", vision=True),
    ModelInfo(id="claude-sonnet-4-6", name="Claude Sonnet 4.6", provider="anthropic", cost_per_step="server-key", vision=True),
    ModelInfo(id="claude-haiku-3-5", name="Claude Haiku 3.5", provider="anthropic", cost_per_step="server-key", vision=True),
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


_AGENT_MODEL_IDS = {
    "claude-opus-4-5",
    "claude-sonnet-4-6",
    "gpt-5.4",
    "gpt-5.3-codex",
    "gpt-5.2-codex",
    "gpt-5.1",
    "gpt-4o",
    "gpt-4o-mini",
}


def is_agent_model_supported(model_id: str) -> bool:
    return model_id in _AGENT_MODEL_IDS


def list_agent_models() -> list[ModelInfo]:
    return [model for model in _MODELS if model.id in _AGENT_MODEL_IDS]
