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
    // Pass existing user-created tag names so Claude can prefer them
    const existingTagNames = (canvas.tags || []).map((t) => t.name.toUpperCase());
    const rawTags = await fetchAutoTags(config.anthropicApiKey, canvas.name, canvas, existingTagNames);

    // Separate matched user tags from new AI tags
    const newAiTagDefinitions: AITagDefinition[] = [];
    const matchedCustomTagAssignments: Array<{ tagId: string; ideaIds: string[] }> = [];

    for (const raw of rawTags) {
      const { label } = raw;

      // Match idea texts to idea IDs (case-insensitive)
      const ideaIds = raw.ideaTexts
        .map((text) => {
          const matched = canvas.ideas.find(
            (idea) => idea.text.toLowerCase() === text.toLowerCase()
          );
          return matched?.id;
        })
        .filter((id): id is string => id !== undefined);

      // Skip tags Claude returned with no matched ideas
      if (ideaIds.length === 0) continue;

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
    // Guard: skip if empty to avoid wiping existing AI tags
    if (newAiTagDefinitions.length > 0) {
      applyAiTags(newAiTagDefinitions);
    }

    // Apply matched custom tag assignments directly to idea.tags[]
    for (const { tagId, ideaIds } of matchedCustomTagAssignments) {
      for (const ideaId of ideaIds) {
        // Re-read canvas state per idea so each updateIdea call sees the latest writes
        const freshCanvas = useStore.getState().canvases.find((c) => c.id === useStore.getState().activeCanvasId);
        const idea = freshCanvas?.ideas.find((i) => i.id === ideaId);
        if (!idea) continue;
        const existingTags = idea.tags || [];
        // Avoid duplicates
        if (!existingTags.includes(tagId)) {
          useStore.getState().updateIdea(ideaId, { tags: [...existingTags, tagId] });
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
