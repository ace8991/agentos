import { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useStore } from '@/store/useStore';

const SettingsModal = () => {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);

  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  const [braveKey, setBraveKey] = useState('');
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
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
    setAnthropicKey(localStorage.getItem('ANTHROPIC_API_KEY') || '');
    setOpenaiKey(localStorage.getItem('OPENAI_API_KEY') || '');
    setTavilyKey(localStorage.getItem('TAVILY_API_KEY') || '');
    setBraveKey(localStorage.getItem('BRAVE_API_KEY') || '');
    setPlaywrightHost(localStorage.getItem('PLAYWRIGHT_HOST') || 'http://localhost:9222');
    setPyautoguiEnabled(localStorage.getItem('PYAUTOGUI_ENABLED') !== 'false');
  }, [open]);

  const saveKeys = () => {
    localStorage.setItem('ANTHROPIC_API_KEY', anthropicKey);
    localStorage.setItem('OPENAI_API_KEY', openaiKey);
    localStorage.setItem('TAVILY_API_KEY', tavilyKey);
    localStorage.setItem('BRAVE_API_KEY', braveKey);
    localStorage.setItem('PLAYWRIGHT_HOST', playwrightHost);
    localStorage.setItem('PYAUTOGUI_ENABLED', String(pyautoguiEnabled));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div className="glass-modal rounded-lg border border-border w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-foreground">Settings</h2>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* LLM API Keys */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">LLM API Keys</h3>
          <p className="text-xs text-muted-foreground mb-3">⚠ Stored in localStorage only — not encrypted.</p>
          {[
            { label: 'ANTHROPIC_API_KEY', value: anthropicKey, set: setAnthropicKey, show: showAnthropic, toggle: () => setShowAnthropic(!showAnthropic) },
            { label: 'OPENAI_API_KEY', value: openaiKey, set: setOpenaiKey, show: showOpenai, toggle: () => setShowOpenai(!showOpenai) },
          ].map((k) => (
            <div key={k.label} className="mb-2">
              <label className="text-xs text-muted-foreground font-mono">{k.label}</label>
              <div className="flex gap-2 mt-1">
                <input
                  type={k.show ? 'text' : 'password'}
                  value={k.value}
                  onChange={(e) => k.set(e.target.value)}
                  className="flex-1 bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button onClick={k.toggle} className="text-muted-foreground hover:text-foreground transition-colors p-1.5">
                  {k.show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Web / Search API Keys */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Web & Search</h3>
          <p className="text-xs text-muted-foreground mb-3">Tavily → search + extract + crawl · Brave → fallback search</p>
          {[
            { label: 'TAVILY_API_KEY', value: tavilyKey, set: setTavilyKey, show: showTavily, toggle: () => setShowTavily(!showTavily) },
            { label: 'BRAVE_API_KEY', value: braveKey, set: setBraveKey, show: showBrave, toggle: () => setShowBrave(!showBrave) },
          ].map((k) => (
            <div key={k.label} className="mb-2">
              <label className="text-xs text-muted-foreground font-mono">{k.label}</label>
              <div className="flex gap-2 mt-1">
                <input
                  type={k.show ? 'text' : 'password'}
                  value={k.value}
                  onChange={(e) => k.set(e.target.value)}
                  className="flex-1 bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button onClick={k.toggle} className="text-muted-foreground hover:text-foreground transition-colors p-1.5">
                  {k.show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Browser & System */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Browser & System</h3>
          <p className="text-xs text-muted-foreground mb-3">Playwright+Brave → navigation DOM · PyAutoGUI → contrôle système</p>
          <div className="mb-2">
            <label className="text-xs text-muted-foreground font-mono">PLAYWRIGHT_HOST</label>
            <input
              value={playwrightHost}
              onChange={(e) => setPlaywrightHost(e.target.value)}
              placeholder="http://localhost:9222"
              className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </div>
          <Toggle label="PyAutoGUI enabled (system control)" checked={pyautoguiEnabled} onChange={setPyautoguiEnabled} />
        </div>

        {/* Save all */}
        <button onClick={saveKeys} className="w-full text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md hover:opacity-90 transition-opacity mb-6 font-medium active:scale-[0.98]">
          Save all settings
        </button>

        {/* Capture */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Capture</h3>
          <Toggle label="Annotate actions on screenshot" checked={annotateActions} onChange={setAnnotateActions} />
          <Toggle label="Save screenshots to disk" checked={saveScreenshots} onChange={setSaveScreenshots} />
          {saveScreenshots && (
            <input
              value={savePath}
              onChange={(e) => setSavePath(e.target.value)}
              className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-2 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              placeholder="./screenshots"
            />
          )}
        </div>

        {/* Safety */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Safety</h3>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-muted-foreground">Max consecutive errors</label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxErrors}
              onChange={(e) => setMaxErrors(Number(e.target.value))}
              className="w-16 bg-muted border border-border rounded-md px-2 py-1 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring tabular-nums"
            />
          </div>
          <Toggle label="Require confirmation before clicking" checked={confirmClick} onChange={setConfirmClick} />
        </div>
      </div>
    </div>
  );
};

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
