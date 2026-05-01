import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, FolderOpen, Plus, ArrowRight } from 'lucide-react';
import CoworkSidebar, { type CoworkView } from '@/components/cowork/CoworkSidebar';
import CoworkChatView from '@/components/cowork/CoworkChatView';
import DispatchPanel from '@/components/cowork/DispatchPanel';
import MCPPanel from '@/components/cowork/MCPPanel';
import ExtensionsMarketplace from '@/components/cowork/ExtensionsMarketplace';
import ProjectsPanel from '@/components/cowork/ProjectsPanel';
import IdeasPanel from '@/components/cowork/IdeasPanel';
import SearchPanel from '@/components/cowork/SearchPanel';
import { useStore } from '@/store/useStore';
import { useCoworkStore } from '@/store/coworkStore';
import ModelSelector from '@/components/ModelSelector';

const sampleFiles = [
  { path: 'src/components/ChatPanel.tsx', type: 'TSX' },
  { path: 'src/pages/CodePage.tsx', type: 'TSX' },
  { path: 'src/lib/api.ts', type: 'TS' },
  { path: 'backend/app/main.py', type: 'PY' },
  { path: 'src/index.css', type: 'CSS' },
];

const CoworkPage = () => {
  const model = useStore((s) => s.model);
  const navigate = useNavigate();
  const { setActiveConversation, activeConversationId } = useCoworkStore();
  const [input, setInput] = useState('');
  const [activeView, setActiveView] = useState<CoworkView>('home');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState('');
  const [chatProjectId, setChatProjectId] = useState<string | undefined>();

  const getModelShortName = () => {
    const parts = model.split('-');
    if (model.includes('claude')) {
      const name = parts.find(p => ['sonnet', 'opus', 'haiku'].includes(p));
      const version = parts.slice(-1)[0];
      return `${name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Claude'} ${version}`;
    }
    if (model.includes('gpt')) return model.replace('gpt-', 'GPT-');
    if (model.includes('deepseek')) return 'DeepSeek';
    return model;
  };

  const handleGoSubmit = () => {
    if (!input.trim()) return;
    setActiveConversation(null);
    setChatInitialMessage(input);
    setChatProjectId(undefined);
    setInput('');
    setActiveView('chat');
  };

  const handleOpenProjectChat = (projectId: string) => {
    setActiveConversation(null);
    setChatProjectId(projectId);
    setChatInitialMessage('');
    setActiveView('chat');
  };

  const handleOpenConversation = (conversationId: string) => {
    setChatInitialMessage('');
    setChatProjectId(undefined);
    setActiveView('chat');
  };

  const handleDispatchSendTask = (task: string) => {
    setActiveConversation(null);
    setChatInitialMessage(task);
    setChatProjectId(undefined);
    setActiveView('chat');
  };

  const handleFileCardClick = (filePath: string) => {
    navigate('/code', { state: { openFile: filePath } });
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[hsl(0,0%,10%)]">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-[hsl(0,0%,10%)]">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-white/10"
          aria-label="Retour"
        >
          <ArrowLeft size={16} />
          <span className="text-xs">Retour</span>
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        <CoworkSidebar
          activeView={activeView}
          onChangeView={setActiveView}
          onOpenConversation={handleOpenConversation}
        />
        <div className="flex-1 flex flex-col min-w-0">

          {activeView === 'home' && (
            <div className="flex-1 overflow-y-auto px-3 py-5 sm:px-8 sm:py-10 flex flex-col items-center" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
              <div className="text-center mb-4 sm:mb-[18px] w-full max-w-[680px]">
                <div className="flex items-center justify-center gap-2 sm:gap-2.5 mb-2 flex-wrap">
                  <span className="text-[26px] sm:text-[32px] text-primary">✳</span>
                  <h1 className="text-[22px] sm:text-[30px] font-bold text-foreground tracking-tight leading-tight">
                    Accomplissons une tâche de votre liste
                  </h1>
                </div>
                <p className="text-[12px] sm:text-sm text-primary/60 mt-1 leading-relaxed">
                  Décrivez ce que vous souhaitez — Cowork s'occupe du reste.
                </p>
              </div>

              <div className="flex gap-2 sm:gap-[9px] w-full max-w-[740px] overflow-x-auto mb-4 pb-1.5 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                {sampleFiles.map((file, i) => (
                  <button key={i}
                    onClick={() => handleFileCardClick(file.path)}
                    className="flex-shrink-0 min-w-[100px] sm:min-w-[115px] max-w-[120px] sm:max-w-[125px] bg-[hsl(var(--surface))] border border-border rounded-lg p-2.5 text-left cursor-pointer hover:bg-[hsl(var(--surface-elevated))] hover:border-primary/30 active:scale-[0.97] transition-all">
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-[1.4] break-all mb-2 line-clamp-3">{file.path}</p>
                    <span className="inline-block text-[9px] sm:text-[10px] font-bold px-[5px] py-[2px] rounded-[3px] bg-[hsl(214,30%,24%)] text-[hsl(214,46%,63%)]">{file.type}</span>
                  </button>
                ))}
              </div>

              <div className="bg-[hsl(var(--surface))] border border-border rounded-xl px-3 sm:px-3.5 py-3 w-full max-w-[680px] mb-4 sm:mb-[18px]">
                <input value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGoSubmit()}
                  placeholder="Décrivez une tâche à accomplir..."
                  className="w-full bg-transparent border-none outline-none text-muted-foreground text-[14px] sm:text-[15px] placeholder:text-muted-foreground/50" />
                <div className="flex items-center justify-between mt-2.5 gap-1">
                  <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
                    <button onClick={() => navigate('/code')}
                      className="flex items-center gap-1 bg-transparent border-none text-muted-foreground text-[11px] sm:text-[12.5px] cursor-pointer px-1 py-1 rounded-md whitespace-nowrap overflow-hidden shrink-0 hover:text-foreground transition-colors">
                      <FolderOpen size={13} className="flex-shrink-0" />
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis hidden sm:inline">Travailler dans un projet</span>
                      <ChevronDown size={11} className="flex-shrink-0" />
                    </button>
                    <button className="bg-transparent border-none text-muted-foreground cursor-pointer px-1 py-0.5 text-base leading-none flex-shrink-0 hover:text-foreground transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 relative">
                    <button
                      onClick={() => setShowModelSelector(!showModelSelector)}
                      className="flex items-center gap-1 bg-transparent border-none text-muted-foreground text-[11px] sm:text-[12.5px] cursor-pointer whitespace-nowrap hover:text-foreground transition-colors">
                      {getModelShortName()} <ChevronDown size={11} />
                    </button>
                    {showModelSelector && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowModelSelector(false)} />
                        <div className="absolute bottom-full right-0 mb-2 z-50">
                          <ModelSelector />
                        </div>
                      </>
                    )}
                    <button onClick={handleGoSubmit}
                      className="bg-primary text-primary-foreground border-none rounded-lg py-2 px-3 sm:px-3.5 text-[12px] sm:text-[13px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap active:bg-primary/80 transition-colors">
                      C'est parti. <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'chat' && (
            <CoworkChatView
              key={activeConversationId || chatInitialMessage || 'new'}
              initialMessage={chatInitialMessage}
              projectId={chatProjectId}
            />
          )}

          {activeView === 'dispatch' && (
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-6">
              <DispatchPanel onSendTask={handleDispatchSendTask} />
            </div>
          )}

          {activeView === 'mcp' && (
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-6">
              <MCPPanel />
            </div>
          )}

          {activeView === 'extensions' && (
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-6">
              <ExtensionsMarketplace />
            </div>
          )}

          {activeView === 'projects' && (
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-6">
              <ProjectsPanel onOpenChat={handleOpenProjectChat} />
            </div>
          )}

          {activeView === 'ideas' && (
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-6">
              <IdeasPanel />
            </div>
          )}

          {activeView === 'search' && (
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-6">
              <SearchPanel />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default CoworkPage;
