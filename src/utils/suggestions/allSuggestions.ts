import { callClaude } from '../claude';
import type { Idea, Canvas } from '../../types';
import type { Cluster } from './clusterUtils';
import type { ExtensionResult } from './extensionSuggestions';
import type { SynthesisResult } from './synthesisSuggestions';
import type { WildcardResult } from './wildcardSuggestions';

const SONNET_MODEL = 'claude-sonnet-4-6';

export interface AllResults {
  extensions: ExtensionResult[];
  synthesis: SynthesisResult[];
  wildcards: WildcardResult[];
}

const SYSTEM_PROMPT = `You are an AI thinking partner embedded in a spatial brainstorming canvas called Monolite. Generate three types of suggestions:

1. EXTENSIONS (1-2): Ideas that build on a specific existing idea. Include which idea it extends.
2. SYNTHESIS (1): An idea that bridges or connects different clusters/themes on the canvas. Include which groups it connects.
3. WILD CARD (1): A surprising, tangential idea from outside the current thinking. Creative disruption.

Rules:
- Extensions: concise (3-12 words), clearly related to one existing idea
- Synthesis: concise (5-15 words), must bridge at least 2 different theme groups
- Wild Card: concise (5-15 words), must be genuinely unexpected and lateral
- Match the tone and style of existing ideas on the canvas

Respond ONLY with valid JSON, no markdown, no backticks, no preamble:
{
  "extensions": [
    {
      "text": "idea text",
      "relatedTo": "exact text of the idea this extends",
      "reasoning": "why this is relevant"
    }
  ],
  "synthesis": [
    {
      "text": "idea text",
      "bridgedGroups": [
        ["idea from group 1"],
        ["idea from group 2"]
      ],
      "reasoning": "what connection this reveals"
    }
  ],
  "wildcards": [
    {
      "text": "idea text",
      "inspiration": "loose inspiration",
      "reasoning": "why this could be valuable"
    }
  ]
}`;

function extractTopThemes(ideas: Idea[], count = 5): string[] {
  const freq = new Map<string, number>();
  for (const idea of ideas) {
    for (const kw of idea.keywords) {
      freq.set(kw, (freq.get(kw) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([kw]) => kw);
}

export function buildUserMessage(
  canvasName: string,
  ideas: Idea[],
  canvas: Canvas,
  clusters: Cluster[],
  standalone: Idea[]
): string {
  const lines: string[] = [];
  const canvasLabel = canvas.description?.trim()
    ? `${canvasName} — ${canvas.description.trim()}`
    : canvasName;
  lines.push(`Canvas: "${canvasLabel}"`);
  lines.push('');

  // Cluster context (for synthesis)
  if (clusters.length > 0) {
    lines.push('Ideas organized by cluster:');
    clusters.forEach((cluster, i) => {
      lines.push(`Cluster ${i + 1}:`);
      for (const idea of cluster.ideas) {
        lines.push(`  - "${idea.text}"`);
      }
    });
    if (standalone.length > 0) {
      lines.push('Standalone:');
      for (const idea of standalone) {
        lines.push(`  - "${idea.text}"`);
      }
    }
    lines.push('');
  }

  // Theme summary (for wildcards)
  const themes = extractTopThemes(ideas);
  if (themes.length > 0) {
    lines.push('Main themes: ' + themes.join(', '));
    lines.push('');
  }

  // Full idea list with connections (for extensions)
  lines.push('All ideas with connections:');
  const truncated = ideas.slice(-30);
  for (const idea of truncated) {
    const connectedTexts = canvas.connections
      .filter((c) => c.sourceId === idea.id || c.targetId === idea.id)
      .map((c) => {
        const otherId = c.sourceId === idea.id ? c.targetId : c.sourceId;
        return canvas.ideas.find((i) => i.id === otherId)?.text;
      })
      .filter((t): t is string => Boolean(t));
    const connStr = connectedTexts.length > 0
      ? connectedTexts.map((t) => `"${t}"`).join(', ')
      : 'none';
    lines.push(`- "${idea.text}" (connected to: ${connStr})`);
  }

  lines.push('');
  lines.push('Generate 1-2 extensions, 1 synthesis, and 1 wild card.');

  return lines.join('\n');
}

function parseResponse(raw: string): AllResults {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(stripped) as Partial<AllResults>;

  const extensions = Array.isArray(parsed.extensions)
    ? parsed.extensions
        .filter((s) => typeof s.text === 'string' && typeof s.relatedTo === 'string' && typeof s.reasoning === 'string')
        .slice(0, 2)
    : [];

  const synthesis = Array.isArray(parsed.synthesis)
    ? parsed.synthesis
        .filter((s) => typeof s.text === 'string' && Array.isArray(s.bridgedGroups) && typeof s.reasoning === 'string')
        .slice(0, 1)
    : [];

  const wildcards = Array.isArray(parsed.wildcards)
    ? parsed.wildcards
        .filter((s) => typeof s.text === 'string' && typeof s.inspiration === 'string' && typeof s.reasoning === 'string')
        .slice(0, 1)
    : [];

  return { extensions, synthesis, wildcards };
}

export async function fetchAll(
  apiKey: string,
  canvasName: string,
  ideas: Idea[],
  canvas: Canvas,
  clusters: Cluster[],
  standalone: Idea[]
): Promise<AllResults> {
  const userMessage = buildUserMessage(canvasName, ideas, canvas, clusters, standalone);

  const raw = await callClaude(
    apiKey,
    SYSTEM_PROMPT,
    [{ role: 'user', content: userMessage }],
    1024,
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
        1024,
        SONNET_MODEL
      );
      return parseResponse(raw2);
    } catch {
      return { extensions: [], synthesis: [], wildcards: [] };
    }
  }
}
