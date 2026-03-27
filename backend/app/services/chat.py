import json
import os
from collections.abc import AsyncGenerator

import httpx

from app.models.schemas import ChatMessage, ChatRequest
from app.services.model_catalog import get_model


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _provider_and_messages(req: ChatRequest) -> tuple[str | None, list[ChatMessage]]:
    model = get_model(req.model)
    messages = list(req.messages)
    if req.web_search:
        messages.insert(
            0,
            ChatMessage(
                role="system",
                content="Web search was requested. If live search context is unavailable, answer with your best knowledge and say that no live search context was injected.",
            ),
        )
    return (model.provider if model else None), messages


async def _stream_openai_compatible(
    endpoint: str,
    payload: dict,
    api_key: str | None = None,
) -> AsyncGenerator[str, None]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
            if response.status_code >= 400:
                detail = (await response.aread()).decode("utf-8", errors="ignore")[:500]
                yield _sse({"type": "error", "content": f"Provider error {response.status_code}: {detail}"})
                return

            async for line in response.aiter_lines():
                if not line:
                    continue
                raw = line[6:].strip() if line.startswith("data: ") else line.strip()
                if raw == "[DONE]":
                    break
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                token = parsed.get("choices", [{}])[0].get("delta", {}).get("content")
                if token:
                    yield _sse({"type": "token", "content": token})

    yield _sse({"type": "done", "content": ""})


async def _stream_anthropic(messages: list[ChatMessage], model: str) -> AsyncGenerator[str, None]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        yield _sse({"type": "error", "content": "ANTHROPIC_API_KEY is not configured on the backend."})
        return

    system_messages = [m.content for m in messages if m.role == "system"]
    user_messages = [{"role": m.role, "content": m.content} for m in messages if m.role != "system"]
    payload: dict[str, object] = {
        "model": model,
        "max_tokens": 4096,
        "messages": user_messages,
        "stream": True,
    }
    if system_messages:
        payload["system"] = "\n\n".join(system_messages)

    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", "https://api.anthropic.com/v1/messages", headers=headers, json=payload) as response:
            if response.status_code >= 400:
                detail = (await response.aread()).decode("utf-8", errors="ignore")[:500]
                yield _sse({"type": "error", "content": f"Anthropic error {response.status_code}: {detail}"})
                return

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if raw == "[DONE]":
                    break
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if parsed.get("type") == "content_block_delta":
                    token = parsed.get("delta", {}).get("text")
                    if token:
                        yield _sse({"type": "token", "content": token})
                elif parsed.get("type") == "message_stop":
                    break

    yield _sse({"type": "done", "content": ""})


async def _stream_google(messages: list[ChatMessage], model: str) -> AsyncGenerator[str, None]:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        yield _sse({"type": "error", "content": "GOOGLE_API_KEY is not configured on the backend."})
        return

    payload: dict[str, object] = {
        "contents": [
            {
                "role": "model" if message.role == "assistant" else "user",
                "parts": [{"text": message.content}],
            }
            for message in messages
            if message.role != "system"
        ]
    }
    system_message = next((m.content for m in messages if m.role == "system"), None)
    if system_message:
        payload["systemInstruction"] = {"parts": [{"text": system_message}]}

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", endpoint, headers={"Content-Type": "application/json"}, json=payload) as response:
            if response.status_code >= 400:
                detail = (await response.aread()).decode("utf-8", errors="ignore")[:500]
                yield _sse({"type": "error", "content": f"Google error {response.status_code}: {detail}"})
                return

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if not raw:
                    continue
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                token = parsed.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text")
                if token:
                    yield _sse({"type": "token", "content": token})

    yield _sse({"type": "done", "content": ""})


async def _stream_ollama(messages: list[ChatMessage], model: str) -> AsyncGenerator[str, None]:
    endpoint = f"{os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434').rstrip('/')}/api/chat"
    payload = {
        "model": model.replace("ollama/", "", 1),
        "messages": [{"role": message.role, "content": message.content} for message in messages],
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", endpoint, headers={"Content-Type": "application/json"}, json=payload) as response:
            if response.status_code >= 400:
                detail = (await response.aread()).decode("utf-8", errors="ignore")[:500]
                yield _sse({"type": "error", "content": f"Ollama error {response.status_code}: {detail}"})
                return

            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    parsed = json.loads(line)
                except json.JSONDecodeError:
                    continue
                token = parsed.get("message", {}).get("content")
                if token:
                    yield _sse({"type": "token", "content": token})
                if parsed.get("done"):
                    break

    yield _sse({"type": "done", "content": ""})


async def stream_chat(req: ChatRequest) -> AsyncGenerator[str, None]:
    provider, messages = _provider_and_messages(req)
    if not provider:
        yield _sse({"type": "error", "content": f"Unsupported model: {req.model}"})
        return

    payload_messages = [{"role": message.role, "content": message.content} for message in messages]
    provider_payload: dict[str, object] = {"model": req.model, "messages": payload_messages, "stream": True}
    if provider == "openai" and req.reasoning_effort:
        provider_payload["reasoning_effort"] = req.reasoning_effort

    if provider == "anthropic":
        async for event in _stream_anthropic(messages, req.model):
            yield event
        return

    if provider == "google":
        async for event in _stream_google(messages, req.model):
            yield event
        return

    if provider == "ollama":
        async for event in _stream_ollama(messages, req.model):
            yield event
        return

    if provider == "lmstudio":
        endpoint = f"{os.getenv('LMSTUDIO_BASE_URL', 'http://localhost:1234').rstrip('/')}/v1/chat/completions"
        async for event in _stream_openai_compatible(
            endpoint,
            provider_payload,
        ):
            yield event
        return

    provider_env_map = {
        "openai": ("OPENAI_API_KEY", "https://api.openai.com/v1/chat/completions"),
        "deepseek": ("DEEPSEEK_API_KEY", "https://api.deepseek.com/chat/completions"),
        "mistral": ("MISTRAL_API_KEY", "https://api.mistral.ai/v1/chat/completions"),
        "groq": ("GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions"),
    }
    env_name, endpoint = provider_env_map.get(provider, (None, None))
    if not env_name or not endpoint:
        yield _sse({"type": "error", "content": f"Unsupported provider: {provider}"})
        return

    api_key = os.getenv(env_name)
    if not api_key:
        yield _sse({"type": "error", "content": f"{env_name} is not configured on the backend."})
        return

    async for event in _stream_openai_compatible(
        endpoint,
        provider_payload,
        api_key=api_key,
    ):
        yield event
