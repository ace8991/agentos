import { useState } from 'react';
import { Search, FileText, Clock } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  type: 'task' | 'project' | 'idea' | 'file';
  preview: string;
  date: string;
}

const mockResults: SearchResult[] = [
  { id: '1', title: 'Configurer Cowork', type: 'task', preview: 'Tâche initiale de configuration...', date: 'Il y a 2h' },
  { id: '2', title: 'Mon Application Web', type: 'project', preview: 'Application React avec dashboard', date: 'Hier' },
  { id: '3', title: 'Notifications en temps réel', type: 'idea', preview: 'Ajouter un système de notifications...', date: 'Il y a 2 jours' },
  { id: '4', title: 'ChatPanel.tsx', type: 'file', preview: 'src/components/ChatPanel.tsx', date: 'Il y a 3h' },
];

const typeLabels: Record<string, { label: string; color: string }> = {
  task: { label: 'Tâche', color: 'bg-[hsl(214,30%,24%)] text-[hsl(214,46%,63%)]' },
  project: { label: 'Projet', color: 'bg-[hsl(140,30%,24%)] text-[hsl(140,46%,63%)]' },
  idea: { label: 'Idée', color: 'bg-[hsl(45,30%,24%)] text-[hsl(45,60%,55%)]' },
  file: { label: 'Fichier', color: 'bg-[hsl(0,0%,20%)] text-muted-foreground' },
};

const SearchPanel = () => {
  const [query, setQuery] = useState('');
  const results = query.trim()
    ? mockResults.filter(r => r.title.toLowerCase().includes(query.toLowerCase()) || r.preview.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="max-w-[680px] mx-auto">
      <h2 className="text-lg font-semibold text-foreground mb-6">Rechercher</h2>

      <div className="flex items-center gap-2 rounded-xl border border-[hsl(0,0%,20%)] bg-[hsl(0,0%,14%)] px-4 py-3 mb-5">
        <Search size={15} className="text-muted-foreground flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher des tâches, projets, idées, fichiers..."
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </div>

      {query.trim() && (
        <div className="space-y-2">
          {results.length > 0 ? (
            results.map((r) => {
              const t = typeLabels[r.type];
              return (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,18%)] hover:bg-[hsl(0,0%,16%)] cursor-pointer transition-colors">
                  <FileText size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.color}`}>{t.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{r.preview}</p>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
                    <Clock size={10} />
                    <span className="text-[10px]">{r.date}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun résultat pour "{query}"</p>
          )}
        </div>
      )}

      {!query.trim() && (
        <div className="text-center py-10">
          <Search size={32} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Tapez pour rechercher dans vos tâches, projets et fichiers</p>
        </div>
      )}
    </div>
  );
};

export default SearchPanel;
