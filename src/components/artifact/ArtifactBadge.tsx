import { Code2, ExternalLink } from 'lucide-react';
import { Artifact } from '@/types/artifact.types';
import { useArtifactStore } from '@/stores/artifactStore';
import { Button } from '@/components/ui/button';

interface ArtifactBadgeProps {
  artifact: Artifact;
}

export function ArtifactBadge({ artifact }: ArtifactBadgeProps) {
  const { setActiveArtifact, setPanelState, activeArtifactId, panelState } = useArtifactStore();
  
  const isActive = activeArtifactId === artifact.id && panelState !== 'hidden';

  const handleClick = () => {
    setActiveArtifact(artifact.id);
  };

  return (
    <div 
      className={`mt-2 flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-white/5 
        ${isActive ? 'bg-primary/10 border-primary/30' : 'bg-black/20 border-white/10'}`}
      onClick={handleClick}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/5">
        <Code2 className="h-5 w-5 text-emerald-400" />
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium text-white/90">
            {artifact.title}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 hover:opacity-100 shrink-0">
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
        <span className="text-xs text-white/50">
          Click to view {artifact.type === 'website' ? 'preview' : 'code'}
        </span>
      </div>
    </div>
  );
}
