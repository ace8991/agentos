import { useState } from 'react';
import { X, Check, Undo2, ChevronDown } from 'lucide-react';

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNum: number;
}

interface CodeEditorProps {
  filePath?: string;
}

const sampleCode = `import { useState } from 'react';

const App = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Counter: {count}</h1>
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-primary text-white rounded-lg"
      >
        Increment
      </button>
    </div>
  );
};

export default App;`;

const sampleDiff: DiffLine[] = [
  { type: 'context', content: "import { useState } from 'react';", lineNum: 1 },
  { type: 'context', content: '', lineNum: 2 },
  { type: 'context', content: 'const App = () => {', lineNum: 3 },
  { type: 'remove', content: '  const [count, setCount] = useState(0);', lineNum: 4 },
  { type: 'add', content: '  const [count, setCount] = useState<number>(0);', lineNum: 4 },
  { type: 'add', content: '  const [step, setStep] = useState(1);', lineNum: 5 },
  { type: 'context', content: '', lineNum: 6 },
  { type: 'context', content: '  return (', lineNum: 7 },
  { type: 'context', content: '    <div className="flex flex-col items-center gap-4 p-8">', lineNum: 8 },
  { type: 'remove', content: '      <h1 className="text-2xl font-bold">Counter: {count}</h1>', lineNum: 9 },
  { type: 'add', content: '      <h1 className="text-3xl font-bold text-primary">Counter: {count}</h1>', lineNum: 9 },
  { type: 'context', content: '      <button', lineNum: 10 },
  { type: 'remove', content: '        onClick={() => setCount(c => c + 1)}', lineNum: 11 },
  { type: 'add', content: '        onClick={() => setCount(c => c + step)}', lineNum: 11 },
];

const CodeEditor = ({ filePath }: CodeEditorProps) => {
  const [viewMode, setViewMode] = useState<'code' | 'diff'>('code');
  const [diffAccepted, setDiffAccepted] = useState(false);

  if (!filePath) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl border border-border bg-muted/30 flex items-center justify-center">
            <ChevronDown size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Sélectionnez un fichier pour l'éditer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-2">
        <div className="flex items-center">
          <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-foreground bg-background border-b-2 border-primary">
            <span className="truncate max-w-[200px]">{filePath.split('/').pop()}</span>
            <button className="text-muted-foreground hover:text-foreground ml-1">
              <X size={11} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 pr-2">
          <button
            onClick={() => setViewMode('code')}
            className={`px-2.5 py-1 text-[11px] rounded transition-colors ${viewMode === 'code' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Code
          </button>
          <button
            onClick={() => setViewMode('diff')}
            className={`px-2.5 py-1 text-[11px] rounded transition-colors ${viewMode === 'diff' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Diff
          </button>
        </div>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-auto scrollbar-thin font-mono text-xs">
        {viewMode === 'code' ? (
          <div className="p-3">
            {sampleCode.split('\n').map((line, i) => (
              <div key={i} className="flex">
                <span className="w-8 text-right pr-3 text-muted-foreground/50 select-none">{i + 1}</span>
                <span className="text-foreground/80 whitespace-pre">{line}</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {/* Diff toolbar */}
            {!diffAccepted && (
              <div className="flex items-center justify-between px-3 py-2 bg-accent/10 border-b border-border">
                <span className="text-[11px] text-accent font-medium">Modifications proposées par l'IA</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDiffAccepted(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-success/20 text-success hover:bg-success/30 transition-colors"
                  >
                    <Check size={11} /> Accepter
                  </button>
                  <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors">
                    <X size={11} /> Rejeter
                  </button>
                  <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                    <Undo2 size={11} /> Annuler
                  </button>
                </div>
              </div>
            )}
            <div className="p-3">
              {sampleDiff.map((line, i) => (
                <div
                  key={i}
                  className={`flex ${
                    line.type === 'add'
                      ? 'bg-success/8'
                      : line.type === 'remove'
                      ? 'bg-destructive/8'
                      : ''
                  }`}
                >
                  <span className="w-8 text-right pr-3 text-muted-foreground/50 select-none">{line.lineNum}</span>
                  <span className={`w-4 text-center select-none ${
                    line.type === 'add' ? 'text-success' : line.type === 'remove' ? 'text-destructive' : 'text-muted-foreground/30'
                  }`}>
                    {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                  </span>
                  <span className={`whitespace-pre ${
                    line.type === 'add' ? 'text-success/90' : line.type === 'remove' ? 'text-destructive/70 line-through' : 'text-foreground/70'
                  }`}>
                    {line.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeEditor;
