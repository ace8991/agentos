import { LogEntry } from '@/store/useStore';
import { Artifact, ArtifactLanguage } from '@/types/artifact.types';
import { v4 as uuidv4 } from 'uuid';

function determineLanguage(path: string, content: string): ArtifactLanguage {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) return 'html';
  if (lowerPath.endsWith('.tsx') || lowerPath.endsWith('.jsx')) return 'react';
  if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.js')) return 'javascript';
  if (lowerPath.endsWith('.css')) return 'css';
  if (lowerPath.endsWith('.json')) return 'json';
  if (lowerPath.endsWith('.py')) return 'python';
  if (lowerPath.endsWith('.md')) return 'markdown';
  if (lowerPath.endsWith('.sh') || lowerPath.endsWith('.bat')) return 'shell';

  if (content.includes('<!DOCTYPE html>') || content.includes('<html')) return 'html';
  if (content.includes('import React') || content.includes('export default function')) return 'react';
  
  return 'text';
}

function extractContentFromCommand(command: string): string | null {
  // Simple heuristic to extract content from `echo "content" > file`
  const match = command.match(/echo\s+['"]([\s\S]*?)['"]\s*>/);
  if (match && match[1]) {
    // Unescape common shell escapes if necessary, though raw is often okay
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

  // Case 1: file_write, file_create, file_append, file_edit
  if (['file_write', 'file_create', 'file_append', 'file_edit', 'desktop_commander: file_write'].includes(entry.actionType || '')) {
    path = args.path || args.file_path || args.filename || args.target_file || '';
    content = args.content || args.file_text || args.new_content || args.text || args.code || '';
    isCreationOrEdit = true;
  }
  
  // Case 2: shell/dc_shell creating a file
  if (['shell', 'dc_shell'].includes(entry.actionType || '')) {
    const command = args.command || args.cmd || '';
    if (command.includes('>') || command.includes('echo')) {
      const extractedContent = extractContentFromCommand(command);
      if (extractedContent) {
        content = extractedContent;
        // Try to guess path from command
        const pathMatch = command.match(/>\s*([^\s]+)/);
        if (pathMatch) {
          path = pathMatch[1];
        } else {
          path = 'shell_output.txt';
        }
        isCreationOrEdit = true;
      }
    }
    
    // Sometimes the toolResult contains the actual content if we read a file
    // But usually Artifacts are for things we generate.
    if (!isCreationOrEdit && toolResult) {
      const resultStr = typeof toolResult.content === 'string' ? toolResult.content : '';
      if (resultStr && (resultStr.includes('<!DOCTYPE') || resultStr.includes('<html') || resultStr.includes('import React'))) {
        content = resultStr;
        path = 'preview.html'; // Fallback
        isCreationOrEdit = true;
      }
    }
  }

  // If we couldn't confidently extract a previewable artifact
  if (!isCreationOrEdit || !content) return null;

  const language = determineLanguage(path, content);

  // We only really want to preview code/web
  if (['text', 'shell'].includes(language) && content.length < 50) {
     return null; // Skip tiny text updates
  }

  return {
    id: entry.id || uuidv4(),
    type: language === 'html' || language === 'react' ? 'website' : 'code',
    title: path ? path.split(/[\\/]/).pop() || path : 'Generated Code',
    content,
    language,
    path,
    createdAt: new Date().toISOString()
  };
}
