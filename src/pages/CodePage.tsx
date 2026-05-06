import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ArrowLeft, Bot, CheckCircle, Code2, Database, FolderOpen, Ghost, Layers3, Menu, MessageSquareText, Mic, MonitorPlay, Paperclip, Plus, Send, Sparkles, Square, X,
} from 'lucide-react';

import { toast } from '@/components/ui/sonner';
import { useStore, type LogEntry, type AgentMode } from '@/store/useStore';
import ChatMessage from '@/components/chat/ChatMessage';
import LiveSessionCard from '@/components/chat/LiveSessionCard';
import ThinkingIndicator from '@/components/chat/ThinkingIndicator';
import TakeoverBanner from '@/components/chat/TakeoverBanner';
import ModelSelector, { isAgentModelSupported } from '@/components/ModelSelector';
import ProviderConfigModal from '@/components/ProviderConfigModal';
import ComposerInsertMenu from '@/components/chat/ComposerInsertMenu';
import ArtifactWorkspaceModal from '@/components/chat/ArtifactWorkspaceModal';
import { ArtifactPanel } from '@/components/artifact/ArtifactPanel';
import { useArtifactStore } from '@/stores/artifactStore';
import { createArtifactStreamHandler } from '@/hooks/useArtifactStream';
import { chatDirect, createBuilderWorkspace, type ChatMessage as ChatMessageType, type ToolCallEvent, type ToolResultEvent, type GeneratedWorkspace } from '@/lib/api';
import { collectArtifactsFromEntries, type WorkspaceView } from '@/lib/artifacts';
import { executeDesktopCommanderIntent } from '@/lib/desktop-commander-intents';
import {
  CONNECTORS_UPDATED_EVENT,
  loadConnectors,
  mergeConnectorState,
  saveConnectors,
  type ConnectorState,
} from '@/lib/connectors';
import {
  getBehaviorInstructions,
  getComposerInstructions,
  getSavedResponseStyleLabel,
  type ComposerPreferences,
} from '@/lib/user-config';
import { buildProjectContext, getCurrentProject, loadProjects, PROJECTS_UPDATED_EVENT, type AppProject } from '@/lib/projects';
import { buildAttachmentContext } from '@/lib/attachment-context';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { useIntentEngine } from '@/hooks/useIntentEngine';
import { ResponseTypePill } from '@/components/ResponseTypePill';
import { CodePanel } from '@/components/code/CodePanel';
import { CodeSidebar } from '@/components/code/CodeSidebar';
import HistorySidebar from '@/components/HistorySidebar';
import ProjectGeneratorPanel from '@/components/ProjectGeneratorPanel';

const ConnectorConfigModal = lazy(() => import('@/components/chat/ConnectorConfigModal'));
const ConnectorsDirectoryModal = lazy(() => import('@/components/chat/ConnectorsDirectoryModal'));
const ProjectsModal = lazy(() => import('@/components/projects/ProjectsModal'));

const BUILDER_REQUEST_KEYWORDS = [
  'create website',
  'build website',
  'landing page',
  'create app',
  'build app',
  'dashboard',
  'presentation',
  'slides',
  'build a',
  'create a',
  'make a website',
  'make an app',
  'portfolio',
  'saas',
  'game',
  'prototype',
  'site vitrine',
  'creer un site',
  'cree un site',
  'creer une app',
  'cree une app',
  'landing',
  'site web',
  'application web',
];

/**
 * Mots-clés pour déclencher le Project Generator (IA puissante).
 * Détecte les demandes de création de projets complexes.
 */
const PROJECT_GENERATOR_KEYWORDS = [
  // Français — création de projet
  'crée un projet',
  'cree un projet',
  'crée moi un projet',
  'cree moi un projet',
  'génère un projet',
  'genere un projet',
  'génère moi un projet',
  'genere moi un projet',
  'crée une application',
  'cree une application',
  'crée un site web',
  'cree un site web',
  'développe un projet',
  'developpe un projet',
  'développe moi',
  'developpe moi',
  'construis un projet',
  'construis moi',
  'fabrique un projet',
  'fabrique moi',
  'réalise un projet',
  'realise un projet',
  'réalise moi',
  'realise moi',
  'je veux un projet',
  'je veux créer',
  'je veux cree',
  'je veux développer',
  'je veux developper',
  'je veux construire',
  'je veux fabriquer',
  'aide moi à créer',
  'aide moi a creer',
  'aide moi à cree',
  'aide moi a cree',
  'aide moi à développer',
  'aide moi a developper',
  'aide moi à construire',
  'aide moi a construire',
  'génère une app',
  'genere une app',
  'génère un site',
  'genere un site',
  'crée un dashboard',
  'cree un dashboard',
  'crée un tableau de bord',
  'cree un tableau de bord',
  'crée un jeu',
  'cree un jeu',
  'crée une animation',
  'cree une animation',
  'crée un portfolio',
  'cree un portfolio',
  'crée une landing page',
  'cree une landing page',
  'crée une page d\'accueil',
  'cree une page d\'accueil',
  'crée un blog',
  'cree un blog',
  'crée un e-commerce',
  'cree un e-commerce',
  'crée une boutique',
  'cree une boutique',
  'crée un SaaS',
  'cree un SaaS',
  'crée un outil',
  'cree un outil',
  'crée une API',
  'cree une API',
  'crée un backend',
  'cree un backend',
  'crée un frontend',
  'cree un frontend',
  'crée une interface',
  'cree une interface',
  'crée un composant',
  'cree un composant',
  'crée une librairie',
  'cree une librairie',
  'crée un package',
  'cree un package',
  'crée un module',
  'cree un module',
  'crée un plugin',
  'cree un plugin',
  'crée une extension',
  'cree une extension',
  'crée un thème',
  'cree un theme',
  'crée un template',
  'cree un template',
  'crée un starter',
  'cree un starter',
  'crée un boilerplate',
  'cree un boilerplate',
  'crée un scaffold',
  'cree un scaffold',
  'génère un dashboard',
  'genere un dashboard',
  'génère un jeu',
  'genere un jeu',
  'génère une animation',
  'genere une animation',
  'génère un portfolio',
  'genere un portfolio',
  'génère un blog',
  'genere un blog',
  'génère un e-commerce',
  'genere un e-commerce',
  'génère une boutique',
  'genere une boutique',
  'génère un SaaS',
  'genere un SaaS',
  'génère un outil',
  'genere un outil',
  'génère une API',
  'genere une API',
  'génère un backend',
  'genere un backend',
  'génère un frontend',
  'genere un frontend',
  'génère une interface',
  'genere une interface',
  'génère un composant',
  'genere un composant',
  'génère une librairie',
  'genere une librairie',
  'génère un package',
  'genere un package',
  'génère un module',
  'genere un module',
  'génère un plugin',
  'genere un plugin',
  'génère une extension',
  'genere une extension',
  'génère un thème',
  'genere un theme',
  'génère un template',
  'genere un template',
  'génère un starter',
  'genere un starter',
  'génère un boilerplate',
  'genere un boilerplate',
  'génère un scaffold',
  'genere un scaffold',
  // Anglais — project creation
  'create a project',
  'build a project',
  'generate a project',
  'make a project',
  'develop a project',
  'create an app',
  'build an app',
  'generate an app',
  'make an app',
  'develop an app',
  'create a website',
  'build a website',
  'generate a website',
  'make a website',
  'create a web app',
  'build a web app',
  'generate a web app',
  'make a web app',
  'create a dashboard',
  'build a dashboard',
  'generate a dashboard',
  'make a dashboard',
  'create a game',
  'build a game',
  'generate a game',
  'make a game',
  'create an animation',
  'build an animation',
  'generate an animation',
  'make an animation',
  'create a portfolio',
  'build a portfolio',
  'generate a portfolio',
  'make a portfolio',
  'create a landing page',
  'build a landing page',
  'generate a landing page',
  'make a landing page',
  'create a blog',
  'build a blog',
  'generate a blog',
  'make a blog',
  'create an ecommerce',
  'build an ecommerce',
  'generate an ecommerce',
  'make an ecommerce',
  'create a saas',
  'build a saas',
  'generate a saas',
  'make a saas',
  'create a tool',
  'build a tool',
  'generate a tool',
  'make a tool',
  'create an api',
  'build an api',
  'generate an api',
  'make an api',
  'create a backend',
  'build a backend',
  'generate a backend',
  'make a backend',
  'create a frontend',
  'build a frontend',
  'generate a frontend',
  'make a frontend',
  'create a fullstack',
  'build a fullstack',
  'generate a fullstack',
  'make a fullstack',
  'create a component',
  'build a component',
  'generate a component',
  'make a component',
  'create a library',
  'build a library',
  'generate a library',
  'make a library',
  'create a package',
  'build a package',
  'generate a package',
  'make a package',
  'create a module',
  'build a module',
  'generate a module',
  'make a module',
  'create a plugin',
  'build a plugin',
  'generate a plugin',
  'make a plugin',
  'create an extension',
  'build an extension',
  'generate an extension',
  'make an extension',
  'create a theme',
  'build a theme',
  'generate a theme',
  'make a theme',
  'create a template',
  'build a template',
  'generate a template',
  'make a template',
  'create a starter',
  'build a starter',
  'generate a starter',
  'make a starter',
  'create a boilerplate',
  'build a boilerplate',
  'generate a boilerplate',
  'make a boilerplate',
  'create a scaffold',
  'build a scaffold',
  'generate a scaffold',
  'make a scaffold',
  'i want to create',
  'i want to build',
  'i want to generate',
  'i want to make',
  'i want to develop',
  'help me create',
  'help me build',
  'help me generate',
  'help me make',
  'help me develop',
  'can you create',
  'can you build',
  'can you generate',
  'can you make',
  'can you develop',
  'could you create',
  'could you build',
  'could you generate',
  'could you make',
  'could you develop',
  'would you create',
  'would you build',
  'would you generate',
  'would you make',
  'would you develop',
];

const shouldUseBuilderWorkspace = (text: string, preferences: ComposerPreferences) => {
  if (!preferences.builderMode) return false;
  const lower = text.toLowerCase();
  return BUILDER_REQUEST_KEYWORDS.some((keyword) => lower.includes(keyword));
};

/**
 * Détecte si l'utilisateur demande la création d'un projet via l'IA générative.
 * Ouvre le ProjectGeneratorPanel au lieu de passer par le builder classique.
 */
const shouldUseProjectGenerator = (text: string): boolean => {
  const lower = text.toLowerCase().trim();
  if (lower.length < 8) return false;

  // 1) Match explicite via la liste exhaustive de phrases
  if (PROJECT_GENERATOR_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return true;
  }

  // 2) Détection universelle: verbe d'action + nom de projet
  // ex: "fais moi un jeu snake", "build me a portfolio", "je voudrais une app de notes"
  const actionVerb = /\b(cr[ée]e?|cr[ée]er|g[ée]n[ée]re?|g[ée]n[ée]rer|fais|fait|faire|construis|construire|d[ée]veloppe?|d[ée]velopper|fabrique?|fabriquer|r[ée]alise?|r[ée]aliser|code|coder|programme?|programmer|monte?|monter|b[âa]tis|b[âa]tir|veux|voudrais|aimerais|peux[- ]tu|peut[- ]on|aide[- ]moi|build|create|make|generate|develop|design|implement|scaffold|bootstrap|i\s+want|i'?d\s+like|can\s+you|could\s+you|help\s+me|let'?s\s+(?:build|create|make))\b/;
  const projectNoun = /\b(projet|application|app|appli|site|site\s+web|website|web\s*app|webapp|page|landing|portfolio|dashboard|tableau\s+de\s+bord|jeu|game|animation|outil|tool|saas|blog|boutique|shop|e[- ]?commerce|api|backend|frontend|fullstack|interface|ui|composant|component|librairie|library|module|plugin|extension|th[èe]me|theme|template|starter|boilerplate|clone|prototype|mvp|landing\s+page|home\s*page|page\s+d['e ]accueil|widget|chatbot|bot|crm|cms|forum|wiki|tracker|todo|note[s]?|calculator|calculatrice|timer|chronom[èe]tre|convertisseur|converter|player|gallery|galerie|calendar|calendrier|planner|agenda)\b/;

  if (actionVerb.test(lower) && projectNoun.test(lower)) {
    return true;
  }

  return false;
};

const shouldRouteToAgent = (
  text: string,
  mode: AgentMode,
  backendOnline: boolean,
) => {
  if (mode === 'agent') return true;
  if (!backendOnline) return false;
  const lower = text.toLowerCase();

  // Mots isolés trop génériques qui ne doivent PAS déclencher le mode agent
  // (ils sont trop fréquents dans le langage courant / le code)
  const safeWords = new Set([
    'code', 'app', 'web', 'site', 'file', 'test', 'check', 'fix',
    'open', 'create', 'run', 'build', 'start', 'stop', 'update',
    'git', 'npm', 'python', 'node', 'api', 'error', 'log', 'server',
    'database', 'db', 'function', 'class', 'variable', 'bug',
    'issue', 'help', 'question', 'how', 'what', 'why', 'when',
    'where', 'who', 'explain', 'show', 'tell', 'mean',
  ]);

  // D'abord vérifier les phrases explicites (plus spécifiques = meilleure détection)
  const agentPhrases = [
    // Browser
    'navigate to', 'go to https://', 'go to http://', 'open in browser',
    'search the web', 'search for', 'look up', 'find on the internet',
    'find online', 'web search', 'browser',
    // Terminal / shell
    'terminal', 'run command', 'execute command', 'run shell',
    'run a command', 'run this code', 'run this command',
    // Screenshot / desktop
    'screenshot', 'take a screenshot', 'what is on my screen',
    'desktop', 'mouse', 'click on', 'type on keyboard',
    'scroll', 'press key', 'move mouse',
    // Applications
    'open application', 'launch app', 'open app',
    // Fichiers (phrases complètes)
    'list directory', 'list files in', 'what files are in',
    'create a file', 'write a file', 'edit a file', 'read a file',
    'delete a file', 'move a file', 'copy a file',
    'download file', 'upload file', 'create file', 'write file',
    'edit file', 'read file',
    // Installation
    'install package', 'install software', 'install ',
    // Git
    'git clone', 'git init', 'git commit', 'git push', 'git pull',
    // Docker
    'docker compose', 'docker run', 'docker build',
    // SSH / déploiement
    'ssh connect', 'ssh to', 'deploy to', 'deploy on',
    // Serveurs
    'start server', 'stop server', 'restart server',
    // Logs / monitoring
    'check logs', 'tail logs', 'view logs', 'monitor process',
    'kill process', 'list processes',
    // Système
    'system info', 'system information', 'what is running',
    // Code / debug
    'analyse this code', 'analyze this code', 'debug this',
    'fix this error', 'fix this bug', 'test this code',
    'build this project', 'compile this', 'configure this',
    'setup this', 'generate code', 'generate a',
    // Projets
    'create a project', 'create an app', 'build a website',
    'build an app', 'make a website', 'make an app',
    'create website', 'create app', 'landing page',
    'create project', 'new project',
  ];

  if (agentPhrases.some((phrase) => lower.includes(phrase))) {
    return true;
  }

  // Ensuite, pour les mots isolés, on vérifie qu'ils ne sont PAS dans la liste safe
  // et qu'ils indiquent une action système
  const agentWords = [
    'terminal', 'browser', 'screenshot', 'desktop',
    'docker', 'ssh', 'deploy', 'compile',
    'install', 'uninstall',
  ];

  const words = lower.split(/\s+/);
  return agentWords.some((word) => words.includes(word));
};

const requiresLocalTools = (text: string) => {
  const lower = text.toLowerCase();
  const localKeywords = [
    'browser',
    'navigate to',
    'go to',
    'terminal',
    'run command',
    'execute',
    'install',
    'create file',
    'write file',
    'edit file',
    'read file',
    'list directory',
    'files',
    'folder',
    'system',
    'desktop',
    'mouse',
    'click',
    'type',
    'screenshot',
    'take a screenshot',
    'what is on my screen',
    'open',
    'launch',
    'start',
    'stop',
    'restart',
    'download',
    'upload',
    'git',
    'commit',
    'push',
    'pull',
    'clone',
    'npm',
    'pip',
    'python',
    'node',
    'localhost',
    'server',
    'deploy',
    'build',
    'compile',
    'test',
    'debug',
    'analyse',
    'analyze',
    'check',
    'monitor',
    'watch',
    'tail',
    'log',
    'error',
    'fix',
    'repair',
    'update',
    'upgrade',
    'configure',
    'setup',
    'init',
    'scaffold',
    'generate',
    'create project',
    'new project',
    'workspace',
    'code',
    'editor',
    'ide',
    'vscode',
    'cursor',
    'windsurf',
    'github',
    'repo',
    'repository',
    'branch',
    'merge',
    'rebase',
    'fetch',
    'remote',
    'ssh',
    'docker',
    'container',
    'compose',
    'kubernetes',
    'k8s',
    'aws',
    'azure',
    'gcp',
    'cloud',
    'api',
    'rest',
    'graphql',
    'database',
    'db',
    'sql',
    'postgres',
    'mysql',
    'mongodb',
    'redis',
    'queue',
    'worker',
    'cron',
    'schedule',
    'automate',
    'script',
    'shell',
    'bash',
    'zsh',
    'powershell',
    'cmd',
    'terminal',
    'console',
    'cli',
    'tool',
    'utility',
    'plugin',
    'extension',
    'addon',
    'module',
    'package',
    'dependency',
    'library',
    'framework',
    'template',
    'boilerplate',
    'starter',
    'kit',
    'sdk',
    'client',
    'server',
    'backend',
    'frontend',
    'fullstack',
    'stack',
    'web',
    'app',
    'application',
    'software',
    'program',
    'service',
    'microservice',
    'function',
    'lambda',
    'endpoint',
    'route',
    'middleware',
    'auth',
    'login',
    'signup',
    'register',
    'authenticate',
    'authorize',
    'permission',
    'role',
    'user',
    'admin',
    'moderator',
    'owner',
    'team',
    'organization',
    'org',
    'company',
    'enterprise',
    'business',
    'startup',
    'saas',
    'product',
    'feature',
    'bug',
    'issue',
    'ticket',
    'task',
    'story',
    'epic',
    'sprint',
    'agile',
    'scrum',
    'kanban',
    'board',
    'backlog',
    'roadmap',
    'milestone',
    'release',
    'version',
    'tag',
    'changelog',
    'readme',
    'documentation',
    'docs',
    'wiki',
    'guide',
    'tutorial',
    'howto',
    'example',
    'sample',
    'demo',
    'poc',
    'prototype',
    'mvp',
    'proof of concept',
    'minimum viable product',
  ];
  return localKeywords.some((keyword) => lower.includes(keyword));
};

const pickSmartAgentModel = (
  text: string,
  currentModel: string,
  backendOnline: boolean,
) => {
  if (!backendOnline) return currentModel;
  const lower = text.toLowerCase();
  const heavyKeywords = [
    'browser',
    'navigate to',
    'go to',
    'search for',
    'find',
    'look up',
    'terminal',
    'run command',
    'execute',
    'install',
    'create file',
    'write file',
    'edit file',
    'read file',
    'list directory',
    'files',
    'folder',
    'system',
    'desktop',
    'mouse',
    'click',
    'type',
    'screenshot',
    'take a screenshot',
    'what is on my screen',
    'open',
    'launch',
    'start',
    'stop',
    'restart',
    'download',
    'upload',
    'git',
    'commit',
    'push',
    'pull',
    'clone',
    'npm',
    'pip',
    'python',
    'node',
    'localhost',
    'server',
    'deploy',
    'build',
    'compile',
    'test',
    'debug',
    'analyse',
    'analyze',
    'check',
    'monitor',
    'watch',
    'tail',
    'log',
    'error',
    'fix',
    'repair',
    'update',
    'upgrade',
    'configure',
    'setup',
    'init',
    'scaffold',
    'generate',
    'create project',
    'new project',
    'workspace',
    'code',
    'editor',
    'ide',
    'vscode',
    'cursor',
    'windsurf',
    'github',
    'repo',
    'repository',
    'branch',
    'merge',
    'rebase',
    'fetch',
    'remote',
    'ssh',
    'docker',
    'container',
    'compose',
    'kubernetes',
    'k8s',
    'aws',
    'azure',
    'gcp',
    'cloud',
    'api',
    'rest',
    'graphql',
    'database',
    'db',
    'sql',
    'postgres',
    'mysql',
    'mongodb',
    'redis',
    'queue',
    'worker',
    'cron',
    'schedule',
    'automate',
    'script',
    'shell',
    'bash',
    'zsh',
    'powershell',
    'cmd',
    'terminal',
    'console',
    'cli',
    'tool',
    'utility',
    'plugin',
    'extension',
    'addon',
    'module',
    'package',
    'dependency',
    'library',
    'framework',
    'template',
    'boilerplate',
    'starter',
    'kit',
    'sdk',
    'client',
    'server',
    'backend',
    'frontend',
    'fullstack',
    'stack',
    'web',
    'app',
    'application',
    'software',
    'program',
    'service',
    'microservice',
    'function',
    'lambda',
    'endpoint',
    'route',
    'middleware',
    'auth',
    'login',
    'signup',
    'register',
    'authenticate',
    'authorize',
    'permission',
    'role',
    'user',
    'admin',
    'moderator',
    'owner',
    'team',
    'organization',
    'org',
    'company',
    'enterprise',
    'business',
    'startup',
    'saas',
    'product',
    'feature',
    'bug',
    'issue',
    'ticket',
    'task',
    'story',
    'epic',
    'sprint',
    'agile',
    'scrum',
    'kanban',
    'board',
    'backlog',
    'roadmap',
    'milestone',
    'release',
    'version',
    'tag',
    'changelog',
    'readme',
    'documentation',
    'docs',
    'wiki',
    'guide',
    'tutorial',
    'howto',
    'example',
    'sample',
    'demo',
    'poc',
    'prototype',
    'mvp',
    'proof of concept',
    'minimum viable product',
  ];
  if (heavyKeywords.some((keyword) => lower.includes(keyword))) {
    return 'claude-sonnet-4-20250514';
  }
  return currentModel;
};

const CodePage = () => {
  const navigate = useNavigate();
  const task = useStore((s) => s.task);
  const setTask = useStore((s) => s.setTask);
  const status = useStore((s) => s.status);
  const entries = useStore((s) => s.entries);
  const addLogEntry = useStore((s) => s.addLogEntry);
  const startAgent = useStore((s) => s.startAgent);
  const stopAgent = useStore((s) => s.stopAgent);
  const resolveAsk = useStore((s) => s.resolveAsk);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const activeThread = useStore((s) => s.activeThread);
  const setActiveThread = useStore((s) => s.setActiveThread);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const model = useStore((s) => s.model);
  const setModel = useStore((s) => s.setModel);
  const openSettingsFor = useStore((s) => s.openSettingsFor);
  const composerPreferences = useStore((s) => s.composerPreferences);
  const setComposerPreferences = useStore((s) => s.setComposerPreferences);
  const backendOnline = useStore((s) => s.backendOnline);
  const backendHealth = useStore((s) => s.backendHealth);
  const reasoningEffort = useStore((s) => s.reasoningEffort);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const incognitoMode = useStore((s) => s.incognitoMode);
  const setIncognitoMode = useStore((s) => s.setIncognitoMode);
  const pendingTaskContext = useStore((s) => s.pendingTaskContext);
  const setPendingTaskContext = useStore((s) => s.setPendingTaskContext);
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
  const openWorkspacePanel = useStore((s) => s.openWorkspacePanel);
  const setWorkspacePanelView = useStore((s) => s.setWorkspacePanelView);
  const historyOpen = useStore((s) => s.historyOpen);
  const setHistoryOpen = useStore((s) => s.setHistoryOpen);
  const saveConversationSnapshot = useStore((s) => s.saveConversationSnapshot);

  const [inputValue, setInputValue] = useState('');
  const [currentResponseType, setCurrentResponseType] = useState<import('@/lib/intentEngine/types').ResponseType>('text');
  const [configProvider, setConfigProvider] = useState<string | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [configConnectorId, setConfigConnectorId] = useState<string | null>(null);
  const [artifactWorkspaceOpen, setArtifactWorkspaceOpen] = useState(false);
  const [artifactWorkspaceView, setArtifactWorkspaceView] = useState<WorkspaceView>('preview');
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [connectors, setConnectors] = useState<ConnectorState[]>([]);
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [projectGeneratorOpen, setProjectGeneratorOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<AppProject | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composerMenuButtonRef = useRef<HTMLButtonElement>(null);
  const composerMenuPanelRef = useRef<HTMLDivElement>(null);
  const assistantBufferRef = useRef('');
  const responseStyleLabel = getSavedResponseStyleLabel();
  const appendTranscript = useCallback((transcript: string) => {
    setInputValue((previous) => `${previous.trimEnd()}${previous.trim() ? ' ' : ''}${transcript}`.trim());
  }, []);
  const { supported: speechSupported, listening: speechListening, error: speechError, toggle: toggleSpeechInput } =
    useSpeechInput({
      onTranscript: appendTranscript,
    });

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const chronologicalEntries = [...entries].reverse();
  const artifacts = collectArtifactsFromEntries(entries);
  const workspaceArtifacts = useMemo(
    () => artifacts.filter((artifact) => ['app', 'html', 'webpage', 'code', 'slides', 'markdown', 'document', 'csv', 'pdf'].includes(artifact.type)),
    [artifacts],
  );
  const currentProject = projects.find((project) => project.id === currentProjectId) || getCurrentProject(projects);

  const openArtifactWorkspace = (view: WorkspaceView) => {
    setArtifactWorkspaceView(view);
    setArtifactWorkspaceOpen(true);
  };

  const openGeneratedWorkspace = (view: WorkspaceView) => {
    setWorkspacePanelView(view);
    openWorkspacePanel(view);
  };

  const handleProjectWorkspaceReady = useCallback((workspace: GeneratedWorkspace) => {
    setActiveWorkspace(workspace);
    setProjectGeneratorOpen(false);
    openWorkspacePanel('preview');
  }, [setActiveWorkspace, openWorkspacePanel]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  useEffect(() => {
    if (!task || status !== 'idle' || activeThread || mode === 'agent') {
      return;
    }

    if (shouldUseBuilderWorkspace(task, composerPreferences)) {
      void handleBuilderSend(task, pendingTaskContext);
    } else {
      void handleChatSend(task, pendingTaskContext);
    }
    setTask('');
    setPendingTaskContext('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread, mode, pendingTaskContext, status, task]);

  useEffect(() => {
    const syncConnectors = () => setConnectors(loadConnectors());
    syncConnectors();
    window.addEventListener(CONNECTORS_UPDATED_EVENT, syncConnectors);

    return () => {
      window.removeEventListener(CONNECTORS_UPDATED_EVENT, syncConnectors);
    };
  }, []);

  useEffect(() => {
    const syncProjects = () => setProjects(loadProjects());
    syncProjects();
    window.addEventListener(PROJECTS_UPDATED_EVENT, syncProjects);

    return () => {
      window.removeEventListener(PROJECTS_UPDATED_EVENT, syncProjects);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        composerMenuButtonRef.current &&
        !composerMenuButtonRef.current.contains(target) &&
        !composerMenuPanelRef.current?.contains(target)
      ) {
        setComposerMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setComposerMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  const { analyzeAndPrepare, lastIntent } = useIntentEngine();

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) return;
    setComposerMenuOpen(false);

    // Analyse l'intention AVANT d'envoyer
    const intent = analyzeAndPrepare(text, undefined, backendOnline);
    setCurrentResponseType(intent.responseType);

    let attachmentContext = await buildAttachmentContext(attachments);
    const shouldUseBuilder = shouldUseBuilderWorkspace(text, composerPreferences);
    const shouldUseAgent =
      shouldRouteToAgent(text, mode, backendOnline) ||
      (mode === 'agent' && backendOnline && requiresLocalTools(text));

    // Détection intelligente : demande de création de projet → ouvre le ProjectGeneratorPanel
    const shouldGenerateProject = shouldUseProjectGenerator(text);
    if (shouldGenerateProject && backendOnline) {
      setInputValue(text);
      setProjectGeneratorOpen(true);
      return;
    }

    if (mode === 'agent' && !backendOnline) {
      toast.error('Agent mode needs the local backend to be online.');
      return;
    }

    if (shouldUseBuilder && !backendOnline) {
      toast.error('Builder mode needs the local backend to be online.');
      return;
    }

    if (shouldUseBuilder && backendOnline) {
      await handleBuilderSend(text, attachmentContext);
      return;
    }

    if (mode !== 'agent') {
      const dcResult = await handleDesktopCommanderSend(text);
      if (dcResult === true) {
        // Desktop Commander a géré une action simple (création fichier, dossier, etc.)
        return;
      }
      if (typeof dcResult === 'string') {
        // Desktop Commander a collecté des données système → les injecter comme contexte pour l'IA
        attachmentContext = attachmentContext
          ? `${attachmentContext}\n\n---\nDonnées collectées par Desktop Commander:\n${dcResult}`
          : `Données collectées par Desktop Commander:\n${dcResult}`;
      }
      // Si dcResult === null → pas une intention DC → continuer normalement vers l'IA
    }

    if (shouldUseAgent) {
      // Use the selected model without switching
      if (mode === 'chat') {
        setMode('agent');
        toast.message('Using Agent mode to run local tools for this request.');
      }

      setPendingTaskContext(attachmentContext);
      setTask(text);
      setActiveThread('agent');
      setInputValue('');
      setAttachments([]);

      // Save snapshot for agent mode
      setTimeout(() => {
        useStore.getState().saveConversationSnapshot({ label: text, thread: 'agent' });
      }, 50);

      if (status === 'idle' || status === 'done' || status === 'error') {
        setTimeout(() => {
          useStore.getState().startAgent();
        }, 100);
      }
      return;
    }

    await handleChatSend(text, attachmentContext);
  };

  /**
   * Gère les intentions Desktop Commander.
   * @returns `true` si l'action a été exécutée directement (fichier créé, commande shell)
   *          `string` (contexte) si des données ont été collectées pour analyse par l'IA
   *          `null` si ce n'est pas une intention Desktop Commander
   */
  const handleDesktopCommanderSend = async (text: string): Promise<boolean | string | null> => {
    setChatLoading(true);
    try {
      const execution = await executeDesktopCommanderIntent(text);
      if (!execution) {
        setChatLoading(false);
        return null;
      }

      setComposerMenuOpen(false);
      setInputValue('');
      setAttachments([]);
      setActiveThread('chat');

      addLogEntry({
        id: crypto.randomUUID(),
        step: 0,
        timestamp: new Date().toISOString(),
        type: 'info',
        action: text,
        reasoning: '',
      });

      addLogEntry({
        id: crypto.randomUUID(),
        step: 1,
        timestamp: new Date().toISOString(),
        type: execution.logType,
        action: execution.action,
        reasoning: execution.reasoning,
        tool_result: execution.toolResult,
        actionType: execution.actionType,
        toolLabel: execution.toolLabel,
      });

      // Pour les intentions d'analyse (système, recherche, lecture), on retourne les données
      // comme contexte pour que l'IA les analyse intelligemment
      const analysisIntents = ['system_info', 'file_search', 'file_read'];
      if (analysisIntents.includes(execution.actionType)) {
        addLogEntry({
          id: crypto.randomUUID(),
          step: 1,
          timestamp: new Date().toISOString(),
          type: 'result',
          action: execution.resultMarkdown,
          reasoning: '',
          toolLabel: 'Desktop Commander result',
        });
        useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
        setChatLoading(false);
        return execution.resultMarkdown;
      }

      // Pour les actions simples (fichier créé, dossier, commande shell), on arrête ici
      addLogEntry({
        id: crypto.randomUUID(),
        step: 1,
        timestamp: new Date().toISOString(),
        type: 'result',
        action: execution.resultMarkdown,
        reasoning: '',
        toolLabel: 'Desktop Commander result',
      });
      useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
      setChatLoading(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Desktop Commander request failed.';
      addLogEntry({
        id: crypto.randomUUID(),
        step: 1,
        timestamp: new Date().toISOString(),
        type: 'error',
        action: message,
        reasoning: '',
        toolLabel: 'Desktop Commander error',
      });
      useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
      setChatLoading(false);
      return true;
    }
  };

  const handleBuilderSend = async (text: string, attachmentContext = '') => {
    setComposerMenuOpen(false);
    setInputValue('');
    setAttachments([]);
    setChatLoading(true);
    setActiveThread('chat');

    const userEntry: LogEntry = {
      id: crypto.randomUUID(),
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'info',
      action: text,
      reasoning: '',
    };
    addLogEntry(userEntry);

    const infoEntryId = crypto.randomUUID();
    addLogEntry({
      id: infoEntryId,
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'info',
      action: 'Builder mode engaged. AgentOS is generating a structured local workspace with preview, code, database, and files surfaces.',
      reasoning: '',
      toolLabel: 'Builder',
    });

    try {
      const workspace = await createBuilderWorkspace(
        [text, attachmentContext].filter(Boolean).join('\n\n'),
      );
      setActiveWorkspace(workspace);
      addLogEntry({
        id: crypto.randomUUID(),
        step: 0,
        timestamp: new Date().toISOString(),
        type: 'result',
        action: `${workspace.summary}\n\nWorkspace surfaces:\n- Preview\n- Code\n${workspace.database_files.length > 0 ? '- Database\n' : ''}- Files`,
        reasoning: '',
        toolLabel: 'Workspace ready',
      });
      useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
      toast.success('Builder workspace generated locally.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Builder workspace failed';
      addLogEntry({
        id: crypto.randomUUID(),
        step: 0,
        timestamp: new Date().toISOString(),
        type: 'error',
        action: message,
        reasoning: '',
        toolLabel: 'Builder error',
      });
      toast.error(message);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatSend = async (text: string, attachmentContext = '') => {
    if (activeThread === 'agent' && status !== 'running' && status !== 'paused' && entries.length > 0) {
      useStore.getState().reset();
    }

    setPendingTaskContext('');
    setInputValue('');
    setAttachments([]);
    setChatLoading(true);
    setActiveThread('chat');

    const userEntry: LogEntry = {
      id: crypto.randomUUID(),
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'info',
      action: text,
      reasoning: '',
    };
    addLogEntry(userEntry);

    const messages: ChatMessageType[] = [];
    const behaviorInstructions = [getBehaviorInstructions(), getComposerInstructions(composerPreferences)]
      .filter(Boolean)
      .join('\n\n');
    const projectContext = buildProjectContext(text, currentProject);
    const readyConnectors = connectors.filter((connector) => connector.connected);
    const workspaceContext = [
      `Workspace mode: ${mode}`,
      `Backend: ${backendOnline ? 'online' : 'offline'}`,
      composerPreferences.builderMode ? 'Agent builder is enabled.' : '',
      composerPreferences.webResearch ? 'Web research is enabled.' : '',
      readyConnectors.length > 0 ? `Connected tools: ${readyConnectors.map((connector) => connector.name).join(', ')}` : '',
      attachments.length > 0 ? `Attachments: ${attachments.map((file) => file.name).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const systemContext = [behaviorInstructions, projectContext, workspaceContext, attachmentContext]
      .filter(Boolean)
      .join('\n\n');

    if (systemContext) {
      messages.push({ role: 'system', content: systemContext });
    }

    const allEntries = [...useStore.getState().entries].reverse();
    for (const entry of allEntries) {
      if (entry.id === userEntry.id) {
        messages.push({ role: 'user', content: entry.action });
      } else if (entry.type === 'result' || (entry.type === 'info' && entry.step === 0 && messages.length > 0)) {
        messages.push({ role: 'assistant', content: entry.action });
      }
    }

    if (messages.length === 0 || messages[messages.length - 1].content !== text) {
      messages.push({ role: 'user', content: text });
    }

    const assistantId = crypto.randomUUID();
    assistantBufferRef.current = '';
    const streamHandler = createArtifactStreamHandler(assistantId);

    const assistantEntry: LogEntry = {
      id: assistantId,
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'result',
      action: '',
      reasoning: '',
    };
    addLogEntry(assistantEntry);

    // Track tool call entry IDs so we can update them with results
    const toolEntryMap = new Map<string, string>();

    const toolTypeForName = (toolName: string) => {
      if (toolName === 'bash_tool') return 'shell' as const;
      if (toolName === 'web_search') return 'web' as const;
      if (toolName === 'str_replace_editor') return 'file' as const;
      if (toolName === 'list_directory') return 'file' as const;
      if (toolName === 'system_info') return 'perceive' as const;
      return 'act' as const;
    };

    const toolLabelForName = (toolName: string, args: Record<string, unknown>) => {
      if (toolName === 'bash_tool') return `$ ${String(args.command ?? '').slice(0, 60)}`;
      if (toolName === 'str_replace_editor') return `${args.command ?? 'view'} · ${String(args.path ?? '').split('\\').pop()}`;
      if (toolName === 'list_directory') return `ls ${String(args.path ?? '')}`;
      if (toolName === 'web_search') return `🔍 ${String(args.query ?? '')}`;
      if (toolName === 'system_info') return 'system_info';
      return toolName;
    };

    await chatDirect(
      messages,
      model,
      reasoningEffort,
      composerPreferences.webResearch,
      (token) => {
        assistantBufferRef.current += token;
        // Parse les artifacts du stream et récupère le texte nettoyé
        const cleanText = streamHandler.onChunk(token);
        useStore.setState((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === assistantId
              ? { ...entry, action: cleanText || assistantBufferRef.current }
              : entry,
          ),
        }));
      },
      () => {
        setChatLoading(false);
        // Dernier parse pour capturer les artifacts restants
        streamHandler.onDone();
        useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
      },
      (err) => {
        setChatLoading(false);
        useStore.setState((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === assistantId ? { ...entry, type: 'error', action: err } : entry,
          ),
        }));
        useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
      },
      {
        onToolCall: (event: ToolCallEvent) => {
          const entryId = crypto.randomUUID();
          toolEntryMap.set(event.id, entryId);
          const label = toolLabelForName(event.tool, event.args);
          setCurrentTool(event.tool);
          useStore.getState().addLogEntry({
            id: entryId,
            step: 0,
            timestamp: new Date().toISOString(),
            type: toolTypeForName(event.tool),
            action: label,
            reasoning: '',
            toolLabel: label,
            tool_result: undefined,
            actionType: event.tool,
            toolArgs: event.args as Record<string, any>,
          });
        },
        onToolResult: (event: ToolResultEvent) => {
          const entryId = toolEntryMap.get(event.id);
          setCurrentTool(null);
          if (!entryId) return;
          useStore.setState((state) => ({
            entries: state.entries.map((e) =>
              e.id === entryId
                ? {
                    ...e,
                    type: event.success ? toolTypeForName(event.tool) : ('error' as const),
                    tool_result: { output: event.result },
                    reasoning: event.result,
                  }
                : e,
            ),
          }));
        },
      },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    setAttachments((previous) => [...previous, ...Array.from(files)]);
    toast.success(`${files.length} file${files.length > 1 ? 's' : ''} attached`);
    event.target.value = '';
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    setAttachments((previous) => [...previous, ...Array.from(files)]);
    toast.success(`${files.length} image${files.length > 1 ? 's' : ''} attached`);
    event.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleToggleComposerPreference = (key: keyof Pick<ComposerPreferences, 'webResearch' | 'useStyle' | 'builderMode'>) => {
    setComposerPreferences({ [key]: !composerPreferences[key] });
    setComposerMenuOpen(false);
  };

  const lastEntry = entries[0];
  const toolDisplayName: Record<string, string> = {
    bash_tool: 'Terminal',
    str_replace_editor: 'Editor',
    list_directory: 'Filesystem',
    web_search: 'Web search',
    system_info: 'System',
  };
  const thinkingLabel = currentTool
    ? `${toolDisplayName[currentTool] ?? currentTool}…`
    : lastEntry?.toolLabel
    ? `${lastEntry.toolLabel}...`
    : isRunning
    ? 'Agent is working...'
    : isPaused
    ? 'Waiting for your input...'
    : chatLoading
    ? 'Analysing…'
    : 'Processing...';

  const isArtifactPanelOpen = useArtifactStore((s) => s.isOpen);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[hsl(0,0%,10%)]">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar — left side */}
        <AnimatePresence>
          {isSidebarOpen && (
            <CodeSidebar
              onSelectProject={setActiveProject}
              activeProject={activeProject}
            />
          )}
        </AnimatePresence>

        {/* Chat content — center */}
        <div
          className="flex min-h-0 min-w-0 flex-col"
          style={{
            flex: isArtifactPanelOpen || isCodePanelOpen ? '1 1 44%' : '1 1 100%',
            maxWidth: isArtifactPanelOpen || isCodePanelOpen ? '44%' : '100%',
            transition: 'flex 0.3s ease, max-width 0.3s ease',
          }}
        >
        <div className="flex items-center justify-between border-b border-[hsl(0,0%,17%)] px-3 py-3 md:px-5">
          <div className="min-w-0 flex items-center gap-2 md:gap-3">
          <div className="w-10 shrink-0 md:hidden" />
          <ModelSelector onConfigureProvider={setConfigProvider} />
          <span className="hidden truncate text-sm font-medium text-foreground md:inline">
            {task && activeThread === 'agent'
              ? task.slice(0, 50) + (task.length > 50 ? '...' : '')
              : currentProject
              ? `Project: ${currentProject.name}`
              : 'Code workspace'}
          </span>
          {(isRunning || isPaused) && (
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">
                Step {currentStep}/{maxSteps}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatTime(elapsedTime)}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-border bg-muted/60 p-1 md:inline-flex">
            <button
              onClick={() => setMode('chat')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                mode !== 'agent'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquareText size={12} />
              Chat
            </button>
            <button
              onClick={() => setMode('agent')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'agent'
                  ? 'border border-primary/20 bg-primary/10 text-primary-300'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bot size={12} className={mode === 'agent' ? 'animate-pulse' : undefined} />
              Agent
            </button>
          </div>
          <button
            onClick={() => setProjectsOpen(true)}
            className={`hidden items-center gap-1.5 rounded-md border px-3 py-1 text-xs transition-colors md:inline-flex ${
              currentProject
                ? 'border-primary-300/18 bg-primary-400/10 text-primary-100 hover:bg-primary-400/15'
                : 'border-border text-muted-foreground hover:bg-surface-elevated'
            }`}
          >
            <FolderOpen size={12} />
            {currentProject ? currentProject.name : 'Projects'}
          </button>
          <button
            onClick={() => setProjectGeneratorOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-primary-300/18 bg-primary-400/10 px-3 py-1 text-xs font-medium text-primary-100 transition-colors hover:bg-primary-400/15 active:scale-[0.97]"
            title="Generate a project with AI"
          >
            <Sparkles size={12} />
            Generate
          </button>
          {isPaused && (
            <span className="rounded-md bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              Paused
            </span>
          )}
          {(isRunning || isPaused) && (
            <button
              onClick={stopAgent}
              className="rounded-md border border-destructive/30 px-3 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.97]"
            >
              Stop
            </button>
          )}
          {chatLoading && (
            <button
              onClick={() => setChatLoading(false)}
              className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-elevated active:scale-[0.97]"
            >
              <Square size={11} className="mr-1 inline" />
              Stop
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 md:px-5 md:py-4">
        {activeThread === 'agent' && task && (
          <div className="mb-2 flex gap-3 py-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <span className="text-xs font-medium text-primary">U</span>
            </div>
            <div className="flex-1">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">You</span>
              <p className="text-sm text-foreground">{task}</p>
            </div>
          </div>
        )}

        {activeThread === 'agent' && task && entries.length > 0 && (
          <div className="my-2 border-t border-border" />
        )}

        {(activeThread === 'agent' || (task && (isRunning || isPaused || status === 'done' || status === 'error'))) && (
          <div className="mx-auto mb-4 w-full max-w-[980px]">
            <LiveSessionCard />
          </div>
        )}

        {activeWorkspace ? (
          <div className="mx-auto mb-4 w-full max-w-[980px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-300/14 bg-primary-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary-100/78">
                  <Layers3 size={12} />
                  Workspace ready
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">{activeWorkspace.title}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/62">
                  {activeWorkspace.summary}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openGeneratedWorkspace('preview')}
                  className="inline-flex items-center gap-2 rounded-full border border-primary-300/18 bg-primary-400/10 px-4 py-2 text-sm font-medium text-primary-100 transition-colors hover:bg-primary-400/15"
                >
                  <MonitorPlay size={14} />
                  Preview
                </button>
                <button
                  onClick={() => openGeneratedWorkspace('code')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <Code2 size={14} />
                  Code
                </button>
                {activeWorkspace.database_files.length > 0 && (
                  <button
                    onClick={() => openGeneratedWorkspace('database')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                  >
                    <Database size={14} />
                    Database
                  </button>
                )}
                <button
                  onClick={() => openGeneratedWorkspace('files')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <FolderOpen size={14} />
                  Files
                </button>
              </div>
            </div>
          </div>
        ) : workspaceArtifacts.length > 0 ? (
          <div className="mx-auto mb-4 w-full max-w-[980px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-300/14 bg-primary-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary-100/78">
                  <Layers3 size={12} />
                  Artifact workspace
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">Generated project workspace is ready</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/62">
                  Open the fallback artifact workspace to inspect the live preview, review generated code, or browse artifacts from the conversation.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openArtifactWorkspace('preview')}
                  className="inline-flex items-center gap-2 rounded-full border border-primary-300/18 bg-primary-400/10 px-4 py-2 text-sm font-medium text-primary-100 transition-colors hover:bg-primary-400/15"
                >
                  <MonitorPlay size={14} />
                  Preview
                </button>
                <button
                  onClick={() => openArtifactWorkspace('code')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <Code2 size={14} />
                  Code
                </button>
                <button
                  onClick={() => openArtifactWorkspace('database')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <Database size={14} />
                  Database
                </button>
                <button
                  onClick={() => openArtifactWorkspace('files')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <FolderOpen size={14} />
                  Files
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {chronologicalEntries.map((entry) => {
          if (activeThread !== 'agent' && entry.type === 'info' && entry.step === 0) {
            return (
              <div key={entry.id} className="flex gap-3 py-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <span className="text-xs font-medium text-primary">U</span>
                </div>
                <div className="flex-1">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">You</span>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{entry.action}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={entry.id}>
              <ChatMessage
                entry={entry}
                onAskReply={resolveAsk}
                isStreaming={chatLoading && entry.type === 'result' && entry.id === chronologicalEntries[chronologicalEntries.length - 1]?.id}
              />
            </div>
          );
        })}

        <TakeoverBanner />

        {(isRunning || chatLoading) && <ThinkingIndicator label={thinkingLabel} />}

        {status === 'done' && activeThread === 'agent' && (
          <div className="log-entry-enter mt-2 flex items-center gap-2 py-3">
            <CheckCircle size={14} className="text-success" />
            <span className="text-sm font-medium text-success">Task completed successfully</span>
          </div>
        )}

        {status === 'error' && (
          <div className="log-entry-enter mt-2 flex items-center gap-2 py-3 text-destructive">
            <AlertTriangle size={14} />
            <span className="text-sm font-medium">
              {useStore.getState().errorMessage || 'An error occurred'}
            </span>
            {activeThread === 'agent' && (
              <button
                onClick={startAgent}
                className="ml-2 rounded-md bg-destructive px-3 py-1 text-xs text-destructive-foreground transition-opacity hover:opacity-90"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!task && entries.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated">
              <Code2 size={20} className="text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-base font-medium text-foreground">What do you want to build?</h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              Ask a question directly, or switch to Agent mode when you want live browser, terminal, or desktop execution inside the workspace.
            </p>
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center gap-2 px-3 pt-2 md:px-5">
          {attachments.map((file, index) => (
            <div key={index} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
              <Paperclip size={11} className="text-muted-foreground" />
              {file.type.startsWith('image/') && (
                <span className="rounded-full border border-primary-300/20 bg-primary-400/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-100">
                  Image
                </span>
              )}
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button onClick={() => removeAttachment(index)} className="text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {(composerPreferences.webResearch || composerPreferences.useStyle || composerPreferences.builderMode) && (
        <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center gap-2 px-3 pt-2 md:px-5">
          {mode === 'agent' && (
            <button
              onClick={() => setMode('chat')}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive"
            >
              <Bot size={11} />
              Agent mode
              <X size={11} />
            </button>
          )}
          {composerPreferences.builderMode && (
            <button
              onClick={() => setComposerPreferences({ builderMode: false })}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/16 bg-primary-400/10 px-2.5 py-1 text-[11px] font-medium text-primary-100"
            >
              <Code2 size={11} />
              Agent builder
              <X size={11} />
            </button>
          )}
          {composerPreferences.webResearch && (
            <button
              onClick={() => setComposerPreferences({ webResearch: false })}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/16 bg-primary-400/10 px-2.5 py-1 text-[11px] font-medium text-primary-100"
            >
              Web research
              <X size={11} />
            </button>
          )}
          {composerPreferences.useStyle && (
            <button
              onClick={() => setComposerPreferences({ useStyle: false })}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/16 bg-primary-400/10 px-2.5 py-1 text-[11px] font-medium text-primary-100"
            >
              {responseStyleLabel}
              <X size={11} />
            </button>
          )}
        </div>
      )}

      {(currentProject || incognitoMode) && (
        <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center gap-2 px-3 pt-2 md:px-5">
          {currentProject && (
            <button
              onClick={() => setProjectsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/16 bg-primary-400/10 px-2.5 py-1 text-[11px] font-medium text-primary-100"
            >
              <FolderOpen size={11} />
              {currentProject.name}
            </button>
          )}
          {incognitoMode && (
            <button
              onClick={() => setIncognitoMode(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/16 bg-primary-400/10 px-2.5 py-1 text-[11px] font-medium text-primary-100"
            >
              <Ghost size={11} />
              Private session
              <X size={11} />
            </button>
          )}
          {!composerPreferences.webResearch && !composerPreferences.useStyle && !composerPreferences.builderMode && mode === 'agent' && (
            <button
              onClick={() => setMode('chat')}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive"
            >
              <Bot size={11} />
              Agent mode
              <X size={11} />
            </button>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-[980px] px-3 pb-3 pt-2 md:px-5 md:pb-4">
        <div className="relative flex items-end gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 transition-shadow focus-within:glow-purple md:gap-3 md:px-4 md:py-3">
          <button
            ref={composerMenuButtonRef}
            onClick={() => setComposerMenuOpen((open) => !open)}
            className="mb-0.5 shrink-0 p-0.5 text-muted-foreground transition-colors hover:text-foreground active:scale-95"
            title="Insert"
          >
            <Plus size={18} />
          </button>
          <ComposerInsertMenu
            open={composerMenuOpen}
            anchorRef={composerMenuButtonRef}
            panelRef={composerMenuPanelRef}
            connectedCount={connectors.filter((connector) => connector.connected).length}
            responseStyleLabel={responseStyleLabel}
            agentModeEnabled={mode === 'agent'}
            builderModeEnabled={composerPreferences.builderMode}
            webSearchEnabled={composerPreferences.webResearch}
            useStyleEnabled={composerPreferences.useStyle}
            onToggleAgentMode={() => setMode(mode === 'agent' ? 'chat' : 'agent')}
            onToggleBuilderMode={() => handleToggleComposerPreference('builderMode')}
            onAddFiles={() => {
              setComposerMenuOpen(false);
              fileInputRef.current?.click();
            }}
            onAddImages={() => {
              setComposerMenuOpen(false);
              imageInputRef.current?.click();
            }}
            onOpenGoogleDrive={() => {
              setComposerMenuOpen(false);
              setConfigConnectorId('google-drive');
            }}
            onOpenGitHub={() => {
              setComposerMenuOpen(false);
              setConfigConnectorId('github');
            }}
            onOpenProjects={() => {
              setComposerMenuOpen(false);
              setProjectsOpen(true);
            }}
            onOpenSkills={() => {
              setComposerMenuOpen(false);
              openSettingsFor('skills');
            }}
            onOpenConnectors={() => {
              setComposerMenuOpen(false);
              setDirectoryOpen(true);
            }}
            onToggleWebSearch={() => handleToggleComposerPreference('webResearch')}
            onToggleUseStyle={() => handleToggleComposerPreference('useStyle')}
          />
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
          <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
          <div className="flex items-center gap-2 px-1 pb-1">
            <ResponseTypePill
              responseType={currentResponseType}
              isVisible={inputValue.trim().length > 0}
            />
          </div>
          <textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something or assign a task..."
            rows={1}
            className="min-h-[28px] max-h-[120px] flex-1 resize-none bg-transparent text-base font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            style={{ height: 'auto' }}
            onInput={(event) => {
              const target = event.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <div className="mb-0.5 flex shrink-0 items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-muted-foreground transition-colors hover:text-foreground active:scale-95"
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>
            <button
              onClick={() => {
                if (!speechSupported) {
                  toast.error('Voice input is not supported in this browser.');
                  return;
                }
                toggleSpeechInput();
              }}
              className={`p-1 transition-colors active:scale-95 ${
                speechListening ? 'text-destructive hover:text-destructive' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Voice input"
            >
              <Mic size={16} className={speechListening ? 'animate-pulse' : undefined} />
            </button>
            <button
              onClick={() => void handleSend()}
              disabled={!inputValue.trim() || chatLoading || isRunning}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30 active:scale-95"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>

      <ProviderConfigModal providerId={configProvider} onClose={() => setConfigProvider(null)} />
      <ArtifactWorkspaceModal
        open={artifactWorkspaceOpen}
        artifacts={artifacts}
        initialView={artifactWorkspaceView}
        onClose={() => setArtifactWorkspaceOpen(false)}
      />
      <Suspense fallback={null}>
        <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
        <ConnectorsDirectoryModal
          open={directoryOpen}
          connectors={connectors}
          onClose={() => setDirectoryOpen(false)}
          onOpenSettings={() => openSettingsFor('connectors')}
          onSelectConnector={(id) => {
            setDirectoryOpen(false);
            setConfigConnectorId(id);
          }}
        />
        <ConnectorConfigModal
          connectorId={configConnectorId}
          onClose={() => setConfigConnectorId(null)}
          onSave={(nextState) => {
            setConnectors((previous) => {
              const next = mergeConnectorState(previous, nextState);
              saveConnectors(next);
              return next;
            });
            setConfigConnectorId(null);
          }}
        />
      </Suspense>
<HistorySidebar />

<ProjectGeneratorPanel
  open={projectGeneratorOpen}
  onClose={() => setProjectGeneratorOpen(false)}
  onWorkspaceReady={handleProjectWorkspaceReady}
/>


      </div>

      {/* Code panel — right side (56%) */}
      {isCodePanelOpen && <CodePanel projectPath="" projectType="static" onClose={() => setIsCodePanelOpen(false)} />}
      <ArtifactPanel />
    </div>
    </div>
  );
};

export default CodePage;
