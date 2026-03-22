import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, ExternalLink, Check, Server } from 'lucide-react';
import { MODEL_PROVIDERS, type ModelProvider } from './ModelSelector';

interface ProviderConfigModalProps {
  providerId: string | null;
  onClose: () => void;
}

const ProviderConfigModal = ({ providerId, onClose }: ProviderConfigModalProps) => {
  const provider = MODEL_PROVIDERS.find((p) => p.id === providerId);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!provider) return;
    if (provider.requiresKey && provider.keyName) {
      setApiKey(localStorage.getItem(provider.keyName) || '');
    }
    if (provider.baseUrlConfigurable) {
      setBaseUrl(localStorage.getItem(`${provider.id.toUpperCase()}_BASE_URL`) || provider.defaultBaseUrl || '');
    }
    setSaved(false);
    setShowKey(false);
  }, [provider]);

  if (!provider) return null;

  const handleSave = () => {
    if (provider.requiresKey && provider.keyName) {
      localStorage.setItem(provider.keyName, apiKey);
    }
    if (provider.baseUrlConfigurable) {
      localStorage.setItem(`${provider.id.toUpperCase()}_BASE_URL`, baseUrl);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const providerDocs: Record<string, { url: string; instructions: string }> = {
    anthropic: { url: 'https://console.anthropic.com/settings/keys', instructions: 'Create an API key in the Anthropic Console.' },
    openai: { url: 'https://platform.openai.com/api-keys', instructions: 'Create an API key in the OpenAI Dashboard.' },
    deepseek: { url: 'https://platform.deepseek.com/api_keys', instructions: 'Create an API key in the DeepSeek Platform.' },
    google: { url: 'https://aistudio.google.com/app/apikey', instructions: 'Get an API key from Google AI Studio.' },
    mistral: { url: 'https://console.mistral.ai/api-keys/', instructions: 'Create an API key in the Mistral Console.' },
    groq: { url: 'https://console.groq.com/keys', instructions: 'Create an API key in the Groq Console.' },
    ollama: { url: 'https://ollama.com/download', instructions: 'Install Ollama locally and pull models with `ollama pull <model>`.' },
    lmstudio: { url: 'https://lmstudio.ai/', instructions: 'Download LM Studio, load a model, and start the local server (port 1234 by default).' },
  };

  const docs = providerDocs[provider.id];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="glass-modal rounded-xl border border-border w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{provider.icon}</span>
            <h2 className="text-base font-medium text-foreground">{provider.name} Configuration</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Instructions */}
          {docs && (
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <p className="text-sm text-muted-foreground">{docs.instructions}</p>
              <a
                href={docs.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
              >
                <ExternalLink size={12} />
                {provider.requiresKey ? 'Get API key' : 'Download'}
              </a>
            </div>
          )}

          {/* API Key input */}
          {provider.requiresKey && provider.keyName && (
            <div>
              <label className="text-xs text-muted-foreground font-mono block mb-1.5">{provider.keyName}</label>
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Enter your ${provider.name} API key`}
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-surface-elevated"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">⚠ Stored in localStorage only</p>
            </div>
          )}

          {/* Base URL config for local providers */}
          {provider.baseUrlConfigurable && (
            <div>
              <label className="text-xs text-muted-foreground font-mono block mb-1.5">Base URL</label>
              <div className="flex items-center gap-2">
                <Server size={14} className="text-muted-foreground shrink-0" />
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={provider.defaultBaseUrl}
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {provider.id === 'lmstudio' && (
                <div className="mt-3 bg-muted/50 border border-border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">Quick Setup</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Open LM Studio and download a model</li>
                    <li>Go to "Local Server" tab</li>
                    <li>Click "Start Server" (default: port 1234)</li>
                    <li>Select "Local Model" from the model dropdown</li>
                  </ol>
                </div>
              )}
              {provider.id === 'ollama' && (
                <div className="mt-3 bg-muted/50 border border-border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">Quick Setup</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Install Ollama from ollama.com</li>
                    <li>Run <code className="bg-muted px-1 rounded text-foreground">ollama pull llama3</code></li>
                    <li>Ollama serves on port 11434 by default</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Available models */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Available models</p>
            <div className="space-y-1">
              {provider.models.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <span className="text-sm text-foreground">{m.name}</span>
                    {m.description && (
                      <span className="text-xs text-muted-foreground ml-2">{m.description}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            {saved ? (
              <>
                <Check size={15} />
                Saved
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProviderConfigModal;
