import { callClaude } from '../claude';
import type { Idea } from '../../types';
import type { Cluster } from './clusterUtils';

const SONNET_MODEL = 'claude-sonnet-4-6';

export interface SynthesisResult {
  text: string;
  bridgedGroups: string[][];  // text arrays — one array per bridged cluster
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an AI thinking partner embedded in a spatial brainstorming canvas called Monolite. You are analyzing the overall structure of the user's ideas to find synthesis opportunities — ideas that bridge different themes, connect separate clusters of thought, or reveal hidden relationships.

Rules:
- Generate 2-3 synthesis ideas.
- Each synthesis should connect or bridge at least 2 different groups of ideas on the canvas.
- Synthesis ideas should NOT just restate what's already there. They should reveal a NEW insight that emerges from the combination of existing themes.
- Keep suggestions concise (5-15 words).
- Think about: What do these separate groups have in common? What's the thread connecting them? What emerges when you combine these perspectives?

Respond ONLY with valid JSON, no markdown, no backticks, no preamble:
{
  "suggestions": [
    {
      "text": "the synthesis idea text",
      "bridgedGroups": [
        ["exact text of idea from group 1", "exact text of another idea from group 1"],
        ["exact text of idea from group 2", "exact text of another idea from group 2"]
      ],
      "reasoning": "one sentence on what connection this reveals"
    }
  ]
}`;

export function buildUserMessage(
  canvasName: string,
  clusters: Cluster[],
  standalone: Idea[],
  canvasDescription?: string
): string {
  const lines: string[] = [];
  const canvasLabel = canvasDescription?.trim()
    ? `${canvasName} — ${canvasDescription.trim()}`
    : canvasName;
  lines.push(`Here are the ideas on my canvas "${canvasLabel}", organized by clusters:`);
  lines.push('');

  clusters.forEach((cluster, i) => {
    lines.push(`Cluster ${i + 1} (connected ideas):`);
    for (const idea of cluster.ideas) {
      const descStr = idea.description?.trim() || 'none';
      lines.push(`- "${idea.text}" (description: "${descStr}")`);
    }
    lines.push('');
  });

  if (standalone.length > 0) {
    lines.push('Standalone ideas (not connected to anything):');
    for (const idea of standalone) {
      lines.push(`- "${idea.text}"`);
    }
    lines.push('');
  }

  lines.push(
    'Find synthesis opportunities that bridge these groups or reveal hidden connections between them. Generate 2-3 synthesis ideas.'
  );

  return lines.join('\n');
}

function parseResponse(raw: string): SynthesisResult[] {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(stripped) as { suggestions: SynthesisResult[] };
  if (!Array.isArray(parsed.suggestions)) return [];
  return parsed.suggestions
    .filter(
      (s) =>
        typeof s.text === 'string' &&
        Array.isArray(s.bridgedGroups) &&
        typeof s.reasoning === 'string'
    )
    .slice(0, 3);
}

export async function fetchSynthesis(
  apiKey: string,
  canvasName: string,
  clusters: Cluster[],
  standalone: Idea[],
  canvasDescription?: string
): Promise<SynthesisResult[]> {
  const userMessage = buildUserMessage(canvasName, clusters, standalone, canvasDescription);

  const raw = await callClaude(
    apiKey,
    SYSTEM_PROMPT,
    [{ role: 'user', content: userMessage }],
    768,
    SONNET_MODEL
  );

  try {
    return parseResponse(raw);
  } catch {
    try {
      const raw2 = await callClaude(
        apiKey,
        SYSTEM_PROMPT,
        [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: raw },
          { role: 'user', content: 'Please respond with valid JSON only, no markdown or extra text.' },
        ],
        768,
        SONNET_MODEL
      );
      return parseResponse(raw2);
    } catch {
      return [];
    }
  }
}
