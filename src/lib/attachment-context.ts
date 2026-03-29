const TEXT_LIKE_TYPES = [
  'text/',
  'application/json',
  'application/xml',
  'application/javascript',
  'application/typescript',
];

const TEXT_LIKE_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.css',
  '.scss',
  '.html',
  '.htm',
  '.yml',
  '.yaml',
  '.xml',
  '.sql',
  '.env',
];

const MAX_ATTACHMENT_CHARS = 4000;

const isTextLikeFile = (file: File) => {
  const type = file.type.toLowerCase();
  if (TEXT_LIKE_TYPES.some((prefix) => type.startsWith(prefix))) {
    return true;
  }

  const loweredName = file.name.toLowerCase();
  return TEXT_LIKE_EXTENSIONS.some((extension) => loweredName.endsWith(extension));
};

const readTextPreview = async (file: File) => {
  try {
    const text = await file.text();
    return text.slice(0, MAX_ATTACHMENT_CHARS);
  } catch {
    return '';
  }
};

export async function buildAttachmentContext(files: File[]): Promise<string> {
  if (files.length === 0) {
    return '';
  }

  const sections = await Promise.all(
    files.map(async (file) => {
      const header = `- ${file.name} (${file.type || 'unknown'}, ${file.size} bytes)`;
      if (!isTextLikeFile(file)) {
        return `${header}\n  Binary or media attachment available. Use the filename and type as context.`;
      }

      const preview = await readTextPreview(file);
      if (!preview.trim()) {
        return `${header}\n  Text attachment available, but no readable preview was extracted.`;
      }

      return `${header}\n  Preview:\n${preview}`;
    }),
  );

  return `Attached file context:\n${sections.join('\n\n')}`;
}
