export interface ProjectKnowledgeItem {
  id: string;
  name: string;
  kind: 'note' | 'file';
  mimeType: string;
  content: string;
  summary: string;
  updatedAt: string;
}

export interface AppProject {
  id: string;
  name: string;
  description: string;
  instructions: string;
  knowledge: ProjectKnowledgeItem[];
  createdAt: string;
  updatedAt: string;
}

const PROJECTS_STORAGE_KEY = 'APP_PROJECTS';
const ACTIVE_PROJECT_ID_STORAGE_KEY = 'ACTIVE_PROJECT_ID';

export const PROJECTS_UPDATED_EVENT = 'agentos-projects-updated';

const isBrowser = () => typeof window !== 'undefined';

const emitProjectsUpdated = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(PROJECTS_UPDATED_EVENT));
};

const normalizeProject = (project: Partial<AppProject>): AppProject => {
  const now = new Date().toISOString();
  return {
    id: String(project.id || crypto.randomUUID()),
    name: String(project.name || 'Untitled project'),
    description: String(project.description || ''),
    instructions: String(project.instructions || ''),
    knowledge: Array.isArray(project.knowledge)
      ? project.knowledge.map((item) => ({
          id: String(item?.id || crypto.randomUUID()),
          name: String(item?.name || 'Untitled note'),
          kind: item?.kind === 'file' ? 'file' : 'note',
          mimeType: String(item?.mimeType || 'text/plain'),
          content: String(item?.content || ''),
          summary: String(item?.summary || ''),
          updatedAt: String(item?.updatedAt || now),
        }))
      : [],
    createdAt: String(project.createdAt || now),
    updatedAt: String(project.updatedAt || now),
  };
};

export const loadProjects = (): AppProject[] => {
  if (!isBrowser()) return [];

  try {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((project) => normalizeProject(project))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
};

export const saveProjects = (projects: AppProject[]) => {
  if (!isBrowser()) return;
  const normalized = projects
    .map((project) => normalizeProject(project))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(normalized));
  emitProjectsUpdated();
};

export const getCurrentProjectId = () => {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACTIVE_PROJECT_ID_STORAGE_KEY);
};

export const setCurrentProjectId = (projectId: string | null) => {
  if (!isBrowser()) return;
  if (projectId) {
    localStorage.setItem(ACTIVE_PROJECT_ID_STORAGE_KEY, projectId);
  } else {
    localStorage.removeItem(ACTIVE_PROJECT_ID_STORAGE_KEY);
  }
  emitProjectsUpdated();
};

export const getCurrentProject = (projects = loadProjects()) => {
  const currentId = getCurrentProjectId();
  if (!currentId) return null;
  return projects.find((project) => project.id === currentId) || null;
};

export const createProject = (input?: Partial<AppProject>) => {
  const now = new Date().toISOString();
  const project = normalizeProject({
    name: input?.name || 'New project',
    description: input?.description || '',
    instructions: input?.instructions || '',
    knowledge: input?.knowledge || [],
    createdAt: now,
    updatedAt: now,
  });
  const next = [project, ...loadProjects()];
  saveProjects(next);
  setCurrentProjectId(project.id);
  return project;
};

export const upsertProject = (project: AppProject) => {
  const current = loadProjects();
  const now = new Date().toISOString();
  const nextProject = normalizeProject({ ...project, updatedAt: now });
  const existingIndex = current.findIndex((candidate) => candidate.id === nextProject.id);

  if (existingIndex === -1) {
    saveProjects([nextProject, ...current]);
  } else {
    const next = [...current];
    next[existingIndex] = nextProject;
    saveProjects(next);
  }

  return nextProject;
};

export const removeProject = (projectId: string) => {
  const next = loadProjects().filter((project) => project.id !== projectId);
  saveProjects(next);

  if (getCurrentProjectId() === projectId) {
    setCurrentProjectId(next[0]?.id ?? null);
  }
};

export const removeKnowledgeItem = (projectId: string, itemId: string) => {
  const project = loadProjects().find((candidate) => candidate.id === projectId);
  if (!project) return null;

  return upsertProject({
    ...project,
    knowledge: project.knowledge.filter((item) => item.id !== itemId),
  });
};

const fileNameLooksTextual = (name: string) =>
  /\.(txt|md|markdown|json|csv|ts|tsx|js|jsx|py|html|css|yml|yaml|xml|log|sql)$/i.test(name);

export const fileToKnowledgeItem = async (file: File): Promise<ProjectKnowledgeItem> => {
  const isTextual = file.type.startsWith('text/') || file.type === 'application/json' || fileNameLooksTextual(file.name);
  const raw = isTextual ? await file.text() : '';
  const content = raw.trim();
  const summary = content
    ? content.replace(/\s+/g, ' ').slice(0, 180)
    : `Imported file: ${file.name}${file.type ? ` (${file.type})` : ''}`;

  return {
    id: crypto.randomUUID(),
    name: file.name,
    kind: 'file',
    mimeType: file.type || 'application/octet-stream',
    content: content || `File metadata only. Original filename: ${file.name}.`,
    summary,
    updatedAt: new Date().toISOString(),
  };
};

const normalizeWords = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3);

const scoreKnowledge = (item: ProjectKnowledgeItem, words: string[]) => {
  if (words.length === 0) return 1;

  const haystack = `${item.name} ${item.summary} ${item.content}`.toLowerCase();
  let score = 0;
  for (const word of words) {
    if (haystack.includes(word)) {
      score += item.name.toLowerCase().includes(word) ? 4 : 2;
    }
  }
  return score;
};

const clip = (value: string, size: number) => {
  if (value.length <= size) return value;
  return `${value.slice(0, size).trimEnd()}...`;
};

export const getRelevantKnowledge = (
  project: AppProject | null,
  query: string,
  limit = 3,
): ProjectKnowledgeItem[] => {
  if (!project || project.knowledge.length === 0) return [];
  const words = normalizeWords(query);

  return [...project.knowledge]
    .map((item) => ({ item, score: scoreKnowledge(item, words) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || right.item.updatedAt.localeCompare(left.item.updatedAt))
    .slice(0, limit)
    .map(({ item }) => item);
};

export const buildProjectContext = (query: string, project = getCurrentProject()) => {
  if (!project) return '';

  const sections = [`Active project: ${project.name}`];

  if (project.description.trim()) {
    sections.push(`Project summary: ${project.description.trim()}`);
  }

  if (project.instructions.trim()) {
    sections.push(`Project instructions:\n${project.instructions.trim()}`);
  }

  const knowledge = getRelevantKnowledge(project, query);
  if (knowledge.length > 0) {
    sections.push(
      [
        'Relevant project knowledge:',
        ...knowledge.map(
          (item, index) =>
            `${index + 1}. ${item.name} - ${clip(item.content || item.summary, 900)}`,
        ),
      ].join('\n'),
    );
  }

  return sections.join('\n\n').trim();
};
