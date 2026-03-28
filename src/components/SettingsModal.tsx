import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Calendar, Mail, Database, Globe, User, Puzzle, Plug, Layers, Key, Shield, Camera, Monitor, Plus, Trash2, Check, ExternalLink, Settings, Bot, Sparkles, Wrench } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MODEL_PROVIDERS, getReasoningEffortOptions, supportsReasoningEffort, type ReasoningEffort } from './ModelSelector';
import ConnectorConfigModal from './chat/ConnectorConfigModal';
import ConnectorLogo from './chat/ConnectorLogo';
import RemoteControlPanel from './settings/RemoteControlPanel';
import { buildDefaultConnectors, loadConnectors, mergeConnectorState, saveConnectors, type ConnectorState } from '@/lib/connectors';
import { API_BASE_URL } from '@/lib/api';
import { toast } from '@/components/ui/sonner';
import { loadSkills, saveSkills, type AppSkill } from '@/lib/user-config';
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
  { label: 'Automations', key: 'scheduled', icon: Calendar },
  { label: 'Mail', key: 'mail', icon: Mail },
  { label: 'Data controls', key: 'data', icon: Database },
  { label: 'Cloud browser', key: 'cloud-browser', icon: Globe },
  { label: 'Remote control', key: 'remote-control', icon: Bot },
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

const AUTOMATION_TEMPLATES: Array<{ label: string; cron: string; prompt: string; icon: typeof Sparkles }> = [
  {
    label: 'Morning repo review',
    cron: '0 9 * * 1-5',
    prompt: 'Review the current repo state, summarize risky diffs, failing tests, and the most important next coding task.',
    icon: Sparkles,
  },
  {
    label: 'Dependency audit',
    cron: '0 10 * * 1',
    prompt: 'Inspect dependencies, identify outdated or risky packages, and summarize recommended upgrades.',
    icon: Shield,
  },
  {
    label: 'Regression smoke test',
    cron: '0 */6 * * *',
    prompt: 'Run the main build and test smoke checks, summarize failures clearly, and note whether the app is releasable.',
    icon: Wrench,
  },
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
  const reasoningEffort = useStore((s) => s.reasoningEffort);
  const setReasoningEffort = useStore((s) => s.setReasoningEffort);

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
  const [workProfile, setWorkProfile] = useState('general');

  // Skills
  const [skills, setSkills] = useState<AppSkill[]>([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDescription, setNewSkillDescription] = useState('');
  const [newSkillPrompt, setNewSkillPrompt] = useState('');

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
    setReasoningEffort((localStorage.getItem('REASONING_EFFORT') as ReasoningEffort | null) || 'medium');
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
    setWorkProfile(localStorage.getItem('WORK_PROFILE') || 'general');

    // Skills
    try {
      setSkills(loadSkills());
    } catch { setSkills(loadSkills()); }

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
  }, [open, setReasoningEffort]);

  const saveAll = () => {
    // API keys
    Object.entries(apiKeys).forEach(([key, value]) => localStorage.setItem(key, value));
    Object.entries(baseUrls).forEach(([id, url]) => localStorage.setItem(`${id.toUpperCase()}_BASE_URL`, url));
    localStorage.setItem('TAVILY_API_KEY', tavilyKey);
    localStorage.setItem('BRAVE_API_KEY', braveKey);
    localStorage.setItem('PLAYWRIGHT_HOST', playwrightHost);
    localStorage.setItem('REASONING_EFFORT', reasoningEffort);
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
    localStorage.setItem('WORK_PROFILE', workProfile);
    saveSkills(skills);
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
        reasoningEffort,
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
        workProfile,
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

  const addCustomSkill = () => {
    if (!newSkillName.trim() || !newSkillPrompt.trim()) {
      return;
    }

    const next = [
      ...skills,
      {
        id: crypto.randomUUID(),
        name: newSkillName.trim(),
        description: newSkillDescription.trim() || 'Custom user-defined skill',
        prompt: newSkillPrompt.trim(),
        enabled: true,
        builtin: false,
      },
    ];

    setSkills(next);
    saveSkills(next);
    setNewSkillName('');
    setNewSkillDescription('');
    setNewSkillPrompt('');
    toast.success('Custom skill added');
  };

  const removeCustomSkill = (id: string) => {
    const next = skills.filter((skill) => skill.id !== id);
    setSkills(next);
    saveSkills(next);
    toast.success('Custom skill removed');
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
            {supportsReasoningEffort(model) && (
              <ConfigRow label="Reasoning effort">
                <select
                  value={reasoningEffort}
                  onChange={(e) => setReasoningEffort(e.target.value as ReasoningEffort)}
                  className="bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full"
                >
                  {getReasoningEffortOptions(model).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </ConfigRow>
            )}
          </div>
        );

      case 'api-keys':
        return (
          <div className="space-y-4">
            <h3 className="text-base font-medium text-foreground">API Keys</h3>
            <p className="text-xs text-muted-foreground">Stored in browser localStorage, not encrypted. For production, use a backend proxy.</p>
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
            <p className="text-xs text-muted-foreground">Playwright â†’ web navigation Â· PyAutoGUI â†’ system control</p>
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
            <h3 className="text-base font-medium text-foreground">Automations</h3>
            <p className="text-xs text-muted-foreground">Codex-style recurring work: queue recurring reviews, audits, and developer workflows.</p>

            <div className="grid gap-2 md:grid-cols-3">
              {AUTOMATION_TEMPLATES.map(({ label, cron, prompt, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    setNewTaskName(label);
                    setNewTaskCron(cron);
                    setNewTaskPrompt(prompt);
                  }}
                  className="rounded-xl border border-border bg-muted/50 p-3 text-left transition-colors hover:bg-surface-elevated"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{cron}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

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

      case 'remote-control':
        return <RemoteControlPanel />;

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
                <option value="fr">FranÃ§ais</option>
                <option value="es">EspaÃ±ol</option>
                <option value="de">Deutsch</option>
                <option value="zh">ä¸­æ–‡</option>
                <option value="ja">æ—¥æœ¬èª</option>
                <option value="ar">Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©</option>
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
            <ConfigRow label="Work profile">
              <select value={workProfile} onChange={(e) => setWorkProfile(e.target.value)} className="bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full">
                <option value="general">General</option>
                <option value="codex">Codex</option>
                <option value="reviewer">Reviewer</option>
                <option value="debugger">Debugger</option>
                <option value="architect">Architect</option>
              </select>
            </ConfigRow>
            <p className="text-xs text-muted-foreground">
              Current work profile: {workProfile === 'general' ? 'General' : workProfile === 'codex' ? 'Codex' : workProfile === 'reviewer' ? 'Reviewer' : workProfile === 'debugger' ? 'Debugger' : 'Architect'}
            </p>
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
            <p className="text-xs text-muted-foreground">Enable built-in capabilities and add your own reusable skills, similar to Claude-style custom instructions.</p>
            <div className="space-y-1">
              {skills.map((skill) => (
                <div key={skill.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface-elevated/50 transition-colors">
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-foreground">{skill.name}</p>
                      {!skill.builtin && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{skill.description}</p>
                    {skill.prompt && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{skill.prompt}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!skill.builtin && (
                      <button
                        onClick={() => removeCustomSkill(skill.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title={`Remove ${skill.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <div
                      onClick={() => toggleSkill(skill.id)}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${skill.enabled ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${skill.enabled ? 'left-4' : 'left-0.5'}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border border-dashed border-border rounded-lg p-3 space-y-2.5">
              <p className="text-sm font-medium text-foreground">Add custom skill</p>
              <input
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                placeholder="Skill name"
                className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                value={newSkillDescription}
                onChange={(e) => setNewSkillDescription(e.target.value)}
                placeholder="Short description"
                className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <textarea
                value={newSkillPrompt}
                onChange={(e) => setNewSkillPrompt(e.target.value)}
                rows={3}
                placeholder="Instructions this skill should apply, for example: Always return shell-safe commands and explain risks briefly."
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <button
                onClick={addCustomSkill}
                disabled={!newSkillName.trim() || !newSkillPrompt.trim()}
                className="w-full flex items-center justify-center gap-1.5 text-sm bg-surface-elevated text-foreground px-3 py-2 rounded-md hover:bg-muted transition-colors disabled:opacity-40 active:scale-[0.98]"
              >
                <Plus size={14} />
                Add custom skill
              </button>
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
                      <p className="text-xs text-muted-foreground capitalize">{conn.type} Â· {conn.statusLabel}</p>
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
                          : conn.configured
                          ? 'bg-warning/15 text-warning hover:bg-warning/25'
                          : 'bg-surface-elevated text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {conn.connected ? 'Ready' : conn.configured ? 'Saved locally' : 'Configure'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <ConnectorConfigModal
              connectorId={configConnectorId}
              onClose={() => setConfigConnectorId(null)}
              onSave={(nextState) => {
                setConnectors((prev) => {
                  const next = mergeConnectorState(prev, nextState);
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
        {/* Sidebar â€” horizontal scroll on mobile, vertical on desktop */}
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

