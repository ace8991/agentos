import { useEffect, useState } from 'react';
import { Plus, Server, X, Loader2 } from 'lucide-react';
import {
  getMcpServers,
  createMcpServer,
  updateMcpServer,
  type MCPServerConfig,
  type MCPServerDraft,
} from '@/lib/api';
import { toast } from '@/components/ui/sonner';

const emptyDraft: MCPServerDraft = {
  name: '',
  description: '',
  family: 'custom',
  command: '',
  args: [],
  env: {},
  enabled: true,
};

export default function McpServersPanel() {
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<MCPServerDraft>(emptyDraft);
  const [argsText, setArgsText] = useState('');
  const [envText, setEnvText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMcpServers();
      setServers(res.servers ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setDraft(emptyDraft);
    setArgsText('');
    setEnvText('');
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!draft.name.trim() || !draft.command.trim()) {
      toast.error('Name and command are required');
      return;
    }
    const args = argsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const env: Record<string, string> = {};
    envText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const idx = line.indexOf('=');
        if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });

    setSubmitting(true);
    try {
      await createMcpServer({ ...draft, args, env });
      toast.success('MCP server added');
      resetForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add MCP server');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEnabled = async (server: MCPServerConfig) => {
    try {
      await updateMcpServer(server.id, { enabled: !server.enabled });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  return (
    <div className="space-y-3 mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-foreground flex items-center gap-2">
            <Server size={15} /> MCP Servers
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect external apps via Model Context Protocol.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 font-medium"
        >
          <Plus size={13} /> Add connector
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-surface-elevated/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">New MCP server</p>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Name (e.g. Notion)"
              className="text-xs px-2.5 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              value={draft.family}
              onChange={(e) => setDraft({ ...draft, family: e.target.value })}
              placeholder="Family (e.g. notion, custom)"
              className="text-xs px-2.5 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full text-xs px-2.5 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={draft.command}
            onChange={(e) => setDraft({ ...draft, command: e.target.value })}
            placeholder="Command (e.g. npx)"
            className="w-full text-xs px-2.5 py-2 rounded-md bg-background border border-border font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <textarea
            value={argsText}
            onChange={(e) => setArgsText(e.target.value)}
            placeholder="Args (one per line)&#10;-y&#10;@modelcontextprotocol/server-filesystem"
            rows={3}
            className="w-full text-xs px-2.5 py-2 rounded-md bg-background border border-border font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <textarea
            value={envText}
            onChange={(e) => setEnvText(e.target.value)}
            placeholder="Env vars (KEY=value, one per line)"
            rows={2}
            className="w-full text-xs px-2.5 py-2 rounded-md bg-background border border-border font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={resetForm}
              className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 font-medium"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Add server
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 px-3">
            <Loader2 size={12} className="animate-spin" /> Loading servers...
          </div>
        )}
        {!loading && servers.length === 0 && (
          <p className="text-xs text-muted-foreground py-3 px-3">No MCP servers configured yet.</p>
        )}
        {servers.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-elevated/50 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm text-foreground truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {s.transport} · {s.family} · {s.status}
              </p>
            </div>
            <button
              onClick={() => toggleEnabled(s)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                s.enabled
                  ? 'bg-success/15 text-success hover:bg-success/25'
                  : 'bg-surface-elevated text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
