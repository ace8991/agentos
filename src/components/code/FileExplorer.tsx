import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, Search } from 'lucide-react';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  language?: string;
}

const defaultTree: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    children: [
      {
        name: 'components',
        type: 'folder',
        children: [
          { name: 'ChatPanel.tsx', type: 'file', language: 'tsx' },
          { name: 'HexLogo.tsx', type: 'file', language: 'tsx' },
          { name: 'SettingsModal.tsx', type: 'file', language: 'tsx' },
        ],
      },
      {
        name: 'pages',
        type: 'folder',
        children: [
          { name: 'Index.tsx', type: 'file', language: 'tsx' },
          { name: 'Dashboard.tsx', type: 'file', language: 'tsx' },
          { name: 'CodePage.tsx', type: 'file', language: 'tsx' },
        ],
      },
      { name: 'App.tsx', type: 'file', language: 'tsx' },
      { name: 'main.tsx', type: 'file', language: 'tsx' },
      { name: 'index.css', type: 'file', language: 'css' },
    ],
  },
  {
    name: 'backend',
    type: 'folder',
    children: [
      {
        name: 'app',
        type: 'folder',
        children: [
          { name: 'main.py', type: 'file', language: 'py' },
          { name: 'config.py', type: 'file', language: 'py' },
        ],
      },
      { name: 'requirements.txt', type: 'file', language: 'txt' },
    ],
  },
  { name: 'package.json', type: 'file', language: 'json' },
  { name: 'tsconfig.json', type: 'file', language: 'json' },
];

const langColors: Record<string, string> = {
  tsx: 'text-primary-400',
  ts: 'text-primary-300',
  css: 'text-primary-400',
  py: 'text-primary-400',
  json: 'text-primary-400',
  txt: 'text-muted-foreground',
};

interface FileExplorerProps {
  onFileSelect?: (path: string) => void;
  selectedFile?: string;
}

const FileTreeNode = ({
  node,
  depth,
  path,
  selectedFile,
  onFileSelect,
}: {
  node: FileNode;
  depth: number;
  path: string;
  selectedFile?: string;
  onFileSelect?: (path: string) => void;
}) => {
  const [open, setOpen] = useState(depth < 1);
  const fullPath = `${path}/${node.name}`;
  const isSelected = selectedFile === fullPath;

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-1.5 py-1 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {open ? <FolderOpen size={13} className="text-accent/70" /> : <Folder size={13} className="text-accent/70" />}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children?.map((child) => (
          <FileTreeNode
            key={child.name}
            node={child}
            depth={depth + 1}
            path={fullPath}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onFileSelect?.(fullPath)}
      className={`w-full flex items-center gap-1.5 py-1 px-2 text-xs rounded transition-colors ${
        isSelected ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <File size={12} className={langColors[node.language || ''] || 'text-muted-foreground'} />
      <span className="truncate">{node.name}</span>
    </button>
  );
};

const FileExplorer = ({ onFileSelect, selectedFile }: FileExplorerProps) => {
  const [search, setSearch] = useState('');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-foreground">Fichiers</span>
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <Plus size={14} />
        </button>
      </div>
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1">
          <Search size={12} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {defaultTree.map((node) => (
          <FileTreeNode
            key={node.name}
            node={node}
            depth={0}
            path=""
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default FileExplorer;
