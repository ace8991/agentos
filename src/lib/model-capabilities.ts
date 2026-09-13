/**
 * Unified model capability map.
 *
 * Single source of truth on the frontend for what each model can do
 * (vision, reasoning, native computer use, tool calling, context size) and
 * how the user-facing "thinking level" maps to each provider's own field.
 */
import type { ReasoningEffort } from '@/components/ModelSelector';

export type ThinkingLevel = 'off' | 'fast' | 'balanced' | 'deep';

export interface ModelCapabilities {
  vision: boolean;
  thinking: boolean;
  computerUse: boolean;
  tools: boolean;
  /** Context window in tokens. */
  context: number;
}

const DEFAULTS: ModelCapabilities = {
  vision: false,
  thinking: false,
  computerUse: false,
  tools: true,
  context: 128_000,
};

const CAPABILITIES: Record<string, Partial<ModelCapabilities>> = {
  // ── Anthropic ────────────────────────────────────────────────────────────
  'claude-opus-4-8': { vision: true, thinking: true, computerUse: true, context: 500_000 },
  'claude-sonnet-4-7': { vision: true, thinking: true, computerUse: true, context: 500_000 },
  'claude-opus-4-5': { vision: true, thinking: true, computerUse: true, context: 200_000 },
  'claude-sonnet-4-6': { vision: true, thinking: true, computerUse: true, context: 200_000 },
  'claude-haiku-4-5': { vision: true, computerUse: true, context: 200_000 },

  // ── OpenAI ───────────────────────────────────────────────────────────────
  'gpt-5.4': { vision: true, thinking: true, context: 400_000 },
  'gpt-5.3-codex': { vision: true, thinking: true, context: 400_000 },
  'gpt-5.2-codex': { vision: true, thinking: true, context: 400_000 },
  'gpt-5.1': { vision: true, thinking: true, context: 400_000 },
  'gpt-4o': { vision: true, context: 128_000 },
  'gpt-4o-mini': { vision: true, context: 128_000 },
  o1: { thinking: true, context: 200_000 },
  'o3-mini': { thinking: true, context: 200_000 },

  // ── DeepSeek ─────────────────────────────────────────────────────────────
  'deepseek-chat': { context: 128_000 },
  'deepseek-reasoner': { thinking: true, context: 128_000 },

  // ── Google ───────────────────────────────────────────────────────────────
  'gemini-2.5-pro': { vision: true, thinking: true, context: 1_000_000 },
  'gemini-2.5-flash': { vision: true, context: 1_000_000 },

  // ── Mistral / Groq / Qwen ────────────────────────────────────────────────
  'mistral-large-latest': { context: 128_000 },
  'mistral-medium-latest': { context: 128_000 },
  'codestral-latest': { context: 256_000 },
  'llama-3.3-70b-versatile': { context: 128_000 },
  'mixtral-8x7b-32768': { context: 32_768 },
  'qwen-max': { context: 131_000 },
  'qwen-plus': { context: 131_000 },
  'qwen-turbo': { context: 1_000_000 },
  'qwen3-235b-a22b-instruct-2507': { thinking: true, context: 262_000 },
};

export function getModelCapabilities(modelId: string): ModelCapabilities {
  if (modelId.startsWith('ollama/') || modelId.startsWith('lmstudio/') || modelId.startsWith('webllm/')) {
    return { ...DEFAULTS, tools: false };
  }
  return { ...DEFAULTS, ...(CAPABILITIES[modelId] ?? {}) };
}

/** Short badges shown next to a model in pickers. */
export function getCapabilityBadges(modelId: string): string[] {
  const caps = getModelCapabilities(modelId);
  const badges: string[] = [];
  if (caps.vision) badges.push('Vision');
  if (caps.thinking) badges.push('Réflexion');
  if (caps.computerUse) badges.push('Écran');
  badges.push(`${Math.round(caps.context / 1000)}K`);
  return badges;
}

export const THINKING_LEVELS: { level: ThinkingLevel; label: string; hint: string }[] = [
  { level: 'off', label: 'Désactivé', hint: 'Réponse directe, latence minimale' },
  { level: 'fast', label: 'Rapide', hint: 'Un peu de réflexion avant de répondre' },
  { level: 'balanced', label: 'Équilibré', hint: 'Réflexion soutenue — recommandé' },
  { level: 'deep', label: 'Profond', hint: 'Réflexion maximale pour les tâches difficiles' },
];

/**
 * Maps the user-facing thinking level to the reasoning effort value the
 * provider actually understands (Anthropic thinking budget, OpenAI
 * reasoning_effort, Qwen enable_thinking, DeepSeek CoT...).
 */
export function effortForLevel(modelId: string, level: ThinkingLevel): ReasoningEffort {
  const caps = getModelCapabilities(modelId);
  if (!caps.thinking || level === 'off') return 'none';
  if (level === 'fast') return 'low';
  if (level === 'balanced') return 'medium';
  // deep — GPT-5 family accepts an extra tier
  if (/^gpt-5(\.|-|$)/.test(modelId) && modelId !== 'gpt-5.1') return 'xhigh';
  return 'high';
}

/** Reverse mapping so the UI can show the persisted effort as a level. */
export function levelForEffort(effort: ReasoningEffort): ThinkingLevel {
  switch (effort) {
    case 'none':
    case 'minimal':
      return 'off';
    case 'low':
      return 'fast';
    case 'high':
    case 'xhigh':
      return 'deep';
    default:
      return 'balanced';
  }
}
