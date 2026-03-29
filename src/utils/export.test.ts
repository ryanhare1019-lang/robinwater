import { describe, it, expect } from 'vitest';
import { buildDefaultFilename, buildExportText } from './export';
import type { Canvas, Idea } from '../types';

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  id: 'idea-1',
  text: 'Test idea',
  description: '',
  x: 0,
  y: 0,
  createdAt: '2026-03-29T10:00:00.000Z',
  keywords: [],
  ...overrides,
});

const emptyCanvas: Canvas = {
  id: 'c1',
  name: 'Test Canvas',
  ideas: [],
  connections: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe('buildDefaultFilename', () => {
  it('lowercases and hyphenates canvas name', () => {
    const result = buildDefaultFilename('My Ideas', new Date(2026, 2, 29));
    expect(result).toBe('robinwater-export-my-ideas-2026-03-29.txt');
  });

  it('strips special characters and collapses hyphens', () => {
    const result = buildDefaultFilename('Ideas & Stuff!', new Date(2026, 2, 29));
    expect(result).toBe('robinwater-export-ideas-stuff-2026-03-29.txt');
  });

  it('collapses multiple spaces to a single hyphen', () => {
    const result = buildDefaultFilename('A  B', new Date(2026, 2, 29));
    expect(result).toBe('robinwater-export-a-b-2026-03-29.txt');
  });
});

describe('buildExportText', () => {
  it('outputs (No ideas on this canvas) for empty canvas', () => {
    const result = buildExportText(emptyCanvas);
    expect(result).toContain('(No ideas on this canvas)');
    expect(result).toContain('CANVAS: Test Canvas');
  });

  it('outputs standalone ideas when no connections exist', () => {
    const canvas: Canvas = {
      ...emptyCanvas,
      ideas: [
        makeIdea({ id: 'a', text: 'First idea', description: 'desc a' }),
        makeIdea({ id: 'b', text: 'Second idea', description: '' }),
      ],
      connections: [],
    };
    const result = buildExportText(canvas);
    expect(result).toContain('--- STANDALONE IDEAS ---');
    expect(result).toContain('Idea: First idea');
    expect(result).toContain('  Description: desc a');
    expect(result).toContain('  Description: No description');
    expect(result).not.toContain('--- CLUSTER ---');
  });

  it('groups connected ideas into a cluster', () => {
    const canvas: Canvas = {
      ...emptyCanvas,
      ideas: [
        makeIdea({ id: 'a', text: 'Root', description: 'root desc', createdAt: '2026-01-01T00:00:00.000Z' }),
        makeIdea({ id: 'b', text: 'Child', description: '', createdAt: '2026-01-02T00:00:00.000Z' }),
      ],
      connections: [{ id: 'c1', sourceId: 'a', targetId: 'b' }],
    };
    const result = buildExportText(canvas);
    expect(result).toContain('--- CLUSTER ---');
    expect(result).toContain('Idea: Root');
    expect(result).toContain('    Idea: Child');
    expect(result).not.toContain('--- STANDALONE IDEAS ---');
  });

  it('picks the most-connected idea as cluster root', () => {
    // 'a' connects to both 'b' and 'c' (degree 2); b and c have degree 1 → a is root
    const canvas: Canvas = {
      ...emptyCanvas,
      ideas: [
        makeIdea({ id: 'a', text: 'Hub', createdAt: '2026-01-01T00:00:00.000Z' }),
        makeIdea({ id: 'b', text: 'Spoke B', createdAt: '2026-01-02T00:00:00.000Z' }),
        makeIdea({ id: 'c', text: 'Spoke C', createdAt: '2026-01-03T00:00:00.000Z' }),
      ],
      connections: [
        { id: 'conn1', sourceId: 'a', targetId: 'b' },
        { id: 'conn2', sourceId: 'a', targetId: 'c' },
      ],
    };
    const result = buildExportText(canvas);
    const hubIdx = result.indexOf('Idea: Hub');
    const spokeBIdx = result.indexOf('Idea: Spoke B');
    const spokeCIdx = result.indexOf('Idea: Spoke C');
    expect(hubIdx).toBeGreaterThanOrEqual(0);
    expect(spokeBIdx).toBeGreaterThan(hubIdx);
    expect(spokeCIdx).toBeGreaterThan(hubIdx);
  });

  it('separates clusters from standalones in mixed canvas', () => {
    const canvas: Canvas = {
      ...emptyCanvas,
      ideas: [
        makeIdea({ id: 'a', text: 'Connected A', createdAt: '2026-01-01T00:00:00.000Z' }),
        makeIdea({ id: 'b', text: 'Connected B', createdAt: '2026-01-02T00:00:00.000Z' }),
        makeIdea({ id: 'c', text: 'Lone Wolf', createdAt: '2026-01-03T00:00:00.000Z' }),
      ],
      connections: [{ id: 'conn1', sourceId: 'a', targetId: 'b' }],
    };
    const result = buildExportText(canvas);
    expect(result).toContain('--- CLUSTER ---');
    expect(result).toContain('--- STANDALONE IDEAS ---');
    expect(result).toContain('Idea: Lone Wolf');
  });

  it('handles circular connections without infinite loop', () => {
    const canvas: Canvas = {
      ...emptyCanvas,
      ideas: [
        makeIdea({ id: 'a', text: 'A', createdAt: '2026-01-01T00:00:00.000Z' }),
        makeIdea({ id: 'b', text: 'B', createdAt: '2026-01-02T00:00:00.000Z' }),
        makeIdea({ id: 'c', text: 'C', createdAt: '2026-01-03T00:00:00.000Z' }),
      ],
      connections: [
        { id: 'conn1', sourceId: 'a', targetId: 'b' },
        { id: 'conn2', sourceId: 'b', targetId: 'c' },
        { id: 'conn3', sourceId: 'c', targetId: 'a' },
      ],
    };
    expect(() => buildExportText(canvas)).not.toThrow();
    const result = buildExportText(canvas);
    expect(result).toMatch(/Idea: A/);
    expect(result).toMatch(/Idea: B/);
    expect(result).toMatch(/Idea: C/);
  });
});
