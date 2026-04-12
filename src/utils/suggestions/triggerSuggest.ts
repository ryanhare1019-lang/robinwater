import { useStore } from '../../store/useStore';
import type { GhostNode, SuggestionMode } from '../../types';
import { generateId } from '../id';
import { placeGhostNode } from '../ghostPlacement';
import { findLooseClusters } from './clusterUtils';
import type { Cluster } from './clusterUtils';
import { fetchExtensions } from './extensionSuggestions';
import { fetchSynthesis } from './synthesisSuggestions';
import { fetchWildcards } from './wildcardSuggestions';
import { fetchAll } from './allSuggestions';

const AUTO_COOLDOWN_MS = 30_000;

const COOLDOWN_MS: Record<SuggestionMode, number> = {
  extend: 10_000,
  synthesize: 10_000,
  wildcard: 10_000,
  all: 15_000,
};

// ─── Placement helpers ───────────────────────────────────────────────────────

function placeSynthesisNode(
  c1: Cluster,
  c2: Cluster,
  occupied: { x: number; y: number }[]
): { x: number; y: number } {
  const midX = (c1.centroid.x + c2.centroid.x) / 2;
  const midY = (c1.centroid.y + c2.centroid.y) / 2;
  const angle = Math.random() * Math.PI * 2;
  const jitter = 50 + Math.random() * 50;
  const startX = midX + Math.cos(angle) * jitter;
  const startY = midY + Math.sin(angle) * jitter;

  // Spiral avoidance (mirrors ghostPlacement.ts logic)
  const goldenAngle = 2.399963;
  const GHOST_W = 200, GHOST_H = 80, PAD = 24;
  const overlaps = (cx: number, cy: number) =>
    occupied.some((r) => Math.abs(cx - r.x) < GHOST_W + PAD && Math.abs(cy - r.y) < GHOST_H + PAD);

  if (!overlaps(startX, startY)) return { x: Math.round(startX), y: Math.round(startY) };
  let lastX = startX, lastY = startY;
  for (let i = 1; i <= 40; i++) {
    const cx = startX + Math.cos(i * goldenAngle) * (i * 50);
    const cy = startY + Math.sin(i * goldenAngle) * (i * 50);
    lastX = cx; lastY = cy;
    if (!overlaps(cx, cy)) return { x: Math.round(cx), y: Math.round(cy) };
  }
  return { x: Math.round(lastX), y: Math.round(lastY) };
}

function placeWildcardNodes(
  ideas: { x: number; y: number }[],
  count: number
): Array<{ x: number; y: number }> {
  if (ideas.length === 0) {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return { x: Math.round(Math.cos(angle) * 800), y: Math.round(Math.sin(angle) * 800) };
    });
  }

  const minX = Math.min(...ideas.map((i) => i.x));
  const maxX = Math.max(...ideas.map((i) => i.x));
  const minY = Math.min(...ideas.map((i) => i.y));
  const maxY = Math.max(...ideas.map((i) => i.y));

  const edges: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right'];
  // Fisher-Yates shuffle
  for (let i = edges.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [edges[i], edges[j]] = [edges[j], edges[i]];
  }

  return Array.from({ length: Math.min(count, 4) }, (_, i) => {
    const edge = edges[i];
    const offset = 200 + Math.random() * 200;
    let x: number, y: number;
    switch (edge) {
      case 'top':
        x = minX + Math.random() * Math.max(maxX - minX, 1);
        y = minY - offset;
        break;
      case 'bottom':
        x = minX + Math.random() * Math.max(maxX - minX, 1);
        y = maxY + offset;
        break;
      case 'left':
        x = minX - offset;
        y = minY + Math.random() * Math.max(maxY - minY, 1);
        break;
      case 'right':
      default:
        x = maxX + offset;
        y = minY + Math.random() * Math.max(maxY - minY, 1);
        break;
    }
    return { x: Math.round(x), y: Math.round(y) };
  });
}

function isOffScreen(
  ghostX: number,
  ghostY: number,
  viewport: { x: number; y: number; zoom: number }
): boolean {
  const screenX = ghostX * viewport.zoom + viewport.x;
  const screenY = ghostY * viewport.zoom + viewport.y;
  return (
    screenX < -200 ||
    screenX > window.innerWidth + 200 ||
    screenY < -200 ||
    screenY > window.innerHeight + 200
  );
}

function computeDirection(
  ghosts: Array<{ x: number; y: number }>,
  viewport: { x: number; y: number; zoom: number }
): 'N' | 'S' | 'E' | 'W' {
  const avgX = ghosts.reduce((s, g) => s + g.x, 0) / ghosts.length;
  const avgY = ghosts.reduce((s, g) => s + g.y, 0) / ghosts.length;
  const screenX = avgX * viewport.zoom + viewport.x;
  const screenY = avgY * viewport.zoom + viewport.y;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const dx = screenX - cx;
  const dy = screenY - cy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'E' : 'W';
  return dy > 0 ? 'S' : 'N';
}

// ─── Text → ID resolution ────────────────────────────────────────────────────

function resolveTextsToIds(
  textGroups: string[][],
  ideas: Array<{ id: string; text: string }>
): string[][] {
  return textGroups.map((group) =>
    group
      .map((text) => ideas.find((i) => i.text === text)?.id)
      .filter((id): id is string => Boolean(id))
  );
}

// ─── Main exports ─────────────────────────────────────────────────────────────

/** Triggered automatically 3s after a new idea is added. Extension-only. */
export async function triggerAutoSuggest(newestIdeaText?: string): Promise<void> {
  const state = useStore.getState();
  const {
    config,
    canvases,
    activeCanvasId,
    addGhostNodes,
    setSuggestLoading,
    lastAutoTriggerAt,
    setLastAutoTriggerAt,
  } = state;

  if (!config?.anthropicApiKey) return;
  if (!config.aiFeatures.ghostNodes) return;

  const now = Date.now();
  if (now - lastAutoTriggerAt < AUTO_COOLDOWN_MS) return;

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  if (!canvas || canvas.ideas.length < 2) return;

  setSuggestLoading(true);
  setLastAutoTriggerAt(Date.now());

  try {
    const suggestions = await fetchExtensions(
      config.anthropicApiKey,
      canvas.name,
      canvas.ideas,
      canvas,
      'auto',
      newestIdeaText
    );

    const freshState = useStore.getState();
    if (freshState.activeCanvasId !== activeCanvasId) return;
    const freshCanvas = freshState.canvases.find((c) => c.id === freshState.activeCanvasId);
    const viewport = freshCanvas?.viewport ?? { x: 0, y: 0, zoom: 1 };
    const freshIdeas = freshCanvas?.ideas ?? canvas.ideas;

    const placedGhosts: { x: number; y: number }[] = [];
    const ghostNodes: GhostNode[] = suggestions.map((s) => {
      const relatedIdea = freshIdeas.find((i) => i.text === s.relatedTo);
      const { x, y } = placeGhostNode(relatedIdea?.id ?? null, freshIdeas, viewport, placedGhosts);
      placedGhosts.push({ x, y });
      return {
        id: generateId(),
        text: s.text,
        type: 'extension' as const,
        relatedToId: relatedIdea?.id ?? null,
        reasoning: s.reasoning,
        x,
        y,
      };
    });

    addGhostNodes(ghostNodes);
  } catch (e) {
    console.error('[triggerAutoSuggest] error:', e);
  } finally {
    setSuggestLoading(false);
  }
}

/** Manual trigger for a specific suggestion mode. */
export async function triggerSuggest(mode: SuggestionMode): Promise<void> {
  const state = useStore.getState();
  const {
    config,
    canvases,
    activeCanvasId,
    addGhostNodes,
    setSuggestLoading,
    setActiveSuggestMode,
    setSuggestCooldown,
    suggestCooldowns,
    setOffScreenGhosts,
  } = state;

  if (!config?.anthropicApiKey) return;
  if (!config.aiFeatures.ghostNodes) return;

  // Rate limit check
  if (Date.now() < suggestCooldowns[mode]) return;

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  if (!canvas) return;

  const ideas = canvas.ideas;

  setSuggestLoading(true);
  setActiveSuggestMode(mode);

  // Compute clusters once (needed for synthesis, wildcard, all)
  const allClusters = findLooseClusters(ideas, canvas.connections);
  const standalone = allClusters.filter((c) => c.ideas.length === 1).flatMap((c) => c.ideas);
  const multiClusters = allClusters.filter((c) => c.ideas.length > 1);

  try {
    const freshStatePre = useStore.getState();
    if (freshStatePre.activeCanvasId !== activeCanvasId) return;

    if (mode === 'extend') {
      if (ideas.length < 2) return;
      const suggestions = await fetchExtensions(config.anthropicApiKey, canvas.name, ideas, canvas, 'manual');
      const freshState = useStore.getState();
      if (freshState.activeCanvasId !== activeCanvasId) return;
      const freshCanvas = freshState.canvases.find((c) => c.id === activeCanvasId)!;
      const viewport = freshCanvas.viewport;
      const freshIdeas = freshCanvas.ideas;

      const placedGhosts: { x: number; y: number }[] = [];
      const ghosts: GhostNode[] = suggestions.map((s) => {
        const relatedIdea = freshIdeas.find((i) => i.text === s.relatedTo);
        const { x, y } = placeGhostNode(relatedIdea?.id ?? null, freshIdeas, viewport, placedGhosts);
        placedGhosts.push({ x, y });
        return {
          id: generateId(), text: s.text, type: 'extension' as const,
          relatedToId: relatedIdea?.id ?? null, reasoning: s.reasoning, x, y,
        };
      });
      addGhostNodes(ghosts);

    } else if (mode === 'synthesize') {
      const canSynthesize = allClusters.length >= 2 || ideas.length >= 6;
      if (!canSynthesize) return;

      const suggestions = await fetchSynthesis(config.anthropicApiKey, canvas.name, multiClusters, standalone, canvas.description);
      const freshState = useStore.getState();
      if (freshState.activeCanvasId !== activeCanvasId) return;
      const freshCanvas = freshState.canvases.find((c) => c.id === activeCanvasId)!;
      const freshIdeas = freshCanvas.ideas;
      const viewport = freshCanvas.viewport;

      const placedGhosts: { x: number; y: number }[] = [];
      const offScreenItems: Array<{ id: string; x: number; y: number }> = [];

      const ghosts: GhostNode[] = suggestions.map((s) => {
        let c1: Cluster | undefined;
        let c2: Cluster | undefined;
        for (const group of s.bridgedGroups) {
          const match = allClusters.find((cl) => cl.ideas.some((idea) => group.includes(idea.text)));
          if (!c1) c1 = match;
          else if (match && match !== c1) { c2 = match; break; }
        }

        let x: number, y: number;
        if (c1 && c2) {
          const pos = placeSynthesisNode(c1, c2, placedGhosts);
          x = pos.x; y = pos.y;
        } else {
          const cx = freshIdeas.reduce((sum, i) => sum + i.x, 0) / Math.max(freshIdeas.length, 1);
          const cy = freshIdeas.reduce((sum, i) => sum + i.y, 0) / Math.max(freshIdeas.length, 1);
          const angle = Math.random() * Math.PI * 2;
          const jitter = 50 + Math.random() * 100;
          x = Math.round(cx + Math.cos(angle) * jitter);
          y = Math.round(cy + Math.sin(angle) * jitter);
        }
        placedGhosts.push({ x, y });

        const bridgedClusterIds = resolveTextsToIds(s.bridgedGroups, freshIdeas);
        const id = generateId();
        if (isOffScreen(x, y, viewport)) offScreenItems.push({ id, x, y });

        return { id, text: s.text, type: 'synthesis' as const, relatedToId: null, bridgedClusterIds, reasoning: s.reasoning, x, y };
      });

      addGhostNodes(ghosts);
      if (offScreenItems.length > 0) {
        setOffScreenGhosts({
          count: offScreenItems.length, type: 'synthesis',
          direction: computeDirection(offScreenItems, viewport),
          ids: offScreenItems.map((g) => g.id),
        });
      }

    } else if (mode === 'wildcard') {
      const suggestions = await fetchWildcards(config.anthropicApiKey, canvas.name, ideas, canvas.description);
      const freshState = useStore.getState();
      if (freshState.activeCanvasId !== activeCanvasId) return;
      const freshCanvas = freshState.canvases.find((c) => c.id === activeCanvasId)!;
      const freshIdeas = freshCanvas.ideas;
      const viewport = freshCanvas.viewport;

      const positions = placeWildcardNodes(freshIdeas, suggestions.length);
      const offScreenItems: Array<{ id: string; x: number; y: number }> = [];

      const ghosts: GhostNode[] = suggestions.map((s, i) => {
        const { x, y } = positions[i] ?? { x: 0, y: 0 };
        const id = generateId();
        if (isOffScreen(x, y, viewport)) offScreenItems.push({ id, x, y });
        return { id, text: s.text, type: 'wildcard' as const, relatedToId: null, reasoning: s.reasoning, inspiration: s.inspiration, x, y };
      });

      addGhostNodes(ghosts);
      if (offScreenItems.length > 0) {
        setOffScreenGhosts({
          count: offScreenItems.length, type: 'wildcard',
          direction: computeDirection(offScreenItems, viewport),
          ids: offScreenItems.map((g) => g.id),
        });
      }

    } else if (mode === 'all') {
      const results = await fetchAll(config.anthropicApiKey, canvas.name, ideas, canvas, multiClusters, standalone);
      const freshState = useStore.getState();
      if (freshState.activeCanvasId !== activeCanvasId) return;
      const freshCanvas = freshState.canvases.find((c) => c.id === activeCanvasId)!;
      const freshIdeas = freshCanvas.ideas;
      const viewport = freshCanvas.viewport;

      const placedGhosts: { x: number; y: number }[] = [];

      const extensionGhosts: GhostNode[] = results.extensions.map((s) => {
        const relatedIdea = freshIdeas.find((i) => i.text === s.relatedTo);
        const { x, y } = placeGhostNode(relatedIdea?.id ?? null, freshIdeas, viewport, placedGhosts);
        placedGhosts.push({ x, y });
        return { id: generateId(), text: s.text, type: 'extension' as const, relatedToId: relatedIdea?.id ?? null, reasoning: s.reasoning, x, y };
      });

      const synthesisGhosts: GhostNode[] = results.synthesis.map((s) => {
        let c1: Cluster | undefined;
        let c2: Cluster | undefined;
        for (const group of s.bridgedGroups) {
          const match = allClusters.find((cl) => cl.ideas.some((idea) => group.includes(idea.text)));
          if (!c1) c1 = match;
          else if (match && match !== c1) { c2 = match; break; }
        }
        let x: number, y: number;
        if (c1 && c2) {
          const pos = placeSynthesisNode(c1, c2, placedGhosts);
          x = pos.x; y = pos.y;
        } else {
          const cx = freshIdeas.reduce((sum, i) => sum + i.x, 0) / Math.max(freshIdeas.length, 1);
          const cy = freshIdeas.reduce((sum, i) => sum + i.y, 0) / Math.max(freshIdeas.length, 1);
          x = Math.round(cx + (Math.random() - 0.5) * 200);
          y = Math.round(cy + (Math.random() - 0.5) * 200);
        }
        placedGhosts.push({ x, y });
        const bridgedClusterIds = resolveTextsToIds(s.bridgedGroups, freshIdeas);
        return { id: generateId(), text: s.text, type: 'synthesis' as const, relatedToId: null, bridgedClusterIds, reasoning: s.reasoning, x, y };
      });

      const wildcardPositions = placeWildcardNodes(freshIdeas, results.wildcards.length);
      const offScreenItems: Array<{ id: string; x: number; y: number }> = [];
      const wildcardGhosts: GhostNode[] = results.wildcards.map((s, i) => {
        const { x, y } = wildcardPositions[i] ?? { x: 0, y: 0 };
        const id = generateId();
        if (isOffScreen(x, y, viewport)) offScreenItems.push({ id, x, y });
        return { id, text: s.text, type: 'wildcard' as const, relatedToId: null, reasoning: s.reasoning, inspiration: s.inspiration, x, y };
      });

      // Staggered appearance
      addGhostNodes(extensionGhosts);
      setTimeout(() => {
        if (useStore.getState().activeCanvasId === activeCanvasId) {
          useStore.getState().addGhostNodes(synthesisGhosts);
        }
      }, 800);
      setTimeout(() => {
        if (useStore.getState().activeCanvasId === activeCanvasId) {
          useStore.getState().addGhostNodes(wildcardGhosts);
          if (offScreenItems.length > 0) {
            useStore.getState().setOffScreenGhosts({
              count: offScreenItems.length, type: 'wildcard',
              direction: computeDirection(offScreenItems, viewport),
              ids: offScreenItems.map((g) => g.id),
            });
          }
        }
      }, 1600);
    }

    setSuggestCooldown(mode, Date.now() + COOLDOWN_MS[mode]);
  } catch (e) {
    console.error(`[triggerSuggest:${mode}] error:`, e);
  } finally {
    setSuggestLoading(false);
    setActiveSuggestMode(null);
  }
}
