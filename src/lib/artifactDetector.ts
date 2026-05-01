import { LogEntry } from '@/store/useStore';
import { Artifact, ArtifactType } from '@/types/artifact.types';
import { v4 as uuidv4 } from 'uuid';

function determineType(path: string, content: string): { type: ArtifactType; language: string } {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) return { type: 'html', language: 'html' };
  if (lowerPath.endsWith('.tsx') || lowerPath.endsWith('.jsx')) return { type: 'react', language: 'tsx' };
  if (lowerPath.endsWith('.svg')) return { type: 'svg', language: 'svg' };
  if (lowerPath.endsWith('.md')) return { type: 'markdown', language: 'markdown' };
  if (lowerPath.endsWith('.css')) return { type: 'css', language: 'css' };
  if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.js')) return { type: 'javascript', language: 'javascript' };

  if (content.includes('<!DOCTYPE html>') || content.includes('<html')) return { type: 'html', language: 'html' };
  if (content.includes('import React') || content.includes('export default function')) {
    return { type: 'react', language: 'tsx' };
  }
  if (content.trim().startsWith('<svg')) return { type: 'svg', language: 'svg' };

  return { type: 'unknown', language: 'text' };
}

function extractContentFromCommand(command: string): string | null {
  const match = command.match(/echo\s+['"]([\s\S]*?)['"]\s*>/);
  if (match && match[1]) {
    return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  return null;
}

export function extractArtifactFromEntry(entry: LogEntry): Artifact | null {
  const args = entry.toolArgs;
  if (!args) return null;

  const toolResult = entry.tool_result;

  let content = '';
  let path = '';
  let isCreationOrEdit = false;

  if (['file_write', 'file_create', 'file_append', 'file_edit', 'desktop_commander: file_write'].includes(entry.actionType || '')) {
    path = args.path || args.file_path || args.filename || args.target_file || '';
    content = args.content || args.file_text || args.new_content || args.text || args.code || '';
    isCreationOrEdit = true;
  }

  if (['shell', 'dc_shell'].includes(entry.actionType || '')) {
    const command = args.command || args.cmd || '';
    if (command.includes('>') || command.includes('echo')) {
      const extractedContent = extractContentFromCommand(command);
      if (extractedContent) {
        content = extractedContent;
        const pathMatch = command.match(/>\s*([^\s]+)/);
        path = pathMatch ? pathMatch[1] : 'shell_output.txt';
        isCreationOrEdit = true;
      }
    }

    if (!isCreationOrEdit && toolResult) {
      const resultStr = typeof (toolResult as any).content === 'string' ? (toolResult as any).content : '';
      if (resultStr && (resultStr.includes('<!DOCTYPE') || resultStr.includes('<html') || resultStr.includes('import React'))) {
        content = resultStr;
        path = 'preview.html';
        isCreationOrEdit = true;
      }
    }
  }

  if (!isCreationOrEdit || !content) return null;

  const { type, language } = determineType(path, content);

  if (type === 'unknown' && content.length < 50) {
    return null;
  }

  return {
    id: entry.id || uuidv4(),
    type,
    title: path ? path.split(/[\\/]/).pop() || path : 'Generated Code',
    code: content,
    language,
    version: 1,
    messageId: entry.id || '',
    timestamp: Date.now(),
  };
}

/**
 * Wrap an artifact's code in a self-contained HTML document suitable for
 * rendering inside a sandboxed iframe via `iframe.srcdoc`.
 */
export function prepareForIframe(artifact: Artifact): string {
  const { type, code } = artifact;

  if (type === 'html') {
    // Already a full document, or fragment — pass through.
    if (/<html[\s>]/i.test(code)) return code;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body>${code}</body></html>`;
  }

  if (type === 'svg') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head><body>${code}</body></html>`;
  }

  if (type === 'markdown') {
    const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head><body class="prose p-6">${escaped.replace(/\n/g, '<br>')}</body></html>`;
  }

  if (type === 'css') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${code}</style></head><body><div class="demo">CSS preview</div></body></html>`;
  }

  if (type === 'react') {
    const escaped = code.replace(/<\/script>/g, '<\\/script>');
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
    try {
      ${escaped}
      const Root = (typeof App !== 'undefined') ? App : (typeof Component !== 'undefined' ? Component : null);
      if (Root) {
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Root));
      } else {
        document.getElementById('root').innerText = 'No default React component found.';
      }
    } catch (err) {
      parent.postMessage({ type: 'artifact-error', message: String(err) }, '*');
    }
  </script>
</body>
</html>`;
  }

  // javascript / unknown
  const safe = code.replace(/</g, '&lt;');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;padding:16px">${safe}</pre></body></html>`;
}
