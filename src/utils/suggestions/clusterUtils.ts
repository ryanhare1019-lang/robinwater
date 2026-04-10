import type { Idea, Connection } from '../../types';

export interface Cluster {
  ideas: Idea[];
  centroid: { x: number; y: number };
}

function computeCentroid(ideas: Idea[]): { x: number; y: number } {
  if (ideas.length === 0) return { x: 0, y: 0 };
  return {
    x: ideas.reduce((s, i) => s + i.x, 0) / ideas.length,
    y: ideas.reduce((s, i) => s + i.y, 0) / ideas.length,
  };
}

/** Find connected components via BFS. Each isolated idea is its own cluster. */
export function findClusters(ideas: Idea[], connections: Connection[]): Cluster[] {
  if (ideas.length === 0) return [];

  const adj = new Map<string, Set<string>>();
  for (const idea of ideas) adj.set(idea.id, new Set());
  for (const conn of connections) {
    adj.get(conn.sourceId)?.add(conn.targetId);
    adj.get(conn.targetId)?.add(conn.sourceId);
  }

  const visited = new Set<string>();
  const clusters: Cluster[] = [];

  for (const idea of ideas) {
    if (visited.has(idea.id)) continue;
    const component: Idea[] = [];
    const queue = [idea.id];
    visited.add(idea.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentIdea = ideas.find((i) => i.id === current);
      if (currentIdea) component.push(currentIdea);
      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    clusters.push({ ideas: component, centroid: computeCentroid(component) });
  }

  return clusters;
}

/**
 * Like findClusters, but also groups spatially-close singleton ideas (< proximityPx apart)
 * into loose clusters. Non-singleton connected components are never merged.
 */
export function findLooseClusters(
  ideas: Idea[],
  connections: Connection[],
  proximityPx = 300
): Cluster[] {
  const connClusters = findClusters(ideas, connections);
  const singletons = connClusters.filter((c) => c.ideas.length === 1).map((c) => c.ideas[0]);
  const nonSingletons = connClusters.filter((c) => c.ideas.length > 1);

  if (singletons.length === 0) return connClusters;

  // BFS over singletons grouped by spatial proximity
  const visited = new Set<string>();
  const looseGroups: Idea[][] = [];

  for (const s of singletons) {
    if (visited.has(s.id)) continue;
    const group: Idea[] = [s];
    visited.add(s.id);
    const queue = [s];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const other of singletons) {
        if (visited.has(other.id)) continue;
        const dx = curr.x - other.x;
        const dy = curr.y - other.y;
        if (Math.sqrt(dx * dx + dy * dy) < proximityPx) {
          visited.add(other.id);
          group.push(other);
          queue.push(other);
        }
      }
    }
    looseGroups.push(group);
  }

  return [
    ...nonSingletons,
    ...looseGroups.map((g) => ({ ideas: g, centroid: computeCentroid(g) })),
  ];
}
