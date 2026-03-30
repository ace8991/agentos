import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  Code2,
  Database,
  ExternalLink,
  Eye,
  FileText,
  FolderTree,
  Maximize2,
  Minimize2,
  Monitor,
  PanelRightClose,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getBuilderWorkspaceDownloadUrl,
  getBuilderWorkspaceFile,
  type GeneratedWorkspace,
  type GeneratedWorkspaceFile,
} from '@/lib/api';
import type { WorkspaceView } from '@/lib/artifacts';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface WorkspaceDockProps {
  workspace: GeneratedWorkspace | null;
  open: boolean;
  view: WorkspaceView;
  onClose: () => void;
  onChangeView: (view: WorkspaceView) => void;
}

const deviceFrameClass: Record<DeviceMode, string> = {
  desktop: 'w-full',
  tablet: 'w-[860px] max-w-full',
  mobile: 'w-[420px] max-w-full',
};

const tabs: Array<{ id: WorkspaceView; label: string; icon: typeof Eye }> = [
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'files', label: 'Files', icon: FolderTree },
];

const WorkspaceDock = ({ workspace, open, view, onClose, onChangeView }: WorkspaceDockProps) => {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [selectedCodePath, setSelectedCodePath] = useState<string | null>(null);
  const [selectedDatabasePath, setSelectedDatabasePath] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [loadingFilePath, setLoadingFilePath] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const codeFiles = useMemo(
    () => workspace?.files.filter((file) => file.group === 'client' || file.group === 'server') ?? [],
    [workspace],
  );
  const databaseFiles = useMemo(() => workspace?.database_files ?? [], [workspace]);
  const visibleFiles = workspace?.files ?? [];
  const selectedPath = view === 'database' ? selectedDatabasePath : selectedCodePath;

  useEffect(() => {
    if (!workspace) {
      setSelectedCodePath(null);
      setSelectedDatabasePath(null);
      setSelectedContent('');
      setSelectedLanguage(null);
      return;
    }

    setDeviceMode('desktop');
    setFullscreen(false);

    if (!selectedCodePath && codeFiles[0]) {
      setSelectedCodePath(codeFiles[0].path);
    }
    if (!selectedDatabasePath && databaseFiles[0]) {
      setSelectedDatabasePath(databaseFiles[0].path);
    }
  }, [codeFiles, databaseFiles, selectedCodePath, selectedDatabasePath, workspace]);

  useEffect(() => {
    setSelectedCodePath(null);
    setSelectedDatabasePath(null);
    setSelectedContent('');
    setSelectedLanguage(null);
  }, [workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace || !selectedPath || (view !== 'code' && view !== 'database')) {
      return;
    }

    let cancelled = false;
    setLoadingFilePath(selectedPath);
    void getBuilderWorkspaceFile(workspace.workspace_id, selectedPath)
      .then((file) => {
        if (cancelled) return;
        setSelectedContent(file.content);
        setSelectedLanguage(file.language ?? null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingFilePath(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPath, view, workspace]);

  if (!workspace || !open) {
    return null;
  }

  const previewSurface = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Live preview</p>
          <p className="mt-1 text-sm text-white/68">{workspace.title}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
          <DeviceButton active={deviceMode === 'desktop'} icon={Monitor} onClick={() => setDeviceMode('desktop')} />
          <DeviceButton active={deviceMode === 'tablet'} icon={Tablet} onClick={() => setDeviceMode('tablet')} />
          <DeviceButton active={deviceMode === 'mobile'} icon={Smartphone} onClick={() => setDeviceMode('mobile')} />
        </div>
      </div>
      <div className="flex justify-center">
        <div
          className={cn(
            'overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1018] shadow-[0_28px_90px_rgba(0,0,0,0.28)]',
            deviceFrameClass[deviceMode],
          )}
        >
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#161b25] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="ml-2 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/62">
              <span className="truncate font-mono">{workspace.preview_url}</span>
            </div>
          </div>
          <iframe
            src={workspace.preview_url}
            title={`${workspace.title} preview`}
            className={cn('w-full bg-white', fullscreen ? 'h-[82vh]' : 'h-[calc(100vh-320px)] min-h-[520px]')}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden h-screen w-[min(50vw,820px)] shrink-0 border-l border-white/10 bg-[radial-gradient(circle_at_top_left,#202a38_0%,#11161e_44%,#0b0e13_100%)] text-white lg:flex lg:flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
              Builder workspace
            </div>
            <h3 className="mt-2 truncate text-lg font-semibold tracking-tight">{workspace.title}</h3>
            <p className="mt-1 text-sm text-white/60">{workspace.stack.frontend}</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
            title="Close workspace"
          >
            <PanelRightClose size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onChangeView(id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  view === id
                    ? 'border-sky-300/18 bg-sky-400/10 text-sky-100'
                    : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(workspace.preview_url, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <ExternalLink size={12} />
              Open external
            </button>
            {view === 'preview' && (
              <button
                onClick={() => setFullscreen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <Maximize2 size={12} />
                Full preview
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-5 py-5">
          {view === 'preview' && previewSurface}
          {view === 'code' && (
            <FileExplorerView
              title="Code explorer"
              files={codeFiles}
              selectedPath={selectedCodePath}
              onSelect={setSelectedCodePath}
              content={selectedContent}
              language={selectedLanguage}
              loadingPath={loadingFilePath}
              workspaceId={workspace.workspace_id}
            />
          )}
          {view === 'database' && (
            <FileExplorerView
              title="Database surfaces"
              files={databaseFiles}
              selectedPath={selectedDatabasePath}
              onSelect={setSelectedDatabasePath}
              content={selectedContent}
              language={selectedLanguage}
              loadingPath={loadingFilePath}
              workspaceId={workspace.workspace_id}
              emptyLabel="No database layer detected for this workspace."
            />
          )}
          {view === 'files' && <WorkspaceFilesGrid files={visibleFiles} workspaceId={workspace.workspace_id} />}
        </div>
      </aside>

      {fullscreen
        ? createPortal(
            <div className="fixed inset-0 z-[81] bg-black/72 backdrop-blur-sm">
              <div className="absolute inset-4 overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0e13]">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-white">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Full preview</p>
                    <p className="mt-1 text-sm text-white/72">{workspace.title}</p>
                  </div>
                  <button
                    onClick={() => setFullscreen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                  >
                    <Minimize2 size={16} />
                  </button>
                </div>
                <iframe src={workspace.preview_url} title={`${workspace.title} full preview`} className="h-[calc(100%-73px)] w-full bg-white" />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

const FileExplorerView = ({
  title,
  files,
  selectedPath,
  onSelect,
  content,
  language,
  loadingPath,
  workspaceId,
  emptyLabel,
}: {
  title: string;
  files: GeneratedWorkspaceFile[];
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
  content: string;
  language: string | null;
  loadingPath: string | null;
  workspaceId: string;
  emptyLabel?: string;
}) => {
  if (files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/58">
        {emptyLabel || 'No files available in this workspace surface.'}
      </div>
    );
  }

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0c1017]">
        <div className="border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/45">{title}</div>
        <div className="max-h-[calc(100vh-260px)] overflow-auto p-3">
          <div className="space-y-1.5">
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => onSelect(file.path)}
                className={cn(
                  'w-full rounded-2xl border px-3 py-2 text-left transition-colors',
                  selectedPath === file.path
                    ? 'border-sky-300/18 bg-sky-400/10 text-sky-100'
                    : 'border-white/10 bg-white/[0.03] text-white/62 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-white/45">{file.path}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#0b0e16]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{selectedPath}</p>
            <p className="mt-1 text-xs text-white/45">{language || 'text'}</p>
          </div>
          {selectedPath && (
            <a
              href={getBuilderWorkspaceDownloadUrl(workspaceId, selectedPath)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <ExternalLink size={12} />
              Download
            </a>
          )}
        </div>
        <div className="max-h-[calc(100vh-260px)] overflow-auto">
          {loadingPath ? (
            <div className="p-6 text-sm text-white/58">Loading {loadingPath}...</div>
          ) : (
            <pre className="min-w-0 whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-white/82">
              <code>{content}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

const WorkspaceFilesGrid = ({ files, workspaceId }: { files: GeneratedWorkspaceFile[]; workspaceId: string }) => (
  <div className="grid gap-3 md:grid-cols-2">
    {files.map((file) => (
      <div key={file.path} className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{file.name}</p>
            <p className="mt-1 truncate text-xs text-white/45">{file.path}</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/62">
            {file.group}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/55">
          <span>{file.size_bytes.toLocaleString()} bytes</span>
          <a
            href={getBuilderWorkspaceDownloadUrl(workspaceId, file.path)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <FileText size={12} />
            Download
          </a>
        </div>
      </div>
    ))}
  </div>
);

const DeviceButton = ({
  active,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  icon: typeof Monitor;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'rounded-full p-2 transition-colors',
      active ? 'bg-white text-slate-900' : 'text-white/62 hover:text-white',
    )}
  >
    <Icon size={13} />
  </button>
);

export default WorkspaceDock;
