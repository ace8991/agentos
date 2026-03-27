import { useEffect, useMemo, useState } from 'react';
import { Download, Layers3, X } from 'lucide-react';
import ArtifactCard, { type Artifact } from './ArtifactCard';

interface ArtifactWorkspaceModalProps {
  open: boolean;
  artifacts: Artifact[];
  onClose: () => void;
}

const ArtifactWorkspaceModal = ({ open, artifacts, onClose }: ArtifactWorkspaceModalProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(artifacts[0]?.id ?? null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!selectedId || !artifacts.some((artifact) => artifact.id === selectedId)) {
      setSelectedId(artifacts[0]?.id ?? null);
    }
  }, [artifacts, open, selectedId]);

  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0] ?? null,
    [artifacts, selectedId],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[57] flex items-center justify-center bg-black/60 px-3 py-4" onClick={onClose}>
      <div
        className="w-full max-w-7xl max-h-[92vh] rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,#252f35_0%,#171a1f_42%,#111317_100%)] text-white overflow-hidden shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 md:px-8 pt-5 md:pt-7 pb-4 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70">
              Artifact Workspace
            </div>
            <h2 className="mt-3 text-2xl md:text-4xl font-semibold tracking-tight">Generated assets</h2>
            <p className="mt-2 text-sm text-white/70">
              Review files, code, documents, and previews generated during the conversation.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-white/60 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row min-h-0 max-h-[calc(92vh-110px)]">
          <div className="lg:w-[320px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 overflow-y-auto">
            <div className="p-4 md:p-5 space-y-2">
              {artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  onClick={() => setSelectedId(artifact.id)}
                  className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${
                    selectedArtifact?.id === artifact.id
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{artifact.title}</p>
                      <p className="text-xs text-white/55 mt-1 uppercase tracking-wide">
                        {artifact.type}
                      </p>
                    </div>
                    <div className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                      <Layers3 size={15} className="text-white/75" />
                    </div>
                  </div>
                  {artifact.sourceLabel && (
                    <p className="text-xs text-white/55 mt-2 truncate">{artifact.sourceLabel}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            {selectedArtifact ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-medium truncate">{selectedArtifact.title}</h3>
                    <p className="text-sm text-white/60 truncate">
                      {selectedArtifact.sourceLabel || selectedArtifact.type}
                    </p>
                  </div>
                  {selectedArtifact.filename && (
                    <span className="inline-flex items-center gap-1 text-xs text-white/70 border border-white/10 rounded-full px-3 py-1">
                      <Download size={12} />
                      {selectedArtifact.filename}
                    </span>
                  )}
                </div>
                <ArtifactCard artifact={selectedArtifact} />
              </div>
            ) : (
              <div className="h-full min-h-[280px] rounded-3xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-white/60">
                No artifacts yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtifactWorkspaceModal;
