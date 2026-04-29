import json
import logging
import re
from typing import Optional

import anthropic

from app.config import IS_CLOUD, IS_LOCAL
from app.models.schemas import ActionType, AgentAction
from app.services import browser as browser_svc
from app.services.prompting import build_agent_system_prompt
from app.services.runtime_config import get_runtime_value

logger = logging.getLogger(__name__)


def _build_system_prompt(task: str) -> str:
    return build_agent_system_prompt(is_cloud=IS_CLOUD, task=task)


def _anthropic():
    key = get_runtime_value("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError("ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=key)


def _uses_openai_max_completion_tokens(model: str) -> bool:
    return model.startswith(("gpt-5", "o1", "o3"))


def _is_browser_first_task(task: str, memory: dict, last_tool_result: Optional[dict]) -> bool:
    task_text = browser_svc.extract_primary_task(task).lower()
    if memory.get("task_surface") == "browser":
        return True
    if last_tool_result and (last_tool_result.get("bootstrap_source") or last_tool_result.get("url")):
        return True
    return any(
        keyword in task_text
        for keyword in (
            "amazon",
            "amazone",
            "site",
            "website",
            "browser",
            "web",
            "navigate",
            "ouvrir",
            "ouvre",
            "open",
            "search",
            "recherche",
            "commande",
            "order",
        )
    )


def parse_action(text: str) -> Optional[AgentAction]:
    match = re.search(r"<action>(.*?)</action>", text, re.DOTALL)
    if not match:
        return None
    try:
        return AgentAction(**json.loads(match.group(1).strip()))
    except Exception as exc:
        logger.warning("parse_action: %s", exc)
        return None


def think_and_act(
    task: str,
    screenshot_b64: str,
    step: int,
    max_steps: int,
    history: list[dict],
    memory: dict,
    model: str = "claude-sonnet-4-6",
    last_tool_result: Optional[dict] = None,
    reasoning_effort: Optional[str] = None,
) -> tuple[str, Optional[AgentAction]]:
    recent = history[-4:]
    history_text = "\n".join(
        f"  [{item['action_type']}] step {item['step']}: {item['action']} -> {item['result']}"
        for item in recent
    ) or "  (none yet)"
    memory_text = "\n".join(f"  {key}: {value}" for key, value in memory.items()) or "  (empty)"
    tool_section = ""
    if last_tool_result:
        tool_section = f"\nLAST TOOL RESULT:\n{json.dumps(last_tool_result, indent=2)[:2500]}\n"

    browser_ready_section = ""
    if last_tool_result and last_tool_result.get("bootstrap_source"):
        browser_ready_section = (
            "\nBROWSER WORKSPACE READY:\n"
            f"  Current URL: {last_tool_result.get('url', '(unknown)')}\n"
            "  Continue from this live browser state instead of reopening the same site.\n"
        )

    browser_first_section = (
        "\nBROWSER-FIRST TASK:\n"
        "  Keep the entire workflow inside browser_* tools and the in-app live browser workspace.\n"
        "  Do NOT use computer_use, shell, or desktop click/type actions unless the user explicitly asks to control a native app window.\n"
    ) if _is_browser_first_task(task, memory, last_tool_result) else ""

    recent_failures = sum(1 for item in recent[-3:] if item.get("result") == "failed")
    escalation = (
        "\nNOTE: 2+ consecutive failures -> change browser_* strategy, refresh the live browser snapshot, or choose a safer selector. "
        "Do not escalate browser-first tasks to computer_use.\n"
        if recent_failures >= 2
        else ""
    )

    user_content = f"""TASK: {task}
MODE: {"LOCAL (all tools)" if IS_LOCAL else "CLOUD (web + browser only)"}
STEP {step} / {max_steps}

RECENT ACTIONS:
{history_text}

WORKING MEMORY:
{memory_text}
{tool_section}{browser_ready_section}{browser_first_section}{escalation}
Current screen above. What is your next action?"""

    system = _build_system_prompt(task)

    # ── Resolve model capabilities from the unified registry ──────────────
    from src.agent.core.registry import get_model as registry_get_model
    model_info = registry_get_model(model)
    supports_vision = bool(model_info and model_info.supports_vision)

    # ── Claude (native Anthropic SDK) ────────────────────────────────────
    if model.startswith("claude"):
        client = _anthropic()
        response = client.messages.create(
            model=model,
            max_tokens=1024,
            system=system,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": screenshot_b64,
                            },
                        },
                        {"type": "text", "text": user_content},
                    ],
                }
            ],
        )
        text = response.content[0].text

    # ── OpenAI-compatible providers (GPT, DeepSeek, Mistral, Groq, Qwen, Ollama, Gemini) ──
    else:
        # Resolve API configuration from the registry/provider
        provider_configs = {
            "openai":      ("OPENAI_API_KEY", "https://api.openai.com/v1/chat/completions"),
            "deepseek":    ("DEEPSEEK_API_KEY", "https://api.deepseek.com/chat/completions"),
            "mistral":     ("MISTRAL_API_KEY", "https://api.mistral.ai/v1/chat/completions"),
            "groq":        ("GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions"),
            "qwen":        ("QWEN_API_KEY", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"),
            "google":      ("GOOGLE_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"),
        }

        # Determine provider from model_info or model prefix
        provider = model_info.provider if model_info else None
        if not provider:
            if model.startswith("ollama/"):
                provider = "ollama"
            else:
                raise ValueError(f"Unsupported model (not in registry): {model}")

        if provider == "ollama":
            # Ollama uses local endpoint, no API key
            ollama_base = get_runtime_value("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
            endpoint = f"{ollama_base}/v1/chat/completions"
            api_key = None
            oauth_token = None
        else:
            config = provider_configs.get(provider)
            if not config:
                raise ValueError(f"Unsupported provider '{provider}' for model '{model}'")
            env_name, endpoint = config
            api_key = get_runtime_value(env_name)
            if not api_key:
                raise ValueError(f"{env_name} is not configured on the backend. Set it in Settings or .env.")

        # Build messages — with image ONLY if model supports vision
        messages = [{"role": "system", "content": system}]
        user_parts = []
        if supports_vision and screenshot_b64:
            user_parts.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{screenshot_b64}"},
            })
        user_parts.append({"type": "text", "text": user_content})

        if supports_vision:
            messages.append({"role": "user", "content": user_parts})
        else:
            messages.append({"role": "user", "content": user_content})

        payload: dict = {
            "model": model,
            "messages": messages,
            "max_tokens": 1024,
            "stream": False,
        }
        if reasoning_effort and provider == "openai":
            payload["reasoning_effort"] = reasoning_effort

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        import httpx
        response = httpx.post(endpoint, headers=headers, json=payload, timeout=60.0)
        if response.status_code >= 400:
            detail = response.text[:500]
            raise ValueError(f"Provider error {response.status_code} for '{model}': {detail}")

        result = response.json()
        choice = result.get("choices", [{}])[0]
        text = (choice.get("message") or {}).get("content") or ""
        if not text:
            raise ValueError(f"Empty response from provider for '{model}'")

    reasoning = re.sub(r"<action>.*?</action>", "", text, flags=re.DOTALL).strip()
    return reasoning, parse_action(text)


def extract_memory_updates(reasoning: str, tool_result: Optional[dict], existing: dict) -> dict:
    try:
        client = _anthropic()
        extra = f"\nTool result: {json.dumps(tool_result)[:600]}" if tool_result else ""
        prompt = f"""Extract up to 6 key-value facts worth remembering. Merge with existing. Return ONLY JSON.

Existing: {json.dumps(existing)}
Reasoning: {reasoning}{extra}"""
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        text = re.sub(r"```json|```", "", response.content[0].text).strip()
        return json.loads(text)
    except Exception as exc:
        logger.warning("memory update: %s", exc)
        return existing
