import { useEffect, useRef, useState } from 'react';
import { Brain, ChevronDown, Check } from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  THINKING_LEVELS,
  effortForLevel,
  getModelCapabilities,
  levelForEffort,
  type ThinkingLevel,
} from '@/lib/model-capabilities';

/**
 * Compact "niveau de réflexion" control shown next to the model selector.
 * Persists through the existing reasoningEffort store value so every route
 * (chat, code, project generator, agent) picks it up unchanged.
 */
const ThinkingLevelSelector = () => {
  const model = useStore((s) => s.model);
  const reasoningEffort = useStore((s) => s.reasoningEffort);
  const setReasoningEffort = useStore((s) => s.setReasoningEffort);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const caps = getModelCapabilities(model);
  const level = caps.thinking ? levelForEffort(reasoningEffort) : 'off';
  const current = THINKING_LEVELS.find((l) => l.level === level) ?? THINKING_LEVELS[2];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const pick = (next: ThinkingLevel) => {
    setReasoningEffort(effortForLevel(model, next));
    setOpen(false);
  };

  if (!caps.thinking) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Niveau de réflexion : ${current.label}`}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-elevated active:scale-[0.98]"
      >
        <Brain size={13} className={level === 'off' ? 'text-muted-foreground' : 'text-primary'} />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={12} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Niveau de réflexion
          </div>
          {THINKING_LEVELS.map((option) => (
            <button
              key={option.level}
              type="button"
              onClick={() => pick(option.level)}
              className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-elevated/70 ${
                option.level === level ? 'bg-surface-elevated' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.hint}</div>
              </div>
              {option.level === level && <Check size={14} className="mt-0.5 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThinkingLevelSelector;
