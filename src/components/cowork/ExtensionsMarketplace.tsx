import { useState } from 'react';
import { Package, Download, Check, Star, Search, Filter, ExternalLink, Cpu, Globe, Database, Mail, FileText, Lock } from 'lucide-react';

interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  icon: typeof Package;
  installed: boolean;
  rating: number;
  downloads: string;
  category: string;
  tags: string[];
}

const extensions: Extension[] = [
  { id: 'desktop-commander', name: 'Desktop Commander', description: 'Contrôle complet du système : fichiers, processus, shell, clipboard', author: 'AgentOS', icon: Cpu, installed: true, rating: 4.8, downloads: '12.5k', category: 'system', tags: ['shell', 'filesystem', 'process'] },
  { id: 'web-search', name: 'Web Search', description: 'Recherche web via Tavily, Google, Bing avec résumés IA', author: 'AgentOS', icon: Globe, installed: true, rating: 4.6, downloads: '8.3k', category: 'search', tags: ['search', 'web', 'ai'] },
  { id: 'supabase', name: 'Supabase', description: 'Base de données PostgreSQL, auth et storage en temps réel', author: 'Supabase', icon: Database, installed: false, rating: 4.9, downloads: '25k', category: 'database', tags: ['postgres', 'auth', 'storage'] },
  { id: 'resend', name: 'Resend Email', description: 'API d\'envoi d\'emails transactionnels et marketing', author: 'Resend', icon: Mail, installed: false, rating: 4.5, downloads: '6.1k', category: 'communication', tags: ['email', 'api'] },
  { id: 'notion', name: 'Notion', description: 'Synchronisation avec vos pages, databases et wikis Notion', author: 'Notion Labs', icon: FileText, installed: false, rating: 4.7, downloads: '15k', category: 'productivity', tags: ['docs', 'wiki', 'database'] },
  { id: 'auth-manager', name: 'Auth Manager', description: 'Gestion avancée d\'authentification OAuth2, JWT, sessions', author: 'AgentOS', icon: Lock, installed: true, rating: 4.4, downloads: '9.2k', category: 'security', tags: ['auth', 'oauth', 'jwt'] },
];

const ExtensionsMarketplace = () => {
  const [items, setItems] = useState(extensions);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const toggleInstall = (id: string) => {
    setItems((prev) => prev.map((ext) => (ext.id === id ? { ...ext, installed: !ext.installed } : ext)));
  };

  const categories = ['all', ...Array.from(new Set(extensions.map((e) => e.category)))];

  const filtered = items.filter((ext) => {
    const matchSearch = !search || ext.name.toLowerCase().includes(search.toLowerCase()) || ext.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || ext.category === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="w-full max-w-[720px] mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Package size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Extensions</h2>
        <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          {items.filter((e) => e.installed).length} installées
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-1.5 rounded-lg bg-muted/30 border border-border px-3 py-2">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une extension..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
          <Filter size={14} />
        </button>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-thin pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 text-[11px] rounded-full whitespace-nowrap transition-colors ${
              filter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            {cat === 'all' ? 'Toutes' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid gap-2.5">
        {filtered.map((ext) => {
          const Icon = ext.icon;
          return (
            <div key={ext.id} className="rounded-xl border border-border bg-[hsl(var(--surface))] p-4 hover:bg-[hsl(var(--surface-elevated))] transition-colors">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{ext.name}</p>
                        <span className="text-[10px] text-muted-foreground">par {ext.author}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{ext.description}</p>
                    </div>
                    <button
                      onClick={() => toggleInstall(ext.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex-shrink-0 ${
                        ext.installed
                          ? 'bg-success/15 text-success'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {ext.installed ? <><Check size={12} /> Installé</> : <><Download size={12} /> Installer</>}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-0.5 text-[11px] text-accent">
                      <Star size={10} fill="currentColor" /> {ext.rating}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{ext.downloads} téléchargements</span>
                    <div className="flex gap-1">
                      {ext.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                    <button className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExtensionsMarketplace;
