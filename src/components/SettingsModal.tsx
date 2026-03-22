import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Calendar, Mail, Database, Globe, User, Puzzle, Plug, Layers, Key, Shield, Camera, Monitor } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MODEL_PROVIDERS } from './ModelSelector';
const intervals = [
  { label: '500ms', value: 500 },
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
];

type Section =
  | 'general'
  | 'api-keys'
  | 'browser-system'
  | 'capture'
  | 'safety'
  | 'scheduled'
  | 'mail'
  | 'data'
  | 'cloud-browser'
  | 'personalization'
  | 'skills'
  | 'connectors'
  | 'integrations';

const sidebarSections: { label: string; key: Section; icon: typeof Key }[] = [
  { label: 'General', key: 'general', icon: Monitor },
  { label: 'API Keys', key: 'api-keys', icon: Key },
  { label: 'Browser & System', key: 'browser-system', icon: Globe },
  { label: 'Capture', key: 'capture', icon: Camera },
  { label: 'Safety', key: 'safety', icon: Shield },
  { label: 'Scheduled tasks', key: 'scheduled', icon: Calendar },
  { label: 'Mail', key: 'mail', icon: Mail },
  { label: 'Data controls', key: 'data', icon: Database },
  { label: 'Cloud browser', key: 'cloud-browser', icon: Globe },
  { label: 'Personalization', key: 'personalization', icon: User },
  { label: 'Skills', key: 'skills', icon: Puzzle },
  { label: 'Connectors', key: 'connectors', icon: Plug },
  { label: 'Integrations', key: 'integrations', icon: Layers },
];

const SettingsModal = () => {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const model = useStore((s) => s.model);
  const setModel = useStore((s) => s.setModel);
  const maxSteps = useStore((s) => s.maxSteps);
  const setMaxSteps = useStore((s) => s.setMaxSteps);
  const captureInterval = useStore((s) => s.captureInterval);
  const setCaptureInterval = useStore((s) => s.setCaptureInterval);

  const [section, setSection] = useState<Section>('general');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
  const [tavilyKey, setTavilyKey] = useState('');
  const [braveKey, setBraveKey] = useState('');
  const [showTavily, setShowTavily] = useState(false);
  const [showBrave, setShowBrave] = useState(false);
  const [annotateActions, setAnnotateActions] = useState(true);
  const [saveScreenshots, setSaveScreenshots] = useState(false);
  const [savePath, setSavePath] = useState('./screenshots');
  const [maxErrors, setMaxErrors] = useState(3);
  const [playwrightHost, setPlaywrightHost] = useState('http://localhost:9222');
  const [pyautoguiEnabled, setPyautoguiEnabled] = useState(true);
  const [confirmClick, setConfirmClick] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Load all provider API keys
    const keys: Record<string, string> = {};
    const urls: Record<string, string> = {};
    MODEL_PROVIDERS.forEach((p) => {
      if (p.requiresKey && p.keyName) {
        keys[p.keyName] = localStorage.getItem(p.keyName) || '';
      }
      if (p.baseUrlConfigurable) {
        urls[p.id] = localStorage.getItem(`${p.id.toUpperCase()}_BASE_URL`) || p.defaultBaseUrl || '';
      }
    });
    setApiKeys(keys);
    setBaseUrls(urls);
    setShowKeys({});
    setTavilyKey(localStorage.getItem('TAVILY_API_KEY') || '');
    setBraveKey(localStorage.getItem('BRAVE_API_KEY') || '');
    setPlaywrightHost(localStorage.getItem('PLAYWRIGHT_HOST') || 'http://localhost:9222');
    setPyautoguiEnabled(localStorage.getItem('PYAUTOGUI_ENABLED') !== 'false');
  }, [open]);

  const saveKeys = () => {
    Object.entries(apiKeys).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    Object.entries(baseUrls).forEach(([id, url]) => {
      localStorage.setItem(`${id.toUpperCase()}_BASE_URL`, url);
    });
    localStorage.setItem('TAVILY_API_KEY', tavilyKey);
    localStorage.setItem('BRAVE_API_KEY', braveKey);
    localStorage.setItem('PLAYWRIGHT_HOST', playwrightHost);
    localStorage.setItem('PYAUTOGUI_ENABLED', String(pyautoguiEnabled));
  };

  if (!open) return null;

  const renderContent = () => {
    switch (section) {
      case 'general':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">General Settings</h3>
            <ConfigRow label="Model">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
              >
                {MODEL_PROVIDERS.flatMap((p) =>
                  p.models.map((m) => (
                    <option key={m.id} value={m.id}>{p.icon} {m.name}</option>
                  ))
                )}
              </select>
            </ConfigRow>
            <ConfigRow label="Max steps">
              <input
                type="number"
                min={1}
                max={100}
                value={maxSteps}
                onChange={(e) => setMaxSteps(Number(e.target.value))}
                className="bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-20 tabular-nums text-center"
              />
            </ConfigRow>
            <ConfigRow label="Capture interval">
              <select
                value={captureInterval}
                onChange={(e) => setCaptureInterval(Number(e.target.value))}
                className="bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
              >
                {intervals.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </ConfigRow>
          </div>
        );

      case 'api-keys':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">API Keys</h3>
            <p className="text-xs text-muted-foreground">⚠ Stored in localStorage only — not encrypted.</p>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">LLM Providers</h4>
              {[
                { label: 'ANTHROPIC_API_KEY', value: anthropicKey, set: setAnthropicKey, show: showAnthropic, toggle: () => setShowAnthropic(!showAnthropic) },
                { label: 'OPENAI_API_KEY', value: openaiKey, set: setOpenaiKey, show: showOpenai, toggle: () => setShowOpenai(!showOpenai) },
              ].map((k) => (
                <KeyInput key={k.label} {...k} />
              ))}
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Web & Search</h4>
              {[
                { label: 'TAVILY_API_KEY', value: tavilyKey, set: setTavilyKey, show: showTavily, toggle: () => setShowTavily(!showTavily) },
                { label: 'BRAVE_API_KEY', value: braveKey, set: setBraveKey, show: showBrave, toggle: () => setShowBrave(!showBrave) },
              ].map((k) => (
                <KeyInput key={k.label} {...k} />
              ))}
            </div>
            <button onClick={saveKeys} className="w-full text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md hover:opacity-90 transition-opacity font-medium active:scale-[0.98]">
              Save keys
            </button>
          </div>
        );

      case 'browser-system':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Browser & System</h3>
            <p className="text-xs text-muted-foreground">Playwright+Brave → navigation DOM · PyAutoGUI → system control</p>
            <div>
              <label className="text-xs text-muted-foreground font-mono">PLAYWRIGHT_HOST</label>
              <input
                value={playwrightHost}
                onChange={(e) => setPlaywrightHost(e.target.value)}
                className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
            </div>
            <Toggle label="PyAutoGUI enabled" checked={pyautoguiEnabled} onChange={setPyautoguiEnabled} />
            <button onClick={saveKeys} className="w-full text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md hover:opacity-90 transition-opacity font-medium active:scale-[0.98]">
              Save
            </button>
          </div>
        );

      case 'capture':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Capture Settings</h3>
            <Toggle label="Annotate actions on screenshot" checked={annotateActions} onChange={setAnnotateActions} />
            <Toggle label="Save screenshots to disk" checked={saveScreenshots} onChange={setSaveScreenshots} />
            {saveScreenshots && (
              <input
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                placeholder="./screenshots"
              />
            )}
          </div>
        );

      case 'safety':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Safety</h3>
            <ConfigRow label="Max consecutive errors">
              <input
                type="number"
                min={1}
                max={20}
                value={maxErrors}
                onChange={(e) => setMaxErrors(Number(e.target.value))}
                className="w-16 bg-muted border border-border rounded-md px-2 py-1 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
              />
            </ConfigRow>
            <Toggle label="Require confirmation before clicking" checked={confirmClick} onChange={setConfirmClick} />
          </div>
        );

      default:
        return <PlaceholderSection section={section} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div
        className="glass-modal rounded-lg border border-border w-full max-w-3xl mx-4 max-h-[85vh] flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-[200px] shrink-0 border-r border-border bg-card/50 overflow-y-auto scrollbar-thin py-2">
          {sidebarSections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                section === s.key
                  ? 'bg-surface-elevated text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated/50'
              }`}
            >
              <s.icon size={14} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-foreground">Settings</h2>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={18} />
            </button>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

const PlaceholderSection = ({ section }: { section: string }) => {
  const labels: Record<string, { title: string; desc: string }> = {
    scheduled: { title: 'Scheduled Tasks', desc: 'Schedule tasks to run automatically at specific times or intervals.' },
    mail: { title: 'Mail', desc: 'Configure email notifications and agent mail integration.' },
    data: { title: 'Data Controls', desc: 'Manage data retention, export, and privacy settings.' },
    'cloud-browser': { title: 'Cloud Browser', desc: 'Configure cloud browser instances for remote task execution.' },
    personalization: { title: 'Personalization', desc: 'Customize agent behavior, language, and response style.' },
    skills: { title: 'Skills', desc: 'Enable or disable agent skills and capabilities.' },
    connectors: { title: 'Connectors', desc: 'Connect external services like Slack, GitHub, Google Drive.' },
    integrations: { title: 'Integrations', desc: 'Manage third-party API integrations and webhooks.' },
  };
  const info = labels[section] || { title: section, desc: '' };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium text-foreground">{info.title}</h3>
      <p className="text-sm text-muted-foreground">{info.desc}</p>
      <div className="border border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center mb-3">
          <span className="text-lg">🚧</span>
        </div>
        <p className="text-sm text-foreground font-medium">Coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">This feature is under development</p>
      </div>
    </div>
  );
};

const ConfigRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <label className="text-sm text-muted-foreground shrink-0">{label}</label>
    <div className="flex-1 max-w-[240px]">{children}</div>
  </div>
);

const KeyInput = ({ label, value, set, show, toggle }: {
  label: string; value: string; set: (v: string) => void; show: boolean; toggle: () => void;
}) => (
  <div>
    <label className="text-xs text-muted-foreground font-mono">{label}</label>
    <div className="flex gap-2 mt-1">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="flex-1 bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button onClick={toggle} className="text-muted-foreground hover:text-foreground transition-colors p-1.5">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  </div>
);

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center justify-between py-1.5 cursor-pointer">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${checked ? 'left-4' : 'left-0.5'}`} />
    </div>
  </label>
);

export default SettingsModal;
