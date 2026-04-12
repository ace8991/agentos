import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Cpu,
  ExternalLink,
  FileText,
  Globe,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Terminal,
  Wrench,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { createMcpServer, updateMcpServer, type MCPServerConfig } from '@/lib/api';
import { useStore } from '@/store/useStore';

type ServerVisualStatus = 'connected' | 'disconnected' | 'error';

const statusConfig: Record<
  ServerVisualStatus,
  { icon: typeof CheckCircle2; color: string; label: string }
> = {
  connected: { icon: CheckCircle2, color: 'text-success', label: 'Ready' },
  disconnected: { icon: Circle, color: 'text-muted-foreground', label: 'Configured' },
  error: { icon: AlertCircle, color: 'text-destructive', label: 'Error' },
};

const familyIcons: Record<string, typeof Plug> = {
  filesystem: FileText,
  browser: Globe,
  database: Cpu,
  api: Cpu,
  system: Terminal,
  terminal: Terminal,
  desktop: Wrench,
  builder: Wrench,
  code: FileText,
  web_search: Globe,
  git: Cpu,
};

const toVisualStatus = (server: MCPServerConfig): ServerVisualStatus => {
  if (server.status === 'error') return 'error';
  if (server.ready) return 'connected';
  return 'disconnected';
};

const MCPPanel = () => {
  const mcpServers = useStore((state) => state.mcpServers);
  const capabilityStatus = useStore((state) => state.capabilityStatus);
  const syncMcpState = useStore((state) => state.syncMcpState);

  const [search, setSearch] = useState('');
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    family: 'filesystem',
    command: '',
    args: '',
  });

  useEffect(() => {
    void syncMcpState();
  }, [syncMcpState]);

  const filteredServers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return mcpServers;
    return mcpServers.filter((server) =>
      [server.name, server.description, server.family].some((field) =>
        field.toLowerCase().includes(normalized),
      ),
    );
  }, [mcpServers, search]);

  const selectedServer =
    filteredServers.find((server) => server.id === selectedServerId) ||
    mcpServers.find((server) => server.id === selectedServerId) ||
    null;

  const connectedCount = mcpServers.filter((server) => server.ready).length;

  const serverTools = useMemo(() => {
    if (!selectedServer) return [];
    return capabilityStatus.filter((tool) => tool.provider_id === selectedServer.id);
  }, [capabilityStatus, selectedServer]);

  const handleCreateServer = async () => {
    if (!draft.name.trim() || !draft.family.trim() || !draft.command.trim()) {
      toast.error('Name, family, and command are required.');
      return;
    }

    setSaving(true);
    try {
      await createMcpServer({
        name: draft.name.trim(),
        description: draft.description.trim(),
        family: draft.family.trim(),
        command: draft.command.trim(),
        args: draft.args
          .split(' ')
          .map((value) => value.trim())
          .filter(Boolean),
        enabled: true,
      });
      setDraft({ name: '', description: '', family: 'filesystem', command: '', args: '' });
      setShowAdd(false);
      toast.success('MCP server saved.');
      await syncMcpState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create MCP server.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleExternalServer = async (server: MCPServerConfig) => {
    if (server.kind === 'internal') return;
    try {
      await updateMcpServer(server.id, { enabled: !server.enabled });
      await syncMcpState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update MCP server.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">MCP Layer</h2>
          <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
            {connectedCount}/{mcpServers.length} ready
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAdd((value) => !value)}
            className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={12} />
            Add server
          </button>
          <button
            onClick={() => void syncMcpState()}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            title="Refresh MCP state"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-4 space-y-3 rounded-xl border border-border bg-[hsl(var(--surface))] p-4">
          <p className="text-xs text-muted-foreground">
            Register an external MCP server over stdio. Internal AgentOS providers are already available below.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Server name"
              className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <input
              value={draft.family}
              onChange={(event) => setDraft((current) => ({ ...current, family: event.target.value }))}
              placeholder="Family (filesystem, browser, ...)"
              className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <input
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Description"
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <input
              value={draft.command}
              onChange={(event) => setDraft((current) => ({ ...current, command: event.target.value }))}
              placeholder="Command (node, npx, python...)"
              className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <input
              value={draft.args}
              onChange={(event) => setDraft((current) => ({ ...current, args: event.target.value }))}
              placeholder="Args separated by spaces"
              className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleCreateServer()}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save server'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search MCP servers..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="grid gap-2">
        {filteredServers.map((server) => {
          const visualStatus = toVisualStatus(server);
          const status = statusConfig[visualStatus];
          const StatusIcon = status.icon;
          const FamilyIcon = familyIcons[server.family] || Wrench;
          const isSelected = selectedServerId === server.id;
          const toolsCount = capabilityStatus.filter((tool) => tool.provider_id === server.id).length;

          return (
            <div key={server.id}>
              <button
                onClick={() => setSelectedServerId(isSelected ? null : server.id)}
                className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                  isSelected
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-[hsl(var(--surface))] hover:bg-[hsl(var(--surface-elevated))]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                      <FamilyIcon size={16} className="text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{server.name}</p>
                        <StatusIcon size={12} className={status.color} />
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {server.kind}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {server.description || `${server.family} provider`}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{toolsCount} tools</span>
                </div>
              </button>

              {isSelected && selectedServer && (
                <div className="mt-1 space-y-3 rounded-xl border border-border bg-[hsl(var(--surface))] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">Server status</p>
                      <p className={`mt-1 text-[11px] ${status.color}`}>{status.label}</p>
                    </div>
                    {selectedServer.kind === 'mcp' ? (
                      <button
                        onClick={() => void handleToggleExternalServer(selectedServer)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedServer.enabled
                            ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                            : 'bg-success/15 text-success hover:bg-success/25'
                        }`}
                      >
                        {selectedServer.enabled ? 'Disable' : 'Enable'}
                      </button>
                    ) : (
                      <span className="rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                        Managed by AgentOS
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2 text-xs md:grid-cols-2">
                    <InfoCard label="Family" value={selectedServer.family} />
                    <InfoCard label="Transport" value={selectedServer.transport} />
                    <InfoCard label="Command" value={selectedServer.command || 'internal'} mono />
                    <InfoCard label="Updated" value={selectedServer.updated_at || 'runtime managed'} />
                  </div>

                  {serverTools.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Tools</p>
                      <div className="flex flex-wrap gap-2">
                        {serverTools.map((tool) => (
                          <span
                            key={`${tool.provider_id}-${tool.name}`}
                            className="rounded-full border border-border bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground"
                          >
                            {tool.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                      No tools registered yet for this provider.
                    </div>
                  )}

                  {selectedServer.command && (
                    <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">Launch command</p>
                        <a
                          href="#"
                          onClick={(event) => event.preventDefault()}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                        >
                          <ExternalLink size={11} />
                          stdio
                        </a>
                      </div>
                      <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                        {[selectedServer.command, ...selectedServer.args].filter(Boolean).join(' ')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const InfoCard = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="rounded-lg bg-muted/30 p-2.5">
    <p className="mb-0.5 text-muted-foreground">{label}</p>
    <p className={`font-medium text-foreground ${mono ? 'break-all font-mono text-[11px]' : ''}`}>{value}</p>
  </div>
);

export default MCPPanel;
