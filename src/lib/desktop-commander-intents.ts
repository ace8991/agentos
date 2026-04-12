import {
  createDirectory,
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
const NAMED_TARGET_VERB_PART = '(?:nommer|nommee|nommees|nomme|called|name|intitulee|intitule)';
const SIMPLE_FILENAME_RE = new RegExp(
  `\\b(?:fichier|file|document|note)\\s+${NAMED_TARGET_VERB_PART}?\\s*["“”']?([\\w.\\- ]{2,80})["“”']?\\b`,
  'i',
);
const SIMPLE_FOLDER_RE = new RegExp(
  `\\b(?:folder|dossier|directory|repertoire)\\s+${NAMED_TARGET_VERB_PART}?\\s*["“”']?([\\w.\\- ]{2,80})["“”']?\\b`,
  'i',
);

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizePath = (value: string) => value.replace(/\\/g, '/');
const escapeMd = (value: string) => value.replace(/\|/g, '\\|');

const inferSpecialFolder = (text: string, home: string) => {
  const lowered = text.toLowerCase();
  if (/\b(desktop|bureau|ecran|écran|screen|home screen|windows screen)\b/.test(lowered)) {
    return `${home}/Desktop`;
  }
  if (/\b(downloads|telechargements|téléchargements)\b/.test(lowered)) {
    return `${home}/Downloads`;
  }
  if (/\b(documents|document important|documents importants)\b/.test(lowered)) {
    return `${home}/Documents`;
  }
  return `${home}/Documents`;
};

const extractQuotedValue = (text: string) => QUOTED_RE.exec(text)?.[1]?.trim() || null;

const sanitizeNamedTarget = (value: string) =>
  value
    .replace(
      /\s+(?:sur|dans|on|in|to|au|aux|inside|avec|with|contenu|content|qui contient|saying)\b.*$/i,
      '',
    )
    .replace(/[<>:"/\\|?*]+/g, '')
    .trim();

const inferWriteContent = (text: string) => {
  const match = text.match(/(?:avec|with|contenu|content|qui contient|saying)\s+(.+)$/i);
  if (!match) return '';
  return match[1].trim().replace(/^["“”']|["“”']$/g, '');
};

const extractFilePathCandidate = (text: string, home: string) => {
  const explicitPath = WINDOWS_PATH_RE.exec(text)?.[0];
  if (explicitPath) {
    return normalizePath(explicitPath);
  }

  const quoted = extractQuotedValue(text);
  if (quoted) {
    const cleaned = sanitizeNamedTarget(quoted);
    if (cleaned) {
      if (/^[A-Za-z]:[\\/]/.test(cleaned)) {
        return normalizePath(cleaned);
      }
      return `${inferSpecialFolder(text, home)}/${normalizePath(cleaned).replace(/^\.\//, '')}`;
    }
  }

  const explicitFilename = FILENAME_RE.exec(text)?.[1]?.trim();
  if (explicitFilename) {
    return `${inferSpecialFolder(text, home)}/${explicitFilename}`;
  }

  const namedFile = SIMPLE_FILENAME_RE.exec(text)?.[1]?.trim();
  if (namedFile) {
    const safeName = sanitizeNamedTarget(namedFile);
    if (safeName) {
      const hasExtension = /\.[A-Za-z0-9]{1,8}$/.test(safeName);
      return `${inferSpecialFolder(text, home)}/${safeName}${hasExtension ? '' : '.txt'}`;
    }
  }

  return null;
};

const extractDirectoryPathCandidate = (text: string, home: string) => {
  const explicitPath = WINDOWS_PATH_RE.exec(text)?.[0];
  if (explicitPath) {
    return normalizePath(explicitPath);
  }

  const quoted = extractQuotedValue(text);
  if (quoted) {
    const cleaned = sanitizeNamedTarget(quoted);
    if (cleaned) {
      if (/^[A-Za-z]:[\\/]/.test(cleaned)) {
        return normalizePath(cleaned);
      }
      return `${inferSpecialFolder(text, home)}/${normalizePath(cleaned).replace(/^\.\//, '')}`;
    }
  }

  const namedFolder = SIMPLE_FOLDER_RE.exec(text)?.[1]?.trim();
  if (namedFolder) {
    const safeName = sanitizeNamedTarget(namedFolder);
    if (safeName) {
      return `${inferSpecialFolder(text, home)}/${safeName}`;
    }
  }

  return null;
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
          'show',
          'open',
          'ouvre',
          'affiche',
          'mon',
          'ma',
          'mes',
          'sur',
          'dans',
          'fichier',
          'fichiers',
          'folder',
          'dossier',
          'file',
          'files',
          'pc',
          'ordinateur',
          'desktop',
          'bureau',
        ].includes(token),
    );

  return normalizeWhitespace(stripped.join(' ')) || 'document';
};

const isWriteIntent = (text: string) =>
  /\b(create|write|save|cree|crée|ecris|écris|fabrique)\b/i.test(text) &&
  !/\b(folder|dossier|directory|repertoire)\b/i.test(text) &&
  /\b(file|fichier|document|txt|md|json|csv|log|note)\b/i.test(text);

const isCreateDirectoryIntent = (text: string) =>
  /\b(create|make|cree|crée|fabrique)\b/i.test(text) &&
  /\b(folder|dossier|directory|repertoire)\b/i.test(text);

const isReadIntent = (text: string) =>
  /\b(read|open|show|lire|lis|ouvre|affiche)\b/i.test(text) &&
  /\b(file|fichier|document|pdf|txt|md|json|csv|note)\b/i.test(text);

const isListIntent = (text: string) =>
  /\b(list|show files|contenu|liste|affiche)\b/i.test(text) &&
  /\b(directory|folder|dossier|repertoire|documents|downloads|desktop|bureau)\b/i.test(text);

const isSearchIntent = (text: string) =>
  /\b(search|find|cherche|trouve|analyse|analyser)\b/i.test(text) &&
  !isWriteIntent(text) &&
  !isReadIntent(text) &&
  !isListIntent(text) &&
  !isCreateDirectoryIntent(text);

const isCommandIntent = (text: string) =>
  /\b(run command|execute command|commande|powershell|terminal|cmd|bash)\b/i.test(text);

const isSystemInfoIntent = (text: string) =>
  /\b(system info|info systeme|infos systeme|infos système|ram|ssd|cpu|processeur|processor|memory|memoire|mémoire|disk|storage|battery|batterie|pc|ordinateur)\b/i.test(
    text,
  );

const isDesktopCommanderCandidate = (text: string) =>
  isCreateDirectoryIntent(text) ||
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

const createMissingPathResponse = (actionLabel: string) =>
  buildMarkdown(
    `Je n'ai pas encore pu ${actionLabel}.`,
    "La demande n'indiquait pas un chemin ou un nom de fichier assez precis pour lancer Desktop Commander en securite.",
    ['Ajoutez un chemin complet ou un nom de fichier explicite, par exemple `C:/Users/User/Documents/test.txt`.'],
    'Indiquez le fichier ou le dossier exact a traiter.',
  );

export async function executeDesktopCommanderIntent(
  text: string,
): Promise<DesktopCommanderIntentExecution | null> {
  const trimmed = text.trim();
  if (!trimmed || !isDesktopCommanderCandidate(trimmed)) {
    return null;
  }

  const config = await getDCConfig();
  const home = config.home || 'C:/Users/User';
  const inferredFolder = inferSpecialFolder(trimmed, home);
  const inferredPath = extractFilePathCandidate(trimmed, home);
  const inferredDirectoryPath = extractDirectoryPathCandidate(trimmed, home);

  if (isCreateDirectoryIntent(trimmed)) {
    const directoryPath = inferredDirectoryPath || `${inferredFolder}/New Folder`;
    const result = (await createDirectory(directoryPath)) as { success: boolean; description?: string; path?: string };
    const finalPath = normalizePath(result.path || directoryPath);

    return {
      actionType: 'dir_create',
      logType: 'file',
      action: 'Created local folder',
      reasoning: '',
      toolLabel: 'Desktop Commander',
      toolResult: {
        ...result,
        path: finalPath,
      },
      resultMarkdown: buildMarkdown(
        result.success ? 'Le dossier a ete cree.' : 'La creation du dossier a echoue.',
        result.success
          ? `Desktop Commander a cree le dossier \`${finalPath}\`.`
          : (result.description || 'La creation du dossier a echoue.'),
        result.success ? [`Chemin: ${finalPath}`] : [`Erreur: ${result.description || 'Action impossible'}`],
        result.success ? 'Aucune.' : 'Donnez-moi un autre nom ou un autre emplacement.',
      ),
    };
  }

  if (isWriteIntent(trimmed)) {
    if (!inferredPath) {
      return {
        actionType: 'file_write',
        logType: 'file',
        action: 'Desktop Commander needs a target path',
        reasoning: '',
        toolLabel: 'Desktop Commander',
        toolResult: { success: false, description: 'Missing file path' },
        resultMarkdown: createMissingPathResponse('creer le fichier'),
      };
    }

    const content = inferWriteContent(trimmed);
    const result = (await writeFile(inferredPath, content, 'rewrite')) as DCWriteResult;
    const finalPath = normalizePath(result.path || inferredPath);

    return {
      actionType: 'file_write',
      logType: 'file',
      action: 'Created local file',
      reasoning: '',
      toolLabel: 'Desktop Commander',
      toolResult: {
        ...result,
        path: finalPath,
      } as Record<string, unknown>,
      resultMarkdown: buildMarkdown(
        result.success ? 'Le fichier a ete cree.' : 'La creation du fichier a echoue.',
        result.success
          ? `Desktop Commander a cree le fichier \`${finalPath}\`.`
          : (result.description || 'La creation du fichier a echoue.'),
        result.success
          ? [`Chemin: ${finalPath}`, `Octets ecrits: ${result.bytes_written ?? 0}`]
          : [`Erreur: ${result.description || 'Action impossible'}`],
        result.success ? 'Aucune.' : 'Donnez-moi un autre chemin ou ajustez les droits du dossier.',
      ),
    };
  }

  if (isReadIntent(trimmed)) {
    if (inferredPath) {
      const result = (await readFile(inferredPath)) as DCFileResult;
      const finalPath = normalizePath(result.path || inferredPath);
      const preview = result.content ? normalizeWhitespace(result.content).slice(0, 220) : '';

      return {
        actionType: 'file_read',
        logType: 'file',
        action: 'Read local file',
        reasoning: '',
        toolLabel: 'Desktop Commander',
        toolResult: {
          ...result,
          path: finalPath,
        } as Record<string, unknown>,
        resultMarkdown: buildMarkdown(
          result.success ? 'Le fichier a ete lu.' : 'La lecture du fichier a echoue.',
          result.success
            ? `Desktop Commander a lu le fichier \`${finalPath}\`.`
            : (result.description || 'La lecture du fichier a echoue.'),
          result.success
            ? [
                `Chemin: ${finalPath}`,
                `Taille: ${result.size_bytes ?? 0} octets`,
                result.truncated ? 'Le contenu a ete tronque pour rester lisible.' : 'Le contenu complet a ete charge.',
                preview ? `Apercu: ${preview}` : 'Apercu: aucun contenu texte lisible',
              ]
            : [`Erreur: ${result.description || 'Action impossible'}`],
          result.success
            ? result.content
              ? 'Je peux aussi resumer ou analyser son contenu.'
              : 'Je peux essayer un autre fichier si besoin.'
            : 'Verifiez le chemin ou donnez-moi un nom de fichier plus precis.',
        ),
      };
    }

    const query = inferSearchQuery(trimmed);
    const searchRoot = inferredDirectoryPath || inferredFolder;
    const searchResult = (await searchFiles(query, searchRoot, 5)) as DCSearchResult;
    const bestMatch = searchResult.success ? searchResult.results?.[0] : null;

    if (bestMatch?.path) {
      const result = (await readFile(bestMatch.path)) as DCFileResult;
      const finalPath = normalizePath(result.path || bestMatch.path);
      const preview = result.content ? normalizeWhitespace(result.content).slice(0, 220) : '';

      return {
        actionType: 'file_read',
        logType: 'file',
        action: 'Found and read local file',
        reasoning: '',
        toolLabel: 'Desktop Commander',
        toolResult: {
          ...result,
          path: finalPath,
          search_query: query,
        } as Record<string, unknown>,
        resultMarkdown: buildMarkdown(
          result.success ? 'Le fichier demande a ete retrouve et lu.' : 'Le fichier a ete trouve mais la lecture a echoue.',
          result.success
            ? `Desktop Commander a recherche \`${query}\`, puis a lu \`${finalPath}\`.`
            : (result.description || 'La lecture du fichier a echoue.'),
          result.success
            ? [
                `Recherche: ${query}`,
                `Chemin: ${finalPath}`,
                `Taille: ${result.size_bytes ?? 0} octets`,
                preview ? `Apercu: ${preview}` : 'Apercu: aucun contenu texte lisible',
              ]
            : [`Erreur: ${result.description || 'Action impossible'}`],
          result.success ? 'Je peux maintenant resumer ou analyser ce fichier.' : 'Je peux essayer un autre resultat si vous voulez.',
        ),
      };
    }

    return {
      actionType: 'file_read',
      logType: 'file',
      action: 'Desktop Commander needs a target file',
      reasoning: '',
      toolLabel: 'Desktop Commander',
      toolResult: { success: false, description: 'Missing file path' },
      resultMarkdown: createMissingPathResponse('lire le fichier'),
    };
  }

  if (isListIntent(trimmed)) {
    const path = inferredDirectoryPath || inferredFolder;
    const result = (await listDirectory(path)) as DCListResult;
    const finalPath = normalizePath(result.path || path);

    return {
      actionType: 'dir_list',
      logType: 'file',
      action: 'Listed local directory',
      reasoning: '',
      toolLabel: 'Desktop Commander',
      toolResult: {
        ...result,
        path: finalPath,
      } as Record<string, unknown>,
      resultMarkdown: buildMarkdown(
        result.success ? 'Le dossier a ete liste.' : 'Le listing du dossier a echoue.',
        result.success
          ? `Desktop Commander a liste \`${finalPath}\`.`
          : (result.description || 'Le listing du dossier a echoue.'),
        result.success
          ? [`Chemin: ${finalPath}`, `Elements trouves: ${result.total ?? result.items?.length ?? 0}`]
          : [`Erreur: ${result.description || 'Action impossible'}`],
        result.success ? 'Je peux maintenant ouvrir un fichier precis de ce dossier.' : 'Donnez-moi un autre dossier a inspecter.',
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
      action: 'Searched local files',
      reasoning: '',
      toolLabel: 'Desktop Commander',
      toolResult: result as Record<string, unknown>,
      resultMarkdown: buildMarkdown(
        result.success ? 'La recherche locale est terminee.' : 'La recherche locale a echoue.',
        result.success
          ? `Desktop Commander a recherche \`${query}\` dans \`${normalizePath(searchRoot)}\`.`
          : (result.description || 'La recherche locale a echoue.'),
        result.success
          ? [
              `Chemin de recherche: ${normalizePath(searchRoot)}`,
              `Resultats: ${result.results?.length ?? 0}`,
              ...((result.results || []).slice(0, 3).map((entry) => `Trouve: ${normalizePath(entry.path)}`)),
            ]
          : [`Erreur: ${result.description || 'Action impossible'}`],
        result.success && (result.results?.length || 0) > 0
          ? 'Je peux maintenant ouvrir un des fichiers trouves.'
          : 'Donnez-moi un nom plus precis si vous voulez relancer la recherche.',
      ),
    };
  }

  if (isCommandIntent(trimmed)) {
    const command =
      extractQuotedValue(trimmed) ||
      trimmed.replace(/^(run command|execute command|commande|powershell|cmd|bash)\s*:?/i, '').trim();
    if (!command) {
      return null;
    }

    const result = (await executeCommand(command)) as DCCommandResult;
    return {
      actionType: 'dc_shell',
      logType: 'shell',
      action: 'Executed local command',
      reasoning: '',
      toolLabel: 'Desktop Commander',
      toolResult: result as Record<string, unknown>,
      resultMarkdown: buildMarkdown(
        result.success ? 'La commande a ete executee.' : 'La commande a echoue.',
        result.success
          ? 'Desktop Commander a execute la commande locale demandee.'
          : (result.description || 'La commande a echoue.'),
        [
          `Commande: ${command}`,
          `Sortie standard: ${normalizeWhitespace(result.stdout || '').slice(0, 140) || 'Aucune'}`,
          result.stderr
            ? `Erreur standard: ${normalizeWhitespace(result.stderr).slice(0, 140)}`
            : 'Erreur standard: Aucune',
        ],
        result.success ? 'Je peux maintenant exploiter cette sortie si vous voulez.' : 'Je peux reformuler la commande et reessayer.',
      ),
    };
  }

  if (isSystemInfoIntent(trimmed)) {
    const result = (await getSystemInfo()) as DCSystemInfoResult;

    return {
      actionType: 'system_info',
      logType: 'act',
      action: 'Collected system information',
      reasoning: '',
      toolLabel: 'Desktop Commander',
      toolResult: result as Record<string, unknown>,
      resultMarkdown: buildMarkdown(
        result.success ? 'Les informations systeme ont ete recuperees.' : 'La lecture des informations systeme a echoue.',
        result.success
          ? `Desktop Commander a recupere l'etat actuel de votre machine \`${result.hostname}\`.`
          : (result.description || 'La lecture des informations systeme a echoue.'),
        result.success
          ? [
              `OS: ${result.os}`,
              `CPU: ${result.cpu_count} coeurs - ${result.cpu_percent}%`,
              `RAM utilisee: ${result.memory_used_gb} / ${result.memory_total_gb} Go (${result.memory_percent}%)`,
              `Disque libre: ${result.disk_free_gb} / ${result.disk_total_gb} Go`,
            ]
          : [`Erreur: ${result.description || 'Action impossible'}`],
        result.success ? 'Je peux aussi detailler RAM, disque ou processus si vous voulez.' : 'Je peux reessayer avec une autre methode si besoin.',
      ),
    };
  }

  return null;
}
