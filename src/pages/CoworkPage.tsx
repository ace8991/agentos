import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, FolderOpen, Plus, ArrowRight, Check, CalendarClock, Plug, Package, MessageSquare, X, Bot, User, Send } from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';
import DispatchPanel from '@/components/cowork/DispatchPanel';
import MCPPanel from '@/components/cowork/MCPPanel';
import ExtensionsMarketplace from '@/components/cowork/ExtensionsMarketplace';
import { chatDirect } from '@/lib/api';
import { useStore } from '@/store/useStore';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  done: boolean;
  action?: () => void;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const sampleFiles = [
  { path: 'C:\\Users\\User\\AppData\\Roaming\\Claude\\Claude Extensions\\ant...', type: 'JS' },
  { path: 'C:\\Users\\User\\AppData\\Roaming\\Claude\\Claude Extensions\\ant...', type: 'JS' },
  { path: 'C:\\Users\\User\\AppData\\Roaming\\Claude\\Claude Extensions\\ant...', type: 'JS' },
  { path: 'C:\\Users\\User\\AppData\\Roaming\\Claude\\Claude Extensions\\ant...', type: 'JS' },
  { path: 'C:\\Users\\User\\AppData\\Roaming\\Claude\\Claude Extensions\\ant...', type: 'JS' },
];

type CoworkView = 'home' | 'dispatch' | 'mcp' | 'extensions' | 'chat';

const CoworkPage = () => {
  const model = useStore((s) => s.model);
  const [input, setInput] = useState('');
  const [activeView, setActiveView] = useState<CoworkView>('home');

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: 'download', label: 'Télécharger Cowork', description: 'Bienvenue !', done: true },
    { id: 'connect-tools', label: 'Connectez vos outils quotidiens', description: 'Plus Claude connaît votre configuration, plus il peut en faire', done: false },
    { id: 'create-something', label: 'Demandez à Claude de créer quelque chose.', description: 'Essayez un tableur, un document ou une présentation', done: false },
    { id: 'schedule-task', label: 'Planifier une tâche récurrente', description: 'Idéal pour les rappels, rapports ou suivis réguliers', done: false },
  ]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const toggleItem = (id: string) => {
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
    // Navigate to relevant view on click
    if (id === 'connect-tools') setActiveView('mcp');
    if (id === 'schedule-task') setActiveView('dispatch');
  };

  const sendToChat = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    let fullContent = '';
    chatDirect(
      [
        { role: 'system', content: 'Tu es un assistant polyvalent qui aide à accomplir des tâches. Réponds en français de manière concise et utile.' },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ],
      model,
      null,
      false,
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

  const handleGoSubmit = () => {
    if (!input.trim()) return;
    setActiveView('chat');
    sendToChat(input);
    setInput('');
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;
    sendToChat(chatInput);
    setChatInput('');
  };

  // ─── Sub-view tabs ───────────────────────────────────────
  const viewTabs: { id: CoworkView; label: string; icon: typeof CalendarClock }[] = [
    { id: 'home', label: 'Accueil', icon: FolderOpen },
    { id: 'dispatch', label: 'Dispatch', icon: CalendarClock },
    { id: 'mcp', label: 'MCP', icon: Plug },
    { id: 'extensions', label: 'Extensions', icon: Package },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#1a1a1a]">
      <TaskSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* View tabs */}
        {activeView !== 'home' && (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[#2a2a2a] bg-[#1c1c1c]">
            {viewTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveView(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    activeView === tab.id ? 'bg-[#252525] text-[#e0e0e0]' : 'text-[#888] hover:text-[#ccc] hover:bg-[#222]'
                  }`}>
                  <Icon size={13} />{tab.label}
                </button>
              );
            })}
            {messages.length > 0 && (
              <button onClick={() => setActiveView('chat')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  activeView === 'chat' ? 'bg-[#e05a2b]/20 text-[#e05a2b]' : 'text-[#888] hover:text-[#ccc] hover:bg-[#222]'
                }`}>
                <MessageSquare size={13} />Chat
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {activeView === 'home' && (
          <div className="flex-1 overflow-y-auto px-3.5 py-6 sm:px-8 sm:py-10 flex flex-col items-center" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
            {/* Hero */}
            <div className="text-center mb-[18px] w-full max-w-[680px]">
              <div className="flex items-center justify-center gap-2.5 mb-1.5 flex-wrap">
                <span className="text-[26px] text-[#e05a2b]">✳</span>
                <h1 className="text-[19px] sm:text-[23px] font-bold text-[#e8e8e8] tracking-tight leading-tight">
                  Accomplissons une tâche de votre liste
                </h1>
              </div>
              <p className="text-xs text-[#666] mt-[5px] leading-relaxed">
                Cowork est en aperçu de recherche. <a href="#" className="text-[#888] underline cursor-pointer">Découvrez comment l'utiliser en toute sécurité.</a>
              </p>
            </div>

            {/* File cards strip */}
            <div className="flex gap-[9px] w-full max-w-[740px] overflow-x-auto mb-4 pb-1.5 scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>
              {sampleFiles.map((file, i) => (
                <button key={i} className="flex-shrink-0 min-w-[115px] max-w-[125px] bg-[#252525] border border-[#333] rounded-lg p-[11px_10px_9px] text-left cursor-pointer active:bg-[#2a2a2a]">
                  <p className="text-[10px] text-[#777] leading-[1.4] break-all mb-[9px]">{file.path}</p>
                  <span className="inline-block text-[10px] font-bold px-[5px] py-[2px] rounded-[3px] bg-[#2a3a50] text-[#6aa3d4]">{file.type}</span>
                </button>
              ))}
            </div>

            {/* Input box */}
            <div className="bg-[#252525] border border-[#333] rounded-xl px-3.5 py-[13px] w-full max-w-[680px] mb-[18px]">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGoSubmit()}
                placeholder="Que souhaitez-vous accomplir ?"
                className="w-full bg-transparent border-none outline-none text-[#777] text-[15px] placeholder:text-[#555]" />
              <div className="flex items-center justify-between mt-[11px] gap-1.5">
                <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                  <button className="flex items-center gap-[5px] bg-transparent border-none text-[#777] text-[12.5px] cursor-pointer px-1 py-[5px] rounded-md whitespace-nowrap overflow-hidden">
                    <FolderOpen size={14} className="flex-shrink-0" />
                    <span className="whitespace-nowrap overflow-hidden text-ellipsis hidden min-[381px]:inline">Travailler dans un projet</span>
                    <ChevronDown size={12} className="flex-shrink-0" />
                  </button>
                  <button className="bg-transparent border-none text-[#555] cursor-pointer px-1.5 py-1 text-lg leading-none flex-shrink-0">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button className="flex items-center gap-1 bg-transparent border-none text-[#888] text-[12.5px] cursor-pointer whitespace-nowrap">
                    Sonnet 4.6 <ChevronDown size={12} />
                  </button>
                  <button onClick={handleGoSubmit}
                    className="bg-[#e05a2b] text-white border-none rounded-lg py-[9px] px-3.5 text-[13px] font-semibold cursor-pointer flex items-center gap-[5px] whitespace-nowrap active:bg-[#c04518]">
                    C'est parti. <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick actions row */}
            <div className="flex gap-2 w-full max-w-[680px] mb-5 overflow-x-auto pb-1">
              <button onClick={() => setActiveView('dispatch')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-[#252525] border border-[#333] text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a] whitespace-nowrap">
                <CalendarClock size={13} />Dispatch
              </button>
              <button onClick={() => setActiveView('mcp')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-[#252525] border border-[#333] text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a] whitespace-nowrap">
                <Plug size={13} />MCP Servers
              </button>
              <button onClick={() => setActiveView('extensions')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-[#252525] border border-[#333] text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a] whitespace-nowrap">
                <Package size={13} />Extensions
              </button>
            </div>

            {/* Discover section */}
            <div className="w-full max-w-[680px]">
              <h2 className="text-[15px] font-semibold text-[#bbb] mb-3">Découvrez Cowork.</h2>
              {checklist.map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-[13px] border-b border-[#252525] last:border-b-0 cursor-pointer"
                  onClick={() => toggleItem(item.id)}>
                  <div className={`w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 mt-[1px] ${
                    item.done ? 'bg-[#555] border-[#555]' : 'border-[#444]'
                  }`}>
                    {item.done && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13.5px] font-medium ${item.done ? 'text-[#999] line-through' : 'text-[#ccc]'}`}>{item.label}</p>
                    <p className="text-xs text-[#666] mt-[3px] leading-[1.45]">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'dispatch' && (
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <DispatchPanel />
          </div>
        )}

        {activeView === 'mcp' && (
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <MCPPanel />
          </div>
        )}

        {activeView === 'extensions' && (
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <ExtensionsMarketplace />
          </div>
        )}

        {activeView === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 space-y-4 max-w-[720px] mx-auto w-full">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${
                    msg.role === 'user' ? 'bg-[#e05a2b]/20' : 'bg-[#333]'
                  }`}>
                    {msg.role === 'user' ? <User size={14} className="text-[#e05a2b]" /> : <Bot size={14} className="text-[#888]" />}
                  </div>
                  <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block text-left rounded-xl px-4 py-3 max-w-full ${
                      msg.role === 'user' ? 'bg-[#e05a2b]/15 text-[#e0e0e0]' : 'bg-[#252525] text-[#ccc]'
                    }`}>
                      <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.content === '' && (
                <div className="flex gap-3">
                  <div className="h-7 w-7 rounded-lg bg-[#333] flex items-center justify-center">
                    <Bot size={14} className="text-[#888] animate-pulse" />
                  </div>
                  <div className="flex items-center gap-1 px-4 py-3 rounded-xl bg-[#252525]">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#888] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-[#888] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-[#888] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
            <div className="flex-shrink-0 px-4 pb-4 sm:px-8 max-w-[720px] mx-auto w-full">
              <div className="flex items-center gap-2 rounded-xl border border-[#333] bg-[#252525] px-4 py-3">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                  placeholder="Continuez la conversation..."
                  className="flex-1 bg-transparent text-[14px] text-[#ccc] outline-none placeholder:text-[#555]" />
                <button onClick={handleChatSubmit} disabled={!chatInput.trim() || isStreaming}
                  className="bg-[#e05a2b] text-white border-none rounded-lg py-2 px-3.5 text-[13px] font-semibold cursor-pointer flex items-center gap-[5px] disabled:opacity-40 active:bg-[#c04518]">
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoworkPage;
