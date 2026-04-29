import React from 'react';
import Editor from '@monaco-editor/react';
import { Artifact } from '@/types/artifact.types';

const LANGUAGE_MAP: Record<string, string> = {
  html: 'html',
  react: 'javascript',
  jsx: 'javascript',
  tsx: 'typescript',
  svg: 'xml',
  markdown: 'markdown',
  javascript: 'javascript',
  css: 'css',
};

interface ArtifactCodeEditorProps {
  artifact: Artifact;
  onChange?: (code: string) => void;
}

export const ArtifactCodeEditor: React.FC<ArtifactCodeEditorProps> = ({
  artifact,
  onChange,
}) => {
  const language = LANGUAGE_MAP[artifact.type] || LANGUAGE_MAP[artifact.language] || 'plaintext';

  return (
    <div className="artifact-code-editor">
      <Editor
        height="100%"
        language={language}
        value={artifact.code}
        onChange={(value) => onChange?.(value ?? '')}
        theme="vs-dark"
        options={{
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          lineHeight: 1.7,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: { top: 16, bottom: 16 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          renderLineHighlight: 'gutter',
          bracketPairColorization: { enabled: true },
          readOnly: false,
          tabSize: 2,
        }}
      />
    </div>
  );
};
