import {
  AlertTriangle,
  BookText,
  Bot,
  CheckCircle2,
  FolderOpen,
  Globe,
  HardDriveDownload,
  KeyRound,
  LockKeyhole,
  Monitor,
  Puzzle,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wrench,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const quickStartSteps = [
  {
    title: 'Open the app and choose a session mode',
    body:
      'Use a local account for full persistence, or continue as Guest if you want to enter the workspace immediately without creating a profile.',
    icon: LockKeyhole,
  },
  {
    title: 'Launch the backend locally',
    body:
      'From the backend folder, create or activate the virtual environment, install requirements, then start FastAPI with the local runtime so health checks, models, auth, downloads, connectors, and automations all work.',
    icon: Monitor,
  },
  {
    title: 'Save your settings once',
    body:
      'Open Settings and use Save all settings after entering API keys, local model endpoints, browser preferences, or connector credentials so the runtime sync can push them into the backend.',
    icon: Wrench,
  },
  {
    title: 'Work from the main workspace',
    body:
      'Use the main composer for research, browser tasks, terminal work, code generation, artifacts, and project context. AgentOS automatically routes the request to the right execution path.',
    icon: Bot,
  },
];

const configurationBlocks = [
  {
    title: 'Authentication and local data',
    icon: LockKeyhole,
    points: [
      'Authentication is local-only: FastAPI + SQLite + JWT, with no external identity provider.',
      'The local database is stored in backend/users.db and is ignored by git.',
      'Guest mode lets you enter the app even if the backend is offline.',
      'Use the profile block in the sidebar to see the active account and sign out.',
    ],
  },
  {
    title: 'Models and API keys',
    icon: KeyRound,
    points: [
      'Configure providers in Settings → API Keys. AgentOS supports Anthropic, OpenAI, DeepSeek, Google, Mistral, Groq, Ollama, and LM Studio.',
      'Web research uses Tavily when the key is present and synced to the backend.',
      'Local models remain available through Ollama or LM Studio even without cloud keys.',
      'Reasoning effort is available for compatible models and is persisted locally.',
    ],
  },
  {
    title: 'Browser, terminal, and desktop controls',
    icon: Globe,
    points: [
      'Browser tasks run through the in-app live browser flow when the backend local runtime and Playwright are available.',
      'Terminal commands run through the backend executor and use PowerShell on Windows.',
      'Desktop control uses PyAutoGUI and the computer-use configuration in Settings → Browser & System.',
      'Cloud browser remains optional and can be enabled separately when you want a remote browser target.',
    ],
  },
  {
    title: 'Artifacts and previews',
    icon: Sparkles,
    points: [
      'Generated artifacts can open inside the advanced workspace viewer for HTML, app previews, markdown, code, CSV, slides, and external assets.',
      'Artifacts are designed to stay readable inside the product instead of forcing downloads first.',
      'Use the workspace when you want to inspect generated code, a landing page, a deck outline, or a mini app preview.',
    ],
  },
  {
    title: 'Connectors and automation',
    icon: Puzzle,
    points: [
      'Connectors store local configuration and can be validated through the backend when native support exists.',
      'Remote control, webhook integrations, and scheduled automations are all managed from Settings.',
      'Telegram, WhatsApp, GitHub, Canva, Notion, Google Drive, and many more can be configured from the connectors catalog.',
    ],
  },
];

const troubleshooting = [
  {
    title: 'Backend shows offline',
    detail:
      'Start the backend first. The frontend expects the local API at the current machine hostname on port 8000 unless VITE_API_BASE_URL overrides it.',
  },
  {
    title: 'Web navigation does not start',
    detail:
      'Verify Settings → Browser & System, make sure Playwright is installed, and confirm the backend health panel reports browser support as ready.',
  },
  {
    title: 'Desktop control is unavailable',
    detail:
      'Enable PyAutoGUI and check that local mode is active. Some flows also require a configured computer-use provider and model.',
  },
  {
    title: 'Model requests fail',
    detail:
      'Re-save API keys in Settings and confirm the provider is configured. GPT-5 style models use the backend runtime, so stale local settings can cause mismatches until saved again.',
  },
  {
    title: 'Download local workspace fails',
    detail:
      'The backend must be running because the zip is generated on demand by the workspace download route.',
  },
];

const DocumentationGuide = () => {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-sky-100">
          <BookText size={13} />
          Product documentation
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">AgentOS Pro documentation</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            This guide explains how to launch, configure, and operate the full local workspace step by step:
            authentication, backend runtime, models, browser automation, terminal execution, desktop control,
            artifacts, connectors, downloads, and troubleshooting.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/40 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <h4 className="text-sm font-medium text-foreground">Current local runtime target</h4>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <InfoTile
            label="Frontend API base"
            value={API_BASE_URL}
            description="The frontend uses this base URL for health, auth, chat, models, runtime sync, and downloads."
          />
          <InfoTile
            label="Primary backend folder"
            value="backend/"
            description="Start the backend from this folder so auth, browser, terminal, connectors, and downloads are available."
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-300" />
          <h4 className="text-sm font-medium text-foreground">Quick start, step by step</h4>
        </div>
        <div className="space-y-3">
          {quickStartSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="flex gap-4 rounded-2xl border border-border bg-card/30 px-4 py-4">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <Icon size={16} />
                  </div>
                  {index < quickStartSteps.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Step {index + 1}: {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench size={16} className="text-amber-300" />
          <h4 className="text-sm font-medium text-foreground">Core configuration areas</h4>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {configurationBlocks.map((block) => {
            const Icon = block.icon;
            return (
              <div key={block.title} className="rounded-2xl border border-border bg-card/30 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.04] text-white/80">
                    <Icon size={16} />
                  </div>
                  <p className="text-sm font-medium text-foreground">{block.title}</p>
                </div>
                <div className="mt-3 space-y-2">
                  {block.points.map((point) => (
                    <div key={point} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <p className="text-sm leading-6 text-muted-foreground">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TerminalSquare size={16} className="text-cyan-300" />
          <h4 className="text-sm font-medium text-foreground">Recommended local startup sequence</h4>
        </div>
        <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-4">
          <CodeBlock
            title="1. Start the backend"
            code={[
              'cd backend',
              'python -m venv .venv',
              '.venv\\Scripts\\activate',
              'pip install -r requirements.txt',
              'playwright install chromium',
              'python run.py',
            ].join('\n')}
          />
          <CodeBlock
            title="2. Start the frontend"
            code={[
              'cd ..',
              'npm install',
              'npm run dev',
            ].join('\n')}
          />
          <CodeBlock
            title="3. Open the workspace"
            code={[
              'Frontend: http://127.0.0.1:8080',
              'Backend health: http://127.0.0.1:8000/health',
            ].join('\n')}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-fuchsia-300" />
          <h4 className="text-sm font-medium text-foreground">What the workspace can do</h4>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CapabilityTile
            icon={Globe}
            title="Web and live browser"
            body="Open sites in the in-app live browser flow, stream the session, and return a final answer in the chat."
          />
          <CapabilityTile
            icon={TerminalSquare}
            title="Terminal and local apps"
            body="Run PowerShell commands, inspect files, launch local apps, and use installed WSL distributions from the agent."
          />
          <CapabilityTile
            icon={Bot}
            title="Desktop control"
            body="Use PyAutoGUI and computer-use routing when local desktop automation is enabled and supported."
          />
          <CapabilityTile
            icon={Puzzle}
            title="Connectors and tools"
            body="Enrich workflows with GitHub, Canva, Google Drive, Notion, Telegram, WhatsApp, and other connected services."
          />
          <CapabilityTile
            icon={Sparkles}
            title="Artifacts and previews"
            body="Inspect generated HTML, markdown, slides, code, CSV, and external assets inside the artifact workspace."
          />
          <CapabilityTile
            icon={HardDriveDownload}
            title="Local download"
            body="Download the full workspace as a zip package from the sidebar when the backend is available."
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-300" />
          <h4 className="text-sm font-medium text-foreground">Operational notes</h4>
        </div>
        <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-3">
          <Callout
            icon={CheckCircle2}
            tone="success"
            title="Runs locally by default"
            body="The main architecture is local-first. Auth, settings, models, browser automation, and downloads are designed to work on the same machine whenever possible."
          />
          <Callout
            icon={AlertTriangle}
            tone="warning"
            title="Some features require a running backend"
            body="Auth, downloads, live browser, terminal execution, and connector validation depend on the backend runtime. If the backend is offline, the frontend can still open in guest mode, but some capabilities will be limited."
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-300" />
          <h4 className="text-sm font-medium text-foreground">Troubleshooting guide</h4>
        </div>
        <div className="space-y-3">
          {troubleshooting.map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-card/30 px-4 py-4">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const InfoTile = ({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) => (
  <div className="rounded-2xl border border-border bg-card/30 px-4 py-4">
    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    <p className="mt-2 break-all font-mono text-sm text-foreground">{value}</p>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
);

const CodeBlock = ({ title, code }: { title: string; code: string }) => (
  <div className="rounded-2xl border border-border bg-[rgba(12,15,24,0.72)] overflow-hidden">
    <div className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">{title}</div>
    <pre className="overflow-x-auto px-4 py-4 text-xs leading-6 text-muted-foreground font-mono">
      <code>{code}</code>
    </pre>
  </div>
);

const CapabilityTile = ({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Globe;
  title: string;
  body: string;
}) => (
  <div className="rounded-2xl border border-border bg-card/30 p-4">
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] text-white/80">
      <Icon size={16} />
    </div>
    <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
  </div>
);

const Callout = ({
  icon: Icon,
  tone,
  title,
  body,
}: {
  icon: typeof CheckCircle2;
  tone: 'success' | 'warning';
  title: string;
  body: string;
}) => (
  <div
    className={`rounded-2xl border px-4 py-4 ${
      tone === 'success'
        ? 'border-emerald-400/18 bg-emerald-500/8'
        : 'border-amber-400/18 bg-amber-500/8'
    }`}
  >
    <div className="flex items-start gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
          tone === 'success'
            ? 'bg-emerald-500/14 text-emerald-200'
            : 'bg-amber-500/14 text-amber-200'
        }`}
      >
        <Icon size={16} />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
    </div>
  </div>
);

export default DocumentationGuide;
