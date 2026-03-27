export type ConnectorFieldType = 'text' | 'password' | 'url';

export interface ConnectorField {
  key: string;
  label: string;
  placeholder: string;
  type?: ConnectorFieldType;
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  badge: string;
  type: string;
  category: string;
  description: string;
  shortAction: string;
  popularityRank?: number;
  providerLabel?: string;
  docsUrl?: string;
  fields: ConnectorField[];
}

export interface ConnectorState {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  badge: string;
}

const CONNECTORS_STORAGE_KEY = 'CONNECTORS';
const CONNECTOR_VALUES_PREFIX = 'CONNECTOR_VALUES_';
export const CONNECTORS_UPDATED_EVENT = 'agentos:connectors-updated';

const emitConnectorsUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CONNECTORS_UPDATED_EVENT));
  }
};

export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  {
    id: 'github',
    name: 'GitHub',
    badge: 'GH',
    type: 'dev',
    category: 'Engineering',
    description: 'Connect repositories, issues, pull requests, and code workflows.',
    shortAction: 'Manage repos, issues, and pull requests from AgentOS.',
    popularityRank: 4,
    docsUrl: 'https://github.com/settings/personal-access-tokens',
    fields: [
      { key: 'GITHUB_TOKEN', label: 'Personal Access Token', placeholder: 'github_pat_...', type: 'password' },
      { key: 'GITHUB_OWNER', label: 'Owner / Organization', placeholder: 'ace8991' },
    ],
  },
  {
    id: 'canva',
    name: 'Canva',
    badge: 'CV',
    type: 'design',
    category: 'Design',
    description: 'Connect Canva assets and design workflows for creative tasks.',
    shortAction: 'Search, create, autofill, and export Canva designs.',
    popularityRank: 5,
    docsUrl: 'https://www.canva.com/developers/',
    fields: [
      { key: 'CANVA_ACCESS_TOKEN', label: 'Access Token', placeholder: 'canva_access_token', type: 'password' },
      { key: 'CANVA_TEAM_ID', label: 'Team ID', placeholder: 'team_123456' },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    badge: 'SL',
    type: 'messaging',
    category: 'Communication',
    description: 'Send messages and receive notifications in Slack channels.',
    shortAction: 'Send messages, share updates, and fetch Slack context.',
    popularityRank: 9,
    docsUrl: 'https://api.slack.com/apps',
    fields: [
      { key: 'SLACK_BOT_TOKEN', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password' },
      { key: 'SLACK_WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/...', type: 'url' },
    ],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    badge: 'GD',
    type: 'storage',
    category: 'Files',
    description: 'Read and write files in shared drives and personal folders.',
    shortAction: 'Search, read, and organize files from Drive.',
    popularityRank: 3,
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'Client ID', placeholder: 'xxx.apps.googleusercontent.com' },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', placeholder: 'GOCSPX-...', type: 'password' },
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    badge: 'NT',
    type: 'docs',
    category: 'Knowledge',
    description: 'Read and write Notion pages, tasks, and databases.',
    shortAction: 'Connect your Notion workspace for docs and databases.',
    popularityRank: 6,
    docsUrl: 'https://www.notion.so/my-integrations',
    fields: [
      { key: 'NOTION_API_KEY', label: 'Integration Token', placeholder: 'secret_...', type: 'password' },
      { key: 'NOTION_DATABASE_ID', label: 'Database ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    badge: 'DC',
    type: 'messaging',
    category: 'Communication',
    description: 'Post updates and coordinate work inside Discord servers.',
    shortAction: 'Post updates and interact with your Discord communities.',
    popularityRank: 11,
    docsUrl: 'https://discord.com/developers/applications',
    fields: [
      { key: 'DISCORD_BOT_TOKEN', label: 'Bot Token', placeholder: 'MTk...', type: 'password' },
      { key: 'DISCORD_WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...', type: 'url' },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    badge: 'TG',
    type: 'messaging',
    category: 'Communication',
    description: 'Send updates, alerts, and workflow messages through Telegram bots.',
    shortAction: 'Connect Telegram bot chats for notifications and task workflows.',
    popularityRank: 7,
    docsUrl: 'https://core.telegram.org/bots/tutorial',
    fields: [
      { key: 'TELEGRAM_BOT_TOKEN', label: 'Bot Token', placeholder: '123456:ABC...', type: 'password' },
      { key: 'TELEGRAM_CHAT_ID', label: 'Chat ID', placeholder: '123456789' },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    badge: 'WA',
    type: 'messaging',
    category: 'Communication',
    description: 'Connect WhatsApp Business messaging workflows and outbound automation.',
    shortAction: 'Wire WhatsApp Business messaging into your support and automation flows.',
    popularityRank: 13,
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
    fields: [
      { key: 'WHATSAPP_ACCESS_TOKEN', label: 'Access Token', placeholder: 'EAAG...', type: 'password' },
      { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone Number ID', placeholder: '123456789012345' },
    ],
  },
  {
    id: 'jira',
    name: 'Jira',
    badge: 'JR',
    type: 'project',
    category: 'Project Management',
    description: 'Create issues, update tickets, and track project delivery.',
    shortAction: 'Access Jira projects, tickets, and delivery workflows.',
    popularityRank: 8,
    providerLabel: 'Atlassian',
    docsUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    fields: [
      { key: 'JIRA_EMAIL', label: 'Email', placeholder: 'you@company.com' },
      { key: 'JIRA_API_TOKEN', label: 'API Token', placeholder: 'ATATT3x...', type: 'password' },
      { key: 'JIRA_BASE_URL', label: 'Base URL', placeholder: 'https://yourcompany.atlassian.net', type: 'url' },
    ],
  },
  {
    id: 'linear',
    name: 'Linear',
    badge: 'LN',
    type: 'project',
    category: 'Project Management',
    description: 'Manage product work, issues, and team planning in Linear.',
    shortAction: 'Manage issues, projects, and team workflows in Linear.',
    popularityRank: 10,
    docsUrl: 'https://linear.app/settings/api',
    fields: [
      { key: 'LINEAR_API_KEY', label: 'API Key', placeholder: 'lin_api_...', type: 'password' },
    ],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    badge: 'ZP',
    type: 'automation',
    category: 'Automation',
    description: 'Trigger automation workflows with Zapier webhooks.',
    shortAction: 'Trigger no-code workflows and chained automations.',
    popularityRank: 12,
    docsUrl: 'https://zapier.com/app/developer',
    fields: [
      { key: 'ZAPIER_WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://hooks.zapier.com/...', type: 'url' },
    ],
  },
];

export const getConnectorDefinition = (id: string) =>
  CONNECTOR_DEFINITIONS.find((connector) => connector.id === id) ?? null;

export const buildDefaultConnectors = (): ConnectorState[] =>
  CONNECTOR_DEFINITIONS.map((connector) => ({
    id: connector.id,
    name: connector.name,
    type: connector.type,
    connected: false,
    badge: connector.badge,
  }));

export const loadConnectorValues = (connectorId: string): Record<string, string> => {
  const definition = getConnectorDefinition(connectorId);
  if (!definition) {
    return {};
  }

  try {
    const stored = localStorage.getItem(`${CONNECTOR_VALUES_PREFIX}${connectorId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    }
  } catch {
    // Fall back to legacy field-by-field storage below.
  }

  const migrated: Record<string, string> = {};
  for (const field of definition.fields) {
    migrated[field.key] = localStorage.getItem(`CONNECTOR_${field.key}`) || '';
  }
  return migrated;
};

export const saveConnectorValues = (connectorId: string, values: Record<string, string>) => {
  localStorage.setItem(`${CONNECTOR_VALUES_PREFIX}${connectorId}`, JSON.stringify(values));
  emitConnectorsUpdated();
};

export const clearConnectorValues = (connectorId: string) => {
  const definition = getConnectorDefinition(connectorId);
  if (!definition) {
    return;
  }

  localStorage.removeItem(`${CONNECTOR_VALUES_PREFIX}${connectorId}`);
  for (const field of definition.fields) {
    localStorage.removeItem(`CONNECTOR_${field.key}`);
  }
  emitConnectorsUpdated();
};

export const hasConnectorCredentials = (connectorId: string, values?: Record<string, string>) => {
  const definition = getConnectorDefinition(connectorId);
  if (!definition) {
    return false;
  }

  const currentValues = values ?? loadConnectorValues(connectorId);
  return definition.fields.some((field) => currentValues[field.key]?.trim());
};

export const loadConnectors = (): ConnectorState[] => {
  const defaults = buildDefaultConnectors();

  try {
    const stored = localStorage.getItem(CONNECTORS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const storedMap = new Map(
          parsed
            .filter((item): item is Partial<ConnectorState> & { id: string } => Boolean(item?.id))
            .map((item) => [item.id, item]),
        );

        return defaults.map((connector) => {
          const saved = storedMap.get(connector.id);
          return {
            ...connector,
            connected: saved?.connected ?? hasConnectorCredentials(connector.id),
          };
        });
      }
    }
  } catch {
    // Ignore invalid storage and rebuild from defaults.
  }

  return defaults.map((connector) => ({
    ...connector,
    connected: hasConnectorCredentials(connector.id),
  }));
};

export const saveConnectors = (connectors: ConnectorState[]) => {
  localStorage.setItem(CONNECTORS_STORAGE_KEY, JSON.stringify(connectors));
  emitConnectorsUpdated();
};
