export type ConnectorFieldType = 'text' | 'password' | 'url';
export type ConnectorIntegrationMode = 'native' | 'relay' | 'local' | 'manual';
export type ConnectorStatus = 'not_configured' | 'saved' | 'verified' | 'ready_relay' | 'ready_local' | 'error';

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
  integrationMode: ConnectorIntegrationMode;
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
  configured: boolean;
  connected: boolean;
  badge: string;
  integrationMode: ConnectorIntegrationMode;
  status: ConnectorStatus;
  statusLabel: string;
  statusDetail?: string;
  lastCheckedAt?: string | null;
}

type ConnectorSeed = Omit<ConnectorDefinition, 'id' | 'badge' | 'fields'> & {
  id?: string;
  badge?: string;
  fields?: ConnectorField[];
  setup?: 'credentials' | 'local';
  integrationMode?: ConnectorIntegrationMode;
};

const CONNECTORS_STORAGE_KEY = 'CONNECTORS';
const CONNECTOR_VALUES_PREFIX = 'CONNECTOR_VALUES_';
export const CONNECTORS_UPDATED_EVENT = 'agentos:connectors-updated';

const RELAY_CONNECTOR_IDS = new Set(['telegram', 'whatsapp']);
const NATIVE_CONNECTOR_IDS = new Set(['github', 'notion', 'slack', 'jira', 'linear', 'discord']);

const emitConnectorsUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CONNECTORS_UPDATED_EVENT));
  }
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toFieldPrefix = (value: string) => slugify(value).replace(/-/g, '_').toUpperCase();

const badgeFromName = (name: string) => {
  const parts = name
    .replace(/\b(and|the|for|of|by)\b/gi, ' ')
    .split(/[\s./()+-]+/)
    .filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CN').slice(0, 3);
};

const credentialFields = (id: string): ConnectorField[] => {
  const prefix = toFieldPrefix(id);
  return [
    {
      key: `${prefix}_TOKEN`,
      label: 'API Key / Access Token',
      placeholder: 'Paste your token, API key, or MCP secret',
      type: 'password',
    },
    {
      key: `${prefix}_WORKSPACE`,
      label: 'Workspace / Account / Endpoint',
      placeholder: 'Optional workspace, project, account, or endpoint',
    },
  ];
};

const localFields = (id: string): ConnectorField[] => {
  const prefix = toFieldPrefix(id);
  return [
    {
      key: `${prefix}_SERVER_URL`,
      label: 'Local Server URL',
      placeholder: 'http://localhost:3000',
      type: 'url',
    },
    {
      key: `${prefix}_ACCESS_TOKEN`,
      label: 'Access Token (optional)',
      placeholder: 'Optional local auth token',
      type: 'password',
    },
  ];
};

const seed = (
  name: string,
  type: string,
  category: string,
  shortAction: string,
  extra: Partial<ConnectorSeed> = {},
): ConnectorSeed => ({
  name,
  type,
  category,
  description: shortAction,
  shortAction,
  ...extra,
});

const buildConnector = (seedValue: ConnectorSeed): ConnectorDefinition => {
  const id = seedValue.id ?? slugify(seedValue.name);
  const integrationMode =
    seedValue.integrationMode ??
    (seedValue.setup === 'local'
      ? 'local'
      : RELAY_CONNECTOR_IDS.has(id)
      ? 'relay'
      : NATIVE_CONNECTOR_IDS.has(id)
      ? 'native'
      : 'manual');

  return {
    ...seedValue,
    id,
    badge: seedValue.badge ?? badgeFromName(seedValue.name),
    integrationMode,
    fields:
      seedValue.fields ??
      (seedValue.setup === 'local' ? localFields(id) : credentialFields(id)),
  };
};

const STATUS_LABELS: Record<ConnectorStatus, string> = {
  not_configured: 'Not configured',
  saved: 'Saved locally',
  verified: 'Verified',
  ready_relay: 'Relay ready',
  ready_local: 'Local ready',
  error: 'Needs attention',
};

const isConnectorStatus = (value: unknown): value is ConnectorStatus =>
  value === 'not_configured' ||
  value === 'saved' ||
  value === 'verified' ||
  value === 'ready_relay' ||
  value === 'ready_local' ||
  value === 'error';

const isReadyStatus = (status: ConnectorStatus) => status === 'verified' || status === 'ready_relay' || status === 'ready_local';

const getSavedStatusDetail = (integrationMode: ConnectorIntegrationMode) => {
  if (integrationMode === 'relay') {
    return 'Credentials are saved, but this flow still depends on the inbound relay/webhook bridge.';
  }
  if (integrationMode === 'local') {
    return 'Configuration is saved locally. This connector only becomes active on a local installation.';
  }
  if (integrationMode === 'native') {
    return 'Credentials are saved locally. Run live validation to confirm the provider accepts them.';
  }
  return 'Credentials are saved locally, but this catalog entry is not wired to a native runtime yet.';
};

const buildStateFromDefinition = (
  connector: ConnectorDefinition,
  overrides: Partial<ConnectorState> = {},
): ConnectorState => {
  const configured = overrides.configured ?? false;
  const status = overrides.status ?? (configured ? 'saved' : 'not_configured');
  return {
    id: connector.id,
    name: connector.name,
    type: connector.type,
    badge: connector.badge,
    configured,
    connected: overrides.connected ?? isReadyStatus(status),
    integrationMode: connector.integrationMode,
    status,
    statusLabel: overrides.statusLabel ?? STATUS_LABELS[status],
    statusDetail:
      overrides.statusDetail ??
      (configured ? getSavedStatusDetail(connector.integrationMode) : 'No credentials or endpoint details saved yet.'),
    lastCheckedAt: overrides.lastCheckedAt ?? null,
  };
};

const coreConnectorSeeds: ConnectorSeed[] = [
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
    type: 'communication',
    category: 'Communication',
    description: 'Send messages and receive notifications in Slack channels.',
    shortAction: 'Send messages, share updates, and fetch Slack context.',
    popularityRank: 10,
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
    shortAction: 'Find and analyze files instantly from Google Drive.',
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
    shortAction: 'Connect your Notion workspace to search, update, and power workflows.',
    popularityRank: 6,
    docsUrl: 'https://www.notion.so/my-integrations',
    fields: [
      { key: 'NOTION_API_KEY', label: 'Integration Token', placeholder: 'secret_...', type: 'password' },
      { key: 'NOTION_DATABASE_ID', label: 'Database ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    badge: 'TG',
    type: 'communication',
    category: 'Communication',
    description: 'Send updates, alerts, and workflow messages through Telegram bots.',
    shortAction: 'Connect Telegram bot chats for notifications and task workflows.',
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
    type: 'communication',
    category: 'Communication',
    description: 'Connect WhatsApp Business messaging workflows and outbound automation.',
    shortAction: 'Wire WhatsApp Business messaging into your support and automation flows.',
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
    shortAction: 'Manage issues, projects and team workflows in Linear.',
    popularityRank: 10,
    docsUrl: 'https://linear.app/settings/api',
    fields: [{ key: 'LINEAR_API_KEY', label: 'API Key', placeholder: 'lin_api_...', type: 'password' }],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    badge: 'ZP',
    type: 'automation',
    category: 'Automation',
    description: 'Trigger automation workflows with Zapier webhooks.',
    shortAction: 'Automate workflows across thousands of apps via conversation.',
    popularityRank: 12,
    providerLabel: 'Trending',
    docsUrl: 'https://zapier.com/app/developer',
    fields: [
      { key: 'ZAPIER_WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://hooks.zapier.com/...', type: 'url' },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    badge: 'DC',
    type: 'communication',
    category: 'Communication',
    description: 'Post updates and coordinate work inside Discord servers.',
    shortAction: 'Post updates and interact with your Discord communities.',
    docsUrl: 'https://discord.com/developers/applications',
    fields: [
      { key: 'DISCORD_BOT_TOKEN', label: 'Bot Token', placeholder: 'MTk...', type: 'password' },
      { key: 'DISCORD_WEBHOOK_URL', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...', type: 'url' },
    ],
  },
];

const expandedConnectorSeeds: ConnectorSeed[] = [
  seed('Gmail', 'communication', 'Email', 'Draft replies, summarize threads, and search your inbox.', { popularityRank: 1 }),
  seed('Google Calendar', 'calendar', 'Scheduling', 'Manage your schedule and coordinate meetings effortlessly.', { popularityRank: 2 }),
  seed('Figma', 'design', 'Design', 'Generate diagrams and better code from Figma context.', { popularityRank: 8 }),
  seed('Atlassian Rovo', 'project', 'Project Management', 'Access Jira and Confluence from Claude.', { providerLabel: 'Atlassian' }),
  seed('HubSpot', 'crm', 'Sales', 'Chat with your CRM data to get personalized insights.'),
  seed('monday.com', 'project', 'Project Management', 'Manage projects, boards, and workflows in monday.com.', { providerLabel: 'Interactive' }),
  seed('Intercom', 'support', 'Support', 'Access Intercom data for better customer insights.'),
  seed('Box', 'storage', 'Files', 'Search, access and get insights on your Box content.', { providerLabel: 'Interactive' }),
  seed('Gamma', 'design', 'Presentation', 'Create presentations, docs, socials, and sites with AI.', { providerLabel: 'Interactive' }),
  seed('Miro', 'design', 'Whiteboarding', 'Access and create new content on Miro boards.'),
  seed('Vercel', 'dev', 'Deployment', 'Analyze, debug, and manage projects and deployments.'),
  seed('Excalidraw', 'design', 'Whiteboarding', 'Create interactive hand-drawn diagrams in Excalidraw.', { providerLabel: 'Interactive' }),
  seed('Granola', 'productivity', 'Meetings', 'The AI notepad for meetings.'),
  seed('Asana', 'project', 'Project Management', 'Coordinate tasks, projects, and goals in Asana.', { providerLabel: 'Interactive' }),
  seed('Sentry', 'observability', 'Engineering', 'Search, query, and debug errors intelligently.'),
  seed('Indeed', 'jobs', 'Careers', 'Search for jobs on Indeed.'),
  seed('Supabase', 'dev', 'Database', 'Manage databases, authentication, and storage.'),
  seed('PubMed', 'research', 'Science', 'Search biomedical literature from PubMed.'),
  seed('n8n', 'automation', 'Automation', 'Access and run your n8n workflows.'),
  seed('ClickUp', 'project', 'Project Management', 'Project management and collaboration for teams and agents.'),
  seed('Microsoft Learn', 'dev', 'Documentation', 'Search trusted Microsoft docs to power your development.'),
  seed('Context7', 'dev', 'Documentation', 'Access up-to-date docs for LLMs and AI code editors.'),
  seed('Mermaid Chart', 'design', 'Visualization', 'Validate Mermaid syntax and render diagrams as high-quality SVG.'),
  seed('Stripe', 'finance', 'Payments', 'Payment processing and financial infrastructure tools.'),
  seed('Hugging Face', 'ai', 'AI & ML', 'Access the Hugging Face Hub and thousands of Gradio Apps.'),
  seed('Fireflies', 'productivity', 'Meetings', 'Analyze and generate insights from meeting transcripts.'),
  seed('Clay', 'sales', 'Sales', 'Find prospects, research accounts, and personalize outreach.', { providerLabel: 'Interactive' }),
  seed('S&P Global', 'finance', 'Market Data', 'Query a range of S&P Global datasets.'),
  seed('Ahrefs', 'marketing', 'SEO', 'SEO and AI search analytics.'),
  seed('NetSuite', 'finance', 'ERP', 'Connect NetSuite data for analysis and insights.'),
  seed('Apollo.io', 'sales', 'Sales', 'Find buyers, book more meetings, and close more deals.'),
  seed('Webflow', 'content', 'CMS', 'Manage Webflow CMS, pages, assets and sites.'),
  seed('ZoomInfo', 'sales', 'Sales', 'Enrich contacts and accounts with GTM intelligence.'),
  seed('Cloudflare Developer Platform', 'dev', 'Cloud', 'Build applications with compute, storage, and AI.'),
  seed('Clinical Trials', 'research', 'Health Data', 'Access ClinicalTrials.gov data.'),
  seed('WordPress.com', 'content', 'CMS', 'Secure AI access to manage your WordPress.com sites.'),
  seed('PitchBook Premium', 'finance', 'Market Data', 'Bring PitchBook data into the way you work.'),
  seed('Airtable', 'productivity', 'Knowledge', 'Bring your structured data to AgentOS.'),
  seed('Smartsheet', 'project', 'Project Management', 'Analyze and manage Smartsheet data with AgentOS.'),
  seed('Scholar Gateway', 'research', 'Science', 'Enhance responses with scholarly research and citations.'),
  seed('Ramp', 'finance', 'Finance', 'Search, access, and analyze your Ramp financial data.'),
  seed('Make', 'automation', 'Automation', 'Run Make scenarios and manage your Make account.'),
  seed('Netlify', 'dev', 'Deployment', 'Create, deploy, manage, and secure websites on Netlify.'),
  seed('Snowflake', 'data', 'Data Platform', 'Retrieve both structured and unstructured data.'),
  seed('Docusign', 'contracts', 'Contracts', 'Intelligent, secure contract management by Docusign.'),
  seed('bioRxiv', 'research', 'Science', 'Access bioRxiv and medRxiv preprint data.'),
  seed('Glean', 'knowledge', 'Knowledge', 'Bring enterprise context to your AI tools.'),
  seed('PDF Viewer', 'local', 'Documents', 'Render PDFs from allowed URLs with an interactive viewer.', { providerLabel: 'Interactive', setup: 'local' }),
  seed('Google Cloud BigQuery', 'data', 'Data Platform', 'BigQuery analytical insights for agents.'),
  seed('FactSet AI-Ready Data', 'finance', 'Market Data', 'Access institutional-quality financial data and analytics.'),
  seed('GoDaddy', 'commerce', 'Web', 'Search domains and check availability.'),
  seed('Morningstar', 'finance', 'Market Data', 'Get up-to-date investment and market insights.'),
  seed('ICD-10 Codes', 'health', 'Health Data', 'Access ICD-10-CM and ICD-10-PCS code sets.'),
  seed('Hex', 'data', 'Analytics', 'Answer questions with the Hex agent.', { providerLabel: 'Interactive' }),
  seed('PostHog', 'analytics', 'Product Analytics', 'Query, analyze, and manage your PostHog insights.', { providerLabel: 'Interactive' }),
  seed('Play Sheet Music', 'media', 'Creative', 'Generate and play sheet music with a visual component.', { providerLabel: 'Interactive' }),
  seed('NPI Registry', 'health', 'Health Data', 'Access the US National Provider Identifier Registry.'),
  seed('Vibe Prospecting', 'sales', 'Sales', 'Power your chat with B2B data to create lead lists and research companies.'),
  seed('CMS Coverage', 'health', 'Health Data', 'Access the CMS Coverage Database.'),
  seed('Wix', 'content', 'CMS', 'Manage and build sites and apps on Wix.'),
  seed('Daloopa', 'finance', 'Market Data', 'Access financial fundamentals and KPIs with hyperlinks.'),
  seed('Databricks', 'data', 'Data Platform', 'Use Databricks with Unity Catalog and Mosaic AI.'),
  seed('Harvey', 'legal', 'Legal', 'Answer legal queries, search vaults, and research.'),
  seed('ChEMBL', 'research', 'Biology', 'Access the ChEMBL database.'),
  seed('Kiwi.com', 'travel', 'Travel', 'Search flights in AgentOS.'),
  seed('Klaviyo', 'marketing', 'Marketing', 'Report, strategize and create with real-time Klaviyo data.', { providerLabel: 'Interactive' }),
  seed('Postman', 'dev', 'APIs', 'Give API context to your coding agents.'),
  seed('Windsor.ai', 'marketing', 'Marketing', 'Connect 325+ marketing, analytics and CRM data sources.'),
  seed('Pendo', 'analytics', 'Product Analytics', 'Connect to Pendo for product and user insights.'),
  seed('AWS Marketplace', 'dev', 'Cloud', 'Discover, evaluate, and buy solutions for the cloud.'),
  seed('Open Targets', 'research', 'Biology', 'Drug target discovery and prioritization platform.'),
  seed('Similarweb', 'marketing', 'Market Intelligence', 'Get real-time web, mobile app, and market data.'),
  seed('PayPal', 'finance', 'Payments', 'Access the PayPal payments platform.'),
  seed('Mixpanel', 'analytics', 'Product Analytics', 'Analyze, query, and manage your Mixpanel data.', { providerLabel: 'New' }),
  seed('Crypto.com', 'finance', 'Crypto', 'Access real-time prices, orders, charts, and more for crypto.'),
  seed('Consensus', 'research', 'Science', 'Explore scientific research with Consensus.'),
  seed('Three.js 3D Viewer', 'design', 'Visualization', 'Render interactive 3D scenes and models using Three.js.', { providerLabel: 'Interactive' }),
  seed('BioRender', 'research', 'Biology', 'Search for and use scientific templates and icons.'),
  seed('Attio', 'sales', 'CRM', 'Search, manage, and update your Attio CRM.'),
  seed('Trivago', 'travel', 'Travel', 'Find your ideal hotel at the best price.'),
  seed('Guru', 'knowledge', 'Knowledge', 'Search and interact with your company knowledge.'),
  seed("Moody's", 'finance', 'Risk', 'Access risk insights, analytics, and decision intelligence.'),
  seed('Udemy Business', 'learning', 'Learning', 'Search and explore skill-building resources.'),
  seed('tldraw', 'design', 'Whiteboarding', 'Sketch, draw, and diagram collaboratively with AI.', { providerLabel: 'Trending' }),
  seed('Outreach', 'sales', 'Sales', 'Unleash your team performance with Outreach AI.'),
  seed('Jam', 'dev', 'Bug Reporting', 'Record screens and collect automatic context for issues.'),
  seed('Fellow.ai', 'productivity', 'Meetings', 'Chat with meetings to uncover actionable insights.'),
  seed('Crossbeam', 'sales', 'Partnerships', 'Explore partner data and ecosystem insights.'),
  seed('lastminute.com', 'travel', 'Travel', 'Search, compare and book flights, packages and hotels.'),
  seed('Synapse.org', 'research', 'Science', 'Search and inspect metadata for Synapse scientific data.'),
  seed('Bitly', 'marketing', 'Links', 'Shorten links, generate QR codes, and track performance.'),
  seed('Calendly', 'calendar', 'Scheduling', 'Manage event types, availability, and bookings.', { providerLabel: 'Trending' }),
  seed('Base44', 'dev', 'App Builder', 'Build and manage Base44 apps.'),
  seed('CData Connect AI', 'data', 'Integration', 'Managed MCP platform for hundreds of sources.'),
  seed('Circleback', 'productivity', 'Meetings', 'Search and access context from meetings.'),
  seed('Jotform', 'productivity', 'Forms', 'Create forms and analyze submissions inside AgentOS.'),
  seed('Omni Analytics', 'data', 'Analytics', 'Query your data using natural language through Omni.'),
  seed('Egnyte', 'storage', 'Files', 'Securely access and analyze Egnyte content.'),
  seed('MT Newswires', 'finance', 'Market Data', 'Trusted real-time global financial news provider.'),
  seed('Square', 'finance', 'Payments', 'Search and manage transaction, merchant, and payment data.'),
  seed('LSEG', 'finance', 'Market Data', 'Access data and analytics across a broad spectrum of asset classes.'),
  seed('Bigdata.com', 'finance', 'Market Data', 'Access real-time financial data.'),
  seed('Pylon', 'support', 'Support', 'Search and manage Pylon support issues.'),
  seed('Mercury', 'finance', 'Finance', 'Search, analyze and understand your finances on Mercury.'),
  seed('Supermetrics', 'marketing', 'Analytics', 'Analyze marketing performance across 200+ platforms.'),
  seed('Honeycomb', 'observability', 'Engineering', 'Query and explore observability data and SLOs.'),
  seed('Common Room', 'sales', 'GTM', 'Use Common Room as your GTM copilot.'),
  seed('Customer.io', 'marketing', 'Marketing', 'Explore customer data and generate insights.'),
  seed('Gusto', 'finance', 'HR', 'Query and analyze your Gusto data.', { providerLabel: 'Interactive' }),
  seed('Dice', 'jobs', 'Careers', 'Find active tech jobs on Dice.'),
  seed('Coupler.io', 'data', 'Integration', 'Connect business data from hundreds of sources.'),
  seed('Plaid Developer Tools', 'finance', 'Finance', 'Monitor, debug, and optimize your Plaid integration.'),
  seed('AirOps', 'marketing', 'Content', 'Craft content that wins AI search.'),
  seed('DevRev', 'support', 'Product', 'Search and update your company knowledge graph.'),
  seed('Pigment', 'data', 'Planning', 'Analyze business data with Pigment.'),
  seed('Learning Commons Knowledge Graph', 'learning', 'Education', 'Access K-12 standards, skills, and learning progressions.'),
  seed('Cloudinary', 'media', 'Media', 'Manage, transform and deliver your images and videos.'),
  seed('Workato', 'automation', 'Automation', 'Automate workflows and connect your business apps.'),
  seed('LunarCrush', 'finance', 'Crypto', 'Add real-time social media data to your searches.'),
  seed('Midpage Legal Research', 'legal', 'Legal', 'Conduct legal research and create work product.'),
  seed('Brex', 'finance', 'Finance', 'Use intelligent finance automation.', { providerLabel: 'Trending' }),
  seed('LegalZoom', 'legal', 'Legal', 'Get attorney guidance and tools for business and personal needs.'),
  seed('MailerLite', 'marketing', 'Email', 'Turn AgentOS into your email marketing assistant.'),
  seed('Tavily', 'research', 'Web Search', 'Connect your AI agents to the web.', { providerLabel: 'Trending' }),
  seed('Close', 'sales', 'CRM', 'Securely access and act on your sales data in Close.'),
  seed('PagerDuty', 'observability', 'Incident Response', 'Manage incidents, services and on-call schedules.'),
  seed('Craft', 'productivity', 'Notes', 'Use notes and a second brain inside Craft.', { providerLabel: 'New' }),
  seed('Candid', 'research', 'Nonprofits', 'Research nonprofits and funders using Candid data.'),
  seed('Magic Patterns', 'design', 'Product Design', 'Discuss and iterate on Magic Patterns designs.'),
  seed('Harmonic', 'sales', 'Company Research', 'Discover, research, and enrich companies and people.'),
  seed('MotherDuck', 'data', 'Data Platform', 'Get answers from your data.'),
  seed('Chronograph', 'data', 'Analytics', 'Interact with your Chronograph data directly.'),
  seed('ActiveCampaign', 'marketing', 'Marketing', 'Use autonomous marketing to transform how you work.'),
  seed('Aiera', 'finance', 'Market Data', 'Access live events, filings, company publications, and more.'),
  seed('Sanity', 'content', 'CMS', 'Create, query, and manage structured content in Sanity.'),
  seed('Mem', 'productivity', 'Notes', 'Use the AI notebook for everything on your mind.'),
  seed('Day AI', 'sales', 'CRM', 'Know everything about prospects and customers with CRMx.'),
  seed('Metaview', 'productivity', 'Recruiting', 'Use the AI platform for recruiting.'),
  seed('Krisp', 'productivity', 'Meetings', 'Add meetings context via transcripts and notes.', { providerLabel: 'New' }),
  seed('DirectBooker', 'travel', 'Hotels', 'Compare hotels and book direct.', { providerLabel: 'Trending' }),
  seed('Owkin', 'research', 'Biology', 'Interact with AI agents built for biology.'),
  seed('Medidata', 'research', 'Clinical Trials', 'Use clinical trial software and site ranking tools.'),
  seed('Yardi Virtuoso', 'real-estate', 'Real Estate', 'Access real-time Yardi data and insights.'),
  seed('Intuit TurboTax', 'finance', 'Tax', 'Estimate tax refunds and connect with live tax experts.', { providerLabel: 'Trending' }),
  seed('Blockscout', 'finance', 'Blockchain', 'Access and analyze blockchain data.'),
  seed('PlayMCP', 'dev', 'Tooling', 'Connect and use PlayMCP servers in your toolbox.'),
  seed('Aura', 'sales', 'Company Intelligence', 'Access company intelligence and workforce analytics.'),
  seed('Melon', 'media', 'Music', 'Browse music charts and personalized picks.'),
  seed('Clerk', 'dev', 'Auth', 'Add authentication, organizations, and billing.'),
  seed('Campfire', 'support', 'Support', 'Search, analyze, and export Campfire data.'),
  seed('Google Compute Engine', 'dev', 'Cloud', 'Use the MCP server for Google Compute Engine.'),
  seed('Razorpay', 'finance', 'Payments', 'Turn AgentOS into your Razorpay dashboard assistant.'),
  seed('Clarify', 'sales', 'CRM', 'Query your CRM, create records, and ask anything.'),
  seed('Local Falcon', 'marketing', 'Local SEO', 'Use AI visibility and local search intelligence.'),
  seed('Benevity', 'research', 'Nonprofits', 'Find and engage with verified nonprofits.'),
  seed('MSCI', 'finance', 'Risk', 'Turn data into insight with MSCI.'),
  seed('Stytch', 'dev', 'Auth', 'Manage your Stytch project.'),
  seed('Ticket Tailor', 'commerce', 'Tickets', 'Manage tickets, orders and events.'),
  seed('Port IO', 'dev', 'Operations', 'Search your context lake and safely run actions.'),
  seed('PlanetScale', 'dev', 'Database', 'Access Postgres and MySQL databases on PlanetScale.'),
  seed('Lumin', 'documents', 'Documents', 'Manage documents, send signature requests, and convert Markdown to PDF.'),
  seed('Quartr', 'finance', 'Market Data', 'Use financial data and AI infrastructure for company research.', { providerLabel: 'New' }),
  seed('Sprouts Data Intelligence', 'sales', 'Lead Gen', 'Go from query to qualified lead in seconds.'),
  seed('SignNow', 'contracts', 'Contracts', 'Automate eSignature workflows directly from AgentOS.'),
  seed('GraphOS MCP Tools', 'dev', 'APIs', 'Search Apollo docs, specs, and best practices.'),
  seed('LILT', 'productivity', 'Translation', 'Get high-quality translation with human verification.'),
  seed('Granted', 'finance', 'Grants', 'Discover every grant opportunity in existence.', { providerLabel: 'Trending' }),
  seed('G2', 'sales', 'Market Intelligence', 'Bring real buyer signals into AI workflows.', { providerLabel: 'New' }),
  seed('Airwallex Developer', 'finance', 'Payments', 'Integrate with the Airwallex platform.'),
  seed('Clarity AI', 'finance', 'ESG', 'Simulate fund classifications under proposed SFDR 2.0.'),
  seed('Benchling', 'research', 'Biology', 'Connect to R&D data, experiments, and notebooks.'),
  seed('Process Street', 'productivity', 'Operations', 'Explore and update your Process Street data.'),
  seed('Gainsight (Staircase AI)', 'support', 'Customer Success', 'Power AI workflows with customer context.', { providerLabel: 'New' }),
  seed('DocuSeal', 'contracts', 'Contracts', 'Sign, send and manage documents with DocuSeal.', { providerLabel: 'New' }),
  seed('Fever Event Discovery', 'travel', 'Events', 'Discover live entertainment events worldwide.', { providerLabel: 'Trending' }),
  seed('Intuit QuickBooks', 'finance', 'Finance', 'Keep business finances simple with QuickBooks.', { providerLabel: 'Interactive' }),
  seed('Tango', 'government', 'Government', 'Search US government contracting data.', { providerLabel: 'New' }),
  seed('Dremio Cloud', 'data', 'Data Platform', 'Analyze and get insights from your lakehouse data.'),
  seed('Jentic', 'dev', 'Integration', 'Use one connection to access all your tools securely.', { providerLabel: 'New' }),
  seed('pg-aiguide', 'dev', 'Documentation', 'Search Postgres and Tiger docs and learn database skills.', { providerLabel: 'New' }),
  seed('Intapp Celeste', 'legal', 'Legal', 'Securely and compliantly access Intapp Celeste products.'),
  seed('Aiwyn Tax', 'finance', 'Tax', 'Prepare federal and state tax returns accurately.', { providerLabel: 'New' }),
  seed('DataGrail', 'security', 'Privacy', 'Use secure AI orchestration for privacy workflows.'),
  seed('CB Insights', 'finance', 'Market Intelligence', 'Get predictive intelligence on private companies.', { providerLabel: 'New' }),
  seed('Starburst', 'data', 'Data Platform', 'Retrieve data from federated data sources securely.'),
  seed('Zoho Projects', 'project', 'Project Management', 'Automate tasks and projects with Zoho Projects.', { providerLabel: 'New' }),
  seed('Visier', 'analytics', 'People Analytics', 'Find people, productivity and business impact insights.'),
  seed('Amplitude', 'analytics', 'Product Analytics', 'Search, access, and get insights on your Amplitude data.', { providerLabel: 'Interactive' }),
  seed('Zoho Books', 'finance', 'Finance', 'Use Zoho Books for smart finance ops.', { providerLabel: 'New' }),
  seed('Zoho CRM', 'sales', 'CRM', 'Run Zoho CRM workflows from AgentOS.', { providerLabel: 'New' }),
  seed('Filesystem', 'local', 'Local Tools', 'Let AgentOS access your filesystem to read and write files.', { popularityRank: 3, setup: 'local' }),
  seed('Windows-MCP', 'local', 'Desktop', 'Enable AgentOS to interact with the Windows operating system.', { popularityRank: 4, setup: 'local' }),
  seed('pdf-viewer', 'local', 'Documents', 'Read, annotate, and interact with PDF files locally.', { popularityRank: 7, providerLabel: 'Interactive', setup: 'local' }),
  seed('Apify', 'automation', 'Web Data', 'Extract data from websites with scrapers, crawlers, and automations.', { popularityRank: 9 }),
  seed('Desktop Commander', 'local', 'Desktop', 'Build, explore, and automate on your local machine.', { setup: 'local' }),
  seed('Control Chrome', 'browser', 'Browser', 'Control Chrome tabs, windows, and navigation.', { setup: 'local' }),
  seed('PDF Tools - Fill, Analyze, Extract, View', 'local', 'Documents', 'Fill forms, analyze PDFs, extract data, and view them interactively.', { setup: 'local' }),
  seed('PowerPoint (By Anthropic)', 'local', 'Desktop', 'Control Microsoft PowerPoint with automation.', { providerLabel: 'Anthropic', setup: 'local' }),
  seed('Read and Send iMessages', 'local', 'Desktop', 'Send, read, and manage messages through Apple Messages.', { setup: 'local' }),
  seed('Word (By Anthropic)', 'local', 'Desktop', 'Control Microsoft Word with automation.', { providerLabel: 'Anthropic', setup: 'local' }),
  seed('Tableau', 'data', 'Analytics', 'Help agents see and understand data.'),
  seed('Read and Write Apple Notes', 'local', 'Desktop', 'Read, write, and manage notes in Apple Notes.', { setup: 'local' }),
  seed('Control your Mac', 'local', 'Desktop', 'Execute AppleScript to automate tasks on macOS.', { setup: 'local' }),
  seed('Spotify (AppleScript)', 'local', 'Desktop', 'Control Spotify via AppleScript.', { setup: 'local' }),
  seed('Massive Market Data', 'finance', 'Market Data', 'Access real-time and historical prices across many asset classes.'),
  seed('Kubernetes MCP Server', 'dev', 'Infrastructure', 'Interact with Kubernetes clusters via kubectl.'),
  seed('Kapture Browser Automation', 'browser', 'Browser', 'Control web browsers through Chrome DevTools.', { setup: 'local' }),
  seed('Socket', 'security', 'AppSec', 'Scan dependencies with Socket.'),
  seed('Postman MCP Server (Minimal)', 'dev', 'APIs', 'Connect your AI to Postman APIs with a minimal MCP server.'),
  seed('Drafts', 'productivity', 'Notes', 'Interact with the Drafts app on macOS.', { setup: 'local' }),
  seed('AWS API MCP Server', 'dev', 'Cloud', 'Manage AWS resources using AWS CLI commands.'),
  seed('Metabase', 'data', 'Analytics', 'Access Metabase analytics with optimized responses.'),
  seed('B12 Website Generator', 'content', 'Website Builder', 'Create a website in seconds with B12.'),
  seed('Enrichr MCP Server', 'research', 'Biology', 'Run gene set enrichment analysis with Enrichr.'),
  seed('Mailtrap', 'communication', 'Email', 'Send emails and manage templates with Mailtrap.'),
  seed('Microsoft Clarity', 'analytics', 'Web Analytics', 'Use the Microsoft Clarity MCP server.'),
  seed('ElevenLabs Player', 'media', 'Audio', 'Generate speech, sound effects and music with ElevenLabs.'),
  seed('Zscaler MCP Server', 'security', 'Security', 'Manage Zscaler Zero Trust Exchange services.'),
  seed('Cloudglue', 'media', 'Video', 'Analyze, search, and extract structured data from video collections.'),
  seed('Cloudinary Asset Management', 'media', 'Media', 'Use the Cloudinary asset management MCP server.'),
  seed('Shadcn UI', 'dev', 'Documentation', 'Access shadcn/ui components, demos, blocks, and metadata.'),
  seed('ElevenLabs Agents MCP App', 'ai', 'Audio AI', 'Create and manage ElevenLabs agents with an interactive UI.'),
  seed('Grafana MCP Server', 'observability', 'Engineering', 'Access Grafana dashboards, datasources, alerting, and more.'),
  seed('Growthbook', 'analytics', 'Experimentation', 'Interact with GrowthBook feature flags and experiments.'),
  seed('Docling MCP', 'documents', 'Documents', 'Process and analyze documents with Docling MCP.'),
  seed('ToolUniverse', 'research', 'Scientific Tools', 'Use an ecosystem of scientific tools inside AgentOS.'),
  seed('SAP Fiori MCP Server', 'dev', 'Enterprise Apps', 'Generate and adapt SAP Fiori applications with AI.'),
  seed('Android-MCP', 'local', 'Mobile', 'Use a lightweight MCP server for Android.', { setup: 'local' }),
  seed('PopHIVE Public Health Data', 'health', 'Health Data', 'Access near real-time public health data from PopHIVE dashboards.'),
  seed('SAPUI5 MCP Server', 'dev', 'Enterprise Apps', 'Create and validate SAPUI5 and OpenUI5 apps.'),
  seed('Fantastical', 'productivity', 'Calendar', 'Read, create, edit, and delete calendar items in Fantastical.', { setup: 'local' }),
  seed('MeetGeek', 'productivity', 'Meetings', 'Manage meetings, transcripts, highlights, and insights.'),
  seed('MCP Instana Server', 'observability', 'Engineering', 'Use Instana observability data inside AgentOS.'),
  seed('10x Genomics Cloud', 'research', 'Biology', 'Interact with 10x Genomics Cloud.'),
  seed('Braze MCP Server', 'marketing', 'Marketing', 'Use Braze REST API read-only endpoints.'),
  seed('Vendr Software Pricing Tools', 'finance', 'Procurement', 'Get software pricing insights from Vendr.'),
  seed('TomTom Maps MCP', 'maps', 'Geospatial', 'Use maps, routing, search, geocoding, and traffic from TomTom.'),
  seed('Tomba MCP Server', 'sales', 'Prospecting', 'Find and verify emails with Tomba.'),
  seed('PanOS MCP', 'security', 'Security', 'Manage Palo Alto Networks firewalls and Panorama.'),
  seed('KARP Inspector Lite', 'dev', 'Code Search', 'Search codebases by meaning, not just keywords.'),
  seed('SAP CAP MCP Server', 'dev', 'Enterprise Apps', 'Build SAP CAP projects with AI assistance.'),
  seed('Pathmode', 'dev', 'Planning', 'Connect AI agents to your intent layer.'),
  seed('SAP MDK MCP Server', 'dev', 'Enterprise Apps', 'Create, validate and deploy SAP MDK mobile apps.'),
  seed('SignWell', 'contracts', 'Contracts', 'Create, send, track, and manage e-signature workflows.'),
  seed('Minutes — Meeting Memory for AI', 'productivity', 'Meetings', 'Record, transcribe, search, and remember meetings and voice memos.', { setup: 'local' }),
  seed('Vybit Notifications', 'communication', 'Notifications', 'Send push notifications with personalized sounds.'),
  seed('Defense.com Threat Analysis', 'security', 'Security', 'View open threats, security issues, and team workload.'),
  seed('Jaz Accounting', 'finance', 'Accounting', 'Give AgentOS full access to Jaz accounting workflows.'),
  seed('Dynatrace MCP Server', 'observability', 'Engineering', 'Access Dynatrace logs, metrics, problems, and vulnerabilities.'),
  seed('Conviso MCP Server', 'security', 'Security', 'Expose Conviso platform data to MCP clients.'),
  seed('Miggo Public API MCP Server', 'security', 'AppSec', 'Query services, endpoints, vulnerabilities, findings, and dependencies from Miggo.'),
];

export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = Array.from(
  new Map(
    [...coreConnectorSeeds, ...expandedConnectorSeeds].map((seedValue) => {
      const connector = buildConnector(seedValue);
      return [connector.id, connector];
    }),
  ).values(),
);

export const getConnectorDefinition = (id: string) =>
  CONNECTOR_DEFINITIONS.find((connector) => connector.id === id) ?? null;

export const buildDefaultConnectors = (): ConnectorState[] =>
  CONNECTOR_DEFINITIONS.map((connector) => buildStateFromDefinition(connector));

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

export const getConnectorStateLabel = (connector: ConnectorState) => connector.statusLabel;
export const isConnectorReady = (connector: ConnectorState) => connector.connected;

export const mergeConnectorState = (connectors: ConnectorState[], nextState: ConnectorState) =>
  connectors.map((connector) => (connector.id === nextState.id ? nextState : connector));

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
          const definition = getConnectorDefinition(connector.id);
          const configured = hasConnectorCredentials(connector.id);
          if (!definition) {
            return {
              ...connector,
              configured,
              connected: configured,
              status: configured ? 'saved' : 'not_configured',
              statusLabel: STATUS_LABELS[configured ? 'saved' : 'not_configured'],
              statusDetail: configured ? 'Credentials are saved locally.' : 'No credentials or endpoint details saved yet.',
              lastCheckedAt: null,
            };
          }
          const savedStatus = saved?.status;
          const legacyStatus: ConnectorStatus =
            isConnectorStatus(savedStatus)
              ? savedStatus
              : saved?.connected
              ? definition.integrationMode === 'relay'
                ? 'ready_relay'
                : definition.integrationMode === 'local'
                ? 'ready_local'
                : 'verified'
              : configured
              ? 'saved'
              : 'not_configured';
          return {
            ...buildStateFromDefinition(definition, {
              configured,
              status: legacyStatus,
              connected: isReadyStatus(legacyStatus),
              statusLabel:
                typeof saved?.statusLabel === 'string' ? saved.statusLabel : STATUS_LABELS[legacyStatus],
              statusDetail:
                typeof saved?.statusDetail === 'string'
                  ? saved.statusDetail
                  : configured
                  ? getSavedStatusDetail(definition.integrationMode)
                  : 'No credentials or endpoint details saved yet.',
              lastCheckedAt: typeof saved?.lastCheckedAt === 'string' ? saved.lastCheckedAt : null,
            }),
          };
        });
      }
    }
  } catch {
    // Ignore invalid storage and rebuild from defaults.
  }

  return defaults.map((connector) => {
    const definition = getConnectorDefinition(connector.id);
    const configured = hasConnectorCredentials(connector.id);
    return definition
      ? buildStateFromDefinition(definition, { configured })
      : {
          ...connector,
          configured,
          connected: false,
          status: configured ? 'saved' : 'not_configured',
          statusLabel: STATUS_LABELS[configured ? 'saved' : 'not_configured'],
          statusDetail: configured ? 'Credentials are saved locally.' : 'No credentials or endpoint details saved yet.',
          lastCheckedAt: null,
        };
  });
};

export const saveConnectors = (connectors: ConnectorState[]) => {
  localStorage.setItem(CONNECTORS_STORAGE_KEY, JSON.stringify(connectors));
  emitConnectorsUpdated();
};
