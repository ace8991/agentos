import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildProjectContext,
  createProject,
  getRelevantKnowledge,
  loadProjects,
  setCurrentProjectId,
  upsertProject,
} from '@/lib/projects';

describe('projects library', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and reloads created projects', () => {
    const project = createProject({ name: 'Website refresh' });
    const projects = loadProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(project.id);
    expect(projects[0].name).toBe('Website refresh');
  });

  it('surfaces the most relevant knowledge in project context', () => {
    const project = createProject({
      name: 'Launch prep',
      instructions: 'Keep the output concise and launch-focused.',
      knowledge: [
        {
          id: 'pricing',
          name: 'Pricing notes',
          kind: 'note',
          mimeType: 'text/plain',
          content: 'Annual plan is 299 EUR and monthly plan is 29 EUR.',
          summary: 'Pricing details for launch',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'brand',
          name: 'Brand tone',
          kind: 'note',
          mimeType: 'text/plain',
          content: 'Tone is warm, confident, and premium.',
          summary: 'Voice and tone',
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    setCurrentProjectId(project.id);
    const context = buildProjectContext('What is the launch pricing?');

    expect(context).toContain('Active project: Launch prep');
    expect(context).toContain('Keep the output concise and launch-focused.');
    expect(context).toContain('Pricing notes');
    expect(context).toContain('299 EUR');
  });

  it('orders relevant knowledge by query match', () => {
    const project = createProject({ name: 'Docs project' });
    const saved = upsertProject({
      ...project,
      knowledge: [
        {
          id: 'api',
          name: 'API auth',
          kind: 'note',
          mimeType: 'text/plain',
          content: 'Use bearer tokens and rotate keys every 90 days.',
          summary: 'Authentication policy',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'design',
          name: 'Landing page',
          kind: 'note',
          mimeType: 'text/plain',
          content: 'Use warm gradients and generous spacing.',
          summary: 'UI direction',
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const relevant = getRelevantKnowledge(saved, 'How does API auth work?');

    expect(relevant[0]?.id).toBe('api');
  });
});
