/**
 * Desktop Commander Settings Panel
 * Displayed inside SettingsModal > "Desktop Commander"
 */
import { useEffect, useState } from 'react';
import { Terminal, FolderOpen, Shield, RefreshCw, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { getDCConfig, type DCConfig } from '@/lib/desktop-commander';
import { API_BASE_URL } from '@/lib/api';

export function DesktopCommanderSettings() {
  const [config, setConfig] = useState<DCConfig | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowedDirsInput, setAllowedDirsInput] = useState('');
  const [blockedCommandsInput, setBlockedCommandsInput] = useState('');
  const [maxReadLines, setMaxReadLines] = useState(2000);
  const [maxWriteLines, setMaxWriteLines] = useState(2000);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const cfg = await getDCConfig();
      setConfig(cfg);
      setOnline(cfg.enabled !== false && cfg.ready !== false);
      setAllowedDirsInput(cfg.allowed_directories.join('\n'));
      setBlockedCommandsInput(cfg.blocked_commands.join('\n'));
      setMaxReadLines(cfg.max_read_lines);
      setMaxWriteLines(cfg.max_write_lines);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig() {
    const dirs = allowedDirsInput
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);
    const blockedCommands = blockedCommandsInput
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);

    try {
      const response = await fetch(`${API_BASE_URL}/desktop-commander/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowed_directories: dirs,
          blocked_commands: blockedCommands,
          max_read_lines: maxReadLines,
          max_write_lines: maxWriteLines,
        }),
      });
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        await loadConfig();
      }
    } catch {
      // Best-effort settings panel
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
          <Terminal size={16} /> Desktop Commander
        </h3>
        <p className="animate-pulse text-xs text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
          <Terminal size={16} /> Desktop Commander
        </h3>
        <button
          onClick={() => void loadConfig()}
          className="text-muted-foreground transition-colors hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
          online
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-400'
            : 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive'
        }`}
      >
        {online ? <CheckCircle size={14} /> : <XCircle size={14} />}
        {online
          ? `Service actif · v${config?.version ?? '?'}`
          : 'Service hors ligne — le backend est-il démarré ?'}
      </div>

      <p className="text-xs text-muted-foreground">
        Desktop Commander donne à l&apos;agent un accès local structuré aux fichiers, dossiers et commandes système,
        avec une configuration persistante inspirée du vrai Desktop Commander MCP.
      </p>

      {config && (
        <>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Home directory détecté</label>
            <code className="block rounded bg-muted px-2 py-1 text-xs text-foreground">{config.home}</code>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-0.5 text-[10px] text-muted-foreground">Plateforme</p>
              <p className="text-sm font-medium text-foreground">{config.platform ?? 'Unknown'}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-0.5 text-[10px] text-muted-foreground">Shell par défaut</p>
              <p className="text-sm font-medium text-foreground">{config.default_shell ?? 'powershell'}</p>
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <FolderOpen size={11} /> Répertoires autorisés (un par ligne)
            </label>
            <textarea
              value={allowedDirsInput}
              onChange={(e) => setAllowedDirsInput(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={`C:\\Users\\User\nC:\\Projects`}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Laisser vide = accès complet au système de fichiers local.
            </p>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Shield size={11} /> Commandes bloquées (une par ligne)
            </label>
            <textarea
              value={blockedCommandsInput}
              onChange={(e) => setBlockedCommandsInput(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={`format\nmount\nsudo`}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Ces commandes seront refusées par Desktop Commander avant exécution.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 text-[10px] text-muted-foreground">Limite lecture</p>
              <input
                type="number"
                min={100}
                max={10000}
                value={maxReadLines}
                onChange={(e) => setMaxReadLines(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 text-[10px] text-muted-foreground">Limite écriture</p>
              <input
                type="number"
                min={100}
                max={10000}
                value={maxWriteLines}
                onChange={(e) => setMaxWriteLines(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <button
            onClick={() => void handleSaveConfig()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90"
          >
            {saved ? '✓ Configuration sauvegardée' : 'Sauvegarder Desktop Commander'}
          </button>
        </>
      )}

      <div>
        <label className="mb-2 block text-xs text-muted-foreground">Endpoints API disponibles</label>
        <div className="space-y-1">
          {[
            ['POST', '/desktop-commander/read-file', 'Lire un fichier'],
            ['POST', '/desktop-commander/write-file', 'Écrire ou append un fichier'],
            ['POST', '/desktop-commander/edit-block', 'Modifier un bloc ciblé'],
            ['POST', '/desktop-commander/list-directory', 'Lister un dossier'],
            ['POST', '/desktop-commander/create-directory', 'Créer un dossier'],
            ['POST', '/desktop-commander/search-files', 'Rechercher des fichiers'],
            ['POST', '/desktop-commander/execute-command', 'Exécuter une commande'],
            ['GET', '/desktop-commander/config', 'Configuration persistante'],
          ].map(([method, path, desc]) => (
            <div key={path} className="flex items-center gap-2 text-xs">
              <span
                className={`rounded px-1 font-mono text-[10px] ${
                  method === 'GET'
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                }`}
              >
                {method}
              </span>
              <code className="font-mono text-muted-foreground">{path}</code>
              <span className="text-muted-foreground">— {desc}</span>
            </div>
          ))}
        </div>
        <a
          href={`${API_BASE_URL}/docs#/desktop-commander`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex w-fit items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink size={11} /> Ouvrir la doc Swagger
        </a>
      </div>
    </div>
  );
}
