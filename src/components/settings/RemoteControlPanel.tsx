import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bot, Check, RefreshCw, Shield, Smartphone, X } from 'lucide-react';
import {
  API_BASE_URL,
  approveRemoteCommand,
  getRemoteCommands,
  getRemoteConfig,
  rejectRemoteCommand,
  type RemoteCommand,
  type RemoteConfig,
} from '@/lib/api';
import { useStore } from '@/store/useStore';
import { toast } from '@/components/ui/sonner';

const AUTO_EXECUTE_KEY = 'REMOTE_AUTO_EXECUTE_LOCAL';

const RemoteControlPanel = () => {
  const backendHealth = useStore((s) => s.backendHealth);
  const [config, setConfig] = useState<RemoteConfig | null>(null);
  const [commands, setCommands] = useState<RemoteCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoExecute, setAutoExecute] = useState(localStorage.getItem(AUTO_EXECUTE_KEY) === 'true');

  const isLocalWorkspace = backendHealth?.mode === 'local';
  const inboundUrl = useMemo(() => `${API_BASE_URL}${config?.inbound_path || '/remote/commands/inbound'}`, [config?.inbound_path]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextConfig, nextCommands] = await Promise.all([
        getRemoteConfig(),
        getRemoteCommands(),
      ]);
      setConfig(nextConfig);
      setCommands(nextCommands);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load remote control state.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 8000);
    return () => window.clearInterval(interval);
  }, []);

  const setAutoExecuteLocal = (enabled: boolean) => {
    localStorage.setItem(AUTO_EXECUTE_KEY, String(enabled));
    setAutoExecute(enabled);
    toast.success(enabled ? 'Local auto-execution enabled' : 'Local auto-execution disabled');
  };

  const pending = commands.filter((command) => command.status === 'pending');
  const recent = commands.filter((command) => command.status !== 'pending').slice(0, 8);

  const handleApprove = async (commandId: string) => {
    await approveRemoteCommand(commandId, 'Approved from AgentOS settings');
    toast.success('Remote command approved');
    refresh();
  };

  const handleReject = async (commandId: string) => {
    await rejectRemoteCommand(commandId, 'Rejected from AgentOS settings');
    toast.success('Remote command rejected');
    refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-foreground">Remote Control</h3>
          <p className="text-xs text-muted-foreground">
            Receive secure remote commands from Telegram, WhatsApp, or a generic webhook relay, then approve or auto-run them on your local workspace.
          </p>
        </div>
        <button
          onClick={refresh}
          className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          title="Refresh remote control state"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatusCard
          icon={Shield}
          title="Security"
          value={config?.approval_required ? 'Approval required' : 'Direct approval off'}
          detail={config?.enabled ? 'Inbound channels are configured on the backend.' : 'Configure backend secrets before exposing remote ingress.'}
        />
        <StatusCard
          icon={Smartphone}
          title="Workspace mode"
          value={isLocalWorkspace ? 'Local execution available' : 'Cloud or offline mode'}
          detail={isLocalWorkspace ? 'This machine can execute approved remote tasks.' : 'Remote commands can be queued, but desktop execution needs local mode.'}
        />
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Automatic local execution</p>
            <p className="text-xs text-muted-foreground">
              When enabled, approved remote commands start automatically on this local workspace when it is idle.
            </p>
          </div>
          <Toggle checked={autoExecute} onChange={setAutoExecuteLocal} disabled={!isLocalWorkspace} />
        </div>
        {!isLocalWorkspace && (
          <p className="mt-2 text-[11px] text-warning">
            Enable this only on a local installation. Cloud mode intentionally does not expose desktop execution.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Inbound relay endpoint</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use this endpoint from your Telegram bot relay, WhatsApp webhook worker, Zapier, n8n, or any trusted gateway.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/60 p-3">
          <code className="break-all text-xs text-foreground">{inboundUrl}</code>
        </div>
        <div className="grid gap-2 md:grid-cols-3 text-xs">
          <ChannelBadge name="telegram" enabled={!!config?.configured_channels?.telegram} />
          <ChannelBadge name="whatsapp" enabled={!!config?.configured_channels?.whatsapp} />
          <ChannelBadge name="webhook" enabled={!!config?.configured_channels?.webhook} />
        </div>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground whitespace-pre-wrap">
{`POST ${inboundUrl}
{
  "channel": "telegram",
  "secret": "<REMOTE_TELEGRAM_SECRET>",
  "sender": "@owner",
  "text": "Open the admin website and export today's report"
}`}
        </pre>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Pending approvals</p>
            <p className="text-xs text-muted-foreground">Remote commands wait here before they can run locally.</p>
          </div>
          <span className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground">
            {pending.length} pending
          </span>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading remote command inbox...</p>
        ) : pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">No remote commands are waiting for approval.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((command) => (
              <CommandCard
                key={command.id}
                command={command}
                actions={
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(command.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2.5 py-1.5 text-[11px] text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <X size={12} />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(command.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Check size={12} />
                      Approve
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-foreground">Recent remote activity</p>
          <p className="text-xs text-muted-foreground">Audit trail for approved, claimed, completed, or rejected commands.</p>
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">No remote activity yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((command) => (
              <CommandCard key={command.id} command={command} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatusCard = ({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof Shield;
  title: string;
  value: string;
  detail: string;
}) => (
  <div className="rounded-xl border border-border bg-card/60 p-4">
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-elevated text-primary">
        <Icon size={15} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
  </div>
);

const ChannelBadge = ({ name, enabled }: { name: string; enabled: boolean }) => (
  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2">
    <span className="text-xs capitalize text-foreground">{name}</span>
    <span className={`text-[11px] ${enabled ? 'text-success' : 'text-muted-foreground'}`}>
      {enabled ? 'Configured' : 'Not set'}
    </span>
  </div>
);

const CommandCard = ({
  command,
  actions,
}: {
  command: RemoteCommand;
  actions?: ReactNode;
}) => (
  <div className="rounded-lg border border-border bg-muted/40 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-foreground">
            <Bot size={11} />
            {command.channel}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {command.sender || 'unknown sender'}
          </span>
          <span className={`text-[11px] ${
            command.status === 'completed'
              ? 'text-success'
              : command.status === 'rejected'
              ? 'text-destructive'
              : command.status === 'claimed'
              ? 'text-primary'
              : command.status === 'approved'
              ? 'text-accent'
              : 'text-muted-foreground'
          }`}>
            {command.status}
          </span>
        </div>
        <p className="mt-2 text-sm text-foreground">{command.text}</p>
        {command.note && <p className="mt-1 text-xs text-muted-foreground">{command.note}</p>}
      </div>
      {actions}
    </div>
  </div>
);

const Toggle = ({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative h-6 w-11 rounded-full transition-colors ${
      checked ? 'bg-primary' : 'bg-muted'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${
        checked ? 'left-5' : 'left-0.5'
      }`}
    />
  </button>
);

export default RemoteControlPanel;
