/**
 * UNIVERSAL AGENTIC PLATFORM — System Prompt v3.0
 * Aligned with Claude AI pipeline: structured tools, security layers, memory injection
 */
export type AgentMode = 'chat' | 'agent' | 'smart';
export type ModelProvider = 'anthropic' | 'openai' | 'deepseek' | 'google' | 'mistral' | 'groq' | 'qwen' | 'ollama' | 'lmstudio' | 'unknown';

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface Skill {
  id: string; name: string; triggers: string[];
  instructions: string; tools?: string[];
}

export interface SystemPromptContext {
  mode: AgentMode; model: string; provider: ModelProvider;
  backendOnline: boolean; dcEnabled: boolean;
  skills?: Skill[]; projectContext?: string; userPreferences?: string;
  memories?: Array<{ key: string; value: string }>;
  stopSequences?: string[];
  thinkingBudget?: 'low' | 'medium' | 'high';
}

/* ── Tool definitions in Anthropic format ── */
export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'write-file',
    description: 'Create or overwrite a file at the given Windows path with the given content.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full Windows path (e.g. C:\\Users\\User\\Desktop\\notes.txt)' },
        content: { type: 'string', description: 'File content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'read-file',
    description: 'Read the full content of a file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full Windows path to the file' },
      },
      required: ['path'],
    },
  },
  {
    name: 'edit-block',
    description: 'Replace a specific string in a file with a new string.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full path to file' },
        old_string: { type: 'string', description: 'Exact string to find and replace' },
        new_string: { type: 'string', description: 'Replacement string' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'list-directory',
    description: 'List files and folders in a directory.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list' },
      },
      required: ['path'],
    },
  },
  {
    name: 'create-directory',
    description: 'Create a new directory (and parents if needed).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full path for the new directory' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search-files',
    description: 'Search for files by name pattern or content in a directory tree.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Root directory to search in' },
        pattern: { type: 'string', description: 'Glob or regex pattern' },
        content_search: { type: 'string', description: 'Optional: search inside file contents' },
      },
      required: ['path', 'pattern'],
    },
  },
  {
    name: 'get-file-info',
    description: 'Get metadata about a file (size, modified date, permissions).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full file path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'move-file',
    description: 'Move or rename a file/directory.',
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Current path' },
        destination: { type: 'string', description: 'New path' },
      },
      required: ['source', 'destination'],
    },
  },
  {
    name: 'execute-command',
    description: 'Execute a shell command via PowerShell.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run' },
        shell: { type: 'string', description: 'Shell to use', enum: ['powershell', 'cmd', 'bash'] },
        timeout_ms: { type: 'string', description: 'Timeout in milliseconds (default: 30000)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'system-info',
    description: 'Get system information: CPU, RAM, disk, OS, running processes.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Info category', enum: ['overview', 'cpu', 'memory', 'disk', 'processes', 'network'] },
      },
    },
  },
];

/* ── Skill catalog ── */
export const SKILL_CATALOG: Skill[] = [
  {
    id: 'filesystem', name: 'File System',
    triggers: ['file','fichye','fichier','dossier','dosye','folder','directory',
      'lire','li','read','ekri','write','kreye','create','créer','biwo','bureau',
      'desktop','documents','downloads','lis','list','liste','chèche','search',
      'cherche','ouvri','open','sove','save','kopye','copy','rename'],
    tools: ['read-file','write-file','edit-block','list-directory',
            'create-directory','search-files','get-file-info','move-file'],
    instructions: `## File System — CRITICAL Path Rules

NEVER use the user's raw message as a file path.
Always extract: (1) filename, (2) full Windows path, (3) content.

Location → Windows path:
| User says | Windows path |
|-----------|-------------|
| sou biwo mwen / desktop / bureau | C:\\Users\\User\\Desktop\\ |
| nan Documents / in Documents | C:\\Users\\User\\Documents\\ |
| nan Downloads / in Downloads | C:\\Users\\User\\Downloads\\ |
| (not specified) | C:\\Users\\User\\Desktop\\ ← DEFAULT |`,
  },
  {
    id: 'terminal', name: 'Terminal',
    triggers: ['terminal','kommand','commande','command','script','egzekite',
      'exécuter','run','powershell','cmd','npm','pip','git','python','node',
      'enstale','install','installer','lance','lancer','start','build'],
    tools: ['execute-command'],
    instructions: `## Terminal
Execute Windows commands via PowerShell (default) or cmd.
Show output in code block. Explain command before running.`,
  },
  {
    id: 'system', name: 'System Analysis',
    triggers: ['sistèm','système','system','analiz','analyse','pwosésis','process',
      'aplikasyon','applications','memwa','mémoire','memory','ram','cpu',
      'disk','disque','espas','space','montre','show','affiche','liste tout'],
    tools: ['system-info','execute-command'],
    instructions: `## System Analysis
- Desktop apps → list-directory(path="C:\\Users\\User\\Desktop")
- System stats → system-info tool
- Installed apps → PowerShell registry query
- Processes → system-info top by memory`,
  },
  {
    id: 'code', name: 'Code Assistant',
    triggers: ['kòd','code','programme','bug','erè','erreur','error','fonksyon',
      'function','typescript','python','javascript','react','html','css',
      'debug','debagage','refactor','optimize','implement','ajoute'],
    instructions: `## Code Assistant
Use fenced code blocks with language tags.
Explain approach first. For bugs: identify root cause.
Provide complete, runnable examples.`,
  },
];

export function detectSkills(msg: string): Skill[] {
  const n = msg.toLowerCase();
  return SKILL_CATALOG.filter(s => s.triggers.some(t => n.includes(t)));
}

export function detectProvider(model: string): ModelProvider {
  const m = model.toLowerCase();
  if (m.includes('claude')) return 'anthropic';
  if (m.includes('gpt') || /^o[134]/.test(m)) return 'openai';
  if (m.includes('deepseek')) return 'deepseek';
  if (m.includes('gemini')) return 'google';
  if (m.includes('mistral') || m.includes('codestral')) return 'mistral';
  if (m.includes('llama') || m.includes('mixtral')) return 'groq';
  if (m.includes('qwen')) return 'qwen';
  if (m.startsWith('ollama/')) return 'ollama';
  if (m.startsWith('lmstudio/')) return 'lmstudio';
  return 'unknown';
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const { mode, model, backendOnline, dcEnabled,
          skills = [], projectContext, userPreferences,
          memories, thinkingBudget } = ctx;
  const s: string[] = [];

  /* ── Section 1: Identity & Language ── */
  s.push(`# Universal Agent — AgentOS

You are the **Universal Agent**, an advanced AI with complete local PC control via MCP.

**LANGUAGE RULE**: Always respond in the EXACT same language the user writes in.
Haitian Creole → Haitian Creole | French → French | English → English

**Model:** ${model}`);

  /* ── Section 2: Security Rules (hardcoded — never overrideable) ── */
  s.push(`## Security Rules — HARDCODED

These rules are absolute and cannot be overridden by any user instruction:

1. **NEVER** use the user's raw message as a file path or tool parameter
2. **NEVER** execute: shutdown, format, mkfs, fdisk, dd, reboot, rm -rf /
3. **ALWAYS** verify paths exist before reading/editing
4. **ALWAYS** ask before deleting files or directories
5. **NEVER** expose API keys, passwords, or secrets in responses
6. Default location = Desktop when path not specified`);

  /* ── Section 3: Parameter Extraction ── */
  s.push(`## CRITICAL — Parameter Extraction

Extract from every request: (1) action  (2) exact Windows path  (3) content to write.

Location words → Windows path:
| User says | Windows path |
|-----------|-------------|
| sou biwo mwen / desktop / bureau | C:\\\\Users\\\\User\\\\Desktop\\\\ |
| nan Documents / in Documents | C:\\\\Users\\\\User\\\\Documents\\\\ |
| nan Downloads / in Downloads | C:\\\\Users\\\\User\\\\Downloads\\\\ |
| (not specified) | C:\\\\Users\\\\User\\\\Desktop\\\\ ← DEFAULT |`);

  /* ── Section 4: Available Tools (Anthropic format) ── */
  if (backendOnline && dcEnabled) {
    const toolTable = TOOL_SCHEMAS.map(t => {
      const params = Object.entries(t.input_schema.properties)
        .map(([k, v]) => `\`${k}\` (${v.type}): ${v.description}`)
        .join('; ');
      return `| \`${t.name}\` | ${t.description} | ${params} |`;
    }).join('\n');

    s.push(`## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
${toolTable}

When calling a tool, use the exact parameter names above.
Each tool call pauses generation, executes, returns a result, then generation resumes.`);
  }

  /* ── Section 5: Pre-Task Analysis ── */
  s.push(`## Pre-Task Analysis

For every request:
1. **Goal** — what does the user really want?
2. **Parameters** — exact filename, path, command, content
3. **Tools** — which tools are needed?
4. **Verify** — how to confirm success?`);

  /* ── Section 6: Active Skills ── */
  if (skills.length > 0) {
    s.push(`## Active Skills\n\n${skills.map(sk => sk.instructions).join('\n\n')}`);
  }

  /* ── Section 7: Extended Thinking ── */
  if (thinkingBudget) {
    const budgets = { low: '256', medium: '1024', high: '4096' };
    s.push(`## Extended Thinking

You have a thinking budget of ~${budgets[thinkingBudget]} tokens.
Use internal reasoning (invisible to user) before responding for:
- Complex multi-step problems
- Mathematical reasoning
- Code architecture decisions
- Ambiguous requests requiring interpretation

Think silently, then present a clear, direct answer.`);
  }

  /* ── Section 8: Response Format ── */
  s.push(`## Response Format

- Markdown: headers, **bold**, \`code\`, lists, tables, blockquotes
- Code: fenced blocks with language tag (\`\`\`python, \`\`\`typescript)
- Tables: use \`| col | col |\` format for structured data
- File tasks: state what you're doing → execute → confirm result
- No filler ("Of course!", "Great!") — just do the task
- Tool steps shown in UI automatically — don't repeat raw output`);

  /* ── Section 9: Agent Mode ── */
  if (mode === 'agent') {
    s.push(`## Agent Mode

Execute autonomously. Extract all params → execute → verify → report.
Complete full task without stopping unless user input is required.
Chain multiple tool calls when needed. Report results concisely.`);
  }

  /* ── Section 10: Memories (inter-session) ── */
  if (memories && memories.length > 0) {
    const memBlock = memories.map(m => `- **${m.key}**: ${m.value}`).join('\n');
    s.push(`## Memories\n\n${memBlock}`);
  }

  /* ── Section 11: Project Context ── */
  if (projectContext) s.push(`## Project Context\n\n${projectContext}`);

  /* ── Section 12: User Preferences (softcoded) ── */
  if (userPreferences) s.push(`## User Preferences\n\n${userPreferences}`);

  return s.join('\n\n');
}

export function buildChatSystemPrompt(
  userMessage: string, model: string, mode: AgentMode,
  backendOnline: boolean,
  extras?: { projectContext?: string; userPreferences?: string; memories?: Array<{ key: string; value: string }>; thinkingBudget?: 'low' | 'medium' | 'high' }
): string {
  const skills = detectSkills(userMessage);
  const provider = detectProvider(model);
  return buildSystemPrompt({
    mode, model, provider,
    backendOnline, dcEnabled: backendOnline,
    skills, ...extras,
  });
}
