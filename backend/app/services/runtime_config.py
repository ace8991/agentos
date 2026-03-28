import os

ALLOWED_RUNTIME_KEYS = {
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY",
    "GOOGLE_API_KEY",
    "MISTRAL_API_KEY",
    "GROQ_API_KEY",
    "TAVILY_API_KEY",
    "BRAVE_API_KEY",
    "COMPUTER_USE_PROVIDER",
    "COMPUTER_USE_MODEL",
    "OLLAMA_BASE_URL",
    "LMSTUDIO_BASE_URL",
    "PLAYWRIGHT_HEADFUL",
}

_runtime_overrides: dict[str, str] = {}


def set_runtime_config(values: dict[str, str]) -> dict[str, bool]:
    applied: dict[str, bool] = {}

    for key, value in values.items():
        if key not in ALLOWED_RUNTIME_KEYS:
            continue

        cleaned = value.strip()
        if cleaned:
            _runtime_overrides[key] = cleaned
            applied[key] = True
        else:
            _runtime_overrides.pop(key, None)
            applied[key] = False

    return applied


def get_runtime_value(key: str, default: str | None = None) -> str | None:
    if key in _runtime_overrides:
        return _runtime_overrides[key]
    return os.getenv(key, default)


def has_runtime_value(key: str) -> bool:
    value = get_runtime_value(key)
    return bool(value and value.strip())
