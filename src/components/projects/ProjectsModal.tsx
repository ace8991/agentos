import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  FileText,
  FolderOpen,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  createProject,
  fileToKnowledgeItem,
  getCurrentProjectId,
  loadProjects,
  PROJECTS_UPDATED_EVENT,
  removeKnowledgeItem,
  removeProject,
  type AppProject,
  type ProjectKnowledgeItem,
  upsertProject,
} from '@/lib/projects';
import { useStore } from '@/store/useStore';

interface ProjectsModalProps {
  open: boolean;
  onClose: () => void;
}

const copyProject = (project: AppProject | null) =>
  project
    ? {
        ...project,
        knowledge: project.knowledge.map((item) => ({ ...item })),
      }
    : null;

const ProjectsModal = ({ open, onClose }: ProjectsModalProps) => {
  const currentProjectId = useStore((s) => s.currentProjectId);
  const setCurrentProjectId = useStore((s) => s.setCurrentProjectId);
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [draftProject, setDraftProject] = useState<AppProject | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const syncProjects = () => {
    const nextProjects = loadProjects();
    const activeId = getCurrentProjectId();
    const fallbackId = nextProjects[0]?.id ?? null;
    const nextSelectedId =
      nextProjects.some((project) => project.id === selectedProjectId)
        ? selectedProjectId
        : activeId || fallbackId;

    setProjects(nextProjects);
    setSelectedProjectId(nextSelectedId);
    setDraftProject(copyProject(nextProjects.find((project) => project.id === nextSelectedId) || null));
  };

  useEffect(() => {
    if (!open) return;

    syncProjects();
    const handleProjectsUpdated = () => syncProjects();
    window.addEventListener(PROJECTS_UPDATED_EVENT, handleProjectsUpdated);

    return () => {
      window.removeEventListener(PROJECTS_UPDATED_EVENT, handleProjectsUpdated);
    };
  }, [open, selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) {
      setDraftProject(null);
      return;
    }
    setDraftProject(copyProject(selectedProject));
  }, [selectedProject]);

  if (!open) return null;

  const handleCreateProject = () => {
    const next = createProject({
      name: `Project ${projects.length + 1}`,
      description: 'Project context, instructions, and reusable knowledge.',
    });
    setCurrentProjectId(next.id);
    toast.success('Project created');
    syncProjects();
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  const handleSaveProject = () => {
    if (!draftProject) return;

    const savedProject = upsertProject({
      ...draftProject,
      name: draftProject.name.trim() || 'Untitled project',
      description: draftProject.description.trim(),
      instructions: draftProject.instructions.trim(),
    });
    setDraftProject(copyProject(savedProject));
    setProjects(loadProjects());
    toast.success('Project saved');
  };

  const handleActivateProject = () => {
    if (!draftProject) return;
    setCurrentProjectId(draftProject.id);
    toast.success(`${draftProject.name} is now active`);
  };

  const handleDeleteProject = () => {
    if (!draftProject) return;
    if (!window.confirm(`Delete project "${draftProject.name}" and its saved knowledge?`)) {
      return;
    }

    removeProject(draftProject.id);
    toast.success('Project deleted');
    syncProjects();
  };

  const handleAddNote = () => {
    if (!draftProject || !noteContent.trim()) return;

    const nextKnowledge: ProjectKnowledgeItem = {
      id: crypto.randomUUID(),
      name: noteTitle.trim() || `Note ${draftProject.knowledge.length + 1}`,
      kind: 'note',
      mimeType: 'text/markdown',
      content: noteContent.trim(),
      summary: noteContent.trim().replace(/\s+/g, ' ').slice(0, 180),
      updatedAt: new Date().toISOString(),
    };

    const savedProject = upsertProject({
      ...draftProject,
      knowledge: [nextKnowledge, ...draftProject.knowledge],
    });
    setDraftProject(copyProject(savedProject));
    setProjects(loadProjects());
    setNoteTitle('');
    setNoteContent('');
    toast.success('Knowledge note added');
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!draftProject || !files || files.length === 0) return;

    try {
      const knowledgeItems = await Promise.all(Array.from(files).map((file) => fileToKnowledgeItem(file)));
      const savedProject = upsertProject({
        ...draftProject,
        knowledge: [...knowledgeItems, ...draftProject.knowledge],
      });
      setDraftProject(copyProject(savedProject));
      setProjects(loadProjects());
      toast.success(`${knowledgeItems.length} file${knowledgeItems.length > 1 ? 's' : ''} added to project knowledge`);
    } catch {
      toast.error('Unable to import one or more files');
    }
  };

  const handleRemoveKnowledge = (knowledgeId: string) => {
    if (!draftProject) return;
    const savedProject = removeKnowledgeItem(draftProject.id, knowledgeId);
    if (!savedProject) return;
    setDraftProject(copyProject(savedProject));
    setProjects(loadProjects());
  };

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/65 px-3 py-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,#243042_0%,#171b25_38%,#101319_100%)] text-white shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 pb-4 pt-5 md:px-7 md:pb-5 md:pt-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70">
              Claude-like Projects
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-4xl">Projects and knowledge</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/68">
              Keep reusable instructions, notes, and files in one project so both chat and live agent runs inherit the right context automatically.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-white/60 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="w-full shrink-0 border-b border-white/10 lg:w-[310px] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-4 py-3 md:px-5">
              <div>
                <p className="text-sm font-medium text-white">Project workspace</p>
                <p className="text-xs text-white/55">{projects.length} saved project{projects.length === 1 ? '' : 's'}</p>
              </div>
              <button
                onClick={handleCreateProject}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.08]"
              >
                <Plus size={13} />
                New
              </button>
            </div>

            <div className="max-h-[32vh] space-y-2 overflow-y-auto px-4 pb-4 md:max-h-none md:px-5">
              {projects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm text-white/58">
                  No projects yet. Create one to store persistent context like Claude Projects.
                </div>
              ) : (
                projects.map((project) => {
                  const isActive = currentProjectId === project.id;
                  const isSelected = selectedProjectId === project.id;
                  return (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-sky-300/28 bg-sky-300/10'
                          : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{project.name}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/58">
                            {project.description || 'Reusable instructions and knowledge for this project.'}
                          </p>
                        </div>
                        {isActive && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-100">
                            <Check size={10} />
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-white/50">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                          {project.knowledge.length} docs
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {draftProject ? (
              <div className="space-y-5 p-4 md:p-6">
                <div className="flex flex-col gap-3 rounded-[26px] border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between md:p-5">
                  <div>
                    <p className="text-lg font-medium text-white">{draftProject.name || 'Untitled project'}</p>
                    <p className="mt-1 text-sm text-white/60">
                      This project context will be injected automatically into chat and agent tasks.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleActivateProject}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        currentProjectId === draftProject.id
                          ? 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100'
                          : 'border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      {currentProjectId === draftProject.id ? 'Active project' : 'Use in workspace'}
                    </button>
                    <button
                      onClick={handleSaveProject}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.08]"
                    >
                      <Save size={13} />
                      Save
                    </button>
                    <button
                      onClick={handleDeleteProject}
                      className="inline-flex items-center gap-1 rounded-full border border-destructive/25 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-4">
                    <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                      <p className="text-sm font-medium text-white">Project identity</p>
                      <div className="mt-4 space-y-3">
                        <label className="block">
                          <span className="mb-1.5 block text-xs text-white/55">Name</span>
                          <input
                            value={draftProject.name}
                            onChange={(event) =>
                              setDraftProject((current) =>
                                current ? { ...current, name: event.target.value } : current,
                              )
                            }
                            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/28 focus:border-white/20"
                            placeholder="Marketing site refresh"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs text-white/55">Summary</span>
                          <textarea
                            value={draftProject.description}
                            onChange={(event) =>
                              setDraftProject((current) =>
                                current ? { ...current, description: event.target.value } : current,
                              )
                            }
                            rows={3}
                            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/28 focus:border-white/20"
                            placeholder="What this project is about, key constraints, goals, and references."
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs text-white/55">Persistent instructions</span>
                          <textarea
                            value={draftProject.instructions}
                            onChange={(event) =>
                              setDraftProject((current) =>
                                current ? { ...current, instructions: event.target.value } : current,
                              )
                            }
                            rows={6}
                            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/28 focus:border-white/20"
                            placeholder="Example: Always optimize for mobile-first UX, keep pricing in EUR, and preserve the established visual language."
                          />
                        </label>
                      </div>
                    </section>

                    <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">Project knowledge</p>
                          <p className="mt-1 text-xs text-white/55">
                            Add notes and text-like files so the assistant can pull relevant context automatically.
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(event) => {
                            void handleUploadFiles(event.target.files);
                            event.target.value = '';
                          }}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.08]"
                        >
                          <Upload size={13} />
                          Upload
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        <input
                          value={noteTitle}
                          onChange={(event) => setNoteTitle(event.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/28 focus:border-white/20"
                          placeholder="Quick note title"
                        />
                        <textarea
                          value={noteContent}
                          onChange={(event) => setNoteContent(event.target.value)}
                          rows={4}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/28 focus:border-white/20"
                          placeholder="Paste reusable facts, requirements, research snippets, or style guidance here."
                        />
                        <button
                          onClick={handleAddNote}
                          disabled={!noteContent.trim()}
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.08] disabled:opacity-40"
                        >
                          <Plus size={13} />
                          Add note
                        </button>
                      </div>
                    </section>
                  </div>

                  <section className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">Knowledge library</p>
                        <p className="mt-1 text-xs text-white/55">
                          {draftProject.knowledge.length} saved item{draftProject.knowledge.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {draftProject.knowledge.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm text-white/58">
                          This project has no saved context yet.
                        </div>
                      ) : (
                        draftProject.knowledge.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/75">
                                    <FileText size={14} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-white">{item.name}</p>
                                    <p className="text-[11px] uppercase tracking-wide text-white/45">{item.kind}</p>
                                  </div>
                                </div>
                                <p className="mt-3 line-clamp-6 text-xs leading-relaxed text-white/58">
                                  {item.summary || item.content}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemoveKnowledge(item.id)}
                                className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] p-2 text-white/55 transition-colors hover:text-white"
                                title="Remove knowledge item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="max-w-md rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72">
                    <FolderOpen size={20} />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-white">Create your first project</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/58">
                    Projects give the workspace persistent instructions and reusable context, similar to Claude Projects.
                  </p>
                  <button
                    onClick={handleCreateProject}
                    className="mt-5 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
                  >
                    <Plus size={14} />
                    Create project
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsModal;
