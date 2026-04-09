import type { Canvas, Idea } from '../types';

export function buildDefaultFilename(canvasName: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const safe = canvasName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `robinwater-export-${safe}-${yyyy}-${mm}-${dd}.txt`;
}

export function buildExportText(canvas: Canvas, date: Date = new Date()): string {
  const lines: string[] = [];

  // Header
  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-') + ' ' + [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join(':');

  lines.push('=====================================');
  lines.push('ROBINWATER EXPORT');
  lines.push(`CANVAS: ${canvas.name}`);
  lines.push(`DATE: ${dateStr}`);
  lines.push('=====================================');

  if (canvas.ideas.length === 0) {
    lines.push('');
    lines.push('(No ideas on this canvas)');
    return lines.join('\n');
  }

  // Build undirected adjacency map
  const adj = new Map<string, Set<string>>();
  for (const idea of canvas.ideas) adj.set(idea.id, new Set());
  for (const conn of canvas.connections) {
    adj.get(conn.sourceId)?.add(conn.targetId);
    adj.get(conn.targetId)?.add(conn.sourceId);
  }

  // Find connected components via BFS
  const globalVisited = new Set<string>();
  const components: string[][] = [];
  for (const idea of canvas.ideas) {
    if (globalVisited.has(idea.id)) continue;
    const component: string[] = [];
    const queue = [idea.id];
    globalVisited.add(idea.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adj.get(current) ?? []) {
        if (!globalVisited.has(neighbor)) {
          globalVisited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  const ideaById = new Map<string, Idea>(canvas.ideas.map(i => [i.id, i]));
  const clusters = components.filter(c => c.length > 1);
  const standalones = components.filter(c => c.length === 1).map(c => c[0]);

  // Format each cluster
  for (const component of clusters) {
    // Root = most connections; tiebreak = earliest createdAt
    const root = component.reduce((best, id) => {
      const bestDeg = adj.get(best)?.size ?? 0;
      const idDeg = adj.get(id)?.size ?? 0;
      if (idDeg > bestDeg) return id;
      if (idDeg === bestDeg) {
        const bestTime = ideaById.get(best)?.createdAt ?? '';
        const idTime = ideaById.get(id)?.createdAt ?? '';
        return idTime < bestTime ? id : best;
      }
      return best;
    });

    lines.push('');
    lines.push('--- CLUSTER ---');
    lines.push('');

    // DFS from root — depth determines indentation, visited set handles cycles
    const dfsVisited = new Set<string>();
    const dfs = (id: string, depth: number): void => {
      dfsVisited.add(id);
      const idea = ideaById.get(id)!;
      const ideaIndent = ' '.repeat(depth * 4);
      const descIndent = ' '.repeat(depth * 4 + 2);
      lines.push(`${ideaIndent}Idea: ${idea.text}`);
      lines.push(`${descIndent}Description: ${idea.description || 'No description'}`);
      const children = [...(adj.get(id) ?? [])].filter(n => !dfsVisited.has(n));
      for (const child of children) {
        lines.push('');
        dfs(child, depth + 1);
      }
    };
    dfs(root, 0);
  }

  // Format standalones
  if (standalones.length > 0) {
    lines.push('');
    lines.push('--- STANDALONE IDEAS ---');
    lines.push('');
    for (const id of standalones) {
      const idea = ideaById.get(id)!;
      lines.push(`Idea: ${idea.text}`);
      lines.push(`  Description: ${idea.description || 'No description'}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function buildDefaultMarkdownFilename(canvasName: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const safe = canvasName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `robinwater-export-${safe}-${yyyy}-${mm}-${dd}.md`;
}

export function buildExportMarkdown(canvas: Canvas, date: Date = new Date()): string {
  const lines: string[] = [];

  // Header
  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-') + ' ' + [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join(':');

  lines.push(`# ${canvas.name}`);
  lines.push(`*Exported: ${dateStr}*`);

  if (canvas.ideas.length === 0) {
    lines.push('');
    lines.push('*(No ideas on this canvas)*');
    return lines.join('\n');
  }

  // Build undirected adjacency map
  const adj = new Map<string, Set<string>>();
  for (const idea of canvas.ideas) adj.set(idea.id, new Set());
  for (const conn of canvas.connections) {
    adj.get(conn.sourceId)?.add(conn.targetId);
    adj.get(conn.targetId)?.add(conn.sourceId);
  }

  // Find connected components via BFS
  const globalVisited = new Set<string>();
  const components: string[][] = [];
  for (const idea of canvas.ideas) {
    if (globalVisited.has(idea.id)) continue;
    const component: string[] = [];
    const queue = [idea.id];
    globalVisited.add(idea.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adj.get(current) ?? []) {
        if (!globalVisited.has(neighbor)) {
          globalVisited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  const ideaById = new Map<string, Idea>(canvas.ideas.map(i => [i.id, i]));
  const clusters = components.filter(c => c.length > 1);
  const standalones = components.filter(c => c.length === 1).map(c => c[0]);

  // Format each cluster
  let clusterNum = 0;
  for (const component of clusters) {
    clusterNum++;
    // Root = most connections; tiebreak = earliest createdAt
    const root = component.reduce((best, id) => {
      const bestDeg = adj.get(best)?.size ?? 0;
      const idDeg = adj.get(id)?.size ?? 0;
      if (idDeg > bestDeg) return id;
      if (idDeg === bestDeg) {
        const bestTime = ideaById.get(best)?.createdAt ?? '';
        const idTime = ideaById.get(id)?.createdAt ?? '';
        return idTime < bestTime ? id : best;
      }
      return best;
    });

    lines.push('');
    lines.push(`## Cluster ${clusterNum}`);
    lines.push('');

    // DFS from root — depth determines indentation, visited set handles cycles
    const dfsVisited = new Set<string>();
    const dfs = (id: string, depth: number): void => {
      dfsVisited.add(id);
      const idea = ideaById.get(id)!;
      const bulletIndent = '  '.repeat(depth);
      const descIndent = '  '.repeat(depth + 1);
      lines.push(`${bulletIndent}- **${idea.text}**`);
      if (idea.description) {
        lines.push(`${descIndent}${idea.description}`);
      }
      const children = [...(adj.get(id) ?? [])].filter(n => !dfsVisited.has(n));
      for (const child of children) {
        dfs(child, depth + 1);
      }
    };
    dfs(root, 0);
  }

  // Format standalones
  if (standalones.length > 0) {
    lines.push('');
    lines.push('## Standalone Ideas');
    lines.push('');
    for (const id of standalones) {
      const idea = ideaById.get(id)!;
      lines.push(`- **${idea.text}**`);
      if (idea.description) {
        lines.push(`  ${idea.description}`);
      }
    }
  }

  return lines.join('\n');
}
