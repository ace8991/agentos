import { createPortal } from 'react-dom';
import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import {
  Check,
  ChevronRight,
  ImagePlus,
  Layers3,
  Paperclip,
  Search,
  Sparkles,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import ConnectorLogo from './ConnectorLogo';

interface ComposerInsertMenuProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  connectedCount: number;
  responseStyleLabel: string;
  webSearchEnabled: boolean;
  useStyleEnabled: boolean;
  onAddFiles: () => void;
  onAddImages: () => void;
  onOpenGoogleDrive: () => void;
  onOpenGitHub: () => void;
  onOpenSkills: () => void;
  onOpenConnectors: () => void;
  onToggleWebSearch: () => void;
  onToggleUseStyle: () => void;
}

const ComposerInsertMenu = ({
  open,
  anchorRef,
  panelRef,
  connectedCount,
  responseStyleLabel,
  webSearchEnabled,
  useStyleEnabled,
  onAddFiles,
  onAddImages,
  onOpenGoogleDrive,
  onOpenGitHub,
  onOpenSkills,
  onOpenConnectors,
  onToggleWebSearch,
  onToggleUseStyle,
}: ComposerInsertMenuProps) => {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const panelWidth = Math.min(286, Math.max(248, viewportWidth - 24));
      const left = Math.max(12, Math.min(rect.left, viewportWidth - panelWidth - 12));
      const top = rect.top - 12;
      const maxHeight = Math.min(440, Math.max(200, rect.top - 20));

      setStyle({
        left,
        top,
        width: panelWidth,
        maxHeight,
        transform: 'translateY(-100%)',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, open]);

  if (!open || !style) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] pointer-events-none">
      <div
        ref={panelRef}
        className="pointer-events-auto fixed overflow-y-auto rounded-[20px] border border-white/10 bg-[rgba(22,24,30,0.97)] backdrop-blur-2xl shadow-[0_22px_60px_rgba(0,0,0,0.44)] p-1.5"
        style={style}
      >
        <div className="space-y-0.5">
          <MenuRow
            icon={<Paperclip size={16} className="text-white/82" />}
            title="Add files or photos"
            onClick={onAddFiles}
          />
          <MenuRow
            icon={<ImagePlus size={16} className="text-white/82" />}
            title="Import images"
            onClick={onAddImages}
          />
          <MenuRow
            icon={<ConnectorLogo connectorId="google-drive" name="Google Drive" badge="GD" size="sm" className="h-4 w-4 rounded-none border-0 bg-transparent" />}
            title="Add from Google Drive"
            onClick={onOpenGoogleDrive}
            trailing={<ChevronRight size={15} className="text-white/32" />}
          />
          <MenuRow
            icon={<ConnectorLogo connectorId="github" name="GitHub" badge="GH" size="sm" className="h-4 w-4 rounded-none border-0 bg-transparent text-white/82" />}
            title="Add from GitHub"
            onClick={onOpenGitHub}
            trailing={<ChevronRight size={15} className="text-white/32" />}
          />
        </div>

        <div className="my-1.5 h-px bg-white/10" />

        <div className="space-y-0.5">
          <MenuRow
            icon={<Sparkles size={16} className="text-accent" />}
            title="Skills"
            onClick={onOpenSkills}
            trailing={<ChevronRight size={15} className="text-white/32" />}
          />
          <MenuRow
            icon={<Layers3 size={16} className="text-white/82" />}
            title="Connectors"
            onClick={onOpenConnectors}
            trailing={
              connectedCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-200">
                  <Check size={12} />
                  {connectedCount}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-200">
                  <TriangleAlert size={11} />
                  1
                </span>
              )
            }
          />
        </div>

        <div className="my-1.5 h-px bg-white/10" />

        <div className="space-y-0.5">
          <ToggleRow
            icon={<Search size={16} className={webSearchEnabled ? 'text-sky-300' : 'text-sky-400'} />}
            title="Web research"
            active={webSearchEnabled}
            onClick={onToggleWebSearch}
          />
          <ToggleRow
            icon={<Wand2 size={16} className={useStyleEnabled ? 'text-fuchsia-200' : 'text-fuchsia-300'} />}
            title="Use saved style"
            active={useStyleEnabled}
            onClick={onToggleUseStyle}
            trailingLabel={responseStyleLabel}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};

const MenuRow = ({
  icon,
  title,
  onClick,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  onClick: () => void;
  trailing?: ReactNode;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 rounded-[14px] px-2.5 py-2 text-left hover:bg-white/[0.05] transition-colors"
  >
    <div className="h-4 w-4 shrink-0 flex items-center justify-center overflow-hidden">
      {icon}
    </div>
    <div className="min-w-0 flex-1 text-[13px] font-medium text-white">{title}</div>
    {trailing && <div className="shrink-0">{trailing}</div>}
  </button>
);

const ToggleRow = ({
  icon,
  title,
  active,
  onClick,
  trailingLabel,
}: {
  icon: ReactNode;
  title: string;
  active: boolean;
  onClick: () => void;
  trailingLabel?: string;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors ${
      active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.05]'
    }`}
  >
    <div className="h-4 w-4 shrink-0 flex items-center justify-center">
      {icon}
    </div>
    <div className="min-w-0 flex-1 text-[13px] font-medium text-white">{title}</div>
    {!active && trailingLabel && (
      <span className="truncate max-w-[92px] text-[11px] text-white/36">{trailingLabel}</span>
    )}
    <div className="shrink-0">
      {active ? (
        <Check size={14} className="text-sky-300" />
      ) : (
        <ChevronRight size={15} className="text-white/32" />
      )}
    </div>
  </button>
);

export default ComposerInsertMenu;
