import { useStore } from '../store/useStore';
import { AITagDefinition } from '../types';
import { fetchAutoTags, getTagColor } from './aiTags';
import { generateId } from './id';

export async function triggerAutoTag(): Promise<void> {
  const state = useStore.getState();
  const { config, canvases, activeCanvasId, applyAiTags, setAutoTagLoading } = state;

  const canvas = canvases.find((c) => c.id === activeCanvasId) || canvases[0];
  if (!canvas) return;

  if (!config?.anthropicApiKey) {
    throw new Error('NO_API_KEY');
  }

  if (!config.aiFeatures.autoTagging) {
    return;
  }

  if (canvas.ideas.length < 2) {
    return;
  }

  setAutoTagLoading(true);

  try {
    const rawTags = await fetchAutoTags(config.anthropicApiKey, canvas.name, canvas);

    // Convert raw label->ideaTexts mapping to AITagDefinition objects
    const tagDefinitions: AITagDefinition[] = rawTags.map((raw) => {
      const label = raw.label;
      const color = getTagColor(label);

      // Match idea texts to idea IDs (case-insensitive)
      const ideaIds = raw.ideaTexts
        .map((text) => {
          const matched = canvas.ideas.find(
            (idea) => idea.text.toLowerCase() === text.toLowerCase()
          );
          return matched?.id;
        })
        .filter((id): id is string => id !== undefined);

      return {
        id: generateId(),
        label,
        color,
        ideaIds,
      };
    });

    applyAiTags(tagDefinitions);
  } finally {
    setAutoTagLoading(false);
  }
}

export function getHasAiTags(): boolean {
  const state = useStore.getState();
  const canvas = state.canvases.find((c) => c.id === state.activeCanvasId) || state.canvases[0];
  if (!canvas) return false;
  return (canvas.aiTagDefinitions?.length ?? 0) > 0;
}
