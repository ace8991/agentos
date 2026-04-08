import { useState, useEffect } from 'react';
import { Download, Trash2, Check, Loader2, HardDrive, Globe, AlertTriangle, Cpu, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import {
  getAvailableWebLLMModels,
  isWebGPUSupported,
  loadWebLLMModel,
  unloadWebLLMModel,
  getCurrentLoadedModel,
  getBackendGGUFModels,
  type LocalModel,
  type BackendGGUFModel,
  type DownloadProgress,
} from '@/lib/local-inference';
import { toast } from '@/components/ui/sonner';

interface LocalModelManagerProps {
  onSelectModel?: (modelId: string) => void;
  onClose?: () => void;
}

const LocalModelManager = ({ onSelectModel, onClose }: LocalModelManagerProps) => {
  const [tab, setTab] = useState<'browser' | 'backend'>('browser');
  const [webllmModels, setWebllmModels] = useState<LocalModel[]>([]);
  const [backendModels] = useState<BackendGGUFModel[]>(getBackendGGUFModels());
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [loadedModel, setLoadedModel] = useState<string | null>(getCurrentLoadedModel());
  const [webgpuSupported] = useState(isWebGPUSupported());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setWebllmModels(getAvailableWebLLMModels());
  }, []);

  const handleDownloadWebLLM = async (modelId: string) => {
    if (downloadingId) return;
    setDownloadingId(modelId);
    setDownloadProgress(null);

    try {
      await loadWebLLMModel(modelId, (p) => {
        setDownloadProgress(p);
      });
      setLoadedModel(modelId);
      setWebllmModels(getAvailableWebLLMModels());
      toast.success('Modèle chargé avec succès');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec du chargement');
      setWebllmModels(getAvailableWebLLMModels());
    } finally {
      setDownloadingId(null);
      setDownloadProgress(null);
    }
  };

  const handleUnload = () => {
    unloadWebLLMModel();
    setLoadedModel(null);
    toast.success('Modèle déchargé');
  };

  const handleUseModel = (modelId: string, source: 'webllm' | 'backend') => {
    const prefixedId = source === 'webllm' ? `webllm/${modelId}` : `local/${modelId}`;
    onSelectModel?.(prefixedId);
    toast.success('Modèle sélectionné');
  };

  const filteredWebLLM = webllmModels.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBackend = backendModels.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.hfRepo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Cpu size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">Modèles locaux</h2>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-2">
          <button
            onClick={() => setTab('browser')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === 'browser' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Globe size={13} /> Navigateur (WebGPU)
          </button>
          <button
            onClick={() => setTab('backend')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === 'backend' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <HardDrive size={13} /> Backend (GGUF)
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un modèle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* WebGPU Warning */}
        {tab === 'browser' && !webgpuSupported && (
          <div className="mx-5 mb-2 flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <AlertTriangle size={15} className="text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive">
              WebGPU n'est pas supporté dans ce navigateur. Utilisez Chrome 113+ ou Edge 113+.
            </p>
          </div>
        )}

        {/* Model List */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          {tab === 'browser' && filteredWebLLM.map((model) => {
            const isLoaded = loadedModel === model.id;
            const isDownloading = downloadingId === model.id;

            return (
              <div
                key={model.id}
                className={`border rounded-xl p-3 transition-colors ${
                  isLoaded ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{model.name}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{model.size}</span>
                      {isLoaded && (
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-medium">Chargé</span>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === model.id ? null : model.id)}
                      className="text-[10px] text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-0.5"
                    >
                      {model.id}
                      {expandedId === model.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isLoaded ? (
                      <>
                        <button
                          onClick={() => handleUseModel(model.id, 'webllm')}
                          className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                        >
                          Utiliser
                        </button>
                        <button
                          onClick={handleUnload}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : isDownloading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">
                          {downloadProgress ? `${Math.round(downloadProgress.progress * 100)}%` : '...'}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownloadWebLLM(model.id)}
                        disabled={!webgpuSupported || !!downloadingId}
                        className="flex items-center gap-1.5 text-xs bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors disabled:opacity-40"
                      >
                        <Download size={13} /> Charger
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {isDownloading && downloadProgress && (
                  <div className="mt-2 space-y-1">
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.round(downloadProgress.progress * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{downloadProgress.text}</p>
                  </div>
                )}

                {/* Expanded details */}
                {expandedId === model.id && (
                  <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                    <p>Source: WebLLM (MLC AI)</p>
                    <p>Runtime: WebGPU in-browser</p>
                    <p>Caché dans IndexedDB après premier chargement</p>
                  </div>
                )}
              </div>
            );
          })}

          {tab === 'backend' && filteredBackend.map((model) => (
            <div
              key={model.id}
              className="border border-border bg-muted/30 rounded-xl p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{model.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{model.size}</span>
                    <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">GGUF</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{model.hfRepo}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{model.fileName}</p>
                </div>
                <button
                  onClick={() => handleUseModel(model.id, 'backend')}
                  className="flex items-center gap-1.5 text-xs bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors shrink-0"
                >
                  <Check size={13} /> Utiliser
                </button>
              </div>
            </div>
          ))}

          {((tab === 'browser' && filteredWebLLM.length === 0) || (tab === 'backend' && filteredBackend.length === 0)) && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aucun modèle trouvé
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/30">
          <p className="text-[10px] text-muted-foreground text-center">
            {tab === 'browser'
              ? 'Les modèles WebLLM tournent 100% dans le navigateur via WebGPU. Aucune donnée ne quitte votre appareil.'
              : 'Les modèles GGUF nécessitent le backend FastAPI avec llama-cpp-python installé.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LocalModelManager;
