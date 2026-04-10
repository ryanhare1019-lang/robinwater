import { callClaude } from '../claude';
import type { Idea } from '../../types';

const SONNET_MODEL = 'claude-sonnet-4-6';

export interface WildcardResult {
  text: string;
  inspiration: string;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are a creative provocateur embedded in a brainstorming canvas called Monolite. Your job is to generate unexpected, tangential, or surprising ideas that are only loosely inspired by what's on the canvas. You are NOT trying to be helpful or relevant. You are trying to introduce creative disruption.

Rules:
- Generate 2-3 wild card ideas.
- Ideas should be surprising, lateral, or from a completely different domain than what's on the canvas.
- Think: "What would a comedian, a philosopher, a child, or an alien say about these topics?"
- Wild cards can be questions, provocations, metaphors, or concrete ideas.
- Keep them concise (5-15 words).
- At least one should be genuinely weird or unexpected. Push boundaries.
- Do NOT generate safe, predictable extensions. If it could have come from the "extend" function, it's not wild enough.

Respond ONLY with valid JSON, no markdown, no backticks, no preamble:
{
  "suggestions": [
    {
      "text": "the wild card idea text",
      "inspiration": "what loosely inspired this (can reference canvas content or not)",
      "reasoning": "one sentence on why this could be valuable despite seeming unrelated"
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

function buildUserMessage(canvasName: string, ideas: Idea[]): string {
  const themes = extractTopThemes(ideas);
  const sample = ideas.slice(-8);

  const lines: string[] = [];
  lines.push(`Here's a summary of what's on my canvas "${canvasName}":`);
  lines.push('');

  if (themes.length > 0) {
    lines.push('Main themes I see:');
    for (const theme of themes) {
      lines.push(`- ${theme}`);
    }
    lines.push('');
  }

  lines.push('Some specific ideas for context:');
  for (const idea of sample) {
    lines.push(`- "${idea.text}"`);
  }
  lines.push('');
  lines.push(
    'Generate 2-3 wild card ideas that come from completely outside my current thinking. Surprise me.'
  );

  return lines.join('\n');
}

function parseResponse(raw: string): WildcardResult[] {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(stripped) as { suggestions: WildcardResult[] };
  if (!Array.isArray(parsed.suggestions)) return [];
  return parsed.suggestions
    .filter(
      (s) =>
        typeof s.text === 'string' &&
        typeof s.inspiration === 'string' &&
        typeof s.reasoning === 'string'
    )
    .slice(0, 3);
}

export async function fetchWildcards(
  apiKey: string,
  canvasName: string,
  ideas: Idea[]
): Promise<WildcardResult[]> {
  const userMessage = buildUserMessage(canvasName, ideas);

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
