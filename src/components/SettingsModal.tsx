import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Calendar, Mail, Database, Globe, User, Puzzle, Plug, Layers, Key, Shield, Camera, Monitor, Plus, Trash2, Check, ExternalLink, Settings } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MODEL_PROVIDERS } from './ModelSelector';
import ConnectorConfigModal from './chat/ConnectorConfigModal';
import ConnectorLogo from './chat/ConnectorLogo';
import { buildDefaultConnectors, loadConnectors, saveConnectors, type ConnectorState } from '@/lib/connectors';
import { API_BASE_URL } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
const intervals = [
  { label: '500ms', value: 500 },
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
];

type Section = ReturnType<typeof useStore.getState>['settingsSection'];

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

// Types for settings stored in localStorage
interface ScheduledTask {
  id: string;
  name: string;
  cron: string;
  task: string;
  enabled: boolean;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

const defaultSkills: Skill[] = [
  { id: 'web-browsing', name: 'Web Browsing', description: 'Navigate and interact with websites', enabled: true },
  { id: 'code-execution', name: 'Code Execution', description: 'Write and execute code in sandbox', enabled: true },
  { id: 'file-management', name: 'File Management', description: 'Read, write, and manage files', enabled: true },
  { id: 'web-search', name: 'Web Search', description: 'Search the internet for information', enabled: true },
  { id: 'data-analysis', name: 'Data Analysis', description: 'Analyze data and create visualizations', enabled: false },
  { id: 'image-generation', name: 'Image Generation', description: 'Generate images from text prompts', enabled: false },
  { id: 'email-sending', name: 'Email Sending', description: 'Compose and send emails', enabled: false },
  { id: 'calendar-access', name: 'Calendar Access', description: 'Read and create calendar events', enabled: false },
];

const SettingsModal = () => {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const section = useStore((s) => s.settingsSection);
  const setSection = useStore((s) => s.setSettingsSection);
  const model = useStore((s) => s.model);
  const setModel = useStore((s) => s.setModel);
  const maxSteps = useStore((s) => s.maxSteps);
  const setMaxSteps = useStore((s) => s.setMaxSteps);
  const captureInterval = useStore((s) => s.captureInterval);
  const setCaptureInterval = useStore((s) => s.setCaptureInterval);

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

  // Scheduled tasks
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskCron, setNewTaskCron] = useState('0 */6 * * *');
  const [newTaskPrompt, setNewTaskPrompt] = useState('');

  // Mail
  const [mailEnabled, setMailEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [mailFrom, setMailFrom] = useState('');

  // Data controls
  const [retentionDays, setRetentionDays] = useState(30);
  const [autoDeleteScreenshots, setAutoDeleteScreenshots] = useState(false);
  const [collectAnalytics, setCollectAnalytics] = useState(false);

  // Cloud browser
  const [cloudBrowserEnabled, setCloudBrowserEnabled] = useState(false);
  const [cloudBrowserUrl, setCloudBrowserUrl] = useState('');
  const [cloudBrowserTimeout, setCloudBrowserTimeout] = useState(300);

  // Personalization
  const [agentName, setAgentName] = useState('Agent');
  const [language, setLanguage] = useState('en');
  const [responseStyle, setResponseStyle] = useState('balanced');
  const [systemPrompt, setSystemPrompt] = useState('');

  // Skills
  const [skills, setSkills] = useState<Skill[]>(defaultSkills);

  // Connectors
  const [connectors, setConnectors] = useState<ConnectorState[]>(buildDefaultConnectors());
  const [configConnectorId, setConfigConnectorId] = useState<string | null>(null);

  // Integrations
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Load all settings from localStorage
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
    setAnnotateActions(localStorage.getItem('ANNOTATE_ACTIONS') !== 'false');
    setSaveScreenshots(localStorage.getItem('SAVE_SCREENSHOTS') === 'true');
    setSavePath(localStorage.getItem('SAVE_PATH') || './screenshots');
    setMaxErrors(Number(localStorage.getItem('MAX_ERRORS')) || 3);
    setConfirmClick(localStorage.getItem('CONFIRM_CLICK') === 'true');

    // Scheduled tasks
    try {
      setScheduledTasks(JSON.parse(localStorage.getItem('SCHEDULED_TASKS') || '[]'));
    } catch { setScheduledTasks([]); }

    // Mail
    setMailEnabled(localStorage.getItem('MAIL_ENABLED') === 'true');
    setSmtpHost(localStorage.getItem('SMTP_HOST') || '');
    setSmtpPort(localStorage.getItem('SMTP_PORT') || '587');
    setSmtpUser(localStorage.getItem('SMTP_USER') || '');
    setSmtpPass(localStorage.getItem('SMTP_PASS') || '');
    setMailFrom(localStorage.getItem('MAIL_FROM') || '');

    // Data controls
    setRetentionDays(Number(localStorage.getItem('RETENTION_DAYS')) || 30);
    setAutoDeleteScreenshots(localStorage.getItem('AUTO_DELETE_SCREENSHOTS') === 'true');
    setCollectAnalytics(localStorage.getItem('COLLECT_ANALYTICS') === 'true');

    // Cloud browser
    setCloudBrowserEnabled(localStorage.getItem('CLOUD_BROWSER_ENABLED') === 'true');
    setCloudBrowserUrl(localStorage.getItem('CLOUD_BROWSER_URL') || '');
    setCloudBrowserTimeout(Number(localStorage.getItem('CLOUD_BROWSER_TIMEOUT')) || 300);

    // Personalization
    setAgentName(localStorage.getItem('AGENT_NAME') || 'Agent');
    setLanguage(localStorage.getItem('AGENT_LANGUAGE') || 'en');
    setResponseStyle(localStorage.getItem('RESPONSE_STYLE') || 'balanced');
    setSystemPrompt(localStorage.getItem('SYSTEM_PROMPT') || '');

    // Skills
    try {
      const saved = JSON.parse(localStorage.getItem('SKILLS') || '');
      if (Array.isArray(saved)) setSkills(saved);
    } catch { setSkills(defaultSkills); }

    // Connectors
    try {
      setConnectors(loadConnectors());
    } catch { setConnectors(buildDefaultConnectors()); }

    // Integrations
    setWebhookUrl(localStorage.getItem('WEBHOOK_URL') || '');
    try {
      setWebhookEvents(JSON.parse(localStorage.getItem('WEBHOOK_EVENTS') || '[]'));
    } catch { setWebhookEvents([]); }

    setSaved(false);
  }, [open]);

  const saveAll = () => {
    // API keys
    Object.entries(apiKeys).forEach(([key, value]) => localStorage.setItem(key, value));
    Object.entries(baseUrls).forEach(([id, url]) => localStorage.setItem(`${id.toUpperCase()}_BASE_URL`, url));
    localStorage.setItem('TAVILY_API_KEY', tavilyKey);
    localStorage.setItem('BRAVE_API_KEY', braveKey);
    localStorage.setItem('PLAYWRIGHT_HOST', playwrightHost);
    localStorage.setItem('PYAUTOGUI_ENABLED', String(pyautoguiEnabled));
    localStorage.setItem('ANNOTATE_ACTIONS', String(annotateActions));
    localStorage.setItem('SAVE_SCREENSHOTS', String(saveScreenshots));
    localStorage.setItem('SAVE_PATH', savePath);
    localStorage.setItem('MAX_ERRORS', String(maxErrors));
    localStorage.setItem('CONFIRM_CLICK', String(confirmClick));
    localStorage.setItem('SCHEDULED_TASKS', JSON.stringify(scheduledTasks));
    localStorage.setItem('MAIL_ENABLED', String(mailEnabled));
    localStorage.setItem('SMTP_HOST', smtpHost);
    localStorage.setItem('SMTP_PORT', smtpPort);
    localStorage.setItem('SMTP_USER', smtpUser);
    localStorage.setItem('SMTP_PASS', smtpPass);
    localStorage.setItem('MAIL_FROM', mailFrom);
    localStorage.setItem('RETENTION_DAYS', String(retentionDays));
    localStorage.setItem('AUTO_DELETE_SCREENSHOTS', String(autoDeleteScreenshots));
    localStorage.setItem('COLLECT_ANALYTICS', String(collectAnalytics));
    localStorage.setItem('CLOUD_BROWSER_ENABLED', String(cloudBrowserEnabled));
    localStorage.setItem('CLOUD_BROWSER_URL', cloudBrowserUrl);
    localStorage.setItem('CLOUD_BROWSER_TIMEOUT', String(cloudBrowserTimeout));
    localStorage.setItem('AGENT_NAME', agentName);
    localStorage.setItem('AGENT_LANGUAGE', language);
    localStorage.setItem('RESPONSE_STYLE', responseStyle);
    localStorage.setItem('SYSTEM_PROMPT', systemPrompt);
    localStorage.setItem('SKILLS', JSON.stringify(skills));
    saveConnectors(connectors);
    localStorage.setItem('WEBHOOK_URL', webhookUrl);
    localStorage.setItem('WEBHOOK_EVENTS', JSON.stringify(webhookEvents));

    setSaved(true);
    toast.success('Settings saved');
    setTimeout(() => setSaved(false), 2000);
  };

  const exportAllData = () => {
    const snapshot = {
      exported_at: new Date().toISOString(),
      settings: {
        apiKeys,
        baseUrls,
        tavilyKey,
        braveKey,
        annotateActions,
        saveScreenshots,
        savePath,
        maxErrors,
        playwrightHost,
        pyautoguiEnabled,
        confirmClick,
        scheduledTasks,
        mailEnabled,
        smtpHost,
        smtpPort,
        smtpUser,
        mailFrom,
        retentionDays,
        autoDeleteScreenshots,
        collectAnalytics,
        cloudBrowserEnabled,
        cloudBrowserUrl,
        cloudBrowserTimeout,
        agentName,
        language,
        responseStyle,
        systemPrompt,
        skills,
        connectors,
        webhookUrl,
        webhookEvents,
      },
      history: useStore.getState().history,
      memory: useStore.getState().memory,
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agentos-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('AgentOS data exported');
  };

  const clearAllData = () => {
    if (!window.confirm('Clear local history, settings, saved connectors, and cached state on this browser?')) {
      return;
    }

    localStorage.clear();
    useStore.setState({
      history: [],
      memory: [],
      entries: [],
      task: '',
      currentScreenshot: null,
      annotations: [],
      viewingHistory: null,
    });
    setOpen(false);
    toast.success('Local AgentOS data cleared');
    window.location.reload();
  };

  const addScheduledTask = () => {
    if (!newTaskName.trim() || !newTaskPrompt.trim()) return;
    setScheduledTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: newTaskName, cron: newTaskCron, task: newTaskPrompt, enabled: true },
    ]);
    setNewTaskName('');
    setNewTaskCron('0 */6 * * *');
    setNewTaskPrompt('');
  };

  const removeScheduledTask = (id: string) => {
    setScheduledTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleScheduledTask = (id: string) => {
    setScheduledTasks((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  const toggleSkill = (id: string) => {
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  const toggleWebhookEvent = (event: string) => {
    setWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
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
            <p className="text-xs text-muted-foreground">⚠ Stored in browser localStorage — not encrypted. For production, use a backend proxy.</p>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">LLM Providers</h4>
              {MODEL_PROVIDERS.filter((p) => p.requiresKey && p.keyName).map((p) => (
                <KeyInput
                  key={p.keyName!}
                  label={`${p.icon} ${p.keyName!}`}
                  value={apiKeys[p.keyName!] || ''}
                  set={(v) => setApiKeys((prev) => ({ ...prev, [p.keyName!]: v }))}
                  show={showKeys[p.keyName!] || false}
                  toggle={() => setShowKeys((prev) => ({ ...prev, [p.keyName!]: !prev[p.keyName!] }))}
                />
              ))}
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Local Model Servers</h4>
              {MODEL_PROVIDERS.filter((p) => p.baseUrlConfigurable).map((p) => (
                <div key={p.id}>
                  <label className="text-xs text-muted-foreground font-mono">{p.icon} {p.name} Base URL</label>
                  <input
                    value={baseUrls[p.id] || ''}
                    onChange={(e) => setBaseUrls((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={p.defaultBaseUrl}
                    className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
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
          </div>
        );

      case 'browser-system':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Browser & System</h3>
            <p className="text-xs text-muted-foreground">Playwright → web navigation · PyAutoGUI → system control</p>
            <div>
              <label className="text-xs text-muted-foreground font-mono">PLAYWRIGHT_HOST</label>
              <input
                value={playwrightHost}
                onChange={(e) => setPlaywrightHost(e.target.value)}
                className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
            </div>
            <Toggle label="PyAutoGUI enabled" checked={pyautoguiEnabled} onChange={setPyautoguiEnabled} />
          </div>
        );

      case 'capture':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Capture Settings</h3>
            <Toggle label="Annotate actions on screenshot" checked={annotateActions} onChange={setAnnotateActions} />
            <Toggle label="Save screenshots to disk" checked={saveScreenshots} onChange={setSaveScreenshots} />
            {saveScreenshots && (
              <div>
                <label className="text-xs text-muted-foreground">Save path</label>
                <input
                  value={savePath}
                  onChange={(e) => setSavePath(e.target.value)}
                  className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono mt-1"
                  placeholder="./screenshots"
                />
              </div>
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

      case 'scheduled':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Scheduled Tasks</h3>
            <p className="text-xs text-muted-foreground">Schedule tasks to run automatically at specific intervals.</p>

            {/* Existing tasks */}
            {scheduledTasks.length > 0 && (
              <div className="space-y-2">
                {scheduledTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg px-3 py-2.5">
                    <Toggle label="" checked={t.enabled} onChange={() => toggleScheduledTask(t.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{t.cron}</p>
                    </div>
                    <button onClick={() => removeScheduledTask(t.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new task */}
            <div className="border border-dashed border-border rounded-lg p-3 space-y-2.5">
              <input
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Task name"
                className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                value={newTaskCron}
                onChange={(e) => setNewTaskCron(e.target.value)}
                placeholder="Cron expression (e.g. 0 */6 * * *)"
                className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <textarea
                value={newTaskPrompt}
                onChange={(e) => setNewTaskPrompt(e.target.value)}
                placeholder="Task prompt..."
                rows={2}
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <button
                onClick={addScheduledTask}
                disabled={!newTaskName.trim() || !newTaskPrompt.trim()}
                className="w-full flex items-center justify-center gap-1.5 text-sm bg-surface-elevated text-foreground px-3 py-2 rounded-md hover:bg-muted transition-colors disabled:opacity-40 active:scale-[0.98]"
              >
                <Plus size={14} />
                Add scheduled task
              </button>
            </div>
          </div>
        );

      case 'mail':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Mail Configuration</h3>
            <Toggle label="Enable email notifications" checked={mailEnabled} onChange={setMailEnabled} />
            {mailEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">SMTP Host</label>
                  <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <ConfigRow label="Port">
                  <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="w-20 bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring tabular-nums" />
                </ConfigRow>
                <div>
                  <label className="text-xs text-muted-foreground">Username</label>
                  <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <KeyInput label="Password" value={smtpPass} set={setSmtpPass} show={showSmtpPass} toggle={() => setShowSmtpPass(!showSmtpPass)} />
                <div>
                  <label className="text-xs text-muted-foreground">From address</label>
                  <input value={mailFrom} onChange={(e) => setMailFrom(e.target.value)} placeholder="agent@example.com" className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
            )}
          </div>
        );

      case 'data':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Data Controls</h3>
            <ConfigRow label="Data retention (days)">
              <input type="number" min={1} max={365} value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} className="w-20 bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring tabular-nums" />
            </ConfigRow>
            <Toggle label="Auto-delete screenshots after retention period" checked={autoDeleteScreenshots} onChange={setAutoDeleteScreenshots} />
            <Toggle label="Collect anonymous usage analytics" checked={collectAnalytics} onChange={setCollectAnalytics} />
            <div className="border-t border-border pt-3 space-y-2">
              <button
                onClick={exportAllData}
                className="w-full text-sm text-foreground bg-surface-elevated px-3 py-2 rounded-md hover:bg-muted transition-colors active:scale-[0.98]"
              >
                Export all data
              </button>
              <button
                onClick={clearAllData}
                className="w-full text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md hover:bg-destructive/20 transition-colors active:scale-[0.98]"
              >
                Clear all data
              </button>
            </div>
          </div>
        );

      case 'cloud-browser':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Cloud Browser</h3>
            <p className="text-xs text-muted-foreground">Use a remote browser instance for web automation tasks.</p>
            <Toggle label="Enable cloud browser" checked={cloudBrowserEnabled} onChange={setCloudBrowserEnabled} />
            {cloudBrowserEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground font-mono">Browser URL</label>
                  <input value={cloudBrowserUrl} onChange={(e) => setCloudBrowserUrl(e.target.value)} placeholder="wss://browser.example.com" className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring font-mono" />
                </div>
                <ConfigRow label="Timeout (seconds)">
                  <input type="number" min={30} max={3600} value={cloudBrowserTimeout} onChange={(e) => setCloudBrowserTimeout(Number(e.target.value))} className="w-20 bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-ring tabular-nums" />
                </ConfigRow>
              </div>
            )}
          </div>
        );

      case 'personalization':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Personalization</h3>
            <div>
              <label className="text-xs text-muted-foreground">Agent name</label>
              <input value={agentName} onChange={(e) => setAgentName(e.target.value)} className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <ConfigRow label="Language">
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full">
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
                <option value="ar">العربية</option>
              </select>
            </ConfigRow>
            <ConfigRow label="Response style">
              <select value={responseStyle} onChange={(e) => setResponseStyle(e.target.value)} className="bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full">
                <option value="concise">Concise</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
                <option value="creative">Creative</option>
              </select>
            </ConfigRow>
            <div>
              <label className="text-xs text-muted-foreground">Custom system prompt</label>
              <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} placeholder="Add custom instructions for the agent..." className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Skills</h3>
            <p className="text-xs text-muted-foreground">Enable or disable agent capabilities.</p>
            <div className="space-y-1">
              {skills.map((skill) => (
                <div key={skill.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface-elevated/50 transition-colors">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm text-foreground">{skill.name}</p>
                    <p className="text-xs text-muted-foreground">{skill.description}</p>
                  </div>
                  <div
                    onClick={() => toggleSkill(skill.id)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${skill.enabled ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${skill.enabled ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'connectors':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Connectors</h3>
            <p className="text-xs text-muted-foreground">Connect external services to extend agent capabilities. Click Configure to set up credentials.</p>
            <div className="space-y-1">
              {connectors.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface-elevated/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <ConnectorLogo
                      connectorId={conn.id}
                      name={conn.name}
                      badge={conn.badge}
                      size="sm"
                      className="border-border bg-surface-elevated"
                    />
                    <div>
                      <p className="text-sm text-foreground">{conn.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{conn.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfigConnectorId(conn.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.97]"
                    >
                      <Settings size={13} />
                    </button>
                    <button
                      onClick={() => setConfigConnectorId(conn.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors active:scale-[0.97] ${
                        conn.connected
                          ? 'bg-success/15 text-success hover:bg-success/25'
                          : 'bg-surface-elevated text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {conn.connected ? '✓ Connected' : 'Configure'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <ConnectorConfigModal
              connectorId={configConnectorId}
              onClose={() => setConfigConnectorId(null)}
              onSave={(id, connected) => {
                setConnectors((prev) => {
                  const next = prev.map((c) => (c.id === id ? { ...c, connected } : c));
                  saveConnectors(next);
                  return next;
                });
                setConfigConnectorId(null);
              }}
            />
          </div>
        );

      case 'integrations':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">Integrations</h3>
            <p className="text-xs text-muted-foreground">Configure webhooks and third-party API integrations.</p>

            <div>
              <label className="text-xs text-muted-foreground">Webhook URL</label>
              <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook" className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-ring font-mono" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">Trigger events</label>
              <div className="space-y-1">
                {['task.started', 'task.completed', 'task.failed', 'task.paused', 'step.completed', 'agent.error'].map((event) => (
                  <label key={event} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg hover:bg-surface-elevated/50 cursor-pointer transition-colors">
                    <div
                      onClick={() => toggleWebhookEvent(event)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        webhookEvents.includes(event) ? 'bg-primary border-primary' : 'border-border'
                      }`}
                    >
                      {webhookEvents.includes(event) && <Check size={10} className="text-primary-foreground" />}
                    </div>
                    <span className="text-sm text-foreground font-mono">{event}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <h4 className="text-sm font-medium text-foreground mb-2">REST API</h4>
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Base URL</p>
                <code className="text-xs text-foreground font-mono">http://localhost:8000</code>
                <div className="mt-2 flex gap-2">
                  <a
                    href={`${API_BASE_URL}/docs`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={11} /> API Docs
                  </a>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div
        className="glass-modal rounded-lg border border-border w-full max-w-3xl mx-3 md:mx-4 max-h-[90vh] md:max-h-[85vh] flex flex-col md:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar — horizontal scroll on mobile, vertical on desktop */}
        <div className="md:w-[200px] shrink-0 border-b md:border-b-0 md:border-r border-border bg-card/50 overflow-x-auto md:overflow-x-visible md:overflow-y-auto scrollbar-thin py-2 md:py-2">
          <div className="flex md:flex-col gap-0.5 px-2 md:px-0 min-w-max md:min-w-0">
            {sidebarSections.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex items-center gap-2 md:gap-2.5 px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-md md:rounded-none whitespace-nowrap transition-colors ${
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6 min-h-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-foreground">Settings</h2>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={18} />
            </button>
          </div>
          {renderContent()}

          {/* Save button (always visible) */}
          <div className="mt-6 pt-4 border-t border-border">
            <button
              onClick={saveAll}
              className="w-full flex items-center justify-center gap-2 text-sm bg-primary text-primary-foreground px-3 py-2.5 rounded-md hover:opacity-90 transition-opacity font-medium active:scale-[0.98]"
            >
              {saved ? (
                <>
                  <Check size={15} />
                  Saved
                </>
              ) : (
                'Save all settings'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfigRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3">
    <label className="text-sm text-muted-foreground shrink-0">{label}</label>
    <div className="flex-1 sm:max-w-[240px]">{children}</div>
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
    {label && <span className="text-sm text-muted-foreground">{label}</span>}
    <div
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${checked ? 'left-4' : 'left-0.5'}`} />
    </div>
  </label>
);

export default SettingsModal;
