import { Canvas } from '../types';
import { callClaude } from './claude';

const AI_TAG_PALETTE = [
  '#5B8C72', // sage green
  '#7B6B8A', // dusty lavender
  '#8A7B5B', // warm tan
  '#5B7B8A', // steel blue
  '#8A5B6B', // muted rose
  '#6B8A5B', // olive
  '#5B6B8A', // slate blue
  '#8A6B5B', // warm brown
  '#6B5B8A', // deep lavender
  '#5B8A7B', // teal
  '#8A8A5B', // khaki
  '#5B5B8A', // indigo gray
];

export function getTagColor(label: string): string {
  let hash = 0;
  for (const char of label) hash = (hash + char.charCodeAt(0)) % AI_TAG_PALETTE.length;
  return AI_TAG_PALETTE[hash];
}

const SYSTEM_PROMPT = `You are analyzing a brainstorming canvas to identify thematic groups. Look at the ideas and their connections, then create descriptive tag labels for groups of related ideas.

Rules:
- Create 2-6 tags depending on how many distinct themes you see.
- Tag labels should be 1-3 words, descriptive and specific (not generic like "IDEAS" or "MISC").
- Every idea should get at least one tag. Some ideas may get multiple tags if they bridge themes.
- Don't create a tag for fewer than 2 ideas.
- Tags should reflect the actual content, not generic categories.
- If the canvas has very few ideas (under 5), create 1-2 tags at most.

Respond ONLY with valid JSON, no markdown, no backticks, no preamble:
{"tags": [{"label": "TAG LABEL IN UPPERCASE", "ideaTexts": ["exact text of idea 1", "exact text of idea 2"]}]}`;

export async function fetchAutoTags(
  apiKey: string,
  canvasName: string,
  canvas: Canvas,
): Promise<Array<{ label: string; ideaTexts: string[] }>> {
  // Truncate to 40 most recent ideas
  const ideas = canvas.ideas.slice(-40);

  // Build a map of idea id -> connected idea texts
  const connectionMap: Record<string, string[]> = {};
  for (const conn of canvas.connections) {
    const sourceIdea = canvas.ideas.find((i) => i.id === conn.sourceId);
    const targetIdea = canvas.ideas.find((i) => i.id === conn.targetId);
    if (sourceIdea && targetIdea) {
      if (!connectionMap[conn.sourceId]) connectionMap[conn.sourceId] = [];
      connectionMap[conn.sourceId].push(targetIdea.text);
      if (!connectionMap[conn.targetId]) connectionMap[conn.targetId] = [];
      connectionMap[conn.targetId].push(sourceIdea.text);
    }
  }

  const ideaLines = ideas.map((idea) => {
    const connectedTexts = connectionMap[idea.id] || [];
    const connectedStr = connectedTexts.length > 0
      ? connectedTexts.map((t) => `"${t}"`).join(', ')
      : 'nothing';
    return `- "${idea.text}" (description: "${idea.description || 'none'}", connected to: ${connectedStr})`;
  });

  const userMessage = `Here are all the ideas on my canvas "${canvasName}":

${ideaLines.join('\n')}

Analyze these and create thematic tags.`;

  const parseResponse = (raw: string): Array<{ label: string; ideaTexts: string[] }> => {
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(stripped) as { tags: Array<{ label: string; ideaTexts: string[] }> };
    return parsed.tags;
  };

  let raw: string;
  try {
    raw = await callClaude(apiKey, SYSTEM_PROMPT, [{ role: 'user', content: userMessage }], 1024);
    return parseResponse(raw);
  } catch (firstError) {
    console.warn('fetchAutoTags: first attempt failed, retrying:', firstError);
    // Retry once
    raw = await callClaude(apiKey, SYSTEM_PROMPT, [{ role: 'user', content: userMessage }], 1024);
    return parseResponse(raw);
  }
}
