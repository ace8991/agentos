"""AgentOS — Chat endpoint v2.1 — Streaming SSE"""
from __future__ import annotations
import json, logging
from typing import AsyncIterator, Optional
import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.runtime_config import get_runtime_value, has_runtime_value

logger = logging.getLogger(__name__)
router = APIRouter()

def _provider(m: str) -> str:
    m = m.lower()
    if m.startswith('claude'): return 'anthropic'
    if any(m.startswith(p) for p in ('gpt','o1','o3','o4')): return 'openai'
    if m.startswith('deepseek'): return 'deepseek'
    return 'anthropic'

def _norm(model: str) -> str:
    FIX = {'gpt-5':'gpt-4o','gpt-5.4':'gpt-4o','gpt-5.1':'gpt-4o','gpt5':'gpt-4o','gpt-4.5':'gpt-4o'}
    l = model.lower()
    if l in FIX: return FIX[l]
    VALID = {'claude-sonnet-4-6','claude-sonnet-4-5','claude-opus-4-5','claude-haiku-4-5',
             'claude-3-5-sonnet-20241022','claude-3-5-haiku-20241022',
             'gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-4','gpt-3.5-turbo',
             'o1','o1-mini','o3','o3-mini','o4-mini','deepseek-chat','deepseek-reasoner'}
    if l in VALID: return model
    if 'gpt-4o' in l: return 'gpt-4o'
    if 'gpt-5' in l or 'gpt5' in l: return 'gpt-4o'
    if 'sonnet' in l: return 'claude-sonnet-4-6'
    if 'opus' in l: return 'claude-opus-4-5'
    if 'haiku' in l: return 'claude-haiku-4-5'
    if 'claude' in l: return 'claude-sonnet-4-6'
    if 'o4' in l: return 'o4-mini'
    if 'o3' in l: return 'o3-mini'
    return 'claude-sonnet-4-6'

class Msg(BaseModel):
    role: str; content: str

class ChatReq(BaseModel):
    messages: list[Msg]
    model: str = 'claude-sonnet-4-6'
    stream: bool = True
    max_tokens: int = 4096
    system: Optional[str] = None
    reasoning_effort: Optional[str] = None
    web_search: bool = False
    temperature: Optional[float] = None

def sse(d: dict) -> str: return f"data: {json.dumps(d)}\n\n"
def sse_t(t: str) -> str: return sse({'type':'text','text':t})
def sse_done() -> str: return sse({'type':'done'})
def sse_err(e: str) -> str: return sse({'type':'error','error':e})

async def _anthropic(req: ChatReq) -> AsyncIterator[str]:
    key = (get_runtime_value('ANTHROPIC_API_KEY') or '').strip()
    if not key:
        yield sse_err('ANTHROPIC_API_KEY is not configured on the backend. Save it in Settings or .env.')
        return
    model = _norm(req.model)
    system = req.system or next((m.content for m in req.messages if m.role=='system'),'')
    msgs = [{'role':m.role,'content':m.content} for m in req.messages if m.role!='system']
    if not msgs: yield sse_err('No messages'); return
    payload = {'model':model,'max_tokens':req.max_tokens,'messages':msgs,'stream':True}
    if system: payload['system'] = system
    if req.reasoning_effort in ('low','medium','high'):
        payload['thinking'] = {'type':'enabled','budget_tokens':{'low':3000,'medium':10000,'high':25000}[req.reasoning_effort]}
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            async with c.stream('POST','https://api.anthropic.com/v1/messages',
                headers={'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},
                json=payload) as r:
                if r.status_code != 200:
                    body = await r.aread()
                    try:
                        err = json.loads(body).get('error',{}).get('message',body.decode()[:200])
                        if 'credit' in err.lower(): yield sse_err('Anthropic credits exhausted — switch to gpt-4o')
                        else: yield sse_err(f'Anthropic {r.status_code}: {err}')
                    except: yield sse_err(f'Anthropic {r.status_code}')
                    return
                async for line in r.aiter_lines():
                    if not line.startswith('data: '): continue
                    raw = line[6:].strip()
                    if not raw: continue
                    try:
                        ev = json.loads(raw)
                        t = ev.get('type','')
                        if t=='content_block_delta':
                            text = ev.get('delta',{}).get('text','')
                            if text: yield sse_t(text)
                        elif t=='message_stop': yield sse_done(); return
                        elif t=='error': yield sse_err(ev.get('error',{}).get('message','error')); return
                    except: pass
        yield sse_done()
    except httpx.ConnectError: yield sse_err('Cannot connect to Anthropic API')
    except httpx.TimeoutException: yield sse_err('Anthropic API timeout')
    except Exception as e: logger.exception('Anthropic error'); yield sse_err(str(e))

async def _openai(req: ChatReq, base='https://api.openai.com/v1') -> AsyncIterator[str]:
    ds = 'deepseek' in base
    env_name = 'DEEPSEEK_API_KEY' if ds else 'OPENAI_API_KEY'
    key = (get_runtime_value(env_name) or '').strip()
    if not key:
        yield sse_err(f'{env_name} is not configured on the backend. Save it in Settings or .env.')
        return
    model = _norm(req.model)
    system = req.system or next((m.content for m in req.messages if m.role=='system'),'')
    msgs = []
    if system: msgs.append({'role':'system','content':system})
    msgs += [{'role':m.role,'content':m.content} for m in req.messages if m.role!='system']
    payload = {'model':model,'messages':msgs,'stream':True,'max_tokens':req.max_tokens}
    if req.temperature is not None: payload['temperature'] = req.temperature
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            async with c.stream('POST',f'{base}/chat/completions',
                headers={'Authorization':f'Bearer {key}','Content-Type':'application/json'},
                json=payload) as r:
                if r.status_code != 200:
                    body = await r.aread()
                    try:
                        err = json.loads(body).get('error',{}).get('message',body.decode()[:200])
                        if 'quota' in err.lower(): yield sse_err('OpenAI quota exceeded')
                        else: yield sse_err(f'OpenAI {r.status_code}: {err}')
                    except: yield sse_err(f'OpenAI {r.status_code}')
                    return
                async for line in r.aiter_lines():
                    if not line.startswith('data: '): continue
                    raw = line[6:].strip()
                    if raw=='[DONE]': yield sse_done(); return
                    try:
                        text = json.loads(raw)['choices'][0].get('delta',{}).get('content','')
                        if text: yield sse_t(text)
                    except: pass
        yield sse_done()
    except httpx.ConnectError: yield sse_err(f"Cannot connect to {'DeepSeek' if ds else 'OpenAI'}")
    except Exception as e: logger.exception('OpenAI error'); yield sse_err(str(e))

@router.post('/chat')
async def chat(req: ChatReq):
    p = _provider(req.model)
    async def gen():
        if p=='anthropic':
            async for c in _anthropic(req): yield c
        elif p=='deepseek':
            async for c in _openai(req,'https://api.deepseek.com'): yield c
        else:
            async for c in _openai(req): yield c
    return StreamingResponse(gen(), media_type='text/event-stream',
        headers={'Cache-Control':'no-cache','X-Accel-Buffering':'no'})

@router.get('/models/available')
async def models():
    a = has_runtime_value('ANTHROPIC_API_KEY')
    o = has_runtime_value('OPENAI_API_KEY')
    d = has_runtime_value('DEEPSEEK_API_KEY')
    mods = []
    if a: mods += [
        {'id':'claude-sonnet-4-6','name':'Claude Sonnet 4.6','provider':'anthropic','default':True},
        {'id':'claude-opus-4-5','name':'Claude Opus 4.5','provider':'anthropic'},
        {'id':'claude-haiku-4-5','name':'Claude Haiku 4.5','provider':'anthropic','fast':True},
    ]
    if o: mods += [
        {'id':'gpt-4o','name':'GPT-4o','provider':'openai'},
        {'id':'gpt-4o-mini','name':'GPT-4o Mini','provider':'openai','fast':True},
        {'id':'o4-mini','name':'o4-mini','provider':'openai'},
    ]
    if d: mods += [
        {'id':'deepseek-chat','name':'DeepSeek Chat','provider':'deepseek'},
        {'id':'deepseek-reasoner','name':'DeepSeek R1','provider':'deepseek'},
    ]
    if not mods: mods = [{'id':'claude-sonnet-4-6','name':'Claude Sonnet 4.6','provider':'anthropic','default':True}]
    return {'models':mods,'providers':{'anthropic':a,'openai':o,'deepseek':d}}
