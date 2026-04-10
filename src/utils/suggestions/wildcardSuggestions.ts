import { callClaude } from '../claude';
import type { Idea } from '../../types';

const SONNET_MODEL = 'claude-sonnet-4-6';

export interface WildcardResult {
  text: string;
  inspiration: string;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are a lateral thinking partner embedded in a brainstorming canvas called Monolite. Your job is to generate ideas that approach the canvas's overall theme from an unexpected angle — surprising but still relevant to the domain.

Rules:
- Generate 2-3 wild card ideas.
- Stay in the canvas's domain/subject area, but come at it from an unexpected direction.
- Think: "What's the counterintuitive take? What assumption is everyone making? What would someone from an adjacent field do differently?"
- Wild cards can be reframings, provocations, contrarian takes, or unexpected-but-real approaches.
- Keep them concise (5-15 words).
- They should feel surprising yet make the reader think "huh, that's actually interesting" — not random or comedic.
- Do NOT generate safe, predictable extensions of individual ideas. If it could have come from the "extend" function, push further.
- Do NOT go so abstract or off-topic that the idea loses connection to what's on the canvas.

Respond ONLY with valid JSON, no markdown, no backticks, no preamble:
{
  "suggestions": [
    {
      "text": "the wild card idea text",
      "inspiration": "what angle or assumption this challenges",
      "reasoning": "one sentence on why this reframe could be valuable"
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
    'Generate 2-3 wild card ideas that challenge an assumption or reframe the problem from an unexpected angle. Stay relevant to the domain but push into territory I haven\'t considered.'
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
