import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Plus, Mic, Paperclip, Bell, Sparkles, User, X,
  FileText, Globe as GlobeIcon, Monitor, Wand2, MoreHorizontal
} from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';
import SettingsModal from '@/components/SettingsModal';
import ConnectorConfigModal from '@/components/chat/ConnectorConfigModal';
import ConnectorsDirectoryModal from '@/components/chat/ConnectorsDirectoryModal';
import ConnectorQuickAccess from '@/components/chat/ConnectorQuickAccess';
import { useStore } from '@/store/useStore';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  CONNECTORS_UPDATED_EVENT,
  loadConnectors,
  saveConnectors,
  type ConnectorState,
} from '@/lib/connectors';
import { toast } from '@/components/ui/sonner';

const suggestions = [
  { icon: FileText, label: 'Create slides' },
  { icon: GlobeIcon, label: 'Build website' },
  { icon: Monitor, label: 'Develop apps' },
  { icon: Wand2, label: 'Design' },
  { icon: MoreHorizontal, label: 'More' },
];

const Welcome = () => {
  const [taskInput, setTaskInput] = useState('');
  const [connectors, setConnectors] = useState<ConnectorState[]>([]);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [configConnectorId, setConfigConnectorId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const setTask = useStore((s) => s.setTask);
  const openSettingsFor = useStore((s) => s.openSettingsFor);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncConnectors = () => setConnectors(loadConnectors());
    syncConnectors();
    window.addEventListener(CONNECTORS_UPDATED_EVENT, syncConnectors);

    return () => {
      window.removeEventListener(CONNECTORS_UPDATED_EVENT, syncConnectors);
    };
  }, []);

  const handleStart = () => {
    if (!taskInput.trim()) return;
    setTask(taskInput.trim());
    navigate('/dashboard');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    setAttachments((previous) => [...previous, ...Array.from(files)]);
    toast.success(`${files.length} file${files.length > 1 ? 's' : ''} attached`);
  };

  const removeAttachment = (index: number) => {
    setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  const handleSuggestion = (label: string) => {
    setTaskInput(label);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <TaskSidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 relative">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/hero-bg.png)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/90" />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            {/* On mobile, leave space for hamburger */}
            {isMobile && <div className="w-10" />}
            <span className="text-sm text-foreground font-medium">AgentOS 1.0</span>
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted-foreground mt-0.5">
              <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => openSettingsFor('integrations')}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-surface-elevated/50 active:scale-95"
            >
              <Bell size={17} />
            </button>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Sparkles size={15} className="text-accent" />
              <span className="text-xs tabular-nums font-medium">164</span>
            </div>
            <button
              onClick={() => openSettingsFor('personalization')}
              className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-bold active:scale-95"
            >
              A
            </button>
          </div>
        </div>

        {/* Plan banner */}
        <div className="relative z-10 flex justify-center pt-6 md:pt-8">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Free plan</span>
            <span className="text-muted-foreground/40">|</span>
            <button
              onClick={() => openSettingsFor('integrations')}
              className="text-accent hover:text-accent/80 transition-colors font-medium"
            >
              Start free trial
            </button>
          </div>
        </div>

        {/* Centered content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 md:px-8 -mt-4 md:-mt-8">
          <h1
            className="text-2xl md:text-4xl font-medium text-foreground text-center leading-tight mb-6 md:mb-10"
            style={{ fontFamily: "'Inter', system-ui, sans-serif", textWrap: 'balance' }}
          >
            What can I do for you?
          </h1>

          {/* Chat input */}
          <div className="w-full max-w-2xl">
            <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl overflow-hidden">
              {/* Text area */}
              <div className="px-4 md:px-5 pt-4 pb-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <textarea
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Assign a task or ask anything"
                  rows={2}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
              </div>

              {attachments.length > 0 && (
                <div className="px-4 md:px-5 pb-2 flex items-center gap-2 flex-wrap">
                  {attachments.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center gap-1.5 bg-muted border border-border rounded-lg px-2.5 py-1 text-xs text-foreground">
                      <Paperclip size={11} className="text-muted-foreground" />
                      <span className="truncate max-w-[140px]">{file.name}</span>
                      <button onClick={() => removeAttachment(index)} className="text-muted-foreground hover:text-foreground">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom bar */}
              <div className="flex items-center justify-between px-3 md:px-4 pb-3">
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setDirectoryOpen(true)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated/50 transition-colors active:scale-95"
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated/50 transition-colors active:scale-95"
                  >
                    <Paperclip size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => toast.message('Voice input is the next UI layer to wire into the backend.')}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated/50 transition-colors active:scale-95"
                  >
                    <Mic size={16} />
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={!taskInput.trim()}
                    className="ml-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-30 active:scale-95"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Connect tools row */}
            <div className="mt-2">
              <ConnectorQuickAccess
                connectors={connectors}
                onSelect={setConfigConnectorId}
                onOpenDirectory={() => setDirectoryOpen(true)}
                onOpenSettings={() => openSettingsFor('connectors')}
              />
            </div>
          </div>

          {/* Suggestion chips — horizontal scroll on mobile */}
          <div className="w-full max-w-2xl mt-6 md:mt-8">
            <div className="flex items-center gap-2 md:gap-2.5 overflow-x-auto scrollbar-thin pb-2 md:justify-center">
              {suggestions.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => handleSuggestion(label)}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm text-xs md:text-sm text-muted-foreground hover:text-foreground hover:bg-card/70 hover:border-border transition-all active:scale-[0.97] shrink-0"
                >
                  <Icon size={15} />
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-4 md:h-8" />
      </div>

      <SettingsModal />
      <ConnectorsDirectoryModal
        open={directoryOpen}
        connectors={connectors}
        onClose={() => setDirectoryOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        onSelectConnector={(id) => {
          setDirectoryOpen(false);
          setConfigConnectorId(id);
        }}
      />
      <ConnectorConfigModal
        connectorId={configConnectorId}
        onClose={() => setConfigConnectorId(null)}
        onSave={(id, connected) => {
          setConnectors((previous) => {
            const next = previous.map((connector) =>
              connector.id === id ? { ...connector, connected } : connector,
            );
            saveConnectors(next);
            return next;
          });
          setConfigConnectorId(null);
        }}
      />
    </div>
  );
};

export default Welcome;
