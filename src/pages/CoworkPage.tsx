import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, FolderOpen, Plus, ArrowRight, CalendarClock, Plug, Package, MessageSquare, Bot, User, Send } from 'lucide-react';
import TopNavBar from '@/components/TopNavBar';
import CoworkSidebar, { type CoworkView } from '@/components/cowork/CoworkSidebar';
import DispatchPanel from '@/components/cowork/DispatchPanel';
import MCPPanel from '@/components/cowork/MCPPanel';
import ExtensionsMarketplace from '@/components/cowork/ExtensionsMarketplace';
import { chatDirect, type ChatMessage as ChatMessageType } from '@/lib/api';
import { useStore } from '@/store/useStore';
import ModelSelector from '@/components/ModelSelector';


interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const sampleFiles = [
  { path: 'src/components/ChatPanel.tsx', type: 'TSX' },
  { path: 'src/pages/CodePage.tsx', type: 'TSX' },
  { path: 'src/lib/api.ts', type: 'TS' },
  { path: 'backend/app/main.py', type: 'PY' },
  { path: 'src/index.css', type: 'CSS' },
];

type _CoworkView = 'home' | 'dispatch' | 'mcp' | 'extensions' | 'chat';

const CoworkPage = () => {
  const model = useStore((s) => s.model);
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [activeView, setActiveView] = useState<CoworkView>('home');
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isStreaming]);

  const sendToChat = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    let fullContent = '';
    const chatMessages: ChatMessageType[] = [
      { role: 'system', content: 'Tu es un assistant polyvalent qui aide à accomplir des tâches. Réponds en français de manière concise et utile.' },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: text },
    ];
    chatDirect(
      chatMessages,
      model, null, false,
      (token) => {
        fullContent += token;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
      },
      () => { setIsStreaming(false); },
      (err) => {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `Erreur: ${err}` } : m));
        setIsStreaming(false);
      },
    );
  }, [messages, model, isStreaming]);

  const handleGoSubmit = () => { if (!input.trim()) return; setActiveView('chat'); sendToChat(input); setInput(''); };
  const handleChatSubmit = () => { if (!chatInput.trim()) return; sendToChat(chatInput); setChatInput(''); };

  const handleFileCardClick = (filePath: string) => {
    navigate('/code', { state: { openFile: filePath } });
  };

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

  const viewTabs: { id: CoworkView; label: string; icon: typeof CalendarClock }[] = [
    { id: 'home', label: 'Accueil', icon: FolderOpen },
    { id: 'dispatch', label: 'Dispatch', icon: CalendarClock },
    { id: 'mcp', label: 'MCP', icon: Plug },
    { id: 'extensions', label: 'Extensions', icon: Package },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[hsl(0,0%,10%)]">
      <TopNavBar />
      <div className="flex flex-1 min-h-0">
      <CoworkSidebar activeView={activeView} onChangeView={setActiveView} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* View tabs */}
        {activeView !== 'home' && (
          <div className="flex items-center gap-1 px-2 sm:px-3 py-2 border-b border-[hsl(0,0%,17%)] bg-[hsl(0,0%,11%)] overflow-x-auto scrollbar-none">
            {viewTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveView(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeView === tab.id ? 'bg-[hsl(0,0%,15%)] text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,13%)]'
                  }`}>
                  <Icon size={13} />{tab.label}
                </button>
              );
            })}
            {messages.length > 0 && (
              <button onClick={() => setActiveView('chat')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeView === 'chat' ? 'bg-[hsl(14,74%,52%)]/20 text-[hsl(14,74%,52%)]' : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,13%)]'
                }`}>
                <MessageSquare size={13} />Chat
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {activeView === 'home' && (
          <div className="flex-1 overflow-y-auto px-3 py-5 sm:px-8 sm:py-10 flex flex-col items-center" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
            {/* Hero */}
            <div className="text-center mb-4 sm:mb-[18px] w-full max-w-[680px]">
              <div className="flex items-center justify-center gap-2 sm:gap-2.5 mb-2 flex-wrap">
                <span className="text-[26px] sm:text-[32px] text-[hsl(14,74%,52%)]">✳</span>
                <h1 className="text-[22px] sm:text-[30px] font-bold text-foreground tracking-tight leading-tight">
                  Accomplissons une tâche de votre liste
                </h1>
              </div>
              <p className="text-[12px] sm:text-sm text-[hsl(14,74%,52%)]/60 mt-1 leading-relaxed">
                Apprenez à utiliser Cowork en toute sécurité.
              </p>
            </div>

            {/* File cards strip */}
            <div className="flex gap-2 sm:gap-[9px] w-full max-w-[740px] overflow-x-auto mb-4 pb-1.5 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
              {sampleFiles.map((file, i) => (
                <button key={i}
                  onClick={() => handleFileCardClick(file.path)}
                  className="flex-shrink-0 min-w-[100px] sm:min-w-[115px] max-w-[120px] sm:max-w-[125px] bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] rounded-lg p-2.5 text-left cursor-pointer hover:bg-[hsl(0,0%,17%)] hover:border-[hsl(14,74%,52%)]/30 active:scale-[0.97] transition-all">
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-[1.4] break-all mb-2 line-clamp-3">{file.path}</p>
                  <span className="inline-block text-[9px] sm:text-[10px] font-bold px-[5px] py-[2px] rounded-[3px] bg-[hsl(214,30%,24%)] text-[hsl(214,46%,63%)]">{file.type}</span>
                </button>
              ))}
            </div>

            {/* Input box */}
            <div className="bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] rounded-xl px-3 sm:px-3.5 py-3 w-full max-w-[680px] mb-4 sm:mb-[18px]">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGoSubmit()}
                placeholder="Tapez / pour les compétences"
                className="w-full bg-transparent border-none outline-none text-muted-foreground text-[14px] sm:text-[15px] placeholder:text-[hsl(0,0%,33%)]" />
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
                    className="bg-[hsl(14,74%,52%)] text-white border-none rounded-lg py-2 px-3 sm:px-3.5 text-[12px] sm:text-[13px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap active:bg-[hsl(14,74%,42%)] transition-colors">
                    C'est parti. <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeView === 'dispatch' && (
          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-6">
            <DispatchPanel />
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

        {activeView === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-8 space-y-4 max-w-[720px] mx-auto w-full">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 h-6 w-6 sm:h-7 sm:w-7 rounded-lg flex items-center justify-center ${
                    msg.role === 'user' ? 'bg-[hsl(14,74%,52%)]/20' : 'bg-[hsl(0,0%,20%)]'
                  }`}>
                    {msg.role === 'user' ? <User size={13} className="text-[hsl(14,74%,52%)]" /> : <Bot size={13} className="text-muted-foreground" />}
                  </div>
                  <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block text-left rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 max-w-full ${
                      msg.role === 'user' ? 'bg-[hsl(14,74%,52%)]/15 text-foreground' : 'bg-[hsl(0,0%,15%)] text-foreground/85'
                    }`}>
                      <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.content === '' && (
                <div className="flex gap-2 sm:gap-3">
                  <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-[hsl(0,0%,20%)] flex items-center justify-center">
                    <Bot size={13} className="text-muted-foreground animate-pulse" />
                  </div>
                  <div className="flex items-center gap-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-[hsl(0,0%,15%)]">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
            <div className="flex-shrink-0 px-3 pb-3 sm:px-8 sm:pb-4 max-w-[720px] mx-auto w-full" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
              <div className="flex items-center gap-2 rounded-xl border border-[hsl(0,0%,20%)] bg-[hsl(0,0%,15%)] px-3 sm:px-4 py-2.5 sm:py-3">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                  placeholder="Continuez la conversation..."
                  className="flex-1 bg-transparent text-[13px] sm:text-[14px] text-foreground outline-none placeholder:text-muted-foreground min-w-0" />
                <button onClick={handleChatSubmit} disabled={!chatInput.trim() || isStreaming}
                  className="bg-[hsl(14,74%,52%)] text-white border-none rounded-lg py-2 px-3 text-[12px] sm:text-[13px] font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-40 active:bg-[hsl(14,74%,42%)] shrink-0 transition-colors">
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default CoworkPage;
