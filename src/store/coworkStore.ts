import { create } from 'zustand';

export interface CoworkMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionSteps?: ActionStep[];
}

export interface ActionStep {
  id: string;
  type: 'thinking' | 'file_read' | 'file_write' | 'search' | 'analyze' | 'create' | 'execute' | 'computer_use' | 'plan';
  label: string;
  status: 'running' | 'done' | 'error';
  detail?: string;
  fileName?: string;
  screenshotUrl?: string;
}

export interface CoworkConversation {
  id: string;
  title: string;
  messages: CoworkMessage[];
  createdAt: string;
  updatedAt: string;
  projectId?: string;
}

export interface CoworkProject {
  id: string;
  name: string;
  description: string;
  instructions: string;
  memory: string[];
  files: CoworkProjectFile[];
  tasks: CoworkProjectTask[];
  createdAt: string;
  updatedAt: string;
}

export interface CoworkProjectFile {
  id: string;
  name: string;
  path: string;
  type: string;
  size?: string;
}

export interface CoworkProjectTask {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  createdAt: string;
}

export interface DispatchExecution {
  id: string;
  taskId: string;
  taskName: string;
  status: 'running' | 'completed' | 'error';
  startedAt: string;
  completedAt?: string;
  result?: string;
}

const COWORK_STORAGE_KEY = 'cowork_conversations_v1';
const COWORK_PROJECTS_KEY = 'cowork_projects_v1';

const loadConversations = (): CoworkConversation[] => {
  try {
    const raw = localStorage.getItem(COWORK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const persistConversations = (convs: CoworkConversation[]) => {
  try { localStorage.setItem(COWORK_STORAGE_KEY, JSON.stringify(convs)); } catch {}
};

const loadProjects = (): CoworkProject[] => {
  try {
    const raw = localStorage.getItem(COWORK_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const persistProjects = (projects: CoworkProject[]) => {
  try { localStorage.setItem(COWORK_PROJECTS_KEY, JSON.stringify(projects)); } catch {}
};

interface CoworkState {
  conversations: CoworkConversation[];
  activeConversationId: string | null;
  projects: CoworkProject[];
  activeProjectId: string | null;
  dispatchExecutions: DispatchExecution[];

  // Conversation actions
  createConversation: (title: string, projectId?: string) => string;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: CoworkMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<CoworkMessage>) => void;
  deleteConversation: (id: string) => void;
  getActiveConversation: () => CoworkConversation | null;

  // Project actions
  createProject: (name: string, description: string) => string;
  updateProject: (id: string, updates: Partial<Omit<CoworkProject, 'id' | 'createdAt'>>) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  addProjectFile: (projectId: string, file: CoworkProjectFile) => void;
  removeProjectFile: (projectId: string, fileId: string) => void;
  addProjectTask: (projectId: string, title: string) => void;
  updateProjectTaskStatus: (projectId: string, taskId: string, status: CoworkProjectTask['status']) => void;

  // Dispatch actions
  addDispatchExecution: (exec: DispatchExecution) => void;
  updateDispatchExecution: (id: string, updates: Partial<DispatchExecution>) => void;
}

export const useCoworkStore = create<CoworkState>((set, get) => ({
  conversations: loadConversations(),
  activeConversationId: null,
  projects: loadProjects(),
  activeProjectId: null,
  dispatchExecutions: [],

  createConversation: (title, projectId) => {
    const id = crypto.randomUUID();
    const conv: CoworkConversation = {
      id,
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectId,
    };
    set((s) => {
      const next = [conv, ...s.conversations];
      persistConversations(next);
      return { conversations: next, activeConversationId: id };
    });
    return id;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) => {
    set((s) => {
      const next = s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message], updatedAt: new Date().toISOString(), title: c.messages.length === 0 && message.role === 'user' ? message.content.slice(0, 50) : c.title }
          : c
      );
      persistConversations(next);
      return { conversations: next };
    });
  },

  updateMessage: (conversationId, messageId, updates) => {
    set((s) => {
      const next = s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: c.messages.map((m) => m.id === messageId ? { ...m, ...updates } : m) }
          : c
      );
      persistConversations(next);
      return { conversations: next };
    });
  },

  deleteConversation: (id) => {
    set((s) => {
      const next = s.conversations.filter((c) => c.id !== id);
      persistConversations(next);
      return { conversations: next, activeConversationId: s.activeConversationId === id ? null : s.activeConversationId };
    });
  },

  getActiveConversation: () => {
    const s = get();
    return s.conversations.find((c) => c.id === s.activeConversationId) || null;
  },

  createProject: (name, description) => {
    const id = crypto.randomUUID();
    const project: CoworkProject = {
      id,
      name,
      description,
      instructions: '',
      memory: [],
      files: [],
      tasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => {
      const next = [project, ...s.projects];
      persistProjects(next);
      return { projects: next };
    });
    return id;
  },

  updateProject: (id, updates) => {
    set((s) => {
      const next = s.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      );
      persistProjects(next);
      return { projects: next };
    });
  },

  deleteProject: (id) => {
    set((s) => {
      const next = s.projects.filter((p) => p.id !== id);
      persistProjects(next);
      return { projects: next, activeProjectId: s.activeProjectId === id ? null : s.activeProjectId };
    });
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  addProjectFile: (projectId, file) => {
    set((s) => {
      const next = s.projects.map((p) =>
        p.id === projectId ? { ...p, files: [...p.files, file], updatedAt: new Date().toISOString() } : p
      );
      persistProjects(next);
      return { projects: next };
    });
  },

  removeProjectFile: (projectId, fileId) => {
    set((s) => {
      const next = s.projects.map((p) =>
        p.id === projectId ? { ...p, files: p.files.filter((f) => f.id !== fileId), updatedAt: new Date().toISOString() } : p
      );
      persistProjects(next);
      return { projects: next };
    });
  },

  addProjectTask: (projectId, title) => {
    const task: CoworkProjectTask = {
      id: crypto.randomUUID(),
      title,
      status: 'todo',
      createdAt: new Date().toISOString(),
    };
    set((s) => {
      const next = s.projects.map((p) =>
        p.id === projectId ? { ...p, tasks: [...p.tasks, task], updatedAt: new Date().toISOString() } : p
      );
      persistProjects(next);
      return { projects: next };
    });
  },

  updateProjectTaskStatus: (projectId, taskId, status) => {
    set((s) => {
      const next = s.projects.map((p) =>
        p.id === projectId
          ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, status } : t), updatedAt: new Date().toISOString() }
          : p
      );
      persistProjects(next);
      return { projects: next };
    });
  },

  addDispatchExecution: (exec) => {
    set((s) => ({ dispatchExecutions: [exec, ...s.dispatchExecutions] }));
  },

  updateDispatchExecution: (id, updates) => {
    set((s) => ({
      dispatchExecutions: s.dispatchExecutions.map((e) => e.id === id ? { ...e, ...updates } : e),
    }));
  },
}));
