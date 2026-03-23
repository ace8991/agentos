import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Plus, Mic, Paperclip, Bell, Sparkles, User,
  FileText, Globe as GlobeIcon, Monitor, Wand2, MoreHorizontal
} from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';
import SettingsModal from '@/components/SettingsModal';
import { useStore } from '@/store/useStore';
import { useIsMobile } from '@/hooks/use-mobile';

const suggestions = [
  { icon: FileText, label: 'Create slides' },
  { icon: GlobeIcon, label: 'Build website' },
  { icon: Monitor, label: 'Develop apps' },
  { icon: Wand2, label: 'Design' },
  { icon: MoreHorizontal, label: 'More' },
];

const Welcome = () => {
  const [taskInput, setTaskInput] = useState('');
  const setTask = useStore((s) => s.setTask);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleStart = () => {
    if (!taskInput.trim()) return;
    setTask(taskInput.trim());
    navigate('/dashboard');
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
            <button className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-surface-elevated/50 active:scale-95">
              <Bell size={17} />
            </button>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Sparkles size={15} className="text-accent" />
              <span className="text-xs tabular-nums font-medium">164</span>
            </div>
            <button className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-bold active:scale-95">
              A
            </button>
          </div>
        </div>

        {/* Plan banner */}
        <div className="relative z-10 flex justify-center pt-6 md:pt-8">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Free plan</span>
            <span className="text-muted-foreground/40">|</span>
            <button className="text-accent hover:text-accent/80 transition-colors font-medium">
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

              {/* Bottom bar */}
              <div className="flex items-center justify-between px-3 md:px-4 pb-3">
                <div className="flex items-center gap-0.5">
                  <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated/50 transition-colors active:scale-95">
                    <Plus size={18} />
                  </button>
                  <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated/50 transition-colors active:scale-95">
                    <Paperclip size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-0.5">
                  <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated/50 transition-colors active:scale-95">
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
            <div className="flex items-center justify-between mt-2 px-1 md:px-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip size={13} />
                <span className="hidden sm:inline">Connect your tools to AgentOS</span>
                <span className="sm:hidden">Connect tools</span>
              </div>
              <div className="flex items-center gap-1">
                {['🟢', '📧', '📊', '💬', '📝'].map((emoji, i) => (
                  <span key={i} className="w-5 h-5 flex items-center justify-center text-xs opacity-60 hover:opacity-100 cursor-pointer transition-opacity">
                    {emoji}
                  </span>
                ))}
              </div>
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
    </div>
  );
};

export default Welcome;
