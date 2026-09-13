/**
 * Agent tool catalog (frontend view).
 *
 * Declares every capability the agent can use, whether it needs the local
 * server, and whether it needs a provider key. The Tools panel renders this
 * list and persists the per-tool switches in this browser.
 */
export type ToolRequirement = 'online' | 'local' | 'key';

export interface AgentToolDescriptor {
  id: string;
  label: string;
  description: string;
  /** What the tool needs to be usable. */
  requires: ToolRequirement;
  /** Runtime capability key reported by /health available_tools, if any. */
  capabilityKey?: string;
  /** localStorage key of the API key this tool needs. */
  keyName?: string;
  destructive?: boolean;
}

export const AGENT_TOOLS: AgentToolDescriptor[] = [
  {
    id: 'web_search',
    label: 'Recherche web',
    description: 'Trouve des informations à jour et cite ses sources.',
    requires: 'key',
    capabilityKey: 'tavily',
    keyName: 'TAVILY_API_KEY',
  },
  {
    id: 'fetch_url',
    label: 'Lecture de page web',
    description: 'Ouvre une adresse précise et en extrait le texte.',
    requires: 'online',
  },
  {
    id: 'read_document',
    label: 'Lecture de documents',
    description: 'Comprend les PDF, images, tableurs et fichiers texte déposés dans le chat.',
    requires: 'online',
  },
  {
    id: 'generate_image',
    label: 'Génération d’images',
    description: 'Crée une image à partir d’une description, réutilisable comme artefact.',
    requires: 'key',
    keyName: 'OPENAI_API_KEY',
  },
  {
    id: 'run_code',
    label: 'Exécution de code',
    description: 'Lance un extrait Python ou JavaScript et affiche la sortie.',
    requires: 'local',
    capabilityKey: 'desktop_commander',
  },
  {
    id: 'str_replace_editor',
    label: 'Fichiers',
    description: 'Lit, crée et modifie des fichiers sur votre ordinateur.',
    requires: 'local',
    capabilityKey: 'desktop_commander',
    destructive: true,
  },
  {
    id: 'bash_tool',
    label: 'Terminal',
    description: 'Exécute des commandes système. Confirmation demandée avant toute action destructive.',
    requires: 'local',
    capabilityKey: 'desktop_commander',
    destructive: true,
  },
  {
    id: 'system_info',
    label: 'État de la machine',
    description: 'Processeur, mémoire, disque et processus en cours.',
    requires: 'local',
    capabilityKey: 'desktop_commander',
  },
  {
    id: 'computer_use',
    label: 'Contrôle de l’écran',
    description: 'Voit l’écran, clique et tape à votre place.',
    requires: 'local',
    capabilityKey: 'computer_use',
    destructive: true,
  },
];

const STORAGE_KEY = 'agentos_disabled_tools';

export function loadDisabledTools(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveDisabledTools(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore quota / privacy-mode failures.
  }
}

export function isToolEnabled(id: string): boolean {
  return !loadDisabledTools().includes(id);
}

export type ToolAvailability = 'available' | 'needs-local' | 'needs-key';

export function resolveToolAvailability(
  tool: AgentToolDescriptor,
  opts: { backendOnline: boolean; availableTools?: Record<string, unknown> | null },
): ToolAvailability {
  if (tool.requires === 'local') {
    if (!opts.backendOnline) return 'needs-local';
    if (tool.capabilityKey && opts.availableTools && !opts.availableTools[tool.capabilityKey]) {
      return 'needs-local';
    }
    return 'available';
  }
  if (tool.requires === 'key') {
    const fromBackend =
      tool.capabilityKey && opts.availableTools ? Boolean(opts.availableTools[tool.capabilityKey]) : false;
    const fromBrowser =
      typeof window !== 'undefined' && tool.keyName ? Boolean(window.localStorage.getItem(tool.keyName)) : false;
    return fromBackend || fromBrowser ? 'available' : 'needs-key';
  }
  return 'available';
}
