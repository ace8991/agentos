import json, re, logging
from typing import Optional
import anthropic
from app.models.schemas import AgentAction, ActionType
from app.config import IS_LOCAL, IS_CLOUD
from app.services.runtime_config import get_runtime_value

logger = logging.getLogger(__name__)

def _build_system_prompt() -> str:
    tool_section = ""
    if IS_CLOUD:
        tool_section = """
NOTE: Running in CLOUD MODE. Desktop tools (click, type, key, computer_use) are
NOT available. Use only web and browser tools to accomplish tasks.
"""
    else:
        tool_section = """
NOTE: Running in LOCAL MODE. All tools are available including desktop control.
"""
    return """You are AgentOS — a professional AI agent with four integrated capabilities.
Choose the RIGHT tool for each step. Never repeat a failing approach.
""" + tool_section + """
╔══════════════════════════════════════════════════════════════════╗
║  TOOL 1 — PyAutoGUI  (LOCAL ONLY — desktop apps)                ║
╠══════════════════════════════════════════════════════════════════╣
  {"type":"click",  "x":123, "y":456, "reason":"..."}
  {"type":"type",   "text":"hello", "reason":"..."}
  {"type":"key",    "key":"ctrl+v", "reason":"..."}
  {"type":"scroll", "x":640, "y":400, "amount":3, "reason":"..."}
  {"type":"wait",   "amount":2, "reason":"..."}
  {"type":"shell",  "command":"open -a Safari", "reason":"..."}

╔══════════════════════════════════════════════════════════════════╗
║  TOOL 2 — Tavily  (CLOUD + LOCAL — web content)                 ║
╠══════════════════════════════════════════════════════════════════╣
  {"type":"web_search",  "query":"...", "max_results":5, "reason":"..."}
  {"type":"web_extract", "url":"https://...", "reason":"..."}
  {"type":"web_qna",     "query":"...", "reason":"..."}
  {"type":"web_crawl",   "url":"https://...", "instructions":"...", "reason":"..."}

╔══════════════════════════════════════════════════════════════════╗
║  TOOL 3 — Playwright + Brave  (CLOUD + LOCAL — browser DOM)     ║
╠══════════════════════════════════════════════════════════════════╣
  {"type":"browser_open",     "url":"https://...", "reason":"..."}
  {"type":"browser_click",    "selector":"button#id", "reason":"..."}
  {"type":"browser_type",     "selector":"input[name=x]", "text":"...", "reason":"..."}
  {"type":"browser_select",   "selector":"select#y", "value":"opt", "reason":"..."}
  {"type":"browser_scroll",   "amount":3, "reason":"..."}
  {"type":"browser_wait",     "selector":".class", "timeout":8000, "reason":"..."}
  {"type":"browser_snapshot", "reason":"..."}
  {"type":"browser_eval",     "script":"document.title", "reason":"..."}
  {"type":"browser_back",     "reason":"..."}
  {"type":"browser_close",    "reason":"..."}

╔══════════════════════════════════════════════════════════════════╗
║  TOOL 4 — Claude Computer Use  (LOCAL ONLY — complex UI)        ║
╠══════════════════════════════════════════════════════════════════╣
  {"type":"computer_use", "subtask":"click the Export button",
   "cu_max_iterations":5, "reason":"..."}
  USE WHEN: PyAutoGUI fails 2+ times, Electron apps, legacy UIs.
  NOTE: computer_use uses a dedicated desktop-control engine and can be configured separately from the main planner model.

╔══════════════════════════════════════════════════════════════════╗
║  CONTROL                                                         ║
╠══════════════════════════════════════════════════════════════════╣
  {"type":"done", "reason":"task completed — summary"}

DECISION MATRIX:
  Need info from web?          → web_search / web_qna
  Need full page content?      → web_extract
  Need to fill a web form?     → browser_open → browser_type → browser_click
  Need to use a web app/SPA?   → browser_* (Playwright)
  Need desktop app? (local)    → click/type/key (PyAutoGUI)
  UI complex/selector fails?   → computer_use (local only)

RULES:
1. After browser_open → always browser_snapshot first
2. After web_search → web_extract if you need full content
3. Consecutive failures (2+) → escalate to computer_use (local) or try different selector
4. When done → use done action with clear summary

5. If the browser already shows the relevant site, continue from that live page instead of reopening it.
6. For website tasks, prefer browser_* tools over shell or desktop tools unless the task explicitly requires a native app window.

RESPONSE FORMAT:
[Reasoning — max 4 sentences]
<action>{"type": "...", ...}</action>
"""

def _anthropic():
    k = get_runtime_value("ANTHROPIC_API_KEY")
    if not k: raise ValueError("ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=k)


def _uses_openai_max_completion_tokens(model: str) -> bool:
    return model.startswith(("gpt-5", "o1", "o3"))

def parse_action(text: str) -> Optional[AgentAction]:
    m = re.search(r"<action>(.*?)</action>", text, re.DOTALL)
    if not m: return None
    try:
        return AgentAction(**json.loads(m.group(1).strip()))
    except Exception as e:
        logger.warning(f"parse_action: {e}")
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
        f"  [{h['action_type']}] step {h['step']}: {h['action']} → {h['result']}"
        for h in recent
    ) or "  (none yet)"
    memory_text = "\n".join(f"  {k}: {v}" for k,v in memory.items()) or "  (empty)"
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
    recent_failures = sum(1 for h in recent[-3:] if h.get("result") == "failed")
    escalation = "\nNOTE: 2+ consecutive failures — consider escalating.\n" if recent_failures >= 2 else ""

    user_content = f"""TASK: {task}
MODE: {"LOCAL (all tools)" if IS_LOCAL else "CLOUD (web + browser only)"}
STEP {step} / {max_steps}

RECENT ACTIONS:
{history_text}

WORKING MEMORY:
{memory_text}
{tool_section}{browser_ready_section}{escalation}
Current screen above. What is your next action?"""

    model_map = {"claude-sonnet-4-6": "claude-sonnet-4-6", "claude-opus-4-5": "claude-opus-4-5"}
    system = _build_system_prompt()

    if model.startswith("claude"):
        client = _anthropic()
        resp = client.messages.create(
            model=model_map.get(model, "claude-sonnet-4-6"),
            max_tokens=1024, system=system,
            messages=[{"role":"user","content":[
                {"type":"image","source":{"type":"base64","media_type":"image/jpeg","data":screenshot_b64}},
                {"type":"text","text":user_content},
            ]}],
        )
        text = resp.content[0].text
    elif model.startswith("gpt"):
        from openai import OpenAI
        key = get_runtime_value("OPENAI_API_KEY")
        if not key: raise ValueError("OPENAI_API_KEY not set")
        client = OpenAI(api_key=key)
        payload = {
            "model": model,
            "messages": [
                {"role":"system","content":system},
                {"role":"user","content":[
                    {"type":"image_url","image_url":{"url":f"data:image/jpeg;base64,{screenshot_b64}"}},
                    {"type":"text","text":user_content},
                ]},
            ],
        }
        if _uses_openai_max_completion_tokens(model):
            payload["max_completion_tokens"] = 1024
        else:
            payload["max_tokens"] = 1024
        if reasoning_effort:
            payload["reasoning_effort"] = reasoning_effort
        resp = client.chat.completions.create(**payload)
        text = resp.choices[0].message.content
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
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001", max_tokens=300,
            messages=[{"role":"user","content":prompt}],
        )
        text = re.sub(r"```json|```","", resp.content[0].text).strip()
        return json.loads(text)
    except Exception as e:
        logger.warning(f"memory update: {e}")
        return existing
