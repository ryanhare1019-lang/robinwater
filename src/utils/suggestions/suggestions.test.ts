import { describe, it, expect } from 'vitest';
import type { Canvas, Idea, Connection } from '../../types';
import { buildUserMessage as buildExtensionMsg } from './extensionSuggestions';
import { buildUserMessage as buildSynthesisMsg } from './synthesisSuggestions';
import { buildUserMessage as buildWildcardMsg } from './wildcardSuggestions';
import { buildUserMessage as buildAllMsg } from './allSuggestions';
import type { Cluster } from './clusterUtils';

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  id: 'i1',
  text: 'example idea',
  description: '',
  x: 0,
  y: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  keywords: [],
  ...overrides,
});

const makeCanvas = (overrides: Partial<Canvas> = {}): Canvas => ({
  id: 'c1',
  name: 'Test Canvas',
  description: '',
  ideas: [makeIdea()],
  connections: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  tags: [],
  aiTagDefinitions: [],
  ...overrides,
});

const makeCluster = (ideas: Idea[]): Cluster => ({
  ideas,
  centroid: { x: 0, y: 0 },
});

describe('extension buildUserMessage', () => {
  it('includes description when present', () => {
    const canvas = makeCanvas({ description: 'mobile UX exploration' });
    const msg = buildExtensionMsg('Test Canvas', canvas.ideas, canvas, 'manual');
    expect(msg).toContain('Test Canvas — mobile UX exploration');
  });

  it('omits description separator when description is empty', () => {
    const canvas = makeCanvas({ description: '' });
    const msg = buildExtensionMsg('Test Canvas', canvas.ideas, canvas, 'manual');
    expect(msg).not.toContain(' — ');
    expect(msg).toContain('"Test Canvas"');
  });
});

describe('synthesis buildUserMessage', () => {
  it('includes description when present', () => {
    const msg = buildSynthesisMsg('Test Canvas', [], [], 'mobile UX exploration');
    expect(msg).toContain('Test Canvas — mobile UX exploration');
  });

  it('omits description separator when description is empty', () => {
    const msg = buildSynthesisMsg('Test Canvas', [], []);
    expect(msg).not.toContain(' — ');
    expect(msg).toContain('"Test Canvas"');
  });
});

describe('wildcard buildUserMessage', () => {
  it('includes description when present', () => {
    const msg = buildWildcardMsg('Test Canvas', [], 'mobile UX exploration');
    expect(msg).toContain('Test Canvas — mobile UX exploration');
  });

  it('omits description separator when description is empty', () => {
    const msg = buildWildcardMsg('Test Canvas', []);
    expect(msg).not.toContain(' — ');
    expect(msg).toContain('"Test Canvas"');
  });
});

describe('all buildUserMessage', () => {
  it('includes description when present', () => {
    const canvas = makeCanvas({ description: 'mobile UX exploration' });
    const msg = buildAllMsg('Test Canvas', canvas.ideas, canvas, [], []);
    expect(msg).toContain('Test Canvas — mobile UX exploration');
  });

  it('omits description separator when description is empty', () => {
    const canvas = makeCanvas({ description: '' });
    const msg = buildAllMsg('Test Canvas', canvas.ideas, canvas, [], []);
    expect(msg).not.toContain(' — ');
    expect(msg).toContain('"Test Canvas"');
  });
});
