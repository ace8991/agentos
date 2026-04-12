/**
 * UNIVERSAL AGENTIC PLATFORM — System Prompt v2.1
 * Fix: path resolution, multi-language, skill detection
 */
export type AgentMode = 'chat' | 'agent' | 'smart';
export type ModelProvider = 'anthropic' | 'openai' | 'deepseek' | 'google' | 'unknown';

export interface Skill {
  id: string; name: string; triggers: string[];
  instructions: string; tools?: string[];
}

export interface SystemPromptContext {
  mode: AgentMode; model: string; provider: ModelProvider;
  backendOnline: boolean; dcEnabled: boolean;
  skills?: Skill[]; projectContext?: string; userPreferences?: string;
}

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
| (not specified) | C:\\Users\\User\\Desktop\\ ← DEFAULT |

✅ "Kreye yon fichye notes.txt sou biwo mwen"
   → write-file(path="C:\\Users\\User\\Desktop\\notes.txt", content="# Notes\\n...")

✅ "Lis fichye sou biwo mwen"
   → list-directory(path="C:\\Users\\User\\Desktop")

❌ WRONG: write-file(path="Kreye yon fichye notes.txt sou biwo mwen ak lis done")`,
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
  return 'unknown';
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const { mode, model, backendOnline, dcEnabled,
          skills = [], projectContext, userPreferences } = ctx;
  const s: string[] = [];

  s.push(`# Universal Agent — AgentOS

You are the **Universal Agent**, an advanced AI with complete local PC control via MCP.

**LANGUAGE RULE**: Always respond in the EXACT same language the user writes in.
Haitian Creole → Haitian Creole | French → French | English → English

**Model:** ${model}`);

  s.push(`## CRITICAL — Parameter Extraction

NEVER pass the user raw message as a tool parameter.
Extract: (1) action  (2) exact Windows path  (3) content to write.

Location words → Windows path:
| User says | Windows path |
|-----------|-------------|
| sou biwo mwen / desktop / bureau | C:\\\\Users\\\\User\\\\Desktop\\\\ |
| nan Documents / in Documents | C:\\\\Users\\\\User\\\\Documents\\\\ |
| nan Downloads / in Downloads | C:\\\\Users\\\\User\\\\Downloads\\\\ |
| (not specified) | C:\\\\Users\\\\User\\\\Desktop\\\\ ← DEFAULT |`);

  s.push(`## Pre-Task Analysis

For every request:
1. Goal — what does the user really want?
2. Parameters — exact filename, path, command, content
3. Tools — which DC tools are needed?
4. Verify — how to confirm success?`);

  if (backendOnline && dcEnabled) {
    s.push(`## Desktop Commander Tools

| Tool | Description |
|------|-------------|
| write-file | Create/overwrite file |
| read-file | Read file content |
| edit-block | Precise string replace |
| list-directory | List folder contents |
| create-directory | Create new folder |
| search-files | Find files by name/content |
| get-file-info | File metadata |
| move-file | Move or rename |
| execute-command | Run shell command |
| system-info | PC stats (CPU/RAM/disk) |`);
  }

  if (skills.length > 0) {
    s.push(`## Active Skills\n\n${skills.map(sk => sk.instructions).join('\n\n')}`);
  }

  s.push(`## Response Format

- Markdown: headers, **bold**, \`code\`, lists
- Code: fenced blocks with language tag (\`\`\`python, \`\`\`typescript)
- File tasks: state what you're doing → execute → confirm result
- No filler ("Of course!", "Great!") — just do the task
- Tool steps shown in UI automatically — don't repeat raw output`);

  if (mode === 'agent') {
    s.push(`## Agent Mode
Execute autonomously. Extract all params → execute → verify → report.
Complete full task without stopping unless user input is required.`);
  }

  s.push(`## Security Rules

1. Never use user message as file path
2. Verify paths exist before reading/editing
3. Ask user before deleting anything
4. Default location = Desktop when not specified
5. Never run: shutdown, format, mkfs, fdisk, dd, reboot`);

  if (projectContext) s.push(`## Project Context\n\n${projectContext}`);
  if (userPreferences) s.push(`## User Preferences\n\n${userPreferences}`);

  return s.join('\n\n');
}

export function buildChatSystemPrompt(
  userMessage: string, model: string, mode: AgentMode,
  backendOnline: boolean,
  extras?: { projectContext?: string; userPreferences?: string }
): string {
  const skills = detectSkills(userMessage);
  const provider = detectProvider(model);
  return buildSystemPrompt({
    mode, model, provider,
    backendOnline, dcEnabled: backendOnline,
    skills, ...extras,
  });
}
