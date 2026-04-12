import { describe, it, expect } from 'vitest';
import type { Canvas } from '../types';
import {
  serializeCanvas,
  buildMonoliteFilename,
  parseMonoliteFile,
  type MonoliteParseResult,
} from './monoliteFile';

const makeCanvas = (overrides: Partial<Canvas> = {}): Canvas => ({
  id: 'c1',
  name: 'Test Canvas',
  ideas: [
    {
      id: 'idea-1',
      text: 'Hello <script>alert(1)</script>',
      description: 'A <b>test</b>',
      x: 100,
      y: 200,
      createdAt: '2026-04-01T10:00:00.000Z',
      keywords: ['hello'],
    },
  ],
  connections: [{ id: 'conn-1', sourceId: 'idea-1', targetId: 'idea-2' }],
  viewport: { x: 0, y: 0, zoom: 1 },
  aiTagDefinitions: [
    { id: 'tag-1', label: 'STUFF', color: '#ff0000', ideaIds: ['idea-1'] },
  ],
  tags: [],
  ...overrides,
});

describe('buildMonoliteFilename', () => {
  it('lowercases, hyphenates, and appends .monolite extension', () => {
    expect(buildMonoliteFilename('Real Madrid Squad')).toBe('real-madrid-squad-monolite.monolite');
  });

  it('strips special characters', () => {
    expect(buildMonoliteFilename('Ideas: 2026!')).toBe('ideas-2026-monolite.monolite');
  });

  it('collapses consecutive hyphens', () => {
    expect(buildMonoliteFilename('A  B')).toBe('a-b-monolite.monolite');
  });
});

describe('serializeCanvas', () => {
  it('produces valid JSON with monolite_version and canvas fields', () => {
    const json = serializeCanvas(makeCanvas());
    const parsed = JSON.parse(json);
    expect(parsed.monolite_version).toBe('1.0');
    expect(parsed.canvas.name).toBe('Test Canvas');
    expect(typeof parsed.exported_at).toBe('string');
  });

  it('includes ideas, connections, and aiTagDefinitions', () => {
    const json = serializeCanvas(makeCanvas());
    const parsed = JSON.parse(json);
    expect(parsed.canvas.ideas).toHaveLength(1);
    expect(parsed.canvas.connections).toHaveLength(1);
    expect(parsed.canvas.aiTagDefinitions).toHaveLength(1);
  });

  it('excludes viewport from canvas data', () => {
    const json = serializeCanvas(makeCanvas());
    const parsed = JSON.parse(json);
    expect(parsed.canvas.viewport).toBeUndefined();
  });

  it('sanitizes HTML from idea text and description', () => {
    const json = serializeCanvas(makeCanvas());
    const parsed = JSON.parse(json);
    expect(parsed.canvas.ideas[0].text).toBe('Hello alert(1)');
    expect(parsed.canvas.ideas[0].description).toBe('A test');
  });
});

describe('parseMonoliteFile', () => {
  const goodFile = () => JSON.stringify({
    monolite_version: '1.0',
    exported_at: '2026-04-11T14:00:00.000Z',
    canvas: {
      name: 'Imported Canvas',
      ideas: [
        {
          id: 'idea-1',
          text: 'Idea one',
          description: '',
          x: 50,
          y: 60,
          createdAt: '2026-04-01T10:00:00.000Z',
          keywords: [],
        },
      ],
      connections: [],
      aiTagDefinitions: [],
    },
  });

  it('returns success result for a valid file', () => {
    const result = parseMonoliteFile(goodFile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.name).toBe('Imported Canvas');
    expect(result.canvas.ideas).toHaveLength(1);
    expect(result.exportedAt).toBe('2026-04-11T14:00:00.000Z');
  });

  it('errors on invalid JSON', () => {
    const result = parseMonoliteFile('not json{{{');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID FILE: NOT VALID JSON');
  });

  it('errors when monolite_version is missing', () => {
    const result = parseMonoliteFile(JSON.stringify({ canvas: { name: 'x', ideas: [] } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID FILE: NOT A MONOLITE FILE');
  });

  it('errors when canvas or ideas is missing', () => {
    const result = parseMonoliteFile(JSON.stringify({ monolite_version: '1.0', canvas: { name: 'x' } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID FILE: MISSING CANVAS DATA');
  });

  it('errors when ideas is not an array', () => {
    const result = parseMonoliteFile(JSON.stringify({
      monolite_version: '1.0',
      canvas: { name: 'x', ideas: 'bad' },
    }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID FILE: CORRUPTED IDEAS DATA');
  });

  it('skips ideas missing required fields and reports warning count', () => {
    const raw = JSON.stringify({
      monolite_version: '1.0',
      exported_at: '2026-04-11T00:00:00.000Z',
      canvas: {
        name: 'Test',
        ideas: [
          { id: 'a', text: 'Good', x: 0, y: 0, createdAt: '2026-01-01T00:00:00.000Z', description: '', keywords: [] },
          { id: 'b', text: 'No position' },
        ],
        connections: [],
        aiTagDefinitions: [],
      },
    });
    const result = parseMonoliteFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.ideas).toHaveLength(1);
    expect(result.skippedCount).toBe(1);
  });

  it('warns (but succeeds) when monolite_version is a future version', () => {
    const raw = JSON.stringify({
      monolite_version: '99.0',
      exported_at: '2026-04-11T00:00:00.000Z',
      canvas: { name: 'Futuristic', ideas: [], connections: [], aiTagDefinitions: [] },
    });
    const result = parseMonoliteFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.versionWarning).toBe(true);
  });

  it('rejects files over 10MB', () => {
    const bigString = 'x'.repeat(10 * 1024 * 1024 + 1);
    const result = parseMonoliteFile(bigString);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('TOO LARGE');
  });

  it('sanitizes HTML in imported idea text and description', () => {
    const raw = JSON.stringify({
      monolite_version: '1.0',
      exported_at: '2026-04-11T00:00:00.000Z',
      canvas: {
        name: 'x',
        ideas: [
          {
            id: 'a',
            text: '<script>evil()</script>Hello',
            description: '<b>bold</b>',
            x: 0, y: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            keywords: [],
          },
        ],
        connections: [],
        aiTagDefinitions: [],
      },
    });
    const result = parseMonoliteFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.ideas[0].text).toBe('Hello');
    expect(result.canvas.ideas[0].description).toBe('bold');
  });

  it('degrades gracefully when connections is missing', () => {
    const raw = JSON.stringify({
      monolite_version: '1.0',
      exported_at: '2026-04-11T00:00:00.000Z',
      canvas: { name: 'x', ideas: [] },
    });
    const result = parseMonoliteFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.connections).toEqual([]);
    expect(result.canvas.aiTagDefinitions).toEqual([]);
  });

  it('generates new UUIDs — no original IDs survive', () => {
    const result = parseMonoliteFile(goodFile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.ideas[0].id).not.toBe('idea-1');
  });
});
