/**
 * Desktop Commander Settings Panel
 * Affiché dans SettingsModal → section "Desktop Commander"
 */
import { useEffect, useState } from 'react';
import { Terminal, FolderOpen, Shield, RefreshCw, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { getDCConfig, checkDCHealth, type DCConfig } from '@/lib/desktop-commander';
import { API_BASE_URL } from '@/lib/api';

export function DesktopCommanderSettings() {
  const [config, setConfig] = useState<DCConfig | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowedDirsInput, setAllowedDirsInput] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const cfg = await getDCConfig();
      setConfig(cfg);
      setOnline(true);
      setAllowedDirsInput(cfg.allowed_directories.join('\n'));
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDirs() {
    const dirs = allowedDirsInput
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);
    try {
      const r = await fetch(`${API_BASE_URL}/desktop-commander/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_directories: dirs }),
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        await loadConfig();
      }
    } catch {
      // backend PATCH config endpoint — optionnel
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-medium text-foreground flex items-center gap-2">
          <Terminal size={16} /> Desktop Commander
        </h3>
        <p className="text-xs text-muted-foreground animate-pulse">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-foreground flex items-center gap-2">
          <Terminal size={16} /> Desktop Commander
        </h3>
        <button
          onClick={loadConfig}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
        online
          ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
          : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
      }`}>
        {online
          ? <CheckCircle size={14} />
          : <XCircle size={14} />}
        {online
          ? `Service actif · v${config?.version ?? '?'}`
          : 'Service hors ligne — le backend est-il démarré ?'}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground">
        Desktop Commander donne à l'agent la capacité de lire et écrire des fichiers sur ton PC,
        lister des répertoires, rechercher des fichiers et exécuter des commandes PowerShell en arrière-plan,
        exactement comme dans Claude.ai.
      </p>

      {config && (
        <>
          {/* Répertoire home */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Répertoire home détecté</label>
            <code className="text-xs bg-muted rounded px-2 py-1 text-foreground block">{config.home}</code>
          </div>

          {/* Répertoires autorisés */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
              <FolderOpen size={11} /> Répertoires autorisés (un par ligne)
            </label>
            <textarea
              value={allowedDirsInput}
              onChange={(e) => setAllowedDirsInput(e.target.value)}
              rows={4}
              className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="C:\Users\User&#10;C:\Projects"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Laisser vide = accès complet au système de fichiers.
            </p>
            <button
              onClick={handleSaveDirs}
              className="mt-2 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {saved ? '✓ Sauvegardé' : 'Sauvegarder les répertoires'}
            </button>
          </div>

          {/* Commandes bloquées */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
              <Shield size={11} /> Commandes bloquées
            </label>
            <div className="flex flex-wrap gap-1.5">
              {config.blocked_commands.map((cmd) => (
                <span
                  key={cmd}
                  className="text-[10px] bg-muted border border-border rounded px-1.5 py-0.5 font-mono text-muted-foreground"
                >
                  {cmd}
                </span>
              ))}
            </div>
          </div>

          {/* Limites */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Limite lecture</p>
              <p className="text-sm font-medium text-foreground">{config.max_read_lines} lignes</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Limite écriture</p>
              <p className="text-sm font-medium text-foreground">{config.max_write_lines} lignes</p>
            </div>
          </div>
        </>
      )}

      {/* Endpoints disponibles */}
      <div>
        <label className="text-xs text-muted-foreground block mb-2">Endpoints API disponibles</label>
        <div className="space-y-1">
          {[
            ['POST', '/desktop-commander/read-file', 'Lire un fichier'],
            ['POST', '/desktop-commander/write-file', 'Écrire un fichier'],
            ['POST', '/desktop-commander/edit-block', 'Éditer un bloc'],
            ['POST', '/desktop-commander/list-directory', 'Lister un répertoire'],
            ['POST', '/desktop-commander/search-files', 'Rechercher des fichiers'],
            ['POST', '/desktop-commander/execute-command', 'Exécuter une commande'],
            ['GET',  '/desktop-commander/config', 'Config & status'],
          ].map(([method, path, desc]) => (
            <div key={path} className="flex items-center gap-2 text-xs">
              <span className={`font-mono text-[10px] px-1 rounded ${method === 'GET' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                {method}
              </span>
              <code className="text-muted-foreground font-mono">{path}</code>
              <span className="text-muted-foreground">— {desc}</span>
            </div>
          ))}
        </div>
        <a
          href={`${API_BASE_URL}/docs#/desktop-commander`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 text-xs text-primary hover:underline flex items-center gap-1 w-fit"
        >
          <ExternalLink size={11} /> Ouvrir la doc Swagger
        </a>
      </div>
    </div>
  );
}
