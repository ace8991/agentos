import { useEffect, useState } from 'react';
import { ChevronDown, Settings, Check, Server, Cpu } from 'lucide-react';
import { useStore } from '@/store/useStore';

export interface ModelProvider {
  id: string;
  name: string;
  icon: string;
  requiresKey: boolean;
  keyName?: string;
  models: { id: string; name: string; description?: string }[];
  baseUrlConfigurable?: boolean;
  defaultBaseUrl?: string;
}

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🟠',
    requiresKey: true,
    keyName: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: 'Most capable' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced' },
      { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5', description: 'Fast & cheap' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🟢',
    requiresKey: true,
    keyName: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4', description: 'Frontier agentic work' },
      { id: 'gpt-5.3-codex', name: 'GPT-5.3-Codex', description: 'Most capable Codex model' },
      { id: 'gpt-5.2-codex', name: 'GPT-5.2-Codex', description: 'Long-horizon coding' },
      { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Best coding and agentic tasks' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Flagship multimodal' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable' },
      { id: 'o1', name: 'o1', description: 'Reasoning model' },
      { id: 'o3-mini', name: 'o3-mini', description: 'Efficient reasoning' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🔵',
    requiresKey: true,
    keyName: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'General purpose' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Reasoning model' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    icon: '🟡',
    requiresKey: true,
    keyName: 'GOOGLE_API_KEY',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & efficient' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    icon: '🟣',
    requiresKey: true,
    keyName: 'MISTRAL_API_KEY',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Flagship model' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Balanced' },
      { id: 'codestral-latest', name: 'Codestral', description: 'Code specialized' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    icon: '⚡',
    requiresKey: true,
    keyName: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Fast inference' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'MoE model' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    icon: '🦙',
    requiresKey: false,
    baseUrlConfigurable: true,
    defaultBaseUrl: 'http://localhost:11434',
    models: [
      { id: 'ollama/llama3', name: 'Llama 3', description: 'Local • Free' },
      { id: 'ollama/mistral', name: 'Mistral 7B', description: 'Local • Free' },
      { id: 'ollama/codellama', name: 'Code Llama', description: 'Local • Free' },
      { id: 'ollama/deepseek-r1', name: 'DeepSeek R1', description: 'Local • Free' },
    ],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    icon: '🖥️',
    requiresKey: false,
    baseUrlConfigurable: true,
    defaultBaseUrl: 'http://localhost:1234',
    models: [
      { id: 'lmstudio/local-model', name: 'Local Model', description: 'Free • Configure in LM Studio' },
    ],
  },
];

const AGENT_SUPPORTED_MODELS = new Set([
  'claude-opus-4-5',
  'claude-sonnet-4-6',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.1',
  'gpt-4o',
  'gpt-4o-mini',
]);

export function isAgentModelSupported(modelId: string) {
  return AGENT_SUPPORTED_MODELS.has(modelId);
}

export function supportsReasoningEffort(modelId: string) {
  return /^gpt-5(\.|-|$)/.test(modelId);
}

export function getReasoningEffortOptions(modelId: string): ReasoningEffort[] {
  if (!supportsReasoningEffort(modelId)) {
    return ['medium'];
  }
  if (modelId === 'gpt-5.1') {
    return ['none', 'low', 'medium', 'high'];
  }
  return ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
}

export function getProviderForModel(modelId: string): ModelProvider | undefined {
  return MODEL_PROVIDERS.find((p) => p.models.some((m) => m.id === modelId));
}

export function getModelInfo(modelId: string) {
  for (const p of MODEL_PROVIDERS) {
    const m = p.models.find((m) => m.id === modelId);
    if (m) return { ...m, provider: p };
  }
  return null;
}

interface ModelSelectorProps {
  onConfigureProvider?: (providerId: string) => void;
}

const ModelSelector = ({ onConfigureProvider }: ModelSelectorProps) => {
  const mode = useStore((s) => s.mode);
  const model = useStore((s) => s.model);
  const setModel = useStore((s) => s.setModel);
  const [open, setOpen] = useState(false);

  const currentInfo = getModelInfo(model);

  const hasApiKey = (provider: ModelProvider) => {
    if (!provider.requiresKey) return true;
    return !!localStorage.getItem(provider.keyName || '');
  };

  useEffect(() => {
    if (mode === 'agent' && !isAgentModelSupported(model)) {
      setModel('claude-sonnet-4-6');
    }
  }, [mode, model, setModel]);

  const visibleProviders = MODEL_PROVIDERS
    .map((provider) => ({
      ...provider,
      models: mode === 'agent'
        ? provider.models.filter((candidate) => isAgentModelSupported(candidate.id))
        : provider.models,
    }))
    .filter((provider) => provider.models.length > 0);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border text-sm text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
      >
        <span>{currentInfo?.provider.icon || '🤖'}</span>
        <span className="truncate max-w-[140px]">{currentInfo?.name || model}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-[280px] md:w-[320px] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[60vh] md:max-h-[70vh] overflow-y-auto scrollbar-thin right-0 md:right-auto">
            {visibleProviders.map((provider) => {
              const configured = hasApiKey(provider);
              return (
                <div key={provider.id}>
                  {/* Provider header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{provider.icon}</span>
                      <span className="text-xs font-medium text-foreground">{provider.name}</span>
                      {!provider.requiresKey && (
                        <span className="text-[10px] bg-success/20 text-success px-1.5 py-0.5 rounded-full font-medium">
                          Free
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {provider.requiresKey && !configured && (
                        <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                          No key
                        </span>
                      )}
                      {mode === 'agent' && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          Agent
                        </span>
                      )}
                      {(provider.requiresKey || provider.baseUrlConfigurable) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            onConfigureProvider?.(provider.id);
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-elevated"
                          title="Configure"
                        >
                          <Settings size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Models */}
                  {provider.models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-elevated/70 ${
                        model === m.id ? 'bg-surface-elevated' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground">{m.name}</div>
                        {m.description && (
                          <div className="text-xs text-muted-foreground">{m.description}</div>
                        )}
                      </div>
                      {model === m.id && <Check size={14} className="text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ModelSelector;
