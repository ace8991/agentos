import { loadConnectors } from '@/lib/connectors';
import { buildProjectContext } from '@/lib/projects';

export interface AppSkill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  enabled: boolean;
  builtin?: boolean;
}

export interface ComposerPreferences {
  webResearch: boolean;
  useStyle: boolean;
  builderMode: boolean;
}

const SKILLS_STORAGE_KEY = 'SKILLS';
const WORK_PROFILE_STORAGE_KEY = 'WORK_PROFILE';
const RESPONSE_STYLE_LABELS: Record<string, string> = {
  concise: 'Concise',
  balanced: 'Balanced',
  detailed: 'Detailed',
  creative: 'Creative',
};
const WORK_PROFILE_LABELS: Record<string, string> = {
  general: 'General',
  codex: 'Codex',
  reviewer: 'Reviewer',
  debugger: 'Debugger',
  architect: 'Architect',
};

export const defaultComposerPreferences: ComposerPreferences = {
  webResearch: false,
  useStyle: false,
  builderMode: false,
};

const builtinSkills: AppSkill[] = [
  {
    id: 'web-browsing',
    name: 'Web Browsing',
    description: 'Navigate and interact with websites',
    prompt: 'Use structured web navigation, cite sources when relevant, and confirm important page state before acting.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'code-execution',
    name: 'Code Execution',
    description: 'Write and execute code in sandbox',
    prompt: 'Prefer executable, testable solutions and explain important outputs clearly.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'file-management',
    name: 'File Management',
    description: 'Read, write, and manage files',
    prompt: 'Keep file operations tidy, explicit, and reversible when possible.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the internet for information',
    prompt: 'Use web search to verify unstable facts and prioritize trustworthy sources.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'repo-analysis',
    name: 'Repository Analysis',
    description: 'Read codebases, map modules, and explain architecture',
    prompt: 'Build context from the codebase first, identify the key files, and explain the implementation plan before or while making changes.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Find bugs, regressions, and risky changes',
    prompt: 'Default to a review mindset when inspecting code: prioritize correctness bugs, regressions, edge cases, and missing verification.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'testing-verification',
    name: 'Testing & Verification',
    description: 'Run tests, build checks, and smoke validations',
    prompt: 'After changes, run the narrowest useful verification first, then summarize what passed, what failed, and any residual risk.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'safe-refactors',
    name: 'Safe Refactors',
    description: 'Keep edits incremental and preserve behavior',
    prompt: 'Prefer small, auditable refactors with behavior-preserving changes unless the task explicitly asks for broader redesign.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'data-analysis',
    name: 'Data Analysis',
    description: 'Analyze data and create visualizations',
    prompt: 'Summarize the signal, quantify uncertainty, and present the clearest chart or table for the job.',
    enabled: false,
    builtin: true,
  },
  {
    id: 'image-generation',
    name: 'Image Generation',
    description: 'Generate images from text prompts',
    prompt: 'When visual output is requested, produce concise creative direction and clear prompt structure.',
    enabled: false,
    builtin: true,
  },
  {
    id: 'email-sending',
    name: 'Email Sending',
    description: 'Compose and send emails',
    prompt: 'Draft email communication with crisp subject lines, clear structure, and professional tone.',
    enabled: false,
    builtin: true,
  },
  {
    id: 'calendar-access',
    name: 'Calendar Access',
    description: 'Read and create calendar events',
    prompt: 'When scheduling, be explicit about timezone, duration, participants, and dependencies.',
    enabled: false,
    builtin: true,
  },
];

export const getBuiltinSkills = () => builtinSkills.map((skill) => ({ ...skill }));

export const getSavedWorkProfile = () => localStorage.getItem(WORK_PROFILE_STORAGE_KEY) || 'general';

export const getSavedWorkProfileLabel = () => {
  const profile = getSavedWorkProfile();
  return WORK_PROFILE_LABELS[profile] || 'General';
};

export const getWorkProfileInstructions = () => {
  const profile = getSavedWorkProfile();

  switch (profile) {
    case 'codex':
      return 'Operate like a professional coding agent: inspect the codebase before editing, make the smallest high-confidence change, verify with commands, and summarize concrete outcomes.';
    case 'reviewer':
      return 'Operate like a strict code reviewer: prioritize bugs, regressions, unsafe assumptions, and missing tests before giving any summary.';
    case 'debugger':
      return 'Operate like a debugger: reproduce the issue, isolate the root cause, prefer evidence over guesswork, and verify the fix explicitly.';
    case 'architect':
      return 'Operate like a software architect: optimize for maintainability, interface clarity, and clean system boundaries while preserving delivery momentum.';
    default:
      return '';
  }
};

export const loadSkills = (): AppSkill[] => {
  const defaults = getBuiltinSkills();

  try {
    const stored = localStorage.getItem(SKILLS_STORAGE_KEY);
    if (!stored) {
      return defaults;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return defaults;
    }

    const builtinMap = new Map(parsed.filter((skill) => skill?.builtin !== false).map((skill) => [skill.id, skill]));
    const customSkills = parsed
      .filter((skill) => skill && skill.builtin === false)
      .map((skill) => ({
        id: String(skill.id),
        name: String(skill.name || 'Custom skill'),
        description: String(skill.description || ''),
        prompt: String(skill.prompt || ''),
        enabled: Boolean(skill.enabled),
        builtin: false,
      }));

    const mergedBuiltin = defaults.map((skill) => {
      const saved = builtinMap.get(skill.id);
      return saved
        ? {
            ...skill,
            enabled: typeof saved.enabled === 'boolean' ? saved.enabled : skill.enabled,
            prompt: typeof saved.prompt === 'string' && saved.prompt.trim() ? saved.prompt : skill.prompt,
          }
        : skill;
    });

    return [...mergedBuiltin, ...customSkills];
  } catch {
    return defaults;
  }
};

export const saveSkills = (skills: AppSkill[]) => {
  localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(skills));
};

export const getBehaviorInstructions = () => {
  const sections: string[] = [];
  const systemPrompt = localStorage.getItem('SYSTEM_PROMPT')?.trim();
  const workProfileInstructions = getWorkProfileInstructions();
  const enabledSkills = loadSkills().filter((skill) => skill.enabled && skill.prompt.trim());

  if (systemPrompt) {
    sections.push(systemPrompt);
  }

  if (workProfileInstructions) {
    sections.push(workProfileInstructions);
  }

  if (enabledSkills.length > 0) {
    sections.push(
      ['Enabled skills:', ...enabledSkills.map((skill) => `- ${skill.name}: ${skill.prompt.trim()}`)].join('\n'),
    );
  }

  return sections.join('\n\n').trim();
};

export const getSavedResponseStyleLabel = () => {
  const responseStyle = localStorage.getItem('RESPONSE_STYLE') || 'balanced';
  return RESPONSE_STYLE_LABELS[responseStyle] || 'Saved style';
};

export const getComposerInstructions = (
  preferences: Partial<ComposerPreferences> = defaultComposerPreferences,
) => {
  const merged = { ...defaultComposerPreferences, ...preferences };
  const sections: string[] = [];

  if (merged.webResearch) {
    sections.push('Use web research to verify unstable, recent, or uncertain information before finalizing the answer.');
  }

  if (merged.useStyle) {
    const responseStyle = getSavedResponseStyleLabel();
    sections.push(`Match the saved response style preference: ${responseStyle}.`);
  }

  if (merged.builderMode) {
    sections.push(
      [
        'Builder mode is enabled.',
        'When the task is to create or improve a website, landing page, product UI, or web application, use a modern builder stack by default: React + Vite + TypeScript + Tailwind CSS.',
        'Prefer shadcn/ui and Radix UI primitives when they fit the design system.',
        'Structure the output like a professional builder workspace with clean components, reusable sections, code that is ready for preview, and clear surfaces for preview, code, database, and files.',
        'Avoid one-off HTML unless the task explicitly asks for a single static file.',
      ].join(' '),
    );
  }

  return sections.join('\n').trim();
};

export const getConnectorInstructions = () => {
  const readyConnectors = loadConnectors().filter((connector) => connector.connected);
  if (readyConnectors.length === 0) {
    return '';
  }

  return [
    'Connected tools ready for use:',
    ...readyConnectors.slice(0, 8).map(
      (connector) => `- ${connector.name}: ${connector.statusDetail || connector.statusLabel}`,
    ),
  ].join('\n');
};

export const buildAgentTask = (
  task: string,
  preferences: Partial<ComposerPreferences> = defaultComposerPreferences,
  extraContext = '',
) => {
  const sections = [
    getBehaviorInstructions(),
    getConnectorInstructions(),
    getComposerInstructions(preferences),
    extraContext.trim(),
    buildProjectContext(task),
  ].filter(Boolean);

  if (sections.length === 0) {
    return task;
  }

  return `Follow these additional operating instructions:\n${sections.join('\n\n')}\n\nPrimary task:\n${task}`;
};
