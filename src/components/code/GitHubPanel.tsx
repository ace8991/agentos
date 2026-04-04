import { useState } from 'react';
import { GitBranch, GitFork, GitPullRequest, Plus, RefreshCw, ExternalLink, Check, Clock, AlertCircle } from 'lucide-react';

interface Repo {
  name: string;
  owner: string;
  branch: string;
  lastSync: string;
  status: 'synced' | 'ahead' | 'behind';
}

const sampleRepos: Repo[] = [
  { name: 'eduayiti', owner: 'Alexis863', branch: 'main', lastSync: 'il y a 2 min', status: 'synced' },
  { name: 'agentos', owner: 'Alexis863', branch: 'dev', lastSync: 'il y a 1h', status: 'ahead' },
];

const GitHubPanel = () => {
  const [repos] = useState(sampleRepos);
  const [activeRepo, setActiveRepo] = useState(0);
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState('');

  const statusIcons = {
    synced: <Check size={12} className="text-success" />,
    ahead: <Clock size={12} className="text-accent" />,
    behind: <AlertCircle size={12} className="text-destructive" />,
  };

  const statusLabels = {
    synced: 'Synchronisé',
    ahead: '2 commits en avance',
    behind: '1 commit en retard',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-foreground">GitHub</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowNewRepo(!showNewRepo)} className="text-muted-foreground hover:text-foreground transition-colors">
            <Plus size={14} />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {showNewRepo && (
        <div className="px-3 py-2 border-b border-border bg-muted/20 space-y-2">
          <input
            value={newRepoUrl}
            onChange={(e) => setNewRepoUrl(e.target.value)}
            placeholder="https://github.com/user/repo"
            className="w-full bg-muted/30 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="flex gap-1.5">
            <button className="flex-1 px-2 py-1.5 text-[11px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Cloner
            </button>
            <button
              onClick={() => setShowNewRepo(false)}
              className="px-2 py-1.5 text-[11px] rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {repos.map((repo, i) => (
          <button
            key={repo.name}
            onClick={() => setActiveRepo(i)}
            className={`w-full text-left px-3 py-2.5 border-b border-border transition-colors ${
              activeRepo === i ? 'bg-primary/8' : 'hover:bg-muted/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <GitFork size={13} className="text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {repo.owner}/{repo.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <GitBranch size={10} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{repo.branch}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1">
                  {statusIcons[repo.status]}
                  <span className="text-[10px] text-muted-foreground">{statusLabels[repo.status]}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{repo.lastSync}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="border-t border-border px-3 py-2 space-y-1.5">
        <button className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-md transition-colors">
          <GitPullRequest size={13} />
          Créer une Pull Request
        </button>
        <button className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-md transition-colors">
          <ExternalLink size={13} />
          Ouvrir sur GitHub
        </button>
      </div>
    </div>
  );
};

export default GitHubPanel;
