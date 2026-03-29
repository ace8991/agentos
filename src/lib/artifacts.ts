import type { FileAttachment, LogEntry } from '@/store/useStore';

export type ArtifactType =
  | 'code'
  | 'document'
  | 'image'
  | 'html'
  | 'csv'
  | 'terminal'
  | 'webpage'
  | 'markdown'
  | 'slides'
  | 'app'
  | 'pdf';

export type WorkspaceView = 'preview' | 'code' | 'database' | 'files';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string;
  url?: string;
  filename?: string;
  sourceLabel?: string;
}

export interface SlideFrame {
  id: string;
  title: string;
  content: string;
  notes?: string;
}

export interface WorkspaceFileNode {
  id: string;
  path: string;
  name: string;
  group: 'client' | 'server' | 'database' | 'docs' | 'assets' | 'output';
  artifact: Artifact;
}

export const languageLabels: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  bash: 'Bash',
  shell: 'Shell',
  sh: 'Shell',
  powershell: 'PowerShell',
  sql: 'SQL',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  cpp: 'C++',
  markdown: 'Markdown',
  md: 'Markdown',
};

const slideTitleHints = /\b(slides?|deck|presentation|pitch|keynote)\b/i;
const appTitleHints = /\b(app|landing|website|site|snake|game|dashboard|prototype|preview)\b/i;
const databaseHints = /\b(database|schema|migration|sql|prisma|supabase|postgres|table|tables|model|models)\b/i;

const normalizeNewlines = (value: string) => value.replace(/\r\n/g, '\n');

const getFilenameExtension = (name?: string) => name?.split('.').pop()?.toLowerCase() ?? '';
const sanitizeFileSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'artifact';

export const isLikelySlidesContent = (content: string, title = '') => {
  const normalized = normalizeNewlines(content);
  if (slideTitleHints.test(title)) return true;
  if (/^\s*---+\s*$/m.test(normalized)) return true;
  return (normalized.match(/^#{1,2}\s+/gm) || []).length >= 3;
};

export const isLikelyAppContent = (content: string, title = '') => {
  const normalized = normalizeNewlines(content);
  if (appTitleHints.test(title)) return true;
  if (!/<(html|body|script|canvas|main|section|div)/i.test(normalized)) return false;
  return /<script/i.test(normalized) || /<canvas/i.test(normalized) || /<(main|section|nav|header|footer)/i.test(normalized);
};

export const inferArtifactTypeFromCode = (language: string, content: string, title = ''): ArtifactType => {
  const lang = language.toLowerCase();

  if (lang === 'html') {
    return isLikelyAppContent(content, title) ? 'app' : 'html';
  }
  if (lang === 'csv') return 'csv';
  if (['bash', 'shell', 'sh', 'powershell', 'ps1'].includes(lang)) return 'terminal';
  if (['markdown', 'md'].includes(lang)) {
    return isLikelySlidesContent(content, title) ? 'slides' : 'markdown';
  }
  return 'code';
};

export const inferArtifactTypeFromAttachment = (attachment: FileAttachment): ArtifactType => {
  const mime = attachment.type.toLowerCase();
  const ext = getFilenameExtension(attachment.name);
  const title = attachment.name || '';
  const content = attachment.content || '';

  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('pdf') || ext === 'pdf') return 'pdf';
  if (mime.includes('html') || ext === 'html') {
    return isLikelyAppContent(content, title) ? 'app' : 'html';
  }
  if (mime.includes('csv') || ext === 'csv') return 'csv';
  if (mime.includes('markdown') || ['md', 'markdown'].includes(ext)) {
    return isLikelySlidesContent(content, title) ? 'slides' : 'markdown';
  }
  if (['ppt', 'pptx', 'key'].includes(ext)) return 'slides';
  if (['txt', 'doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'document';
  return 'document';
};

export const getArtifactMimeType = (artifact: Artifact) => {
  if (artifact.type === 'app' || artifact.type === 'html') return 'text/html';
  if (artifact.type === 'markdown' || artifact.type === 'slides') return 'text/markdown';
  if (artifact.type === 'csv') return 'text/csv';
  if (artifact.type === 'code' || artifact.type === 'terminal') return 'text/plain';
  if (artifact.type === 'pdf') return 'application/pdf';
  if (artifact.type === 'image') return 'image/png';
  return 'text/plain';
};

export const isDatabaseArtifact = (artifact: Artifact) => {
  const language = artifact.language?.toLowerCase() || '';
  const extension = getFilenameExtension(artifact.filename);
  const signature = `${artifact.title} ${artifact.filename || ''} ${artifact.content.slice(0, 320)}`;

  return (
    ['sql', 'prisma'].includes(language) ||
    ['sql', 'prisma', 'db', 'sqlite'].includes(extension) ||
    databaseHints.test(signature) ||
    /create\s+table|alter\s+table|datasource\s+db|generator\s+client|model\s+\w+\s+\{|\btable\b/i.test(
      artifact.content,
    )
  );
};

export const getArtifactWorkspacePath = (artifact: Artifact, index = 0) => {
  if (artifact.filename) return artifact.filename.replace(/\\/g, '/');

  const language = artifact.language?.toLowerCase() || '';
  const suffix = sanitizeFileSegment(artifact.title);
  const inferredExtension =
    getFilenameExtension(artifact.filename) ||
    artifact.language?.toLowerCase() ||
    (artifact.type === 'slides'
      ? 'md'
      : artifact.type === 'app'
      ? ['tsx', 'jsx', 'ts', 'js'].includes(language)
        ? language
        : 'html'
      : artifact.type === 'csv'
      ? 'csv'
      : artifact.type === 'pdf'
      ? 'pdf'
      : artifact.type === 'image'
      ? 'png'
      : artifact.type === 'terminal'
      ? 'txt'
      : artifact.type === 'markdown'
      ? 'md'
      : 'txt');

  if (artifact.type === 'app') {
    if (['tsx', 'jsx', 'ts', 'js'].includes(language)) {
      return `client/src/${suffix || 'app'}.${inferredExtension}`;
    }
    return `client/index.${inferredExtension}`;
  }
  if (artifact.type === 'html') return `client/index.${inferredExtension}`;
  if (artifact.type === 'slides') return `deliverables/${suffix || 'presentation'}.md`;
  if (artifact.type === 'markdown' || artifact.type === 'document') return `docs/${suffix || 'document'}.${inferredExtension}`;
  if (artifact.type === 'csv') return `data/${suffix || `dataset-${index + 1}`}.csv`;
  if (artifact.type === 'image') return `assets/${suffix || `image-${index + 1}`}.${inferredExtension}`;
  if (artifact.type === 'pdf') return `deliverables/${suffix || 'document'}.pdf`;
  if (artifact.type === 'webpage') return `previews/${suffix || 'external-link'}.url`;
  if (artifact.type === 'terminal') return `logs/${suffix || `run-${index + 1}`}.txt`;

  if (isDatabaseArtifact(artifact)) {
    return `database/${suffix || `schema-${index + 1}`}.${inferredExtension}`;
  }
  if (['tsx', 'jsx', 'ts', 'js', 'css', 'json'].includes(language)) {
    return `client/src/${suffix || `module-${index + 1}`}.${inferredExtension}`;
  }
  if (['python', 'py'].includes(language)) {
    return `server/${suffix || `script-${index + 1}`}.py`;
  }

  return `workspace/${suffix || `artifact-${index + 1}`}.${inferredExtension}`;
};

export const buildWorkspaceFiles = (artifacts: Artifact[]): WorkspaceFileNode[] =>
  artifacts.map((artifact, index) => {
    const path = getArtifactWorkspacePath(artifact, index);
    const [root = 'workspace'] = path.split('/');
    const group =
      root === 'client'
        ? 'client'
        : root === 'server'
        ? 'server'
        : root === 'database'
        ? 'database'
        : root === 'docs' || root === 'deliverables'
        ? 'docs'
        : root === 'assets' || root === 'previews'
        ? 'assets'
        : 'output';

    return {
      id: artifact.id,
      path,
      name: path.split('/').pop() || artifact.title,
      group,
      artifact,
    };
  });

export const getPrimaryWorkspaceArtifact = (artifacts: Artifact[]) =>
  artifacts.find((artifact) => ['app', 'html', 'webpage'].includes(artifact.type)) ||
  artifacts.find((artifact) => artifact.type === 'slides') ||
  artifacts[0] ||
  null;

export const getArtifactPreviewHtml = (artifact: Artifact) => {
  if (!['app', 'html'].includes(artifact.type)) return null;
  const content = artifact.content.trim();
  if (!content) return null;
  if (/<html|<!doctype/i.test(content)) return content;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${artifact.title}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, Segoe UI, system-ui, sans-serif;
        background: #0b1020;
        color: #f5f7ff;
      }
    </style>
  </head>
  <body>${content}</body>
</html>`;
};

export const parseSlides = (content: string, fallbackTitle = 'Presentation'): SlideFrame[] => {
  const normalized = normalizeNewlines(content).trim();
  if (!normalized) {
    return [{ id: 'slide-0', title: fallbackTitle, content: '' }];
  }

  let blocks: string[] = [];
  if (/^\s*---+\s*$/m.test(normalized)) {
    blocks = normalized.split(/^\s*---+\s*$/gm).map((block) => block.trim()).filter(Boolean);
  } else {
    const headingBlocks = normalized
      .split(/(?=^#{1,2}\s+)/gm)
      .map((block) => block.trim())
      .filter(Boolean);
    blocks = headingBlocks.length >= 2 ? headingBlocks : [normalized];
  }

  return blocks.map((block, index) => {
    const lines = block.split('\n');
    const firstHeading = lines.find((line) => /^#{1,3}\s+/.test(line));
    const title = firstHeading
      ? firstHeading.replace(/^#{1,3}\s+/, '').trim()
      : index === 0
      ? fallbackTitle
      : `Slide ${index + 1}`;
    const notesIndex = lines.findIndex((line) => /^notes?\s*:/i.test(line));
    const notes =
      notesIndex >= 0
        ? lines
            .slice(notesIndex)
            .join('\n')
            .replace(/^notes?\s*:/i, '')
            .trim()
        : undefined;

    return {
      id: `slide-${index}`,
      title,
      content: block,
      notes,
    };
  });
};

export const getArtifactStats = (artifact: Artifact) => {
  const content = artifact.content || '';
  const bytes = new Blob([content]).size;
  const lines = content ? content.split('\n').length : 0;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  return { bytes, lines, words };
};

export const getArtifactSummary = (artifact: Artifact) => {
  const content = normalizeNewlines(artifact.content || '').trim();
  if (!content) {
    return artifact.url ? 'External resource ready for preview.' : 'No inline content yet.';
  }

  const firstMeaningfulLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('```') && !line.startsWith('#'));

  const summary = firstMeaningfulLine || content.slice(0, 180);
  return summary.length > 120 ? `${summary.slice(0, 119)}...` : summary;
};

export const extractOutline = (artifact: Artifact) => {
  const content = normalizeNewlines(artifact.content || '');

  if (artifact.type === 'slides') {
    return parseSlides(content, artifact.title).map((slide, index) => ({
      id: slide.id,
      label: slide.title,
      meta: `Slide ${index + 1}`,
    }));
  }

  return content
    .split('\n')
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^#{1,3}\s+/.test(line))
    .map(({ line, index }) => ({
      id: `heading-${index}`,
      label: line.replace(/^#{1,3}\s+/, '').trim(),
      meta: line.match(/^#+/)?.[0]?.length === 1 ? 'Section' : 'Subsection',
    }));
};

export function parseArtifacts(content: string): { text: string; artifacts: Artifact[] } {
  const artifacts: Artifact[] = [];
  let text = content;
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = (match[1] || 'text').trim();
    const code = match[2].trim();

    if (code.split('\n').length > 3) {
      const type = inferArtifactTypeFromCode(lang, code);

      artifacts.push({
        id: `artifact-${blockIndex}`,
        type,
        title:
          type === 'slides'
            ? 'Slide deck'
            : type === 'app'
            ? 'App preview'
            : `${languageLabels[lang] || lang} snippet`,
        content: code,
        language: lang,
      });
      blockIndex += 1;
    }
  }

  if (artifacts.length > 0) {
    text = content
      .replace(codeBlockRegex, (_fullMatch, _lang, code) => {
        if (String(code).trim().split('\n').length > 3) {
          return '';
        }
        return _fullMatch;
      })
      .trim();
  }

  return { text, artifacts };
}

export function collectArtifactsFromEntries(entries: LogEntry[]): Artifact[] {
  const collected: Artifact[] = [];

  for (const entry of [...entries].reverse()) {
    if (entry.type === 'result' && entry.action) {
      const { artifacts } = parseArtifacts(entry.action);
      artifacts.forEach((artifact, index) => {
        collected.push({
          ...artifact,
          id: `${entry.id}-${artifact.id}-${index}`,
          sourceLabel: entry.toolLabel || `Step ${entry.step || 0}`,
        });
      });
    }

    if (entry.attachments?.length) {
      entry.attachments.forEach((attachment, index) => {
        collected.push({
          id: `${entry.id}-attachment-${index}`,
          type: inferArtifactTypeFromAttachment(attachment),
          title: attachment.name,
          content: attachment.content || attachment.url || '',
          url: attachment.url,
          filename: attachment.name,
          sourceLabel: entry.toolLabel || `Step ${entry.step || 0}`,
        });
      });
    }
  }

  return collected;
}
