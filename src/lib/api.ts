import { buildChatSystemPrompt } from '@/lib/system-prompt';

const getBase = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  return `${window.location.protocol}//${window.location.hostname}:8000`;
};
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || getBase()).replace(/\/$/, '');
const BASE = API_BASE_URL;

export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string; }

const MODEL_FIX: Record<string, string> = {
  'gpt-5': 'gpt-4o', 'gpt-5.4': 'gpt-4o', 'gpt-5.1': 'gpt-4o', 'gpt5': 'gpt-4o',
  'gpt-4.5': 'gpt-4o', 'gpt-4.1': 'gpt-4o',
};
const VALID = new Set([
  'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5',
  'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo',
  'o1', 'o1-mini', 'o3', 'o3-mini', 'o4-mini',
  'deepseek-chat', 'deepseek-reasoner',
]);

export function normalizeModel(m: string): string {
  if (!m) return 'claude-sonnet-4-6';
  const l = m.toLowerCase();
  if (MODEL_FIX[l]) return MODEL_FIX[l];
  if (VALID.has(l)) return l;
  if (l.includes('gpt-4o')) return 'gpt-4o';
  if (l.includes('gpt-5') || l.includes('gpt5')) return 'gpt-4o';
  if (l.includes('gpt-4')) return 'gpt-4o';
  if (l.includes('sonnet')) return 'claude-sonnet-4-6';
  if (l.includes('opus')) return 'claude-opus-4-5';
  if (l.includes('haiku')) return 'claude-haiku-4-5';
  if (l.includes('claude')) return 'claude-sonnet-4-6';
  if (l.includes('o4')) return 'o4-mini';
  if (l.includes('o3')) return 'o3-mini';
  if (l.includes('deepseek')) return 'deepseek-chat';
  return 'claude-sonnet-4-6';
}

export async function chatDirect(
  messages: ChatMessage[], model: string, reasoningEffort: string | null,
  webResearch: boolean,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
): Promise<void> {
  const norm = normalizeModel(model);
  const userMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const mode = messages.some(m => m.role === 'system' && m.content.includes('agent'))
    ? 'agent' : 'chat';
  const system = buildChatSystemPrompt(userMsg, norm, mode, true);
  const msgs = messages.filter(m => m.role !== 'system');

  try {
    const resp = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: msgs, model: norm, stream: true,
        max_tokens: 4096, reasoning_effort: reasoningEffort ?? null,
        web_search: webResearch, system,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => `HTTP ${resp.status}`);
      try { const j = JSON.parse(body); onError(j.detail || j.error || body.slice(0, 300)); }
      catch { onError(`Backend ${resp.status}: ${body.slice(0, 300)}`); }
      return;
    }

    const reader = resp.body?.getReader();
    if (!reader) { onError('No response body'); return; }

    const dec = new TextDecoder();
    let buf = '', hasContent = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') {
          if (raw === '[DONE]') { onDone(); return; }
          continue;
        }
        try {
          const ev = JSON.parse(raw);
          if (ev.type === 'text' && ev.text) { hasContent = true; onToken(ev.text); }
          else if (ev.type === 'done') { onDone(); return; }
          else if (ev.type === 'error') { onError(ev.error || 'Streaming error'); return; }
          else if (ev.type === 'content_block_delta') {
            const t = ev.delta?.text || '';
            if (t) { hasContent = true; onToken(t); }
          }
        } catch {
          if (raw && raw !== 'null') { hasContent = true; onToken(raw); }
        }
      }
    }
    if (!hasContent) onError('No response — check API key and model selection.');
    else onDone();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('fetch') || msg.includes('connect'))
      onError('Cannot connect to backend (port 8000). Make sure it is running.');
    else if (msg.includes('abort')) onDone();
    else onError(msg);
  }
}

export interface BackendHealth {
  online: boolean; version?: string;
  system?: { anthropic_key: boolean; openai_key: boolean; desktop_commander_ready: boolean; };
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return { online: false };
    return { online: true, ...(await r.json()) };
  } catch { return { online: false }; }
}

export async function createBuilderWorkspace(prompt: string) {
  const r = await fetch(`${BASE}/workspace/builder`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }), signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(await r.text().catch(() => `HTTP ${r.status}`));
  return r.json();
}
