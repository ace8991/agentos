import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Sparkles, User, Bot, Copy, Check } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  codeBlocks?: { language: string; code: string; file?: string }[];
}

const CodeChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant de code. Décrivez ce que vous souhaitez créer ou modifier.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `J'ai analysé votre demande. Voici ce que je propose :\n\nJe vais créer les fichiers nécessaires et appliquer les modifications. Voulez-vous que je procède ?`,
        timestamp: new Date(),
        codeBlocks: [
          {
            language: 'typescript',
            file: 'src/example.ts',
            code: `// Exemple de code généré\nexport function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}`,
          },
        ],
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${
              msg.role === 'user' ? 'bg-primary/20' : 'bg-accent/20'
            }`}>
              {msg.role === 'user' ? <User size={14} className="text-primary" /> : <Bot size={14} className="text-accent" />}
            </div>
            <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.codeBlocks?.map((block, i) => (
                <div key={i} className="mt-2 rounded-lg border border-border bg-background overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
                    <span className="text-[11px] text-muted-foreground font-mono">{block.file || block.language}</span>
                    <button
                      onClick={() => handleCopy(block.code, `${msg.id}-${i}`)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedId === `${msg.id}-${i}` ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <pre className="p-3 text-xs font-mono text-foreground/80 overflow-x-auto">
                    <code>{block.code}</code>
                  </pre>
                </div>
              ))}
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-accent/20 flex items-center justify-center">
              <Sparkles size={14} className="text-accent animate-pulse" />
            </div>
            <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-muted/30">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-border">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <Paperclip size={15} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Décrivez le code à générer..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="text-primary hover:text-primary/80 disabled:text-muted-foreground transition-colors"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeChat;
