import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, User, Send, FileText, X, Maximize2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatDirect, type ChatMessage as ChatMessageType } from '@/lib/api';
import { useStore } from '@/store/useStore';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Artifact {
  id: string;
  type: 'document' | 'code' | 'table' | 'html';
  title: string;
  content: string;
  language?: string;
}

interface CoworkChatViewProps {
  initialMessage?: string;
}

const CoworkChatView = ({ initialMessage }: CoworkChatViewProps) => {
  const model = useStore((s) => s.model);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const initialSent = useRef(false);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const extractArtifacts = (content: string): Artifact[] => {
    const artifacts: Artifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const lang = match[1] || 'text';
      const code = match[2].trim();
      if (code.length > 100) {
        artifacts.push({
          id: `artifact-${Date.now()}-${artifacts.length}`,
          type: lang === 'html' ? 'html' : 'code',
          title: `${lang.toUpperCase()} - ${code.slice(0, 30)}...`,
          content: code,
          language: lang,
        });
      }
    }
    return artifacts;
  };

  const sendToChat = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    let fullContent = '';
    const chatMessages: ChatMessageType[] = [
      { role: 'system', content: `Tu es un assistant Cowork polyvalent et professionnel. Tu aides à accomplir des tâches complexes : créer des documents, analyser des données, écrire du code, planifier des projets. 

Règles :
- Réponds toujours en français
- Sois concis mais complet
- Utilise le markdown pour structurer tes réponses (titres, listes, tableaux, blocs de code)
- Quand tu crées du contenu (code, document, tableau), utilise des blocs de code markdown avec le langage approprié
- Propose des actions concrètes et des prochaines étapes` },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: text },
    ];

    chatDirect(
      chatMessages, model, null, false,
      (token) => {
        fullContent += token;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
      },
      () => {
        setIsStreaming(false);
        const newArtifacts = extractArtifacts(fullContent);
        if (newArtifacts.length > 0) {
          setArtifacts(prev => [...prev, ...newArtifacts]);
          setActiveArtifact(newArtifacts[0]);
          setArtifactPanelOpen(true);
        }
      },
      (err) => {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `❌ Erreur: ${err}` } : m));
        setIsStreaming(false);
      },
    );
  }, [messages, model, isStreaming]);

  useEffect(() => {
    if (initialMessage && !initialSent.current) {
      initialSent.current = true;
      sendToChat(initialMessage);
    }
  }, [initialMessage, sendToChat]);

  const handleSubmit = () => {
    if (!chatInput.trim()) return;
    sendToChat(chatInput);
    setChatInput('');
  };

  return (
    <div className="flex-1 flex min-h-0">
      {/* Chat panel */}
      <div className={`flex flex-col min-h-0 ${artifactPanelOpen ? 'w-1/2 border-r border-[hsl(0,0%,17%)]' : 'flex-1'} transition-all`}>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center mt-1 ${
                msg.role === 'user' ? 'bg-[hsl(14,74%,52%)]/20' : 'bg-[hsl(0,0%,20%)]'
              }`}>
                {msg.role === 'user'
                  ? <User size={14} className="text-[hsl(14,74%,52%)]" />
                  : <Bot size={14} className="text-muted-foreground" />}
              </div>
              <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block text-left rounded-xl px-4 py-3 max-w-[90%] ${
                  msg.role === 'user'
                    ? 'bg-[hsl(14,74%,52%)]/15 text-foreground'
                    : 'bg-[hsl(0,0%,14%)] text-foreground/90'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none text-[13px] leading-relaxed
                      [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-3 [&_h1]:mb-2
                      [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-2.5 [&_h2]:mb-1.5
                      [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-foreground/90
                      [&_p]:text-foreground/85 [&_p]:mb-2 [&_p]:last:mb-0
                      [&_ul]:text-foreground/80 [&_ul]:my-1.5 [&_ul]:pl-4
                      [&_ol]:text-foreground/80 [&_ol]:my-1.5 [&_ol]:pl-4
                      [&_li]:mb-0.5
                      [&_code]:bg-[hsl(0,0%,20%)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:text-[hsl(14,74%,62%)]
                      [&_pre]:bg-[hsl(0,0%,12%)] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto
                      [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground/80
                      [&_table]:w-full [&_table]:my-2
                      [&_th]:text-left [&_th]:px-2 [&_th]:py-1 [&_th]:border-b [&_th]:border-[hsl(0,0%,25%)] [&_th]:text-foreground/90 [&_th]:text-[12px]
                      [&_td]:px-2 [&_td]:py-1 [&_td]:border-b [&_td]:border-[hsl(0,0%,18%)] [&_td]:text-[12px]
                      [&_strong]:text-foreground [&_strong]:font-semibold
                      [&_a]:text-[hsl(14,74%,52%)] [&_a]:no-underline [&_a]:hover:underline
                      [&_blockquote]:border-l-2 [&_blockquote]:border-[hsl(14,74%,52%)]/40 [&_blockquote]:pl-3 [&_blockquote]:text-foreground/60
                    ">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-lg bg-[hsl(0,0%,20%)] flex items-center justify-center">
                <Bot size={14} className="text-muted-foreground animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[hsl(0,0%,14%)]">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat input */}
        <div className="flex-shrink-0 px-4 pb-4" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-center gap-2 rounded-xl border border-[hsl(0,0%,20%)] bg-[hsl(0,0%,14%)] px-4 py-3">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              placeholder="Continuez la conversation..."
              className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground min-w-0"
            />
            <button
              onClick={handleSubmit}
              disabled={!chatInput.trim() || isStreaming}
              className="bg-[hsl(14,74%,52%)] text-white border-none rounded-lg py-2 px-3 text-[12px] font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-40 active:bg-[hsl(14,74%,42%)] shrink-0 transition-colors"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Artifact/Result panel */}
      {artifactPanelOpen && activeArtifact && (
        <div className="w-1/2 flex flex-col min-h-0 bg-[hsl(0,0%,11%)]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(0,0%,17%)]">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={14} className="text-[hsl(14,74%,52%)] flex-shrink-0" />
              <span className="text-xs font-medium text-foreground truncate">{activeArtifact.title}</span>
            </div>
            <div className="flex items-center gap-1">
              {artifacts.length > 1 && (
                <div className="flex items-center gap-1 mr-2">
                  {artifacts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setActiveArtifact(a)}
                      className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                        a.id === activeArtifact.id
                          ? 'bg-[hsl(14,74%,52%)]/20 text-[hsl(14,74%,52%)]'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {a.language?.toUpperCase() || 'DOC'}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setArtifactPanelOpen(false)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {activeArtifact.type === 'html' ? (
              <iframe
                srcDoc={activeArtifact.content}
                className="w-full h-full rounded-lg border border-[hsl(0,0%,20%)] bg-white"
                sandbox="allow-scripts"
                title={activeArtifact.title}
              />
            ) : (
              <pre className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono bg-[hsl(0,0%,8%)] rounded-lg p-4 h-full overflow-auto">
                <code>{activeArtifact.content}</code>
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoworkChatView;
