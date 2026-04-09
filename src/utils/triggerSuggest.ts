import { useStore } from '../store/useStore';
import { GhostNode } from '../types';
import { fetchSuggestions } from './ghostSuggestions';

function generateId(): string {
  return crypto.randomUUID();
}

/** Pick a position near a related idea, or near viewport center. */
function positionGhostNode(
  relatedToId: string | null,
  ideas: import('../types').Idea[],
  viewport: import('../types').Viewport
): { x: number; y: number } {
  const related = relatedToId ? ideas.find((i) => i.id === relatedToId) : null;

  if (related) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 100;
    return {
      x: Math.round(related.x + Math.cos(angle) * dist),
      y: Math.round(related.y + Math.sin(angle) * dist),
    };
  }

  // Near viewport center
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.round(-viewport.x / viewport.zoom + (Math.random() * vw * 0.4 + vw * 0.3) / viewport.zoom),
    y: Math.round(-viewport.y / viewport.zoom + (Math.random() * vh * 0.4 + vh * 0.3) / viewport.zoom),
  };
}

const AUTO_COOLDOWN_MS = 30_000;

export async function triggerSuggest(
  triggerMode: 'manual' | 'auto',
  newestIdeaText?: string
): Promise<void> {
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

  // Guard: need API key
  if (!config?.anthropicApiKey) return;

  // Guard: feature must be enabled
  if (!config.aiFeatures.ghostNodes) return;

  // Guard: auto-trigger cooldown
  if (triggerMode === 'auto') {
    const now = Date.now();
    if (now - lastAutoTriggerAt < AUTO_COOLDOWN_MS) return;
  }

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  if (!canvas) return;

  const ideas = canvas.ideas;

  // Need at least 2 ideas
  if (ideas.length < 2) return;

  setSuggestLoading(true);

  if (triggerMode === 'auto') {
    setLastAutoTriggerAt(Date.now());
  }

  try {
    const suggestions = await fetchSuggestions(
      config.anthropicApiKey,
      canvas.name,
      ideas,
      canvas,
      triggerMode,
      newestIdeaText
    );

    // Convert suggestions to GhostNodes
    const ghostNodes: GhostNode[] = suggestions.map((s) => {
      // Find relatedToId by matching text
      const relatedIdea = ideas.find((i) => i.text === s.relatedTo);
      const relatedToId = relatedIdea ? relatedIdea.id : null;

      // Get fresh state for viewport (may have changed)
      const freshState = useStore.getState();
      const freshCanvas = freshState.canvases.find((c) => c.id === freshState.activeCanvasId);
      const viewport = freshCanvas?.viewport || { x: 0, y: 0, zoom: 1 };
      const freshIdeas = freshCanvas?.ideas || ideas;

      const { x, y } = positionGhostNode(relatedToId, freshIdeas, viewport);

      return {
        id: generateId(),
        text: s.text,
        relatedToId,
        reasoning: s.reasoning,
        x,
        y,
        type: 'suggestion' as const,
      };
    });

    addGhostNodes(ghostNodes);
  } catch (e) {
    console.error('[triggerSuggest] error:', e);
  } finally {
    setSuggestLoading(false);
  }
}
