import { useState, useEffect } from 'react';
import { FileText, Save, Check, RotateCcw } from 'lucide-react';

const STORAGE_KEY = 'agentos-claude-md';

const DEFAULT_CONTENT = `# CLAUDE.md — Mémoire de projet

## Stack technique
- Framework: React 18 + TypeScript 5
- Build: Vite 5
- Style: Tailwind CSS v3
- State: Zustand

## Conventions de code
- Composants fonctionnels uniquement
- Noms de fichiers en PascalCase pour les composants
- Utiliser des hooks personnalisés pour la logique réutilisable

## Instructions récurrentes
- Répondre en français
- Proposer des tests unitaires pour chaque nouvelle fonctionnalité
- Respecter le design system existant (tokens CSS sémantiques)

## Décisions d'architecture
- 
`;

const ClaudeMdEditor = () => {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setContent(stored ?? DEFAULT_CONTENT);
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setContent(DEFAULT_CONTENT);
    localStorage.setItem(STORAGE_KEY, DEFAULT_CONTENT);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(0,0%,17%)] bg-[hsl(0,0%,11%)]">
        <div className="flex items-center gap-1.5">
          <FileText size={13} className="text-primary-400" />
          <span className="text-xs font-medium text-foreground">CLAUDE.md</span>
          <span className="text-[10px] text-muted-foreground ml-1">Mémoire de projet</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Réinitialiser"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-primary-500/15 text-primary-400 hover:bg-primary-500/25 transition-colors"
          >
            {saved ? <Check size={11} /> : <Save size={11} />}
            {saved ? 'Sauvé' : 'Sauver'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault();
              handleSave();
            }
          }}
          className="w-full h-full bg-[hsl(0,0%,10%)] text-foreground/85 text-[12px] font-mono leading-5 resize-none outline-none p-3"
          spellCheck={false}
          placeholder="Décrivez votre projet, stack technique, conventions..."
        />
      </div>
    </div>
  );
};

export default ClaudeMdEditor;
