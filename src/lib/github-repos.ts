/**
 * GitHub repository connection manager.
 * Stores connected repos in localStorage and provides CRUD + branch helpers.
 */

export interface GitHubRepo {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  branch: string;
  branches: string[];
  url: string;
  lastSync: string;
  status: 'synced' | 'ahead' | 'behind' | 'error';
  addedAt: string;
}

const STORAGE_KEY = 'GITHUB_CONNECTED_REPOS';
const ACTIVE_REPO_KEY = 'GITHUB_ACTIVE_REPO_ID';
export const REPOS_UPDATED_EVENT = 'github-repos-updated';

const emit = () => window.dispatchEvent(new CustomEvent(REPOS_UPDATED_EVENT));

// ─── Persistence ─────────────────────────────────────────────────────

export const loadRepos = (): GitHubRepo[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveRepos = (repos: GitHubRepo[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
  emit();
};

export const getActiveRepoId = (): string | null =>
  localStorage.getItem(ACTIVE_REPO_KEY);

export const setActiveRepoId = (id: string | null) => {
  if (id) localStorage.setItem(ACTIVE_REPO_KEY, id);
  else localStorage.removeItem(ACTIVE_REPO_KEY);
  emit();
};

export const getActiveRepo = (): GitHubRepo | null => {
  const id = getActiveRepoId();
  if (!id) return loadRepos()[0] ?? null;
  return loadRepos().find((r) => r.id === id) ?? loadRepos()[0] ?? null;
};

// ─── Parsing ─────────────────────────────────────────────────────────

/**
 * Parse a GitHub URL or "owner/repo" shorthand into { owner, name }.
 * Returns null if the input is invalid.
 */
export const parseRepoInput = (input: string): { owner: string; name: string } | null => {
  const trimmed = input.trim();

  // owner/repo
  const slashMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (slashMatch) return { owner: slashMatch[1], name: slashMatch[2] };

  // https://github.com/owner/repo[.git][/...]
  try {
    const url = new URL(trimmed);
    if (url.hostname === 'github.com') {
      const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
      if (parts.length >= 2) return { owner: parts[0], name: parts[1] };
    }
  } catch { /* not a URL */ }

  return null;
};

// ─── GitHub API ──────────────────────────────────────────────────────

const ghFetch = async (path: string, token?: string) => {
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers.Authorization = `token ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
};

export const fetchRepoBranches = async (owner: string, name: string, token?: string): Promise<string[]> => {
  try {
    const data = await ghFetch(`/repos/${owner}/${name}/branches?per_page=30`, token);
    return (data as { name: string }[]).map((b) => b.name);
  } catch {
    return ['main'];
  }
};

export const fetchRepoInfo = async (owner: string, name: string, token?: string) => {
  const data = await ghFetch(`/repos/${owner}/${name}`, token);
  return {
    defaultBranch: (data as { default_branch: string }).default_branch || 'main',
    description: (data as { description: string | null }).description || '',
    private: (data as { private: boolean }).private,
  };
};

// ─── CRUD ────────────────────────────────────────────────────────────

export const addRepo = async (input: string, token?: string): Promise<GitHubRepo> => {
  const parsed = parseRepoInput(input);
  if (!parsed) throw new Error('Format invalide. Utilisez owner/repo ou une URL GitHub.');

  const existing = loadRepos();
  const fullName = `${parsed.owner}/${parsed.name}`;
  if (existing.find((r) => r.fullName === fullName)) {
    throw new Error(`${fullName} est déjà connecté.`);
  }

  let info: { defaultBranch: string };
  let branches: string[];
  try {
    [info, branches] = await Promise.all([
      fetchRepoInfo(parsed.owner, parsed.name, token),
      fetchRepoBranches(parsed.owner, parsed.name, token),
    ]);
  } catch {
    // Fallback for private repos without token — add anyway with defaults
    info = { defaultBranch: 'main' };
    branches = ['main'];
  }

  const repo: GitHubRepo = {
    id: crypto.randomUUID(),
    owner: parsed.owner,
    name: parsed.name,
    fullName,
    branch: info.defaultBranch,
    branches,
    url: `https://github.com/${fullName}`,
    lastSync: new Date().toISOString(),
    status: 'synced',
    addedAt: new Date().toISOString(),
  };

  const next = [repo, ...existing];
  saveRepos(next);
  setActiveRepoId(repo.id);
  return repo;
};

export const removeRepo = (id: string) => {
  const next = loadRepos().filter((r) => r.id !== id);
  saveRepos(next);
  if (getActiveRepoId() === id) {
    setActiveRepoId(next[0]?.id ?? null);
  }
};

export const switchBranch = (repoId: string, branch: string) => {
  const repos = loadRepos();
  const idx = repos.findIndex((r) => r.id === repoId);
  if (idx === -1) return;
  repos[idx] = { ...repos[idx], branch, lastSync: new Date().toISOString() };
  saveRepos(repos);
};

export const getGitHubToken = (): string | null =>
  localStorage.getItem('GITHUB_TOKEN');

export const setGitHubToken = (token: string | null) => {
  if (token) localStorage.setItem('GITHUB_TOKEN', token);
  else localStorage.removeItem('GITHUB_TOKEN');
};
