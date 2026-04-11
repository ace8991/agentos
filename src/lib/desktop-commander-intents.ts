import {
  executeCommand,
  getDCConfig,
  getSystemInfo,
  listDirectory,
  readFile,
  searchFiles,
  writeFile,
  type DCCommandResult,
  type DCFileResult,
  type DCListResult,
  type DCSearchResult,
  type DCSystemInfoResult,
  type DCWriteResult,
} from './desktop-commander';

type DesktopCommanderLogType = 'act' | 'file' | 'shell';

export interface DesktopCommanderIntentExecution {
  actionType: string;
  logType: DesktopCommanderLogType;
  action: string;
  reasoning: string;
  toolLabel: string;
  toolResult: Record<string, unknown>;
  resultMarkdown: string;
}

const WINDOWS_PATH_RE = /[A-Za-z]:[\\/][^\n"'<>|?*]+/;
const QUOTED_RE = /["“”']([^"“”']+)["“”']/;
const FILENAME_RE = /\b([\w.\- ]+\.[A-Za-z0-9]{1,8})\b/;
const SIMPLE_FILENAME_RE =
  /\b(?:fichier|file|document)\s+(?:nomme|nommé|called|name|intitule|intitulé)?\s*["“”']?([\w.\- ]{2,80})["“”']?\b/i;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const escapeMd = (value: string) => value.replace(/\|/g, '\\|');

const inferSpecialFolder = (text: string, home: string) => {
  const lowered = text.toLowerCase();
  if (/\b(desktop|bureau)\b/.test(lowered)) return `${home}/Desktop`;
  if (/\b(downloads|telechargements|téléchargements)\b/.test(lowered)) return `${home}/Downloads`;
  if (/\b(documents|document important|documents importants)\b/.test(lowered)) return `${home}/Documents`;
  return `${home}/Documents`;
};

const normalizePath = (path: string) => path.replace(/\\/g, '/');

const extractQuotedValue = (text: string) => QUOTED_RE.exec(text)?.[1]?.trim() || null;

const extractPathCandidate = (text: string, home: string) => {
  const explicitPath = WINDOWS_PATH_RE.exec(text)?.[0];
  if (explicitPath) {
    return normalizePath(explicitPath);
  }

  const quoted = extractQuotedValue(text);
  if (quoted && /[\\/]|^\w+\.\w+$/i.test(quoted)) {
    if (/^[A-Za-z]:[\\/]/.test(quoted)) {
      return normalizePath(quoted);
    }
    return `${inferSpecialFolder(text, home)}/${normalizePath(quoted).replace(/^\.\//, '')}`;
  }

  const filename = FILENAME_RE.exec(text)?.[1]?.trim();
  if (filename) {
    return `${inferSpecialFolder(text, home)}/${filename}`;
  }

  const namedFile = SIMPLE_FILENAME_RE.exec(text)?.[1]?.trim();
  if (namedFile) {
    const safeName = namedFile.replace(/[<>:"/\\|?*]+/g, '').trim();
    if (safeName) {
      const hasExtension = /\.[A-Za-z0-9]{1,8}$/.test(safeName);
      return `${inferSpecialFolder(text, home)}/${safeName}${hasExtension ? '' : '.txt'}`;
    }
  }

  return null;
};

const inferWriteContent = (text: string) => {
  const match = text.match(/(?:avec|with|contenu|content|qui contient|saying)\s+(.+)$/i);
  if (!match) return '';
  const raw = match[1].trim();
  const unwrapped = raw.replace(/^["“”']|["“”']$/g, '');
  return unwrapped;
};

const inferSearchQuery = (text: string) => {
  const lowered = text.toLowerCase();
  const stripped = lowered
    .replace(/[^\p{L}\p{N}.\-_ ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      (token) =>
        ![
          'cherche',
          'trouve',
          'find',
          'search',
          'read',
          'lire',
          'lis',
          'mon',
          'ma',
          'mes',
          'sur',
          'dans',
          'fichier',
          'fichiers',
          'file',
          'files',
          'pc',
          'ordinateur',
          'mon',
        ].includes(token),
    );

  return normalizeWhitespace(stripped.join(' ')) || 'document';
};

const isWriteIntent = (text: string) =>
  /\b(create|write|save|cree|crée|ecris|écris|fabrique)\b/i.test(text) &&
  /\b(file|fichier|document|txt|md|json|csv|log|note)\b/i.test(text);

const isReadIntent = (text: string) =>
  /\b(read|open|show|lire|lis|ouvre|affiche)\b/i.test(text) &&
  /\b(file|fichier|document|pdf|txt|md|json|csv|note)\b/i.test(text);

const isListIntent = (text: string) =>
  /\b(list|show files|contenu|liste|affiche)\b/i.test(text) &&
  /\b(directory|folder|dossier|repertoire|répertoire|documents|downloads|desktop|bureau)\b/i.test(text);

const isSearchIntent = (text: string) =>
  /\b(search|find|cherche|trouve|analyse|analyser)\b/i.test(text) &&
  !isWriteIntent(text) &&
  !isReadIntent(text) &&
  !isListIntent(text);

const isCommandIntent = (text: string) =>
  /\b(run command|execute command|commande|powershell|terminal|cmd|bash)\b/i.test(text);

const isSystemInfoIntent = (text: string) =>
  /\b(system info|info systeme|infos systeme|infos système|ram|ssd|cpu|processeur|processor|memory|memoire|mémoire|disk|storage|battery|batterie|pc|ordinateur)\b/i.test(
    text,
  );

const isDesktopCommanderCandidate = (text: string) =>
  isWriteIntent(text) ||
  isReadIntent(text) ||
  isListIntent(text) ||
  isSearchIntent(text) ||
  isCommandIntent(text) ||
  isSystemInfoIntent(text);

const buildMarkdown = (resume: string, resultat: string, details: string[], next: string) =>
  [
    '**Resume**',
    resume,
    '',
    '**Resultat**',
    resultat,
    '',
    '**Details**',
    ...(details.length > 0 ? details.map((detail) => `- ${escapeMd(detail)}`) : ['- Aucun detail supplementaire.']),
    '',
    '**Prochaine etape**',
    next,
  ].join('\n');

const createMissingPathResponse = (kind: string) =>
  buildMarkdown(
    `Je n’ai pas encore pu ${kind}.`,
    "La demande n’indiquait pas un chemin de fichier ou un nom de fichier assez précis pour exécuter Desktop Commander en sécurité.",
    ['Ajoutez un chemin complet ou au moins un nom de fichier clair, par exemple `C:/Users/User/Documents/test.txt`.'],
    'Indiquez le fichier exact à traiter.',
  );

export async function executeDesktopCommanderIntent(text: string): Promise<DesktopCommanderIntentExecution | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!isDesktopCommanderCandidate(trimmed)) return null;

  const config = await getDCConfig();
  const home = config.home || 'C:/Users/User';
  const inferredPath = extractPathCandidate(trimmed, home);
  const inferredFolder = inferSpecialFolder(trimmed, home);
  const inferredDirectoryPath =
    inferredPath && !/\.[A-Za-z0-9]{1,8}$/.test(inferredPath) ? inferredPath : null;

  if (isWriteIntent(trimmed)) {
    if (!inferredPath) {
      return {
        actionType: 'file_write',
        logType: 'file',
        action: 'Desktop Commander needs a target path',
        reasoning: 'The request asked to create or write a file, but no safe target path could be inferred.',
        toolLabel: 'Desktop Commander',
        toolResult: { success: false, description: 'Missing file path' },
        resultMarkdown: createMissingPathResponse('creer le fichier'),
      };
    }

    const content = inferWriteContent(trimmed);
    const result = (await writeFile(inferredPath, content)) as DCWriteResult;
    return {
      actionType: 'file_write',
      logType: 'file',
      action: result.description,
      reasoning: 'Desktop Commander wrote the requested file directly on the local machine.',
      toolLabel: 'Desktop Commander',
      toolResult: result as unknown as Record<string, unknown>,
      resultMarkdown: buildMarkdown(
        result.success ? 'Le fichier a été créé.' : 'La création du fichier a échoué.',
        result.success
          ? `Desktop Commander a créé ou écrasé le fichier \`${normalizePath(result.path)}\`.`
          : result.description,
        result.success
          ? [
              `Chemin: ${normalizePath(result.path)}`,
              `Octets écrits: ${result.bytes_written ?? 0}`,
            ]
          : [`Erreur: ${result.description}`],
        result.success ? 'Aucune.' : 'Donnez-moi un autre chemin ou ajustez les droits du dossier.',
      ),
    };
  }

  if (isReadIntent(trimmed)) {
    if (inferredPath) {
      const result = (await readFile(inferredPath)) as DCFileResult;
      const preview = result.content ? normalizeWhitespace(result.content).slice(0, 220) : '';
      return {
        actionType: 'file_read',
        logType: 'file',
        action: result.description,
        reasoning: 'Desktop Commander read the requested file directly from the local machine.',
        toolLabel: 'Desktop Commander',
        toolResult: result as unknown as Record<string, unknown>,
        resultMarkdown: buildMarkdown(
          result.success ? 'Le fichier a été lu.' : 'La lecture du fichier a échoué.',
          result.success
            ? `Desktop Commander a lu le fichier \`${normalizePath(result.path)}\`.`
            : result.description,
          result.success
          ? [
              `Chemin: ${normalizePath(result.path)}`,
              `Taille: ${result.size_bytes ?? 0} octets`,
              result.truncated ? 'Le contenu a été tronqué pour rester lisible.' : 'Le contenu complet a été chargé.',
              preview ? `Aperçu: ${preview}` : 'Aperçu: aucun contenu texte lisible',
            ]
          : [`Erreur: ${result.description}`],
          result.success
            ? result.content
              ? 'Je peux aussi résumer ou analyser son contenu.'
              : 'Je peux aussi essayer un autre fichier si besoin.'
            : 'Vérifiez le chemin ou donnez-moi un nom de fichier plus précis.',
        ),
      };
    }

    const query = inferSearchQuery(trimmed);
    const searchRoot = inferredDirectoryPath || inferredFolder;
    const searchResult = (await searchFiles(query, searchRoot, 5)) as DCSearchResult;
    const bestMatch = searchResult.success ? searchResult.results[0] : null;
    if (bestMatch?.path) {
      const result = (await readFile(bestMatch.path)) as DCFileResult;
      const preview = result.content ? normalizeWhitespace(result.content).slice(0, 220) : '';
      return {
        actionType: 'file_read',
        logType: 'file',
        action: result.description,
        reasoning: 'Desktop Commander searched locally, found the best matching file, and read it.',
        toolLabel: 'Desktop Commander',
        toolResult: {
          ...(result as unknown as Record<string, unknown>),
          search_query: query,
        },
        resultMarkdown: buildMarkdown(
          result.success ? 'Le fichier demandé a été retrouvé et lu.' : 'Le fichier a été trouvé mais la lecture a échoué.',
          result.success
            ? `Desktop Commander a d’abord recherché \`${query}\`, puis a lu \`${normalizePath(result.path)}\`.`
            : result.description,
          result.success
            ? [
                `Recherche: ${query}`,
                `Chemin: ${normalizePath(result.path)}`,
                `Taille: ${result.size_bytes ?? 0} octets`,
                preview ? `Aperçu: ${preview}` : 'Aperçu: aucun contenu texte lisible',
              ]
            : [`Erreur: ${result.description}`],
          result.success ? 'Je peux maintenant résumer ou analyser ce fichier.' : 'Je peux essayer un autre résultat si vous voulez.',
        ),
      };
    }

    return {
      actionType: 'file_read',
      logType: 'file',
      action: 'Desktop Commander needs a target file',
      reasoning: 'The request asked to read a file, but no file path or filename could be inferred safely.',
      toolLabel: 'Desktop Commander',
      toolResult: { success: false, description: 'Missing file path' },
      resultMarkdown: createMissingPathResponse('lire le fichier'),
    };
  }

  if (isListIntent(trimmed)) {
    const result = (await listDirectory(inferredDirectoryPath || inferredFolder)) as DCListResult;
    return {
      actionType: 'dir_list',
      logType: 'file',
      action: result.description,
      reasoning: 'Desktop Commander listed the local directory directly.',
      toolLabel: 'Desktop Commander',
      toolResult: result as unknown as Record<string, unknown>,
      resultMarkdown: buildMarkdown(
        result.success ? 'Le dossier a été listé.' : 'Le listing du dossier a échoué.',
        result.success
          ? `Desktop Commander a listé \`${normalizePath(result.path)}\`.`
          : result.description,
        result.success
          ? [
              `Chemin: ${normalizePath(result.path)}`,
              `Éléments trouvés: ${result.total}`,
            ]
          : [`Erreur: ${result.description}`],
        result.success ? 'Je peux maintenant ouvrir un fichier précis de ce dossier.' : 'Donnez-moi un autre dossier à inspecter.',
      ),
    };
  }

  if (isSearchIntent(trimmed)) {
    const query = inferSearchQuery(trimmed);
    const searchRoot = inferredDirectoryPath || inferredFolder;
    const result = (await searchFiles(query, searchRoot, 8)) as DCSearchResult;
    return {
      actionType: 'file_search',
      logType: 'file',
      action: result.description,
      reasoning: 'Desktop Commander searched the local filesystem for matching files.',
      toolLabel: 'Desktop Commander',
      toolResult: result as unknown as Record<string, unknown>,
      resultMarkdown: buildMarkdown(
        result.success ? 'La recherche locale est terminée.' : 'La recherche locale a échoué.',
        result.success
          ? `Desktop Commander a recherché \`${query}\` dans \`${normalizePath(searchRoot)}\`.`
          : result.description,
        result.success
          ? [
              `Chemin de recherche: ${normalizePath(searchRoot)}`,
              `Résultats: ${result.results.length}`,
              ...(result.results.slice(0, 3).map((entry) => `Trouvé: ${normalizePath(entry.path)}`)),
            ]
          : [`Erreur: ${result.description}`],
        result.success && result.results.length > 0
          ? 'Je peux maintenant ouvrir un des fichiers trouvés.'
          : 'Donnez-moi un nom plus précis si vous voulez relancer la recherche.',
      ),
    };
  }

  if (isCommandIntent(trimmed)) {
    const command = extractQuotedValue(trimmed) || trimmed.replace(/^(run command|execute command|commande|powershell|cmd|bash)\s*:?/i, '').trim();
    if (!command) return null;
    const result = (await executeCommand(command)) as DCCommandResult;
    return {
      actionType: 'shell',
      logType: 'shell',
      action: result.description,
      reasoning: 'Desktop Commander executed the requested local command.',
      toolLabel: 'Desktop Commander',
      toolResult: result as unknown as Record<string, unknown>,
      resultMarkdown: buildMarkdown(
        result.success ? 'La commande a été exécutée.' : 'La commande a échoué.',
        result.success
          ? `Desktop Commander a exécuté la commande locale demandée.`
          : result.description,
        [
          `Commande: ${command}`,
          `Sortie standard: ${normalizeWhitespace(result.stdout || '').slice(0, 140) || 'Aucune'}`,
          result.stderr ? `Erreur standard: ${normalizeWhitespace(result.stderr).slice(0, 140)}` : 'Erreur standard: Aucune',
        ],
        result.success ? 'Je peux maintenant exploiter cette sortie si vous voulez.' : 'Je peux reformuler la commande et réessayer.',
      ),
    };
  }

  if (isSystemInfoIntent(trimmed)) {
    const result = (await getSystemInfo()) as DCSystemInfoResult;
    return {
      actionType: 'system_info',
      logType: 'act',
      action: result.description,
      reasoning: 'Desktop Commander collected local system information from the machine.',
      toolLabel: 'Desktop Commander',
      toolResult: result as unknown as Record<string, unknown>,
      resultMarkdown: buildMarkdown(
        result.success ? 'Les informations système ont été récupérées.' : 'La lecture des informations système a échoué.',
        result.success
          ? `Desktop Commander a récupéré l’état actuel de votre machine \`${result.hostname}\`.`
          : result.description,
        result.success
          ? [
              `OS: ${result.os}`,
              `CPU: ${result.cpu_count} cœurs • ${result.cpu_percent}%`,
              `RAM utilisée: ${result.memory_used_gb} / ${result.memory_total_gb} Go (${result.memory_percent}%)`,
              `Disque libre: ${result.disk_free_gb} / ${result.disk_total_gb} Go`,
            ]
          : [`Erreur: ${result.description}`],
        result.success ? 'Je peux aussi détailler RAM, disque ou processus si vous voulez.' : 'Je peux réessayer avec une autre méthode si besoin.',
      ),
    };
  }

  return null;
}
