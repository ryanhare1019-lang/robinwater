import { callClaude } from './claude';
import { Idea, Canvas } from '../types';

export interface SuggestionResult {
  text: string;
  relatedTo: string; // exact text of related idea
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an AI thinking partner embedded in a spatial brainstorming canvas called Robinwater. The user has been capturing ideas on their canvas. Your job is to suggest related ideas they might not have considered.

Rules:
- Suggest 3-5 ideas (for manual trigger) or 1-2 ideas (for auto trigger).
- Each suggestion should be concise (3-12 words), matching the style of the user's existing ideas.
- Suggestions should be genuinely useful — not obvious restatements or generic advice.
- Consider connections between existing ideas to find gaps or extensions.
- Be creative but grounded in the context of what's on the canvas.
- Match the tone of the existing ideas (casual if they're casual, technical if they're technical).

Respond ONLY with valid JSON, no markdown, no backticks, no preamble:
{"suggestions": [{"text": "the suggested idea text", "relatedTo": "the exact text of the existing idea this relates to most", "reasoning": "one sentence on why this is relevant"}]}`;

function buildUserMessage(
  canvasName: string,
  ideas: Idea[],
  canvas: Canvas,
  triggerMode: 'manual' | 'auto',
  newestIdeaText?: string
): string {
  const lines: string[] = [];
  lines.push(`Here are the ideas currently on my canvas "${canvasName}":`);
  lines.push('');

  for (const idea of ideas) {
    const connectedIds = canvas.connections
      .filter((c) => c.sourceId === idea.id || c.targetId === idea.id)
      .map((c) => (c.sourceId === idea.id ? c.targetId : c.sourceId));
    const connectedTexts = connectedIds
      .map((cid) => canvas.ideas.find((i) => i.id === cid)?.text)
      .filter((t): t is string => Boolean(t));

    const connectedStr =
      connectedTexts.length > 0
        ? connectedTexts.map((t) => `"${t}"`).join(', ')
        : 'nothing';

    const descStr = idea.description && idea.description.trim() ? idea.description : 'none';
    lines.push(`- "${idea.text}" (description: "${descStr}", connected to: ${connectedStr})`);
  }

  lines.push('');

  if (triggerMode === 'auto' && newestIdeaText) {
    lines.push(`I just added this idea: "${newestIdeaText}"`);
    lines.push('Please suggest 1-2 related ideas.');
  } else {
    lines.push('Please suggest 3-5 ideas I might be missing or that would extend my thinking.');
  }

  return lines.join('\n');
}

function parseResponse(raw: string, triggerMode: 'manual' | 'auto'): SuggestionResult[] {
  const parsed = JSON.parse(raw) as { suggestions: SuggestionResult[] };
  if (!Array.isArray(parsed.suggestions)) return [];
  const limit = triggerMode === 'auto' ? 2 : 5;
  return parsed.suggestions
    .filter(
      (s) => typeof s.text === 'string' && typeof s.relatedTo === 'string' && typeof s.reasoning === 'string'
    )
    .slice(0, limit);
}

export async function fetchSuggestions(
  apiKey: string,
  canvasName: string,
  ideas: Idea[],
  canvas: Canvas,
  triggerMode: 'manual' | 'auto',
  newestIdeaText?: string
): Promise<SuggestionResult[]> {
  const truncatedIdeas = ideas.slice(-40);
  const userMessage = buildUserMessage(canvasName, truncatedIdeas, canvas, triggerMode, newestIdeaText);

  const raw = await callClaude(
    apiKey,
    SYSTEM_PROMPT,
    [{ role: 'user', content: userMessage }],
    512
  );

  // Try parse, retry once on failure
  try {
    return parseResponse(raw, triggerMode);
  } catch {
    // One retry
    try {
      const raw2 = await callClaude(
        apiKey,
        SYSTEM_PROMPT,
        [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: raw },
          { role: 'user', content: 'Please respond with valid JSON only, no markdown or extra text.' },
        ],
        512
      );
      return parseResponse(raw2, triggerMode);
    } catch {
      return [];
    }
  }
}
