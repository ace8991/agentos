import { useState } from 'react';
import { X, Check, ExternalLink, Key, Globe, Shield } from 'lucide-react';

interface ConnectorConfig {
  id: string;
  name: string;
  icon: string;
  type: string;
  fields: { key: string; label: string; placeholder: string; type?: 'text' | 'password' | 'url' }[];
  docsUrl?: string;
  description?: string;
}

const connectorConfigs: Record<string, ConnectorConfig> = {
  slack: {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    type: 'messaging',
    description: 'Send messages and receive notifications in Slack channels.',
    fields: [
      { key: 'SLACK_BOT_TOKEN', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password' },
      { key: 'SLACK_WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/...', type: 'url' },
    ],
    docsUrl: 'https://api.slack.com/apps',
  },
  github: {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    type: 'dev',
    description: 'Create issues, PRs, and manage repositories.',
    fields: [
      { key: 'GITHUB_TOKEN', label: 'Personal Access Token', placeholder: 'ghp_...', type: 'password' },
      { key: 'GITHUB_OWNER', label: 'Owner / Org', placeholder: 'your-username' },
    ],
    docsUrl: 'https://github.com/settings/tokens',
  },
  'google-drive': {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '📁',
    type: 'storage',
    description: 'Read and write files to Google Drive.',
    fields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'Client ID', placeholder: 'xxx.apps.googleusercontent.com' },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', placeholder: 'GOCSPX-...', type: 'password' },
    ],
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    icon: '📝',
    type: 'docs',
    description: 'Read and write Notion pages and databases.',
    fields: [
      { key: 'NOTION_API_KEY', label: 'Integration Token', placeholder: 'secret_...', type: 'password' },
      { key: 'NOTION_DATABASE_ID', label: 'Database ID (optional)', placeholder: 'xxxxxxxx-xxxx-...' },
    ],
    docsUrl: 'https://www.notion.so/my-integrations',
  },
  discord: {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    type: 'messaging',
    description: 'Send messages and manage Discord servers.',
    fields: [
      { key: 'DISCORD_BOT_TOKEN', label: 'Bot Token', placeholder: 'MTk...', type: 'password' },
      { key: 'DISCORD_WEBHOOK_URL', label: 'Webhook URL (optional)', placeholder: 'https://discord.com/api/webhooks/...', type: 'url' },
    ],
    docsUrl: 'https://discord.com/developers/applications',
  },
  jira: {
    id: 'jira',
    name: 'Jira',
    icon: '📊',
    type: 'project',
    description: 'Create and manage Jira issues and projects.',
    fields: [
      { key: 'JIRA_EMAIL', label: 'Email', placeholder: 'you@company.com' },
      { key: 'JIRA_API_TOKEN', label: 'API Token', placeholder: 'ATATT3x...', type: 'password' },
      { key: 'JIRA_BASE_URL', label: 'Base URL', placeholder: 'https://yourcompany.atlassian.net', type: 'url' },
    ],
    docsUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
  },
  linear: {
    id: 'linear',
    name: 'Linear',
    icon: '📐',
    type: 'project',
    description: 'Manage Linear issues and project tracking.',
    fields: [
      { key: 'LINEAR_API_KEY', label: 'API Key', placeholder: 'lin_api_...', type: 'password' },
    ],
    docsUrl: 'https://linear.app/settings/api',
  },
  zapier: {
    id: 'zapier',
    name: 'Zapier',
    icon: '⚡',
    type: 'automation',
    description: 'Trigger Zapier workflows and automations.',
    fields: [
      { key: 'ZAPIER_WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://hooks.zapier.com/...', type: 'url' },
    ],
    docsUrl: 'https://zapier.com/app/developer',
  },
};

interface ConnectorConfigModalProps {
  connectorId: string | null;
  onClose: () => void;
  onSave: (connectorId: string, connected: boolean) => void;
}

const ConnectorConfigModal = ({ connectorId, onClose, onSave }: ConnectorConfigModalProps) => {
  const config = connectorId ? connectorConfigs[connectorId] : null;
  const [values, setValues] = useState<Record<string, string>>({});
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Load saved values
  useState(() => {
    if (!config) return;
    const loaded: Record<string, string> = {};
    config.fields.forEach((f) => {
      loaded[f.key] = localStorage.getItem(`CONNECTOR_${f.key}`) || '';
    });
    setValues(loaded);
  });

  if (!config) return null;

  const handleSave = () => {
    config.fields.forEach((f) => {
      localStorage.setItem(`CONNECTOR_${f.key}`, values[f.key] || '');
    });
    const hasValues = config.fields.some((f) => values[f.key]?.trim());
    onSave(config.id, hasValues);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    // Simulate connection test
    await new Promise((r) => setTimeout(r, 1500));
    const hasValues = config.fields.some((f) => values[f.key]?.trim());
    setTestResult(hasValues ? 'success' : 'error');
    setTesting(false);
  };

  const handleDisconnect = () => {
    config.fields.forEach((f) => {
      localStorage.removeItem(`CONNECTOR_${f.key}`);
    });
    setValues({});
    onSave(config.id, false);
    onClose();
  };

  const isConnected = config.fields.some((f) => values[f.key]?.trim());

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="glass-modal rounded-xl border border-border w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{config.icon}</span>
            <div>
              <h2 className="text-base font-medium text-foreground">{config.name}</h2>
              <p className="text-xs text-muted-foreground capitalize">{config.type}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}

          {/* Status indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
            isConnected
              ? 'bg-success/10 text-success border border-success/20'
              : 'bg-muted text-muted-foreground border border-border'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-muted-foreground'}`} />
            {isConnected ? 'Connected' : 'Not configured'}
          </div>

          {/* Fields */}
          <div className="space-y-3">
            {config.fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs text-muted-foreground font-mono block mb-1.5">
                  {field.label}
                </label>
                <div className="flex gap-2">
                  <input
                    type={field.type === 'password' && !showFields[field.key] ? 'password' : 'text'}
                    value={values[field.key] || ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                  {field.type === 'password' && (
                    <button
                      onClick={() => setShowFields((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                      className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-surface-elevated"
                    >
                      {showFields[field.key] ? <Shield size={14} /> : <Key size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Docs link */}
          {config.docsUrl && (
            <a
              href={config.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={11} />
              Get credentials
            </a>
          )}

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              testResult === 'success'
                ? 'bg-success/10 text-success border border-success/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {testResult === 'success' ? <Check size={12} /> : <X size={12} />}
              {testResult === 'success' ? 'Connection successful!' : 'Connection failed. Check credentials.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex-1 flex items-center justify-center gap-2 bg-surface-elevated text-foreground font-medium text-sm py-2.5 rounded-lg hover:bg-muted transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              {testing ? (
                <>
                  <Globe size={13} className="animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              {saved ? (
                <>
                  <Check size={13} />
                  Saved
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
          {isConnected && (
            <button
              onClick={handleDisconnect}
              className="w-full text-xs text-destructive hover:text-destructive/80 py-2 transition-colors"
            >
              Disconnect {config.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectorConfigModal;