import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ChevronRight, FileSearch, Filter, Layers3, Search, Sparkles, X } from 'lucide-react';
import type { Artifact, ArtifactType, WorkspaceView } from '@/lib/artifacts';
import ArtifactPreviewPanel from './ArtifactPreviewPanel';

interface ArtifactWorkspaceModalProps {
  open: boolean;
  artifacts: Artifact[];
  initialView?: WorkspaceView;
  onClose: () => void;
}

type ArtifactFilter = 'all' | 'apps' | 'docs' | 'slides' | 'code' | 'media';

const filterMap: Record<ArtifactFilter, ArtifactType[]> = {
  all: [],
  apps: ['app', 'html', 'webpage'],
  docs: ['document', 'markdown', 'pdf'],
  slides: ['slides'],
  code: ['code', 'terminal', 'csv'],
  media: ['image'],
};

const ArtifactWorkspaceModal = ({ open, artifacts, initialView = 'preview', onClose }: ArtifactWorkspaceModalProps) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ArtifactFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(artifacts[0]?.id ?? null);
  const deferredQuery = useDeferredValue(query);

  const filteredArtifacts = useMemo(() => {
    const loweredQuery = deferredQuery.trim().toLowerCase();
    const allowedTypes = filterMap[filter];

    return artifacts.filter((artifact) => {
      const matchesFilter = filter === 'all' || allowedTypes.includes(artifact.type);
      const matchesQuery =
        !loweredQuery ||
        artifact.title.toLowerCase().includes(loweredQuery) ||
        artifact.type.toLowerCase().includes(loweredQuery) ||
        (artifact.sourceLabel || '').toLowerCase().includes(loweredQuery);

      return matchesFilter && matchesQuery;
    });
  }, [artifacts, deferredQuery, filter]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!selectedId || !filteredArtifacts.some((artifact) => artifact.id === selectedId)) {
      setSelectedId(filteredArtifacts[0]?.id ?? null);
    }
  }, [filteredArtifacts, open, selectedId]);

  const selectedArtifact = useMemo(
    () => filteredArtifacts.find((artifact) => artifact.id === selectedId) ?? filteredArtifacts[0] ?? null,
    [filteredArtifacts, selectedId],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[57] bg-black/58 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="absolute inset-y-3 right-3 flex w-[min(78vw,1440px)] min-w-[980px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,#252f35_0%,#171a1f_42%,#111317_100%)] text-white shadow-2xl md:inset-y-4 md:right-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 pb-4 pt-5 md:px-8 md:pt-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70">
              Artifact Workspace
            </div>
            <h2 className="mt-3 text-2xl md:text-4xl font-semibold tracking-tight">Generated assets</h2>
            <p className="mt-2 text-sm text-white/70">
              Review files, code, documents, slide decks, and live previews generated during the conversation.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                {artifacts.length} artifact{artifacts.length === 1 ? '' : 's'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                HTML, docs, slides, apps, code
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                Workspace preview engine
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-white/60 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-4 md:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search artifacts, file names, sources"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-11 py-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-sky-300/25"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/65">
                <Filter size={12} />
                Filter
              </div>
              {(['all', 'apps', 'docs', 'slides', 'code', 'media'] as ArtifactFilter[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                    filter === item
                      ? 'border-sky-300/18 bg-sky-400/10 text-sky-100'
                      : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  {item === 'all' ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="shrink-0 overflow-y-auto border-b border-white/10 lg:w-[330px] lg:border-b-0 lg:border-r">
            <div className="space-y-2 p-4 md:p-5">
              {filteredArtifacts.map((artifact) => (
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
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/45">
                        {artifact.sourceLabel || 'Conversation artifact'}
                      </p>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <Layers3 size={15} className="text-white/75" />
                    </div>
                  </div>
                </button>
              ))}
              {filteredArtifacts.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-white/45">
                  <FileSearch className="mx-auto mb-3" size={24} />
                  <p className="text-sm font-medium text-white/70">No artifacts match this view</p>
                  <p className="mt-2 text-xs leading-relaxed">
                    Try a different filter or search term to explore the workspace.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            {selectedArtifact ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/14 bg-sky-400/8 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-100/78">
                      <Sparkles size={11} />
                      Advanced preview workspace
                    </div>
                    <h3 className="mt-2 text-lg font-medium truncate">{selectedArtifact.title}</h3>
                    <p className="text-sm text-white/60 truncate">
                      {selectedArtifact.sourceLabel || selectedArtifact.type}
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 lg:inline-flex">
                    Workspace
                    <ChevronRight size={12} />
                    {initialView}
                  </div>
                </div>
                <ArtifactPreviewPanel artifact={selectedArtifact} artifacts={filteredArtifacts} initialView={initialView} />
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
