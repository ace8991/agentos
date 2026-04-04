import { useState } from 'react';
import { Plug, Circle, CheckCircle2, AlertCircle, RefreshCw, Settings, ExternalLink, Plus, Search, Cpu, Terminal, Database, Globe, FileText, Wrench } from 'lucide-react';

interface MCPServer {
  id: string;
  name: string;
  description: string;
  icon: typeof Plug;
  status: 'connected' | 'disconnected' | 'error';
  tools: number;
  category: 'filesystem' | 'browser' | 'database' | 'api' | 'system';
}

const defaultServers: MCPServer[] = [
  { id: 'desktop-commander', name: 'Desktop Commander', description: 'Contrôle système local : fichiers, processus, terminal', icon: Terminal, status: 'connected', tools: 12, category: 'system' },
  { id: 'filesystem', name: 'Filesystem', description: 'Lecture/écriture de fichiers et dossiers', icon: FileText, status: 'connected', tools: 8, category: 'filesystem' },
  { id: 'browser', name: 'Puppeteer Browser', description: 'Automatisation du navigateur web', icon: Globe, status: 'disconnected', tools: 6, category: 'browser' },
  { id: 'postgres', name: 'PostgreSQL', description: 'Requêtes et gestion de base de données', icon: Database, status: 'disconnected', tools: 5, category: 'database' },
  { id: 'github', name: 'GitHub', description: 'Gestion de repos, issues, PRs', icon: Cpu, status: 'connected', tools: 15, category: 'api' },
  { id: 'notion', name: 'Notion', description: 'Accès aux pages et bases Notion', icon: FileText, status: 'disconnected', tools: 7, category: 'api' },
];

const statusConfig = {
  connected: { icon: CheckCircle2, color: 'text-success', label: 'Connecté' },
  disconnected: { icon: Circle, color: 'text-muted-foreground', label: 'Déconnecté' },
  error: { icon: AlertCircle, color: 'text-destructive', label: 'Erreur' },
};

const categoryIcons: Record<string, typeof Plug> = {
  filesystem: FileText,
  browser: Globe,
  database: Database,
  api: Cpu,
  system: Terminal,
};

const MCPPanel = () => {
  const [servers, setServers] = useState(defaultServers);
  const [search, setSearch] = useState('');
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  const toggleConnection = (id: string) => {
    setServers((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: (s.status === 'connected' ? 'disconnected' : 'connected') as MCPServer['status'] }
          : s
      )
    );
  };

  const filtered = servers.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase())
  );

  const connectedCount = servers.filter((s) => s.status === 'connected').length;
  const selected = servers.find((s) => s.id === selectedServer);

  return (
    <div className="w-full max-w-[720px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plug size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">MCP Servers</h2>
          <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {connectedCount}/{servers.length} connectés
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus size={12} /> Ajouter
          </button>
          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-xl border border-border bg-[hsl(var(--surface))] p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Ajoutez un serveur MCP par URL ou chemin local</p>
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="npx @modelcontextprotocol/server-filesystem ou http://localhost:3001"
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="flex gap-1.5 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs rounded-lg text-muted-foreground hover:text-foreground">
              Annuler
            </button>
            <button className="px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              Connecter
            </button>
          </div>
        </div>
      )}

      <div className="mb-3">
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/30 border border-border px-3 py-2">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un serveur MCP..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="grid gap-2">
        {filtered.map((server) => {
          const config = statusConfig[server.status];
          const StatusIcon = config.icon;
          const CatIcon = categoryIcons[server.category] || Wrench;
          const isSelected = selectedServer === server.id;

          return (
            <div key={server.id}>
              <button
                onClick={() => setSelectedServer(isSelected ? null : server.id)}
                className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                  isSelected ? 'border-primary/30 bg-primary/5' : 'border-border bg-[hsl(var(--surface))] hover:bg-[hsl(var(--surface-elevated))]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <CatIcon size={16} className="text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{server.name}</p>
                        <StatusIcon size={12} className={config.color} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{server.description}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">{server.tools} outils</span>
                </div>
              </button>

              {isSelected && selected && (
                <div className="mt-1 rounded-xl border border-border bg-[hsl(var(--surface))] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">Configuration</span>
                    <span className={`text-[11px] ${config.color}`}>{config.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/30 p-2.5">
                      <p className="text-muted-foreground mb-0.5">Outils disponibles</p>
                      <p className="text-foreground font-medium">{selected.tools}</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2.5">
                      <p className="text-muted-foreground mb-0.5">Catégorie</p>
                      <p className="text-foreground font-medium capitalize">{selected.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleConnection(server.id)}
                      className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors ${
                        server.status === 'connected'
                          ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                          : 'bg-success/15 text-success hover:bg-success/25'
                      }`}
                    >
                      {server.status === 'connected' ? 'Déconnecter' : 'Connecter'}
                    </button>
                    <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                      <Settings size={14} />
                    </button>
                    <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MCPPanel;
