import { useStore } from '../store/useStore';
import { GhostNode } from '../types';
import { fetchQuestions } from './questionGeneration';

function generateId(): string {
  return crypto.randomUUID();
}

/** Position a question ghost node near a target idea, or scatter near related ideas. */
function positionQuestionNode(
  relatedToId: string | null,
  ideas: import('../types').Idea[],
  viewport: import('../types').Viewport,
  index: number
): { x: number; y: number } {
  const related = relatedToId ? ideas.find((i) => i.id === relatedToId) : null;

  if (related) {
    // Place near the related idea — use golden angle distribution to avoid overlap
    const goldenAngle = 2.399963;
    const angle = index * goldenAngle;
    const dist = 100 + Math.random() * 80;
    return {
      x: Math.round(related.x + Math.cos(angle) * dist),
      y: Math.round(related.y + Math.sin(angle) * dist),
    };
  }

  // Near viewport center (canvas-wide, no related idea matched)
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.round(-viewport.x / viewport.zoom + (Math.random() * vw * 0.4 + vw * 0.3) / viewport.zoom),
    y: Math.round(-viewport.y / viewport.zoom + (Math.random() * vh * 0.4 + vh * 0.3) / viewport.zoom),
  };
}

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

    const ghostNodes: GhostNode[] = results.map((result, index) => {
      // Match relatedTo text to an idea id
      const relatedIdea = ideas.find((i) => i.text === result.relatedTo);
      const relatedToId = relatedIdea ? relatedIdea.id : (targetIdeaId || null);

      // Get fresh state for viewport
      const freshState = useStore.getState();
      const freshCanvas = freshState.canvases.find((c) => c.id === freshState.activeCanvasId);
      const viewport = freshCanvas?.viewport || { x: 0, y: 0, zoom: 1 };
      const freshIdeas = freshCanvas?.ideas || ideas;

      const { x, y } = positionQuestionNode(relatedToId, freshIdeas, viewport, index);

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
