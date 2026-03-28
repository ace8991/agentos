import { describe, expect, it } from 'vitest';
import {
  inferArtifactTypeFromAttachment,
  inferArtifactTypeFromCode,
  parseArtifacts,
  parseSlides,
} from '@/lib/artifacts';

describe('artifact intelligence', () => {
  it('detects app previews from html code', () => {
    const type = inferArtifactTypeFromCode(
      'html',
      '<main><canvas id="game"></canvas><script>console.log("snake")</script></main>',
      'Snake game',
    );

    expect(type).toBe('app');
  });

  it('detects slide decks from markdown separators', () => {
    const slides = parseSlides('# Intro\nHello\n\n---\n# Pricing\nMore');

    expect(slides).toHaveLength(2);
    expect(slides[0].title).toBe('Intro');
    expect(slides[1].title).toBe('Pricing');
  });

  it('parses markdown slide artifacts from assistant output', () => {
    const { artifacts } = parseArtifacts(
      'Here is your deck.\n\n```markdown\n# Intro\nHello\n\n---\n# Demo\nMore\n```',
    );

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].type).toBe('slides');
  });

  it('infers slide attachments from pptx files', () => {
    const type = inferArtifactTypeFromAttachment({
      name: 'pitch-deck.pptx',
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      url: 'https://example.com/pitch-deck.pptx',
    });

    expect(type).toBe('slides');
  });
});
