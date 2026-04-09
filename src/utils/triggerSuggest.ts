import { useStore } from '../store/useStore';
import { GhostNode } from '../types';
import { fetchSuggestions } from './ghostSuggestions';
import { generateId } from './id';
import { placeGhostNode } from './ghostPlacement';

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

    // Get fresh state for viewport (may have changed during API call)
    const freshState = useStore.getState();
    // If user switched canvas while suggestions were loading, discard results
    if (freshState.activeCanvasId !== activeCanvasId) return;
    const freshCanvas = freshState.canvases.find((c) => c.id === freshState.activeCanvasId);
    const viewport = freshCanvas?.viewport || { x: 0, y: 0, zoom: 1 };
    const freshIdeas = freshCanvas?.ideas || ideas;

    // Convert suggestions to GhostNodes, accumulating placed positions to avoid intra-batch overlaps
    const placedGhosts: { x: number; y: number }[] = [];
    const ghostNodes: GhostNode[] = suggestions.map((s) => {
      const relatedIdea = freshIdeas.find((i) => i.text === s.relatedTo);
      const relatedToId = relatedIdea ? relatedIdea.id : null;

      const { x, y } = placeGhostNode(relatedToId, freshIdeas, viewport, placedGhosts);
      placedGhosts.push({ x, y });

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
