import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, User, Send, FileText, X, FolderOpen, CheckCircle2,
  Loader2, Brain, Search, FileEdit, FileCode, Monitor, ListChecks,
  Eye, ChevronDown, ChevronRight, Paperclip
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatDirect, type ChatMessage as ChatMessageType } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { useCoworkStore, type ActionStep, type CoworkMessage } from '@/store/coworkStore';

interface Artifact {
  id: string;
  type: 'document' | 'code' | 'table' | 'html';
  title: string;
  content: string;
  language?: string;
}

interface CoworkChatViewProps {
  initialMessage?: string;
  projectId?: string;
}

const stepIcons: Record<ActionStep['type'], typeof Brain> = {
  thinking: Brain,
  file_read: Eye,
  file_write: FileEdit,
  search: Search,
  analyze: Brain,
  create: FileCode,
  execute: Monitor,
  computer_use: Monitor,
  plan: ListChecks,
};

const stepLabels: Record<ActionStep['type'], string> = {
  thinking: 'Réflexion...',
  file_read: 'Lecture du fichier',
  file_write: 'Écriture du fichier',
  search: 'Recherche en cours',
  analyze: 'Analyse des données',
  create: 'Création du document',
  execute: 'Exécution de la commande',
  computer_use: 'Contrôle du bureau',
  plan: 'Élaboration du plan',
};

const simulateActionSteps = (): ActionStep[] => {
  const possibleFlows: ActionStep['type'][][] = [
    ['thinking', 'search', 'analyze', 'create'],
    ['thinking', 'file_read', 'analyze', 'file_write'],
    ['thinking', 'plan', 'execute', 'create'],
    ['thinking', 'search', 'file_read', 'file_write'],
  ];
  const flow = possibleFlows[Math.floor(Math.random() * possibleFlows.length)];
  return flow.map((type, i) => ({
    id: `step-${Date.now()}-${i}`,
    type,
    label: stepLabels[type],
    status: 'running' as const,
    detail: type === 'file_read' ? 'src/components/App.tsx' : type === 'file_write' ? 'output/result.md' : undefined,
    fileName: type === 'file_read' || type === 'file_write' ? 'fichier.tsx' : undefined,
  }));
};

const ActionStepDisplay = ({ step }: { step: ActionStep }) => {
  const Icon = stepIcons[step.type] || Brain;
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-md text-[11px]">
      {step.status === 'running' ? (
        <Loader2 size={12} className="text-primary animate-spin flex-shrink-0" />
      ) : step.status === 'done' ? (
        <CheckCircle2 size={12} className="text-[hsl(140,60%,50%)] flex-shrink-0" />
      ) : (
        <X size={12} className="text-destructive flex-shrink-0" />
      )}
      <Icon size={12} className="text-muted-foreground flex-shrink-0" />
      <span className="text-foreground/70">{step.label}</span>
      {step.detail && <span className="text-muted-foreground/60 truncate ml-1">— {step.detail}</span>}
    </div>
  );
};

const CoworkChatView = ({ initialMessage, projectId }: CoworkChatViewProps) => {
  const model = useStore((s) => s.model);
  const { createConversation, addMessage, updateMessage, activeConversationId, conversations } = useCoworkStore();

  const [messages, setMessages] = useState<CoworkMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<ActionStep[]>([]);
  const [showPlan, setShowPlan] = useState(false);
  const [planContent, setPlanContent] = useState('');
  const [planApproved, setPlanApproved] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const initialSent = useRef(false);
  const convIdRef = useRef<string | null>(activeConversationId);

  // Load conversation messages on mount
  useEffect(() => {
    if (activeConversationId) {
      const conv = conversations.find((c) => c.id === activeConversationId);
      if (conv && conv.messages.length > 0) {
        setMessages(conv.messages);
      }
    }
  }, [activeConversationId, conversations]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, currentSteps]);

  const extractArtifacts = (content: string): Artifact[] => {
    const arts: Artifact[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lang = match[1] || 'text';
      const code = match[2].trim();
      if (code.length > 80) {
        arts.push({
          id: `artifact-${Date.now()}-${arts.length}`,
          type: lang === 'html' ? 'html' : 'code',
          title: `${lang.toUpperCase()} — ${code.slice(0, 30)}...`,
          content: code,
          language: lang,
        });
      }
    }
    return arts;
  };

  const runActionSteps = async (steps: ActionStep[]): Promise<ActionStep[]> => {
    const completed: ActionStep[] = [];
    for (let i = 0; i < steps.length; i++) {
      setCurrentSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, status: 'running' } : s));
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
      setCurrentSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s));
      completed.push({ ...steps[i], status: 'done' });
    }
    return completed;
  };

  const sendToChat = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // Create conversation if needed
    if (!convIdRef.current) {
      const id = createConversation(text.slice(0, 50), projectId);
      convIdRef.current = id;
    }

    const userMsg: CoworkMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    addMessage(convIdRef.current!, userMsg);
    setIsStreaming(true);

    // Show plan for complex tasks
    const isComplex = text.length > 60 || text.includes('créer') || text.includes('analyser') || text.includes('projet');
    if (isComplex && !planApproved) {
      setPlanContent(`## Plan d'exécution\n\n1. **Analyser** la demande et le contexte\n2. **Rechercher** les ressources nécessaires\n3. **Créer** le livrable demandé\n4. **Vérifier** et livrer le résultat`);
      setShowPlan(true);
      setIsStreaming(false);
      return;
    }

    // Simulate action steps
    const steps = simulateActionSteps();
    setCurrentSteps(steps);
    setStepsExpanded(true);
    await runActionSteps(steps);

    // Now stream the response
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: CoworkMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      actionSteps: steps.map((s) => ({ ...s, status: 'done' as const })),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    let fullContent = '';
    const chatMessages: ChatMessageType[] = [
      {
        role: 'system',
        content: `Tu es Cowork, un agent IA autonome et professionnel. Tu accomplis des tâches complexes de A à Z.

Règles :
- Réponds toujours en français
- Sois concis mais complet
- Utilise le markdown pour structurer (titres, listes, tableaux, blocs de code)
- Quand tu crées du contenu, utilise des blocs de code markdown
- Propose des actions concrètes et prochaines étapes
- Tu peux lire et écrire des fichiers, naviguer sur le web, exécuter du code
${projectId ? '- Tu travailles dans le contexte d\'un projet spécifique' : ''}`,
      },
      ...messages.filter(m => m.role === 'user' || m.role === 'assistant').map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: text },
    ];

    chatDirect(
      chatMessages,
      model,
      null,
      false,
      (token) => {
        fullContent += token;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
        );
      },
      () => {
        setIsStreaming(false);
        setCurrentSteps([]);
        const finalMsg: CoworkMessage = {
          ...assistantMsg,
          content: fullContent,
          actionSteps: steps.map((s) => ({ ...s, status: 'done' as const })),
        };
        addMessage(convIdRef.current!, finalMsg);
        const newArtifacts = extractArtifacts(fullContent);
        if (newArtifacts.length > 0) {
          setArtifacts((prev) => [...prev, ...newArtifacts]);
          setActiveArtifact(newArtifacts[0]);
          setArtifactPanelOpen(true);
        }
      },
      (err) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: `❌ Erreur: ${err}` } : m))
        );
        setIsStreaming(false);
        setCurrentSteps([]);
      }
    );
  }, [messages, model, isStreaming, planApproved, projectId, createConversation, addMessage]);

  const handleApprovePlan = () => {
    setShowPlan(false);
    setPlanApproved(true);
    // Re-send the last user message
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      sendToChat(lastUser.content);
    }
  };

  useEffect(() => {
    if (initialMessage && !initialSent.current) {
      initialSent.current = true;
      sendToChat(initialMessage);
    }
  }, [initialMessage, sendToChat]);

  const handleSubmit = () => {
    if (!chatInput.trim()) return;
    setPlanApproved(false);
    sendToChat(chatInput);
    setChatInput('');
  };

  return (
    <div className="flex-1 flex min-h-0">
      {/* Chat panel */}
      <div className={`flex flex-col min-h-0 ${artifactPanelOpen ? 'w-1/2 border-r border-border' : 'flex-1'} transition-all`}>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center mt-1 ${
                msg.role === 'user' ? 'bg-primary/20' : 'bg-muted'
              }`}>
                {msg.role === 'user'
                  ? <User size={14} className="text-primary" />
                  : <Bot size={14} className="text-muted-foreground" />}
              </div>
              <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
                {/* Action steps */}
                {msg.role === 'assistant' && msg.actionSteps && msg.actionSteps.length > 0 && (
                  <div className="mb-2 rounded-lg bg-muted/30 border border-border p-2">
                    <button
                      onClick={() => setStepsExpanded(!stepsExpanded)}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground mb-1 transition-colors"
                    >
                      {stepsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span>{msg.actionSteps.length} étapes exécutées</span>
                    </button>
                    {stepsExpanded && (
                      <div className="space-y-0.5">
                        {msg.actionSteps.map((step) => (
                          <ActionStepDisplay key={step.id} step={step} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className={`inline-block text-left rounded-xl px-4 py-3 max-w-[90%] ${
                  msg.role === 'user'
                    ? 'bg-primary/15 text-foreground'
                    : 'bg-[hsl(var(--surface))] text-foreground/90'
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
                      [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:text-primary
                      [&_pre]:bg-[hsl(0,0%,8%)] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto
                      [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground/80
                      [&_table]:w-full [&_table]:my-2
                      [&_th]:text-left [&_th]:px-2 [&_th]:py-1 [&_th]:border-b [&_th]:border-border [&_th]:text-foreground/90 [&_th]:text-[12px]
                      [&_td]:px-2 [&_td]:py-1 [&_td]:border-b [&_td]:border-border [&_td]:text-[12px]
                      [&_strong]:text-foreground [&_strong]:font-semibold
                      [&_a]:text-primary [&_a]:no-underline [&_a]:hover:underline
                      [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-foreground/60
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

          {/* Live action steps */}
          {currentSteps.length > 0 && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                <Bot size={14} className="text-muted-foreground" />
              </div>
              <div className="rounded-lg bg-muted/30 border border-border p-2.5 min-w-[200px]">
                <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium mb-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Exécution en cours...</span>
                </div>
                <div className="space-y-0.5">
                  {currentSteps.map((step) => (
                    <ActionStepDisplay key={step.id} step={step} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Plan approval */}
          {showPlan && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                <ListChecks size={14} className="text-primary" />
              </div>
              <div className="rounded-xl bg-[hsl(var(--surface))] border border-primary/30 p-4 max-w-[80%]">
                <div className="prose prose-sm prose-invert max-w-none text-[13px] mb-3
                  [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-2
                  [&_ol]:pl-4 [&_li]:mb-1 [&_strong]:text-foreground
                ">
                  <ReactMarkdown>{planContent}</ReactMarkdown>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleApprovePlan}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    ✓ Approuver et exécuter
                  </button>
                  <button
                    onClick={() => { setShowPlan(false); setIsStreaming(false); }}
                    className="px-3 py-1.5 rounded-lg text-muted-foreground text-xs hover:text-foreground transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}

          {isStreaming && messages[messages.length - 1]?.content === '' && currentSteps.length === 0 && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                <Bot size={14} className="text-muted-foreground animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[hsl(var(--surface))]">
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
          <div className="rounded-xl border border-border bg-[hsl(var(--surface))] px-4 py-3">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              placeholder="Décrivez une tâche à accomplir..."
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground min-w-0"
            />
            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-1">
                <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/30">
                  <Paperclip size={14} />
                </button>
                <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/30">
                  <FolderOpen size={14} />
                </button>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!chatInput.trim() || isStreaming}
                className="bg-primary text-primary-foreground rounded-lg py-2 px-3 text-[12px] font-semibold flex items-center gap-1 disabled:opacity-40 active:bg-primary/80 shrink-0 transition-colors"
              >
                <Send size={12} /> Envoyer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Artifact panel */}
      {artifactPanelOpen && activeArtifact && (
        <div className="w-1/2 flex flex-col min-h-0 bg-background">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={14} className="text-primary flex-shrink-0" />
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
                          ? 'bg-primary/20 text-primary'
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
                className="w-full h-full rounded-lg border border-border bg-white"
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
