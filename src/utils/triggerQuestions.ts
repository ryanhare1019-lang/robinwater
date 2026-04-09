import { useStore } from '../store/useStore';
import { GhostNode } from '../types';
import { fetchQuestions } from './questionGeneration';
import { generateId } from './id';
import { placeGhostNode } from './ghostPlacement';

export async function triggerQuestions(
  mode: 'per-idea' | 'canvas-wide',
  targetIdeaId?: string
): Promise<void> {
  const state = useStore.getState();
  const { config, canvases, activeCanvasId, addGhostNodes, setQuestionsLoading } = state;

  // Guard: need API key
  if (!config?.anthropicApiKey) {
    throw new Error('No API key configured');
  }

  // Guard: feature must be enabled
  if (config.aiFeatures.questionGeneration === false) return;

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  if (!canvas) return;

  const ideas = canvas.ideas;

  // Guard: need at least 2 ideas
  if (ideas.length < 2) return;

  setQuestionsLoading(true);

  try {
    const results = await fetchQuestions(
      config.anthropicApiKey,
      canvas.name,
      canvas,
      mode,
      targetIdeaId
    );

    // Get fresh state for viewport (may have changed during API call)
    const freshState = useStore.getState();
    const freshCanvas = freshState.canvases.find((c) => c.id === freshState.activeCanvasId);
    const viewport = freshCanvas?.viewport || { x: 0, y: 0, zoom: 1 };
    const freshIdeas = freshCanvas?.ideas || ideas;

    const placedGhosts: { x: number; y: number }[] = [];
    const ghostNodes: GhostNode[] = results.map((result) => {
      const relatedIdea = freshIdeas.find((i) => i.text === result.relatedTo);
      const relatedToId = relatedIdea ? relatedIdea.id : (targetIdeaId || null);

      const { x, y } = placeGhostNode(relatedToId, freshIdeas, viewport, placedGhosts, [100, 180]);
      placedGhosts.push({ x, y });

      return {
        id: generateId(),
        text: `? ${result.text}`,
        relatedToId,
        reasoning: result.type,
        x,
        y,
        type: 'question' as const,
        questionType: result.type,
      };
    });

    addGhostNodes(ghostNodes);
  } catch (e) {
    console.error('[triggerQuestions] error:', e);
    throw e;
  } finally {
    setQuestionsLoading(false);
  }
}
