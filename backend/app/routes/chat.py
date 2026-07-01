"""AgentOS — Chat endpoint v4.0 — Full agentic tool-calling loop"""
from __future__ import annotations
import json, logging
from typing import AsyncIterator, Optional
import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.runtime_config import get_runtime_value, has_runtime_value
from app.services.agentic_loop import anthropic_loop, openai_loop

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Provider detection ────────────────────────────────────────────────────────

def _provider(m: str) -> str:
    m = m.lower()
    if m.startswith('claude'):                                return 'anthropic'
    if any(m.startswith(p) for p in ('gpt', 'o1', 'o3', 'o4')): return 'openai'
    if m.startswith('deepseek'):                              return 'deepseek'
    if m.startswith('gemini'):                                return 'google'
    if m.startswith('mistral') or m.startswith('codestral'): return 'mistral'
    if m in ('llama-3.3-70b-versatile', 'mixtral-8x7b-32768'): return 'groq'
    if m.startswith('qwen'):                                  return 'qwen'
    if m.startswith('ollama/'):                               return 'ollama'
    if m.startswith('lmstudio/'):                             return 'lmstudio'
    return 'anthropic'

# ── Model normalization ───────────────────────────────────────────────────────

_OPENAI_FIX: dict[str, str] = {
    'gpt-5':         'chatgpt-4o-latest',
    'gpt5':          'chatgpt-4o-latest',
    'gpt-5.4':       'chatgpt-4o-latest',
    'gpt-5.3-codex': 'gpt-4o',
    'gpt-5.2-codex': 'gpt-4o',
    'gpt-5.1':       'gpt-4o',
    'gpt-4.5':       'gpt-4o',
}

def _norm_openai(model: str) -> str:
    return _OPENAI_FIX.get(model.lower(), model)

# ── Request schema ────────────────────────────────────────────────────────────

class Msg(BaseModel):
    role: str
    content: str

class ChatReq(BaseModel):
    messages: list[Msg]
    model: str = 'claude-sonnet-4-6'
    stream: bool = True
    max_tokens: int = 4096
    system: Optional[str] = None
    reasoning_effort: Optional[str] = None
    web_search: bool = False
    temperature: Optional[float] = None

# ── SSE helpers ───────────────────────────────────────────────────────────────

def sse(d: dict) -> str:    return f"data: {json.dumps(d)}\n\n"
def sse_t(t: str) -> str:   return sse({'type': 'text', 'text': t})
def sse_done() -> str:      return sse({'type': 'done'})
def sse_err(e: str) -> str: return sse({'type': 'error', 'error': e})

# ── Anthropic ─────────────────────────────────────────────────────────────────

async def _anthropic(req: ChatReq) -> AsyncIterator[str]:
    key = (get_runtime_value('ANTHROPIC_API_KEY') or '').strip()
    if not key:
        yield sse_err('ANTHROPIC_API_KEY is not configured. Save it in Settings.')
        return
    model = req.model
    system = req.system or next((m.content for m in req.messages if m.role == 'system'), '')
    msgs = [{'role': m.role, 'content': m.content} for m in req.messages if m.role != 'system']
    if not msgs:
        yield sse_err('No messages')
        return
    payload: dict = {'model': model, 'max_tokens': req.max_tokens, 'messages': msgs, 'stream': True}
    if system:
        payload['system'] = system
    if req.reasoning_effort in ('low', 'medium', 'high'):
        budgets = {'low': 3000, 'medium': 10000, 'high': 25000}
        payload['thinking'] = {'type': 'enabled', 'budget_tokens': budgets[req.reasoning_effort]}
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            async with c.stream(
                'POST', 'https://api.anthropic.com/v1/messages',
                headers={'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
                json=payload,
            ) as r:
                if r.status_code != 200:
                    body = await r.aread()
                    try:
                        err = json.loads(body).get('error', {}).get('message', body.decode()[:200])
                        if 'credit' in err.lower():
                            yield sse_err('Anthropic credits exhausted — add credits or switch model')
                        else:
                            yield sse_err(f'Anthropic {r.status_code}: {err}')
                    except Exception:
                        yield sse_err(f'Anthropic {r.status_code}')
                    return
                async for line in r.aiter_lines():
                    if not line.startswith('data: '):
                        continue
                    raw = line[6:].strip()
                    if not raw:
                        continue
                    try:
                        ev = json.loads(raw)
                        t = ev.get('type', '')
                        if t == 'content_block_delta':
                            text = ev.get('delta', {}).get('text', '')
                            if text:
                                yield sse_t(text)
                        elif t == 'message_stop':
                            yield sse_done()
                            return
                        elif t == 'error':
                            yield sse_err(ev.get('error', {}).get('message', 'error'))
                            return
                    except Exception:
                        pass
        yield sse_done()
    except httpx.ConnectError:
        yield sse_err('Cannot connect to Anthropic API')
    except httpx.TimeoutException:
        yield sse_err('Anthropic API timeout')
    except Exception as e:
        logger.exception('Anthropic error')
        yield sse_err(str(e))

# ── Generic OpenAI-compatible (OpenAI, DeepSeek, Mistral, Groq, Qwen, Google, LMStudio) ──

def _reasoning_budget(effort: str | None) -> int:
    return {'low': 4096, 'medium': 12000, 'high': 32000}.get(effort or '', 0)

async def _openai_compat(
    req: ChatReq,
    base_url: str,
    key_name: str,
    provider_label: str,
    model_override: str | None = None,
    require_key: bool = True,
    extra_params: dict | None = None,
) -> AsyncIterator[str]:
    key = (get_runtime_value(key_name) or '').strip() if key_name else ''
    if require_key and not key:
        yield sse_err(f'{key_name} is not configured. Save it in Settings.')
        return
    model = model_override or req.model
    system = req.system or next((m.content for m in req.messages if m.role == 'system'), '')
    msgs: list[dict] = []
    if system:
        msgs.append({'role': 'system', 'content': system})
    msgs += [{'role': m.role, 'content': m.content} for m in req.messages if m.role != 'system']
    payload: dict = {'model': model, 'messages': msgs, 'stream': True, 'max_tokens': req.max_tokens}
    if req.temperature is not None:
        payload['temperature'] = req.temperature
    if extra_params:
        payload.update(extra_params)
    headers = {'Content-Type': 'application/json'}
    if key:
        headers['Authorization'] = f'Bearer {key}'
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            async with c.stream('POST', f'{base_url}/chat/completions', headers=headers, json=payload) as r:
                if r.status_code != 200:
                    body = await r.aread()
                    try:
                        err = json.loads(body).get('error', {}).get('message', body.decode()[:300])
                        yield sse_err(f'{provider_label} {r.status_code}: {err}')
                    except Exception:
                        yield sse_err(f'{provider_label} {r.status_code}')
                    return
                async for line in r.aiter_lines():
                    if not line.startswith('data: '):
                        continue
                    raw = line[6:].strip()
                    if raw == '[DONE]':
                        yield sse_done()
                        return
                    if not raw:
                        continue
                    try:
                        delta = json.loads(raw)['choices'][0].get('delta', {})
                        # Reasoning/thinking tokens (Qwen3, DeepSeek-R1)
                        thinking = delta.get('reasoning_content', '')
                        if thinking:
                            yield sse({'type': 'thinking', 'text': thinking})
                        text = delta.get('content', '')
                        if text:
                            yield sse_t(text)
                    except Exception:
                        pass
        yield sse_done()
    except httpx.ConnectError:
        yield sse_err(f'Cannot connect to {provider_label}. Check your network or API endpoint.')
    except httpx.TimeoutException:
        yield sse_err(f'{provider_label} API timeout')
    except Exception as e:
        logger.exception('%s error', provider_label)
        yield sse_err(str(e))

# ── Ollama (local — different streaming format) ───────────────────────────────

async def _ollama(req: ChatReq) -> AsyncIterator[str]:
    base = (get_runtime_value('OLLAMA_BASE_URL') or 'http://localhost:11434').rstrip('/')
    model = req.model.replace('ollama/', '', 1)
    system = req.system or next((m.content for m in req.messages if m.role == 'system'), '')
    msgs: list[dict] = []
    if system:
        msgs.append({'role': 'system', 'content': system})
    msgs += [{'role': m.role, 'content': m.content} for m in req.messages if m.role != 'system']
    payload = {'model': model, 'messages': msgs, 'stream': True}
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            async with c.stream(
                'POST', f'{base}/api/chat',
                headers={'Content-Type': 'application/json'}, json=payload,
            ) as r:
                if r.status_code != 200:
                    body = await r.aread()
                    yield sse_err(f'Ollama {r.status_code}: {body.decode()[:200]}')
                    return
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    try:
                        parsed = json.loads(line)
                        text = parsed.get('message', {}).get('content', '')
                        if text:
                            yield sse_t(text)
                        if parsed.get('done'):
                            yield sse_done()
                            return
                    except Exception:
                        pass
        yield sse_done()
    except httpx.ConnectError:
        yield sse_err('Cannot connect to Ollama — make sure Ollama is running on port 11434')
    except Exception as e:
        logger.exception('Ollama error')
        yield sse_err(str(e))

# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_messages(req: ChatReq) -> list[dict]:
    """Convert ChatReq messages to plain dicts, stripping system messages."""
    return [{"role": m.role, "content": m.content} for m in req.messages if m.role != "system"]

def _get_system(req: ChatReq) -> str:
    """Extract system prompt: prefer explicit req.system, fallback to system message."""
    if req.system:
        return req.system
    for m in req.messages:
        if m.role == "system":
            return m.content
    return ""

# ── Main route ────────────────────────────────────────────────────────────────

@router.post('/chat')
async def chat(req: ChatReq):
    p = _provider(req.model)
    msgs = _build_messages(req)
    system = _get_system(req)

    async def gen():
        # ── Anthropic — full agentic loop with native tool use ─────────────────
        if p == 'anthropic':
            async for c in anthropic_loop(
                messages=msgs,
                model=req.model,
                system=system,
                max_tokens=req.max_tokens,
                reasoning_effort=req.reasoning_effort,
            ):
                yield c

        # ── OpenAI — agentic loop with function calling ────────────────────────
        elif p == 'openai':
            oai_model = _norm_openai(req.model)
            extra: dict = {}
            if req.reasoning_effort and any(oai_model.startswith(x) for x in ('o1', 'o3', 'o4')):
                extra['reasoning_effort'] = req.reasoning_effort
            async for c in openai_loop(
                messages=msgs, model=oai_model, system=system,
                max_tokens=req.max_tokens,
                base_url='https://api.openai.com/v1',
                key_name='OPENAI_API_KEY', provider_label='OpenAI',
                extra_params=extra or None,
            ):
                yield c

        # ── DeepSeek — agentic loop ────────────────────────────────────────────
        elif p == 'deepseek':
            extra = {}
            if req.reasoning_effort and 'reasoner' in req.model:
                extra['temperature'] = 0.6
            async for c in openai_loop(
                messages=msgs, model=req.model, system=system,
                max_tokens=req.max_tokens,
                base_url='https://api.deepseek.com',
                key_name='DEEPSEEK_API_KEY', provider_label='DeepSeek',
                extra_params=extra or None,
            ):
                yield c

        # ── Google Gemini — agentic loop ───────────────────────────────────────
        elif p == 'google':
            async for c in openai_loop(
                messages=msgs, model=req.model, system=system,
                max_tokens=req.max_tokens,
                base_url='https://generativelanguage.googleapis.com/v1beta/openai',
                key_name='GOOGLE_API_KEY', provider_label='Google',
            ):
                yield c

        # ── Mistral — agentic loop ─────────────────────────────────────────────
        elif p == 'mistral':
            async for c in openai_loop(
                messages=msgs, model=req.model, system=system,
                max_tokens=req.max_tokens,
                base_url='https://api.mistral.ai/v1',
                key_name='MISTRAL_API_KEY', provider_label='Mistral',
                extra_params={'temperature': 0.7},
            ):
                yield c

        # ── Groq — agentic loop ────────────────────────────────────────────────
        elif p == 'groq':
            async for c in openai_loop(
                messages=msgs, model=req.model, system=system,
                max_tokens=req.max_tokens,
                base_url='https://api.groq.com/openai/v1',
                key_name='GROQ_API_KEY', provider_label='Groq',
                extra_params={'temperature': 0.7},
            ):
                yield c

        # ── Qwen — agentic loop with anti-repetition params ───────────────────
        elif p == 'qwen':
            qwen_extra: dict = {
                'temperature': req.temperature if req.temperature is not None else 0.7,
                'repetition_penalty': 1.05,
                'top_p': 0.9,
            }
            if req.reasoning_effort and 'qwen3' in req.model.lower():
                budget = _reasoning_budget(req.reasoning_effort)
                if budget:
                    qwen_extra['enable_thinking'] = True
                    qwen_extra['thinking_budget'] = budget
            async for c in openai_loop(
                messages=msgs, model=req.model, system=system,
                max_tokens=req.max_tokens,
                base_url='https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
                key_name='QWEN_API_KEY', provider_label='Qwen',
                extra_params=qwen_extra,
            ):
                yield c

        # ── Ollama — local, simple stream (no tool calling) ───────────────────
        elif p == 'ollama':
            async for c in _ollama(req):
                yield c

        # ── LM Studio — local OpenAI-compatible, simple stream ────────────────
        elif p == 'lmstudio':
            base = (get_runtime_value('LMSTUDIO_BASE_URL') or 'http://localhost:1234').rstrip('/')
            model = req.model.replace('lmstudio/', '', 1)
            async for c in _openai_compat(
                req, base, '', 'LM Studio',
                model_override=model, require_key=False,
            ):
                yield c

        else:
            yield sse_err(f'Unsupported provider for model: {req.model}')

    return StreamingResponse(
        gen(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )

# ── Available models endpoint ─────────────────────────────────────────────────

@router.get('/models/available')
async def models_available():
    a   = has_runtime_value('ANTHROPIC_API_KEY')
    o   = has_runtime_value('OPENAI_API_KEY')
    d   = has_runtime_value('DEEPSEEK_API_KEY')
    g   = has_runtime_value('GOOGLE_API_KEY')
    mis = has_runtime_value('MISTRAL_API_KEY')
    grq = has_runtime_value('GROQ_API_KEY')
    qw  = has_runtime_value('QWEN_API_KEY')
    mods = []
    if a:
        mods += [
            {'id': 'claude-opus-4-8',   'name': 'Claude Opus 4.8 (latest)',   'provider': 'anthropic'},
            {'id': 'claude-sonnet-4-7', 'name': 'Claude Sonnet 4.7 (latest)', 'provider': 'anthropic', 'default': True},
            {'id': 'claude-opus-4-5',   'name': 'Claude Opus 4.5',   'provider': 'anthropic'},
            {'id': 'claude-sonnet-4-6', 'name': 'Claude Sonnet 4.6', 'provider': 'anthropic'},
            {'id': 'claude-haiku-4-5',  'name': 'Claude Haiku 4.5',  'provider': 'anthropic', 'fast': True},
        ]
    if o:
        mods += [
            {'id': 'gpt-5.4',     'name': 'GPT-5.4',    'provider': 'openai'},
            {'id': 'gpt-5.1',     'name': 'GPT-5.1',    'provider': 'openai'},
            {'id': 'gpt-4o',      'name': 'GPT-4o',      'provider': 'openai'},
            {'id': 'gpt-4o-mini', 'name': 'GPT-4o Mini', 'provider': 'openai', 'fast': True},
            {'id': 'o1',          'name': 'o1',           'provider': 'openai'},
            {'id': 'o3-mini',     'name': 'o3-mini',      'provider': 'openai'},
        ]
    if d:
        mods += [
            {'id': 'deepseek-chat',     'name': 'DeepSeek V3', 'provider': 'deepseek'},
            {'id': 'deepseek-reasoner', 'name': 'DeepSeek R1', 'provider': 'deepseek'},
        ]
    if g:
        mods += [
            {'id': 'gemini-2.5-pro',   'name': 'Gemini 2.5 Pro',   'provider': 'google'},
            {'id': 'gemini-2.5-flash', 'name': 'Gemini 2.5 Flash', 'provider': 'google', 'fast': True},
        ]
    if mis:
        mods += [
            {'id': 'mistral-large-latest',  'name': 'Mistral Large',  'provider': 'mistral'},
            {'id': 'mistral-medium-latest', 'name': 'Mistral Medium', 'provider': 'mistral'},
            {'id': 'codestral-latest',      'name': 'Codestral',      'provider': 'mistral'},
        ]
    if grq:
        mods += [
            {'id': 'llama-3.3-70b-versatile', 'name': 'Llama 3.3 70B', 'provider': 'groq'},
            {'id': 'mixtral-8x7b-32768',       'name': 'Mixtral 8x7B',  'provider': 'groq'},
        ]
    if qw:
        mods += [
            {'id': 'qwen-max',                      'name': 'Qwen Max',    'provider': 'qwen'},
            {'id': 'qwen-plus',                     'name': 'Qwen Plus',   'provider': 'qwen'},
            {'id': 'qwen-turbo',                    'name': 'Qwen Turbo',  'provider': 'qwen', 'fast': True},
            {'id': 'qwen3-235b-a22b-instruct-2507', 'name': 'Qwen3 235B', 'provider': 'qwen'},
        ]
    if not mods:
        mods = [{'id': 'claude-sonnet-4-7', 'name': 'Claude Sonnet 4.7 (latest)', 'provider': 'anthropic', 'default': True}]
    return {
        'models': mods,
        'providers': {
            'anthropic': a, 'openai': o, 'deepseek': d,
            'google': g, 'mistral': mis, 'groq': grq, 'qwen': qw,
        },
    }
