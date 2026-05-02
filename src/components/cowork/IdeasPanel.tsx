import { useState } from 'react';
import { Lightbulb, Plus, Trash2 } from 'lucide-react';

interface Idea {
  id: string;
  content: string;
  createdAt: string;
}

const IdeasPanel = () => {
  const [ideas, setIdeas] = useState<Idea[]>([
    { id: '1', content: 'Ajouter un système de notifications en temps réel', createdAt: 'Il y a 1h' },
    { id: '2', content: 'Intégrer un éditeur de code collaboratif', createdAt: 'Hier' },
    { id: '3', content: 'Créer un tableau de bord analytique avec graphiques', createdAt: 'Il y a 2 jours' },
  ]);
  const [newIdea, setNewIdea] = useState('');

  const addIdea = () => {
    if (!newIdea.trim()) return;
    setIdeas(prev => [{ id: Date.now().toString(), content: newIdea, createdAt: "À l'instant" }, ...prev]);
    setNewIdea('');
  };

  const removeIdea = (id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="max-w-[680px] mx-auto">
      <h2 className="text-lg font-semibold text-foreground mb-6">Idées</h2>

      <div className="flex gap-2 mb-5">
        <input
          value={newIdea}
          onChange={(e) => setNewIdea(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addIdea()}
          placeholder="Capturez une idée..."
          className="flex-1 bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,20%)] rounded-lg px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button onClick={addIdea} className="px-3 py-2 rounded-lg bg-[hsl(14,74%,52%)] text-white text-xs font-medium hover:bg-[hsl(14,74%,42%)] transition-colors flex-shrink-0">
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {ideas.map((idea) => (
          <div key={idea.id} className="flex items-start gap-3 p-3 rounded-xl bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,18%)] group">
            <Lightbulb size={14} className="text-[hsl(45,80%,55%)] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/90 leading-relaxed">{idea.content}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{idea.createdAt}</p>
            </div>
            <button
              onClick={() => removeIdea(idea.id)}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {ideas.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune idée pour l'instant. Capturez vos premières idées ci-dessus !</p>
        )}
      </div>
    </div>
  );
};

export default IdeasPanel;
