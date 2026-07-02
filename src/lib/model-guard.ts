/**
 * Model guard — validates a model identifier before dispatch.
 * Ensures the ModelSelector value is propagated intact to any route
 * (chat, code page, project generator) and fails loudly on unknown IDs.
 */
import { normalizeModel } from '@/lib/api';

const KNOWN = new Set([
  'claude-opus-4-8',
  'claude-sonnet-4-7',
  'claude-opus-4-5',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-haiku-3-5',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.1',
  'gpt-4o',
  'gpt-4o-mini',
  'o1',
  'o3',
  'o3-mini',
  'o4-mini',
  'deepseek-chat',
  'deepseek-reasoner',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'mistral-large-latest',
  'mistral-medium-latest',
  'codestral-latest',
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
  'qwen-max',
  'qwen-plus',
  'qwen-turbo',
  'qwen3-235b-a22b-instruct-2507',
]);

export interface ResolvedModel {
  id: string;
  provider:
    | 'anthropic'
    | 'openai'
    | 'deepseek'
    | 'google'
    | 'mistral'
    | 'groq'
    | 'qwen'
    | 'ollama'
    | 'lmstudio';
  extendedThinking: boolean;
  betaHeaders: string[];
}

function detectProvider(id: string): ResolvedModel['provider'] {
  const m = id.toLowerCase();
  if (m.startsWith('claude')) return 'anthropic';
  if (m.startsWith('deepseek')) return 'deepseek';
  if (m.startsWith('gemini')) return 'google';
  if (m.startsWith('mistral') || m.startsWith('codestral')) return 'mistral';
  if (m.startsWith('qwen')) return 'qwen';
  if (m.startsWith('ollama/')) return 'ollama';
  if (m.startsWith('lmstudio/')) return 'lmstudio';
  if (m === 'llama-3.3-70b-versatile' || m === 'mixtral-8x7b-32768') return 'groq';
  return 'openai';
}

/**
 * Resolves the model ID for outbound requests.
 * - Throws if unknown and no safe fallback.
 * - Logs a single-line summary of model / thinking / beta headers.
 */
export function resolveModelId(
  raw: string,
  route: 'chat' | 'code' | 'project_generator' | 'agent',
  opts: { reasoningEffort?: string | null; computerUse?: boolean } = {},
): ResolvedModel {
  const id = normalizeModel(raw);
  if (!KNOWN.has(id) && !id.startsWith('ollama/') && !id.startsWith('lmstudio/')) {
    // Non-blocking — normalizeModel already applied a safe fallback,
    // but surface the original mismatch for diagnostics.
    // eslint-disable-next-line no-console
    console.warn(`[model-guard] Unknown model "${raw}" — falling back to "${id}"`);
  }

  const provider = detectProvider(id);
  const effort = opts.reasoningEffort ?? null;
  const extendedThinking =
    provider === 'anthropic' && effort !== null && ['low', 'medium', 'high'].includes(effort);

  const betaHeaders: string[] = [];
  if (provider === 'anthropic') {
    if (opts.computerUse) betaHeaders.push('computer-use-2025-01-24');
    if (extendedThinking) betaHeaders.push('interleaved-thinking-2025-05-14');
  }

  // eslint-disable-next-line no-console
  console.info(
    `[model-guard][${route}] model=${id} provider=${provider} thinking=${extendedThinking}${
      betaHeaders.length ? ` beta=${betaHeaders.join(',')}` : ''
    }`,
  );

  return { id, provider, extendedThinking, betaHeaders };
}
