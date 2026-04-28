import { useEffect, useRef, useState } from 'react';
import { useDesktopCommander } from '@/hooks/use-desktop-commander';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FolderOpen, FileText, Terminal, RefreshCw,
  CheckCircle, XCircle, ChevronRight, Search,
  FolderPlus, Pencil, ArrowRight, Loader2,
} from 'lucide-react';

type ActiveTab = 'terminal' | 'files' | 'search';

export function DesktopCommanderPanel() {
  const dc = useDesktopCommander();
  const { checkHealth } = dc;
  const [tab, setTab] = useState<ActiveTab>('terminal');

  // Terminal state
  const [cmdInput, setCmdInput] = useState('');
  const [cmdShell, setCmdShell] = useState<'powershell' | 'cmd'>('powershell');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // File explorer state
  const [dirPath, setDirPath] = useState('C:\\Users\\User');
  const [dirEntries, setDirEntries] = useState<any[]>([]);  const [fileContent, setFileContent] = useState<{ path: string; content: string } | null>(null);

  // Search state
  const [searchPath, setSearchPath] = useState('C:\\Users\\User');
  const [searchPattern, setSearchPattern] = useState('*.ts');
  const [searchResults, setSearchResults] = useState<string[]>([]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dc.commandHistory]);

  // ─── Terminal ──────────────────────────────────────────────────────

  const handleRunCmd = async () => {
    if (!cmdInput.trim()) return;
    const cmd = cmdInput.trim();
    setCmdInput('');
    await dc.runCommand(cmd, { shell: cmdShell });
  };

  // ─── File explorer ─────────────────────────────────────────────────

  const handleListDir = async () => {
    const entries = await dc.list(dirPath, 1);
    if (entries) setDirEntries(entries);
  };

  const handleReadFile = async (path: string) => {
    const result = await dc.read(path);
    if (result?.success && result.content !== undefined) {
      setFileContent({ path, content: result.content });
    }
  };

  // ─── Search ────────────────────────────────────────────────────────

  const handleSearch = async () => {
    const result = await dc.search(searchPath, searchPattern);
    if (result?.results) setSearchResults(result.results.map(r => r.path));
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden text-sm">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-xs">Desktop Commander</span>
          {dc.status.checked && (
            dc.status.online
              ? <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] px-1.5 py-0">Online</Badge>
              : <Badge variant="outline" className="text-red-500 border-red-300 text-[10px] px-1.5 py-0">Offline</Badge>
          )}
        </div>
        <button
          onClick={dc.checkHealth}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Allowed dirs info */}
      {dc.status.config && (
        <div className="px-3 py-1.5 bg-muted/30 border-b text-[10px] text-muted-foreground truncate">
          Répertoires : {dc.status.config.allowed_directories.join(' · ')}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b">
        {(['terminal', 'files', 'search'] as ActiveTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-primary text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'terminal' ? '⌨ Terminal' : t === 'files' ? '📁 Fichiers' : '🔍 Recherche'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">

        {/* ── TERMINAL ── */}
        {tab === 'terminal' && (
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 p-2 font-mono">
              {dc.commandHistory.length === 0 && (
                <p className="text-muted-foreground text-[11px] p-2">
                  Exécute des commandes PowerShell ou CMD sur ton PC.
                </p>
              )}
              {[...dc.commandHistory].reverse().map((entry) => (
                <div key={entry.id} className="mb-3">
                  <div className="flex items-center gap-1 text-[11px] text-primary mb-0.5">
                    <ChevronRight className="w-3 h-3" />
                    <span className="font-medium">{entry.command}</span>
                    <span className="text-muted-foreground ml-auto">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {entry.result.stdout && (
                    <pre className="text-[10px] text-foreground whitespace-pre-wrap bg-muted/40 rounded px-2 py-1 max-h-40 overflow-y-auto">
                      {entry.result.stdout}
                    </pre>
                  )}
                  {entry.result.stderr && (
                    <pre className="text-[10px] text-red-500 whitespace-pre-wrap bg-red-50 dark:bg-red-950/20 rounded px-2 py-1 max-h-24 overflow-y-auto mt-0.5">
                      {entry.result.stderr}
                    </pre>
                  )}
                  {entry.result.timed_out && (
                    <span className="text-[10px] text-amber-500">Timeout</span>
                  )}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </ScrollArea>
            <div className="border-t p-2 flex gap-2">
              <select
                value={cmdShell}
                onChange={(e) => setCmdShell(e.target.value as any)}
                className="text-[11px] border rounded px-1 py-1 bg-background text-foreground"
              >
                <option value="powershell">PS</option>
                <option value="cmd">CMD</option>
              </select>
              <Input
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunCmd()}
                placeholder="commande..."
                className="h-7 text-xs font-mono flex-1"
                disabled={dc.loading || !dc.status.online}
              />
              <Button
                size="sm"
                onClick={handleRunCmd}
                disabled={dc.loading || !cmdInput.trim() || !dc.status.online}
                className="h-7 px-2"
              >
                {dc.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        )}

        {/* ── FILES ── */}
        {tab === 'files' && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b flex gap-2">
              <Input
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleListDir()}
                placeholder="Chemin..."
                className="h-7 text-xs flex-1"
              />
              <Button size="sm" onClick={handleListDir} disabled={dc.loading} className="h-7 px-2">
                <FolderOpen className="w-3 h-3" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {fileContent ? (
                <div className="p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => setFileContent(null)} className="text-[10px] text-primary hover:underline">← Retour</button>
                    <span className="text-[10px] text-muted-foreground truncate">{fileContent.path}</span>
                  </div>
                  <pre className="text-[10px] whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-[400px] overflow-y-auto">
                    {fileContent.content}
                  </pre>
                </div>
              ) : (
                <div className="p-1">
                  {dirEntries.length === 0 && (
                    <p className="text-muted-foreground text-[11px] p-2">Clique sur 📁 pour parcourir.</p>
                  )}
                  {dirEntries.map((entry) => (
                    <button
                      key={entry.name}
                      onClick={() => entry.type === 'file' ? handleReadFile(`${dirPath}\\${entry.name}`) : setDirPath(`${dirPath}\\${entry.name}`)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-muted/50 rounded text-xs"
                    >
                      {entry.type === 'directory'
                        ? <FolderOpen className="w-3 h-3 text-amber-500 shrink-0" />
                        : <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                      }
                      <span className="truncate">{entry.name}</span>
                      {entry.size_bytes != null && (
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          {entry.size_bytes > 1024 ? `${(entry.size_bytes / 1024).toFixed(1)}KB` : `${entry.size_bytes}B`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* ── SEARCH ── */}
        {tab === 'search' && (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b space-y-1.5">
              <Input
                value={searchPath}
                onChange={(e) => setSearchPath(e.target.value)}
                placeholder="Répertoire de recherche..."
                className="h-7 text-xs"
              />
              <div className="flex gap-2">
                <Input
                  value={searchPattern}
                  onChange={(e) => setSearchPattern(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Mot-clé (ex: App.tsx)"
                  className="h-7 text-xs flex-1"
                />
                <Button size="sm" onClick={handleSearch} disabled={dc.loading} className="h-7 px-2">
                  <Search className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-2">
              {searchResults.length === 0 && (
                <p className="text-muted-foreground text-[11px] p-1">Résultats ici.</p>
              )}
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { setDirPath(r.split('\\').slice(0, -1).join('\\')); setTab('files'); handleReadFile(r); }}
                  className="flex items-center gap-2 w-full text-left px-1 py-0.5 hover:bg-muted/50 rounded"
                >
                  <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                  <span className="text-[11px] truncate">{r}</span>
                </button>
              ))}
            </ScrollArea>
          </div>
        )}

      </div>

      {/* Error bar */}
      {dc.error && (
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/20 border-t text-[10px] text-red-600 flex items-center gap-1">
          <XCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">{dc.error}</span>
        </div>
      )}
    </div>
  );
}
