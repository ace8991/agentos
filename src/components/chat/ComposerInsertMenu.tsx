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
      const panelWidth = Math.min(340, Math.max(viewportWidth - 24, 260));
      const left = Math.max(12, Math.min(rect.left, viewportWidth - panelWidth - 12));
      const top = rect.top - 12;
      const maxHeight = Math.max(240, window.innerHeight - 24);

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
        className="pointer-events-auto fixed overflow-y-auto rounded-[26px] border border-white/10 bg-[rgba(18,20,27,0.94)] backdrop-blur-2xl shadow-[0_28px_90px_rgba(0,0,0,0.46)] p-2.5"
        style={style}
      >
        <div className="px-2.5 pb-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Insert</p>
        </div>

        <div className="space-y-1">
          <MenuRow
            icon={<Paperclip size={16} className="text-white/82" />}
            title="Add files or photos"
            subtitle="Import documents, screenshots, and references"
            onClick={onAddFiles}
          />
          <MenuRow
            icon={<ImagePlus size={16} className="text-white/82" />}
            title="Import images"
            subtitle="Attach mockups, product photos, and visual inspiration"
            onClick={onAddImages}
          />
          <MenuRow
            icon={<ConnectorLogo connectorId="google-drive" name="Google Drive" badge="GD" size="sm" className="border-white/12 bg-white/[0.03]" />}
            title="Add from Google Drive"
            subtitle="Connect or review Drive access for file workflows"
            onClick={onOpenGoogleDrive}
            trailing={<ChevronRight size={15} className="text-white/32" />}
          />
          <MenuRow
            icon={<ConnectorLogo connectorId="github" name="GitHub" badge="GH" size="sm" className="border-white/12 bg-white/[0.03]" />}
            title="Add from GitHub"
            subtitle="Bring repositories, issues, and code context into tasks"
            onClick={onOpenGitHub}
            trailing={<ChevronRight size={15} className="text-white/32" />}
          />
        </div>

        <div className="my-2 h-px bg-white/8" />

        <div className="space-y-1">
          <MenuRow
            icon={<Sparkles size={16} className="text-accent" />}
            title="Skills"
            subtitle="Open reusable skills and custom instructions"
            onClick={onOpenSkills}
            trailing={<ChevronRight size={15} className="text-white/32" />}
          />
          <MenuRow
            icon={<Layers3 size={16} className="text-white/82" />}
            title="Connectors"
            subtitle={connectedCount > 0 ? `${connectedCount} connected and ready to use` : 'Set up apps like GitHub, Canva, Telegram, and more'}
            onClick={onOpenConnectors}
            trailing={
              connectedCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-200">
                  <Check size={11} />
                  Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-medium text-amber-200">
                  <TriangleAlert size={11} />
                  Setup
                </span>
              )
            }
          />
        </div>

        <div className="my-2 h-px bg-white/8" />

        <div className="space-y-1">
          <ToggleRow
            icon={<Search size={16} className={webSearchEnabled ? 'text-sky-300' : 'text-sky-400'} />}
            title="Web research"
            subtitle="Verify unstable facts and enrich answers with live sources"
            active={webSearchEnabled}
            onClick={onToggleWebSearch}
          />
          <ToggleRow
            icon={<Wand2 size={16} className={useStyleEnabled ? 'text-fuchsia-200' : 'text-fuchsia-300'} />}
            title="Use saved style"
            subtitle={`Apply your ${responseStyleLabel.toLowerCase()} response profile`}
            active={useStyleEnabled}
            onClick={onToggleUseStyle}
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
  subtitle,
  onClick,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  trailing?: ReactNode;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 rounded-[20px] px-3 py-3 text-left hover:bg-white/[0.05] transition-colors"
  >
    <div className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center overflow-hidden">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-white/55">{subtitle}</p>
    </div>
    {trailing && <div className="shrink-0">{trailing}</div>}
  </button>
);

const ToggleRow = ({
  icon,
  title,
  subtitle,
  active,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 rounded-[20px] px-3 py-3 text-left transition-colors ${
      active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.05]'
    }`}
  >
    <div className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-white/55">{subtitle}</p>
    </div>
    <div className="shrink-0">
      {active ? (
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-sky-300/20 bg-sky-400/10 px-2 text-[11px] font-medium text-sky-100">
          <Check size={12} />
        </span>
      ) : (
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-2 text-[11px] font-medium text-white/38">
          Off
        </span>
      )}
    </div>
  </button>
);

export default ComposerInsertMenu;
