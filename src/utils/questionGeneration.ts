import { Canvas } from '../types';
import { callClaude } from './claude';

export interface QuestionResult {
  text: string;
  relatedTo: string;
  type: 'challenge' | 'expand' | 'connect';
}

const SYSTEM_PROMPT = `You are a critical thinking partner. Your job is to generate probing questions that help the user think deeper about their ideas. Questions should challenge assumptions, reveal gaps, push toward specifics, or surface hidden connections.

Rules:
- Questions should be concise (5-15 words).
- Questions should be genuinely thought-provoking, not generic (avoid "Have you thought about X?" style questions).
- Questions should be specific to the ideas provided, not general brainstorming questions.
- Frame questions as if you're a sharp collaborator, not a teacher or interviewer.
- Mix question types: some should challenge, some should expand, some should connect.

Respond ONLY with valid JSON, no markdown, no backticks, no preamble:
{"questions": [{"text": "the question text", "relatedTo": "exact text of the idea this question targets", "type": "challenge" | "expand" | "connect"}]}`;

function parseResponse(raw: string): QuestionResult[] {
  const parsed = JSON.parse(raw) as { questions: QuestionResult[] };
  if (!Array.isArray(parsed.questions)) throw new Error('Invalid response shape');
  return parsed.questions;
}

export async function fetchQuestions(
  apiKey: string,
  canvasName: string,
  canvas: Canvas,
  mode: 'per-idea' | 'canvas-wide',
  targetIdeaId?: string
): Promise<QuestionResult[]> {
  const ideas = canvas.ideas;

  let userMessage: string;

  if (mode === 'per-idea' && targetIdeaId) {
    const target = ideas.find((i) => i.id === targetIdeaId);
    if (!target) throw new Error('Target idea not found');

    // Find connected ideas
    const connectedIds = new Set<string>();
    for (const conn of canvas.connections) {
      if (conn.sourceId === targetIdeaId) connectedIds.add(conn.targetId);
      if (conn.targetId === targetIdeaId) connectedIds.add(conn.sourceId);
    }
    const connectedTexts = ideas
      .filter((i) => connectedIds.has(i.id))
      .map((i) => i.text);

    const otherIdeas = ideas
      .filter((i) => i.id !== targetIdeaId)
      .slice(0, 20)
      .map((i) => `- ${i.text}`)
      .join('\n');

    userMessage = `Here's an idea from my canvas: "${target.text}"
Description: "${target.description || 'none'}"
Connected to: ${connectedTexts.length > 0 ? connectedTexts.map((t) => `"${t}"`).join(', ') : 'nothing'}

Other ideas on the canvas for context:
${otherIdeas || '(none)'}

Generate 2-3 probing questions about this specific idea.`;
  } else {
    // canvas-wide mode
    const ideaList = ideas
      .slice(0, 40)
      .map((idea) => {
        const connectedIds = new Set<string>();
        for (const conn of canvas.connections) {
          if (conn.sourceId === idea.id) connectedIds.add(conn.targetId);
          if (conn.targetId === idea.id) connectedIds.add(conn.sourceId);
        }
        const connectedTexts = ideas
          .filter((i) => connectedIds.has(i.id))
          .map((i) => i.text);
        const connStr = connectedTexts.length > 0 ? ` → [${connectedTexts.join(', ')}]` : '';
        return `- ${idea.text}${connStr}`;
      })
      .join('\n');

    userMessage = `Here are all the ideas on my canvas "${canvasName}":
${ideaList}

Generate 3-5 probing questions that would help me think deeper about my ideas, find gaps, or discover connections I'm missing.`;
  }

  const raw = await callClaude(apiKey, SYSTEM_PROMPT, [{ role: 'user', content: userMessage }], 512);

  let results: QuestionResult[];
  try {
    results = parseResponse(raw);
  } catch (firstErr) {
    console.warn('[fetchQuestions] First parse failed, retrying:', firstErr);
    const raw2 = await callClaude(apiKey, SYSTEM_PROMPT, [{ role: 'user', content: userMessage }], 512);
    results = parseResponse(raw2);
  }

  return results;
}
