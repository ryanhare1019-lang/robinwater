import { describe, it, expect } from 'vitest';
import { findClusters, findLooseClusters } from './clusterUtils';
import type { Idea, Connection } from '../../types';

const makeIdea = (id: string, x = 0, y = 0): Idea => ({
  id,
  text: `idea-${id}`,
  description: '',
  x,
  y,
  createdAt: '2026-01-01T00:00:00.000Z',
  keywords: [],
});

const makeConn = (sourceId: string, targetId: string): Connection => ({
  id: `${sourceId}-${targetId}`,
  sourceId,
  targetId,
});

describe('findClusters', () => {
  it('returns empty array for no ideas', () => {
    expect(findClusters([], [])).toEqual([]);
  });

  it('each disconnected idea is its own cluster', () => {
    const ideas = [makeIdea('a'), makeIdea('b'), makeIdea('c')];
    const clusters = findClusters(ideas, []);
    expect(clusters).toHaveLength(3);
    expect(clusters.every(c => c.ideas.length === 1)).toBe(true);
  });

  it('connected ideas form one cluster', () => {
    const ideas = [makeIdea('a'), makeIdea('b'), makeIdea('c')];
    const conns = [makeConn('a', 'b'), makeConn('b', 'c')];
    const clusters = findClusters(ideas, conns);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].ideas).toHaveLength(3);
  });

  it('two separate groups form two clusters', () => {
    const ideas = [makeIdea('a'), makeIdea('b'), makeIdea('c'), makeIdea('d')];
    const conns = [makeConn('a', 'b'), makeConn('c', 'd')];
    const clusters = findClusters(ideas, conns);
    expect(clusters).toHaveLength(2);
    expect(clusters.every(c => c.ideas.length === 2)).toBe(true);
  });

  it('computes centroid as average position', () => {
    const ideas = [makeIdea('a', 0, 0), makeIdea('b', 100, 100)];
    const clusters = findClusters(ideas, [makeConn('a', 'b')]);
    expect(clusters[0].centroid).toEqual({ x: 50, y: 50 });
  });

  it('handles undirected connections (target→source also connects)', () => {
    const ideas = [makeIdea('a'), makeIdea('b')];
    const conns = [makeConn('b', 'a')]; // reversed
    const clusters = findClusters(ideas, conns);
    expect(clusters).toHaveLength(1);
  });
});

describe('findLooseClusters', () => {
  it('leaves connected clusters unchanged', () => {
    const ideas = [makeIdea('a', 0, 0), makeIdea('b', 50, 0)];
    const conns = [makeConn('a', 'b')];
    const clusters = findLooseClusters(ideas, conns, 300);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].ideas).toHaveLength(2);
  });

  it('groups nearby singletons into one loose cluster', () => {
    const ideas = [makeIdea('a', 0, 0), makeIdea('b', 100, 0), makeIdea('c', 200, 0)];
    // No connections, all within 300px of each other
    const clusters = findLooseClusters(ideas, [], 300);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].ideas).toHaveLength(3);
  });

  it('keeps singletons far apart as separate clusters', () => {
    const ideas = [makeIdea('a', 0, 0), makeIdea('b', 1000, 0)];
    const clusters = findLooseClusters(ideas, [], 300);
    expect(clusters).toHaveLength(2);
  });
});
