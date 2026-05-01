/**
 * Direct browser-to-provider chat clients.
 *
 * When the FastAPI backend is offline (online/cloud mode) we still want the
 * chat to work just like Claude.ai: the browser calls the provider's HTTP API
 * directly using the user's locally-stored API key.
 *
 * Supported providers:
 *  - Anthropic (claude-*)
 *  - OpenAI (gpt-*, o1, o3, o4)
 *  - DeepSeek (deepseek-*)
 *  - Groq (llama-*, mixtral-*)
 *  - Mistral (mistral-*, codestral-*)
 *
 * Streaming is parsed from SSE / NDJSON and forwarded to the existing
 * onToken / onDone / onError callbacks used by `chatDirect`.
 */

import type { ChatMessage } from '@/lib/api';

export type DirectProvider =
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'groq'
  | 'mistral'
  | 'unsupported';

export function detectDirectProvider(model: string): DirectProvider {
  const m = model.toLowerCase();
  if (m.startsWith('claude')) return 'anthropic';
  if (m.startsWith('deepseek')) return 'deepseek';
  if (m.startsWith('mistral') || m.startsWith('codestral')) return 'mistral';
  if (m.includes('llama') || m.includes('mixtral')) return 'groq';
  if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 'openai';
  return 'unsupported';
}

const KEY_FOR: Record<Exclude<DirectProvider, 'unsupported'>, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  groq: 'GROQ_API_KEY',
  mistral: 'MISTRAL_API_KEY',
};

export function getApiKey(provider: DirectProvider): string | null {
  if (provider === 'unsupported') return null;
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY_FOR[provider])?.trim() || null;
}

export interface DirectChatCallbacks {
  onToken: (token: string) => void;
  onThinking?: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

interface DirectChatRequest {
  messages: ChatMessage[];
  model: string;
  system: string;
  maxTokens?: number;
}

/** Strip system messages, normalize content to provider-friendly shape. */
function toOpenAIMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role === 'tool' ? 'user' : m.role, content: m.content };
      }
      // Multimodal (images): collapse to text-only for now in offline mode.
      const text = m.content.map((p) => p.text || '').join('').trim();
      return { role: m.role === 'tool' ? 'user' : m.role, content: text };
    });
}

function toAnthropicMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      }
      const blocks = m.content.map((p) => {
        if (p.type === 'image' && p.source) {
          return { type: 'image', source: p.source };
        }
        return { type: 'text', text: p.text || '' };
      });
      return { role: m.role, content: blocks };
    });
}

async function streamSSE(
  response: Response,
  parseEvent: (raw: string) => { text?: string; thinking?: string; done?: boolean } | null,
  cb: DirectChatCallbacks,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    cb.onError('No response body from provider');
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let any = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      if (raw === '[DONE]') {
        cb.onDone();
        return;
      }
      try {
        const parsed = parseEvent(raw);
        if (!parsed) continue;
        if (parsed.text) {
          any = true;
          cb.onToken(parsed.text);
        }
        if (parsed.thinking && cb.onThinking) {
          cb.onThinking(parsed.thinking);
        }
        if (parsed.done) {
          cb.onDone();
          return;
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }

  if (any) cb.onDone();
  else cb.onError('Empty response from provider');
}

async function callAnthropic(req: DirectChatRequest, key: string, cb: DirectChatCallbacks) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.maxTokens ?? 4096,
      system: req.system,
      stream: true,
      messages: toAnthropicMessages(req.messages),
    }),
  });
  if (!response.ok) {
    cb.onError(`Anthropic ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return;
  }
  await streamSSE(
    response,
    (raw) => {
      const evt = JSON.parse(raw);
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        return { text: evt.delta.text };
      }
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'thinking_delta') {
        return { thinking: evt.delta.thinking };
      }
      if (evt.type === 'message_stop') return { done: true };
      return null;
    },
    cb,
  );
}

interface OpenAILikeConfig {
  url: string;
  authHeader: 'bearer';
}

async function callOpenAILike(
  req: DirectChatRequest,
  key: string,
  cfg: OpenAILikeConfig,
  cb: DirectChatCallbacks,
) {
  const response = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: req.model,
      stream: true,
      max_tokens: req.maxTokens ?? 4096,
      messages: [
        { role: 'system', content: req.system },
        ...toOpenAIMessages(req.messages),
      ],
    }),
  });
  if (!response.ok) {
    cb.onError(`Provider ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return;
  }
  await streamSSE(
    response,
    (raw) => {
      const evt = JSON.parse(raw);
      const delta = evt.choices?.[0]?.delta;
      if (!delta) {
        if (evt.choices?.[0]?.finish_reason) return { done: true };
        return null;
      }
      if (delta.reasoning_content) return { thinking: delta.reasoning_content };
      if (delta.content) return { text: delta.content };
      return null;
    },
    cb,
  );
}

export async function chatDirectFromBrowser(
  req: DirectChatRequest,
  cb: DirectChatCallbacks,
): Promise<void> {
  const provider = detectDirectProvider(req.model);
  if (provider === 'unsupported') {
    cb.onError(
      `Model "${req.model}" is not supported in offline (cloud-only) mode. Start the local backend or pick a Claude / GPT / DeepSeek / Mistral / Groq model.`,
    );
    return;
  }
  const key = getApiKey(provider);
  if (!key) {
    cb.onError(
      `Missing ${KEY_FOR[provider]} in Settings. Add your ${provider} key, or start the local backend on port 8000.`,
    );
    return;
  }

  try {
    if (provider === 'anthropic') {
      await callAnthropic(req, key, cb);
      return;
    }
    const endpoints: Record<Exclude<DirectProvider, 'unsupported' | 'anthropic'>, string> = {
      openai: 'https://api.openai.com/v1/chat/completions',
      deepseek: 'https://api.deepseek.com/v1/chat/completions',
      groq: 'https://api.groq.com/openai/v1/chat/completions',
      mistral: 'https://api.mistral.ai/v1/chat/completions',
    };
    await callOpenAILike(req, key, { url: endpoints[provider], authHeader: 'bearer' }, cb);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cb.onError(`Direct ${provider} call failed: ${message}`);
  }
}
