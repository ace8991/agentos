import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, Settings, Check, Server, Cpu, HardDrive } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { getAvailableWebLLMModels, getLocalModelDisplayName, isLocalModel } from '@/lib/local-inference';
import LocalModelManager from '@/components/LocalModelManager';
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
      { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', description: 'Latest — extended thinking + computer use' },
      { id: 'claude-sonnet-4-7', name: 'Claude Sonnet 4.7', description: 'Latest — best balance, thinking + computer use' },
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: 'Most capable (previous gen)' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Fast & cheap' },
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
  {
    id: 'qwen',
    name: 'Qwen (Alibaba)',
    icon: '🟤',
    requiresKey: true,
    keyName: 'QWEN_API_KEY',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    baseUrlConfigurable: false,
    models: [
      { id: 'qwen-max', name: 'Qwen Max', description: 'Best Qwen model — complex reasoning tasks' },
      { id: 'qwen-plus', name: 'Qwen Plus', description: 'Balanced performance & cost — 131K context' },
      { id: 'qwen-turbo', name: 'Qwen Turbo', description: 'Fast & cheap — 1M context window' },
      { id: 'qwen3-235b-a22b-instruct-2507', name: 'Qwen3 235B (latest)', description: 'Qwen3 flagship — 262K context, tool use' },
    ],
  },
];

export function isAgentModelSupported(modelId: string) {
  return true; // All models are supported in the new multi-LLM architecture
}

const REASONING_MODELS = new Set([
  // OpenAI — native reasoning_effort
  'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.1',
  'o1', 'o3-mini',
  // Anthropic — extended thinking
  'claude-opus-4-8', 'claude-sonnet-4-7', 'claude-opus-4-5', 'claude-sonnet-4-6',
  // Qwen3 — enable_thinking
  'qwen3-235b-a22b-instruct-2507',
  // DeepSeek-R1 — chain-of-thought
  'deepseek-reasoner',
  // Gemini — supports thinking
  'gemini-2.5-pro',
]);

export function supportsReasoningEffort(modelId: string) {
  return REASONING_MODELS.has(modelId);
}

export function getReasoningEffortOptions(modelId: string): ReasoningEffort[] {
  if (!supportsReasoningEffort(modelId)) {
    return ['medium'];
  }
  if (/^gpt-5(\.|-|$)/.test(modelId) && modelId !== 'gpt-5.1') {
    return ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
  }
  return ['none', 'low', 'medium', 'high'];
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
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const [showLocalManager, setShowLocalManager] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  // Dynamic models for agent mode
  const [agentModels, setAgentModels] = useState<any[]>([]);

  useEffect(() => {
    if (mode === 'agent') {
      fetch('http://localhost:8000/api/agent/models')
        .then(r => r.json())
        .then(d => {
          if (d.models) setAgentModels(d.models);
        })
        .catch(console.error);
    }
  }, [mode]);

  const currentInfo = getModelInfo(model);

  const hasApiKey = (provider: ModelProvider) => {
    if (!provider.requiresKey) return true;
    return !!localStorage.getItem(provider.keyName || '');
  };

  useEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const preferredWidth = viewportWidth >= 768 ? 320 : 280;
      const panelWidth = Math.min(preferredWidth, Math.max(viewportWidth - 24, 220));
      const left = Math.max(12, Math.min(rect.right - panelWidth, viewportWidth - panelWidth - 12));
      const top = rect.bottom + 10;
      const maxHeight = Math.max(220, viewportHeight - top - 12);

      setPanelStyle({
        position: 'fixed',
        top,
        left,
        width: panelWidth,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const visibleProviders = mode === 'agent'
    ? (() => {
        if (agentModels.length === 0) return MODEL_PROVIDERS;
        const providersMap = new Map<string, ModelProvider>();
        MODEL_PROVIDERS.forEach(p => providersMap.set(p.id, { ...p, models: [] }));

        agentModels.forEach(m => {
          if (providersMap.has(m.provider)) {
            const p = providersMap.get(m.provider)!;
            if (!p.models.some(existing => existing.id === m.id)) {
              p.models.push({
                id: m.id,
                name: m.label,
                description: m.computer_use ? 'Native Computer Use' : (m.vision ? 'Vision + Semantic UI' : 'Text + Semantic UI')
              });
            }
          }
        });
        return Array.from(providersMap.values()).filter((provider) => provider.models.length > 0);
      })()
    : MODEL_PROVIDERS.filter((provider) => provider.models.length > 0);

  return (
    <div ref={anchorRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border text-sm text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
      >
        <span>{isLocalModel(model) ? '🧠' : (currentInfo?.provider.icon || '🤖')}</span>
        <span className="truncate max-w-[140px]">{isLocalModel(model) ? getLocalModelDisplayName(model) : (currentInfo?.name || model)}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && panelStyle &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="z-50 overflow-hidden rounded-xl border border-border bg-card shadow-xl overflow-y-auto scrollbar-thin"
              style={panelStyle}
            >
              {visibleProviders.map((provider) => {
                const configured = hasApiKey(provider);
                return (
                  <div key={provider.id}>
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

              {/* Local Models Section */}
              <div>
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🧠</span>
                    <span className="text-xs font-medium text-foreground">Modèles locaux</span>
                    <span className="text-[10px] bg-success/20 text-success px-1.5 py-0.5 rounded-full font-medium">
                      Gratuit
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowLocalManager(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-elevated/70"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground flex items-center gap-1.5">
                      <HardDrive size={13} /> Gérer les modèles locaux
                    </div>
                    <div className="text-xs text-muted-foreground">WebLLM (navigateur) & GGUF (backend)</div>
                  </div>
                </button>
                {isLocalModel(model) && (
                  <div className="px-4 py-2 bg-surface-elevated text-xs text-primary flex items-center gap-1.5">
                    <Check size={12} /> {getLocalModelDisplayName(model)}
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}

      {showLocalManager && (
        <LocalModelManager
          onSelectModel={(id) => {
            setModel(id);
            setShowLocalManager(false);
          }}
          onClose={() => setShowLocalManager(false)}
        />
      )}
    </div>
  );
};

export default ModelSelector;
