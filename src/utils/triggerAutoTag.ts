import { useStore } from '../store/useStore';
import { AITagDefinition } from '../types';
import { fetchAutoTags, getTagColor } from './aiTags';
import { generateId } from './id';

export async function triggerAutoTag(): Promise<void> {
  const state = useStore.getState();
  const { config, canvases, activeCanvasId, applyAiTags, setAutoTagLoading, updateIdea } = state;

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
    // Pass existing user-created tag names so Claude can prefer them
    const existingTagNames = (canvas.tags || []).map((t) => t.name.toUpperCase());
    const rawTags = await fetchAutoTags(config.anthropicApiKey, canvas.name, canvas, existingTagNames);

    // Separate matched user tags from new AI tags
    const newAiTagDefinitions: AITagDefinition[] = [];
    const matchedCustomTagAssignments: Array<{ tagId: string; ideaIds: string[] }> = [];

    for (const raw of rawTags) {
      const label = raw.label;

      // Match idea texts to idea IDs (case-insensitive)
      const ideaIds = raw.ideaTexts
        .map((text) => {
          const matched = canvas.ideas.find(
            (idea) => idea.text.toLowerCase() === text.toLowerCase()
          );
          return matched?.id;
        })
        .filter((id): id is string => id !== undefined);

      // Check if label matches an existing user-created CustomTag (case-insensitive)
      const matchedCustomTag = (canvas.tags || []).find(
        (t) => t.name.toUpperCase() === label.toUpperCase()
      );

      if (matchedCustomTag) {
        // Route matched ideas to the existing custom tag (idea.tags[])
        matchedCustomTagAssignments.push({ tagId: matchedCustomTag.id, ideaIds });
      } else {
        // Create a new AITagDefinition
        newAiTagDefinitions.push({
          id: generateId(),
          label,
          color: getTagColor(label),
          ideaIds,
        });
      }
    }

    // Apply new AI tags via the store action (handles idea.aiTags[])
    applyAiTags(newAiTagDefinitions);

    // Apply matched custom tag assignments directly to idea.tags[]
    for (const { tagId, ideaIds } of matchedCustomTagAssignments) {
      // Re-read canvas state after applyAiTags may have updated it
      const freshCanvas = useStore.getState().canvases.find((c) => c.id === activeCanvasId)
        || useStore.getState().canvases[0];

      for (const ideaId of ideaIds) {
        const idea = freshCanvas?.ideas.find((i) => i.id === ideaId);
        if (!idea) continue;
        const existingTags = idea.tags || [];
        // Avoid duplicates
        if (!existingTags.includes(tagId)) {
          updateIdea(ideaId, { tags: [...existingTags, tagId] });
        }
      }
    }
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
