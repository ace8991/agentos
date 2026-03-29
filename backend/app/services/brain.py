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


def _build_system_prompt() -> str:
    return build_agent_system_prompt(is_cloud=IS_CLOUD)


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

    model_map = {
        "claude-sonnet-4-6": "claude-sonnet-4-6",
        "claude-opus-4-5": "claude-opus-4-5",
    }
    system = _build_system_prompt()

    if model.startswith("claude"):
        client = _anthropic()
        response = client.messages.create(
            model=model_map.get(model, "claude-sonnet-4-6"),
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
    elif model.startswith("gpt"):
        from openai import OpenAI

        key = get_runtime_value("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY not set")
        client = OpenAI(api_key=key)
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{screenshot_b64}"}},
                        {"type": "text", "text": user_content},
                    ],
                },
            ],
        }
        if _uses_openai_max_completion_tokens(model):
            payload["max_completion_tokens"] = 1024
        else:
            payload["max_tokens"] = 1024
        if reasoning_effort:
            payload["reasoning_effort"] = reasoning_effort
        response = client.chat.completions.create(**payload)
        text = response.choices[0].message.content
    else:
        raise ValueError(f"Unsupported model: {model}")

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
