import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, CalendarClock, FolderOpen, Send as Dispatch,
  Lightbulb, SlidersHorizontal, PanelLeftClose, PanelLeftOpen,
  Menu, X, Download, ChevronRight,
} from 'lucide-react';
import { useStore, type HistoryRun } from '@/store/useStore';
import { useAuthStore } from '@/store/authStore';
import HexLogo from '@/components/HexLogo';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

export type CoworkView = 'home' | 'dispatch' | 'mcp' | 'extensions' | 'chat' | 'projects' | 'ideas' | 'search';

interface CoworkSidebarProps {
  activeView: CoworkView;
  onChangeView: (view: CoworkView) => void;
}

const CoworkSidebar = ({ activeView, onChangeView }: CoworkSidebarProps) => {
  const history = useStore((s) => s.history);
  const reset = useStore((s) => s.reset);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const authUser = useAuthStore((s) => s.user);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const userInitial = authUser?.display_name?.trim().charAt(0).toUpperCase() || 'A';
  const userName = authUser?.display_name || 'Utilisateur';

  const menuItems = [
    { id: 'new', label: 'Nouvelle tâche.', icon: Plus, action: () => { reset(); onChangeView('home'); } },
    { id: 'search', label: 'Rechercher', icon: Search, action: () => onChangeView('search') },
    { id: 'scheduled', label: 'Programmé', icon: CalendarClock, action: () => onChangeView('dispatch') },
    { id: 'projects', label: 'Projets', icon: FolderOpen, action: () => onChangeView('projects') },
    { id: 'dispatch', label: 'Dispatch', icon: Dispatch, action: () => onChangeView('dispatch') },
    { id: 'ideas', label: 'Idées', icon: Lightbulb, action: () => onChangeView('ideas') },
    { id: 'customize', label: 'Personnaliser', icon: SlidersHorizontal, action: () => onChangeView('extensions') },
  ];

  const recentTasks = history.slice(0, 5);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[hsl(0,0%,10%)]">
      {/* Menu items */}
      <div className="px-3 py-3 space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { item.action(); setMobileOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-foreground/80 hover:bg-[hsl(0,0%,15%)] transition-colors active:scale-[0.98]"
            >
              <Icon size={16} className="text-muted-foreground flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Recents */}
      <div className="px-4 mt-2">
        <p className="text-xs text-muted-foreground mb-2">Récents</p>
        <div className="space-y-0.5">
          {recentTasks.length > 0 ? (
            recentTasks.map((run) => (
              <button
                key={run.run_id}
                onClick={() => { setMobileOpen(false); }}
                className="w-full text-left px-2 py-1.5 rounded-md text-sm text-foreground/70 hover:bg-[hsl(0,0%,15%)] transition-colors truncate"
              >
                {run.task.slice(0, 40)}
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground/60 px-2">Configurer Cowork</p>
          )}
        </div>
      </div>

      <p className="px-4 mt-3 text-[11px] text-muted-foreground/50 leading-relaxed">
        Ces tâches s'exécutent localement et ne sont pas synchronisées entre les appareils.
      </p>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User profile */}
      <div className="px-3 py-3 border-t border-[hsl(0,0%,15%)]">
        <div className="flex items-center gap-2.5 px-2">
          <div className="h-8 w-8 rounded-full bg-[hsl(0,0%,20%)] flex items-center justify-center text-xs font-semibold text-foreground">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{userName}</p>
            <p className="text-[11px] text-muted-foreground">Forfait Pro</p>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
              <Download size={14} />
            </button>
            <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-[52px] left-3 z-30 p-2 rounded-lg bg-[hsl(0,0%,13%)] border border-[hsl(0,0%,20%)] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu size={18} />
        </button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-[280px] bg-[hsl(0,0%,10%)] border-r border-[hsl(0,0%,17%)]">
            <SheetTitle className="sr-only">Menu Cowork</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (collapsed) {
    return (
      <div className="w-[52px] flex-shrink-0 bg-[hsl(0,0%,10%)] border-r border-[hsl(0,0%,17%)] flex flex-col items-center py-3">
        <button onClick={() => setCollapsed(false)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <PanelLeftOpen size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[260px] flex-shrink-0 bg-[hsl(0,0%,10%)] border-r border-[hsl(0,0%,17%)] flex flex-col h-full">
      <div className="flex items-center justify-end px-3 py-2">
        <button onClick={() => setCollapsed(true)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
          <PanelLeftClose size={15} />
        </button>
      </div>
      {sidebarContent}
    </div>
  );
};

export default CoworkSidebar;
