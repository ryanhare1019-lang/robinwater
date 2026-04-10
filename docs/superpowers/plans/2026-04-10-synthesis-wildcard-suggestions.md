# Monolite — Synthesis Suggestions & Wild Card Ideas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the AI suggestion system from one type (extensions) to four modes — extend, synthesize, wild card, and all — each with distinct Claude prompts, placement logic, visual identity, and accept behavior.

**Architecture:** A new `src/utils/suggestions/` subfolder houses one module per suggestion type plus shared cluster utilities. A new orchestrator replaces the old `triggerSuggest.ts` and dispatches based on a `SuggestionMode` union. The store gains off-screen ghost tracking and per-type cooldowns. `AiControlsBar` becomes a split button exposing all four modes via a dropdown. `GhostNodeCard` reads `ghost.type` to render distinct visuals.

**Tech Stack:** React 19, TypeScript 5, Zustand, Vitest, Tauri v2

---

## File Map

**Modified:**
- `src/types.ts` — expand `GhostNode`, add `SuggestionMode`
- `src/store/useStore.ts` — new state fields, update `acceptGhostNode` for synthesis
- `src/App.tsx` — update import path, switch auto-trigger call to `triggerAutoSuggest`
- `src/components/AiControlsBar.tsx` — split button + dropdown (full rewrite)
- `src/components/GhostNodeCard.tsx` — per-type visual identity + tooltip format
- `src/components/Canvas.tsx` — render `GhostOffScreenBanner`

**Created:**
- `src/utils/suggestions/clusterUtils.ts`
- `src/utils/suggestions/clusterUtils.test.ts`
- `src/utils/suggestions/extensionSuggestions.ts`
- `src/utils/suggestions/synthesisSuggestions.ts`
- `src/utils/suggestions/wildcardSuggestions.ts`
- `src/utils/suggestions/allSuggestions.ts`
- `src/utils/suggestions/triggerSuggest.ts`
- `src/components/GhostOffScreenBanner.tsx`

**Deleted:**
- `src/utils/ghostSuggestions.ts` (replaced by `suggestions/extensionSuggestions.ts`)
- `src/utils/triggerSuggest.ts` (replaced by `suggestions/triggerSuggest.ts`)

---

## Task 1: Expand GhostNode type and add SuggestionMode

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Update GhostNode and add SuggestionMode in `src/types.ts`**

Replace the existing `GhostNode` interface (lines 62–71) with:

```typescript
export type SuggestionMode = 'extend' | 'synthesize' | 'wildcard' | 'all';

export interface GhostNode {
  id: string;
  text: string;
  type: 'extension' | 'synthesis' | 'wildcard' | 'question';
  relatedToId: string | null;       // extension: source idea id; others: null
  bridgedClusterIds?: string[][];   // synthesis only: [[ideaId,...],[ideaId,...]] per cluster
                                    // resolved from Claude's text arrays in triggerSuggest
  reasoning: string;
  inspiration?: string;             // wildcard only
  x: number;
  y: number;
  questionType?: 'challenge' | 'expand' | 'connect'; // question nodes only — unchanged
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about `type: 'suggestion'` usages in `triggerSuggest.ts` and `GhostNodeCard.tsx` — those get fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
cd ~/thinktank/robinwater
git add src/types.ts
git commit -m "types: expand GhostNode for synthesis/wildcard, add SuggestionMode"
```

---

## Task 2: Create cluster utilities

**Files:**
- Create: `src/utils/suggestions/clusterUtils.ts`
- Create: `src/utils/suggestions/clusterUtils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/suggestions/clusterUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findClusters, findLooseClusters } from './clusterUtils';
import type { Idea, Connection } from '../../types';

const makeIdea = (id: string, x = 0, y = 0): Idea => ({
  id,
  text: `idea-${id}`,
  description: '',
  x,
  y,
  createdAt: '2026-01-01T00:00:00.000Z',
  keywords: [],
});

const makeConn = (sourceId: string, targetId: string): Connection => ({
  id: `${sourceId}-${targetId}`,
  sourceId,
  targetId,
});

describe('findClusters', () => {
  it('returns empty array for no ideas', () => {
    expect(findClusters([], [])).toEqual([]);
  });

  it('each disconnected idea is its own cluster', () => {
    const ideas = [makeIdea('a'), makeIdea('b'), makeIdea('c')];
    const clusters = findClusters(ideas, []);
    expect(clusters).toHaveLength(3);
    expect(clusters.every(c => c.ideas.length === 1)).toBe(true);
  });

  it('connected ideas form one cluster', () => {
    const ideas = [makeIdea('a'), makeIdea('b'), makeIdea('c')];
    const conns = [makeConn('a', 'b'), makeConn('b', 'c')];
    const clusters = findClusters(ideas, conns);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].ideas).toHaveLength(3);
  });

  it('two separate groups form two clusters', () => {
    const ideas = [makeIdea('a'), makeIdea('b'), makeIdea('c'), makeIdea('d')];
    const conns = [makeConn('a', 'b'), makeConn('c', 'd')];
    const clusters = findClusters(ideas, conns);
    expect(clusters).toHaveLength(2);
    expect(clusters.every(c => c.ideas.length === 2)).toBe(true);
  });

  it('computes centroid as average position', () => {
    const ideas = [makeIdea('a', 0, 0), makeIdea('b', 100, 100)];
    const clusters = findClusters(ideas, [makeConn('a', 'b')]);
    expect(clusters[0].centroid).toEqual({ x: 50, y: 50 });
  });

  it('handles undirected connections (target→source also connects)', () => {
    const ideas = [makeIdea('a'), makeIdea('b')];
    const conns = [makeConn('b', 'a')]; // reversed
    const clusters = findClusters(ideas, conns);
    expect(clusters).toHaveLength(1);
  });
});

describe('findLooseClusters', () => {
  it('leaves connected clusters unchanged', () => {
    const ideas = [makeIdea('a', 0, 0), makeIdea('b', 50, 0)];
    const conns = [makeConn('a', 'b')];
    const clusters = findLooseClusters(ideas, conns, 300);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].ideas).toHaveLength(2);
  });

  it('groups nearby singletons into one loose cluster', () => {
    const ideas = [makeIdea('a', 0, 0), makeIdea('b', 100, 0), makeIdea('c', 200, 0)];
    // No connections, all within 300px of each other
    const clusters = findLooseClusters(ideas, [], 300);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].ideas).toHaveLength(3);
  });

  it('keeps singletons far apart as separate clusters', () => {
    const ideas = [makeIdea('a', 0, 0), makeIdea('b', 1000, 0)];
    const clusters = findLooseClusters(ideas, [], 300);
    expect(clusters).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd ~/thinktank/robinwater && npx vitest run src/utils/suggestions/clusterUtils.test.ts 2>&1 | tail -20
```

Expected: FAIL — `clusterUtils` module not found.

- [ ] **Step 3: Create `src/utils/suggestions/clusterUtils.ts`**

```typescript
import type { Idea, Connection } from '../../types';

export interface Cluster {
  ideas: Idea[];
  centroid: { x: number; y: number };
}

function computeCentroid(ideas: Idea[]): { x: number; y: number } {
  if (ideas.length === 0) return { x: 0, y: 0 };
  return {
    x: ideas.reduce((s, i) => s + i.x, 0) / ideas.length,
    y: ideas.reduce((s, i) => s + i.y, 0) / ideas.length,
  };
}

/** Find connected components via BFS. Each isolated idea is its own cluster. */
export function findClusters(ideas: Idea[], connections: Connection[]): Cluster[] {
  if (ideas.length === 0) return [];

  const adj = new Map<string, Set<string>>();
  for (const idea of ideas) adj.set(idea.id, new Set());
  for (const conn of connections) {
    adj.get(conn.sourceId)?.add(conn.targetId);
    adj.get(conn.targetId)?.add(conn.sourceId);
  }

  const visited = new Set<string>();
  const clusters: Cluster[] = [];

  for (const idea of ideas) {
    if (visited.has(idea.id)) continue;
    const component: Idea[] = [];
    const queue = [idea.id];
    visited.add(idea.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentIdea = ideas.find((i) => i.id === current);
      if (currentIdea) component.push(currentIdea);
      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    clusters.push({ ideas: component, centroid: computeCentroid(component) });
  }

  return clusters;
}

/**
 * Like findClusters, but also groups spatially-close singleton ideas (< proximityPx apart)
 * into loose clusters. Non-singleton connected components are never merged.
 */
export function findLooseClusters(
  ideas: Idea[],
  connections: Connection[],
  proximityPx = 300
): Cluster[] {
  const connClusters = findClusters(ideas, connections);
  const singletons = connClusters.filter((c) => c.ideas.length === 1).map((c) => c.ideas[0]);
  const nonSingletons = connClusters.filter((c) => c.ideas.length > 1);

  if (singletons.length === 0) return connClusters;

  // BFS over singletons grouped by spatial proximity
  const visited = new Set<string>();
  const looseGroups: Idea[][] = [];

  for (const s of singletons) {
    if (visited.has(s.id)) continue;
    const group: Idea[] = [s];
    visited.add(s.id);
    const queue = [s];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const other of singletons) {
        if (visited.has(other.id)) continue;
        const dx = curr.x - other.x;
        const dy = curr.y - other.y;
        if (Math.sqrt(dx * dx + dy * dy) < proximityPx) {
          visited.add(other.id);
          group.push(other);
          queue.push(other);
        }
      }
    }
    looseGroups.push(group);
  }

  return [
    ...nonSingletons,
    ...looseGroups.map((g) => ({ ideas: g, centroid: computeCentroid(g) })),
  ];
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd ~/thinktank/robinwater && npx vitest run src/utils/suggestions/clusterUtils.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/thinktank/robinwater
git add src/utils/suggestions/clusterUtils.ts src/utils/suggestions/clusterUtils.test.ts
git commit -m "feat: add clusterUtils with findClusters and findLooseClusters"
```

---

## Task 3: Create extension suggestions module

**Files:**
- Create: `src/utils/suggestions/extensionSuggestions.ts`

This is a migration of `ghostSuggestions.ts` with the type renamed from `SuggestionResult` to `ExtensionResult` and the system prompt updated to say "Monolite" instead of "Robinwater". No functional changes.

- [ ] **Step 1: Create `src/utils/suggestions/extensionSuggestions.ts`**

```typescript
import { callClaude } from '../claude';
import type { Idea, Canvas } from '../../types';

export interface ExtensionResult {
  text: string;
  relatedTo: string; // exact text of the idea this extends
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an AI thinking partner embedded in a spatial brainstorming canvas called Monolite. The user has been capturing ideas on their canvas. Your job is to suggest related ideas they might not have considered.

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

    const descStr = idea.description?.trim() || 'none';
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

function parseResponse(raw: string, triggerMode: 'manual' | 'auto'): ExtensionResult[] {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(stripped) as { suggestions: ExtensionResult[] };
  if (!Array.isArray(parsed.suggestions)) return [];
  const limit = triggerMode === 'auto' ? 2 : 5;
  return parsed.suggestions
    .filter(
      (s) =>
        typeof s.text === 'string' &&
        typeof s.relatedTo === 'string' &&
        typeof s.reasoning === 'string'
    )
    .slice(0, limit);
}

export async function fetchExtensions(
  apiKey: string,
  canvasName: string,
  ideas: Idea[],
  canvas: Canvas,
  triggerMode: 'manual' | 'auto',
  newestIdeaText?: string
): Promise<ExtensionResult[]> {
  const truncatedIdeas = ideas.slice(-40);
  const userMessage = buildUserMessage(canvasName, truncatedIdeas, canvas, triggerMode, newestIdeaText);

  const raw = await callClaude(
    apiKey,
    SYSTEM_PROMPT,
    [{ role: 'user', content: userMessage }],
    512
  );

  try {
    return parseResponse(raw, triggerMode);
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
        512
      );
      return parseResponse(raw2, triggerMode);
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1 | grep extensionSuggestions
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
cd ~/thinktank/robinwater
git add src/utils/suggestions/extensionSuggestions.ts
git commit -m "feat: add extensionSuggestions module (migrated from ghostSuggestions)"
```

---

## Task 4: Create synthesis suggestions module

**Files:**
- Create: `src/utils/suggestions/synthesisSuggestions.ts`

- [ ] **Step 1: Create `src/utils/suggestions/synthesisSuggestions.ts`**

```typescript
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

function buildUserMessage(
  canvasName: string,
  clusters: Cluster[],
  standalone: Idea[]
): string {
  const lines: string[] = [];
  lines.push(`Here are the ideas on my canvas "${canvasName}", organized by clusters:`);
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
  standalone: Idea[]
): Promise<SynthesisResult[]> {
  const userMessage = buildUserMessage(canvasName, clusters, standalone);

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
```

- [ ] **Step 2: Update `callClaude` to accept an optional model parameter**

Open `src/utils/claude.ts`. The current signature is:
```typescript
export async function callClaude(
  apiKey: string,
  systemPrompt: string,
  messages: ClaudeMessage[],
  maxTokens: number = 1024
): Promise<string>
```

Add an optional `model` parameter after `maxTokens`:

```typescript
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const CLAUDE_SONNET_MODEL = 'claude-sonnet-4-6';

export { CLAUDE_SONNET_MODEL };

export async function callClaude(
  apiKey: string,
  systemPrompt: string,
  messages: ClaudeMessage[],
  maxTokens: number = 1024,
  model: string = CLAUDE_MODEL
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '(no body)');
    throw new Error(`Claude API error ${response.status}: ${body}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  return data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1 | grep -E "synthesisSuggestions|claude\.ts" | head -10
```

Expected: no errors for these files.

- [ ] **Step 4: Commit**

```bash
cd ~/thinktank/robinwater
git add src/utils/suggestions/synthesisSuggestions.ts src/utils/claude.ts
git commit -m "feat: add synthesisSuggestions module (Sonnet, cluster-bridging prompt)"
```

---

## Task 5: Create wildcard suggestions module

**Files:**
- Create: `src/utils/suggestions/wildcardSuggestions.ts`

- [ ] **Step 1: Create `src/utils/suggestions/wildcardSuggestions.ts`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1 | grep wildcardSuggestions | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/thinktank/robinwater
git add src/utils/suggestions/wildcardSuggestions.ts
git commit -m "feat: add wildcardSuggestions module (Sonnet, creative disruption prompt)"
```

---

## Task 6: Create ALL mode module

**Files:**
- Create: `src/utils/suggestions/allSuggestions.ts`

- [ ] **Step 1: Create `src/utils/suggestions/allSuggestions.ts`**

```typescript
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

function buildUserMessage(
  canvasName: string,
  ideas: Idea[],
  canvas: Canvas,
  clusters: Cluster[],
  standalone: Idea[]
): string {
  const lines: string[] = [];
  lines.push(`Canvas: "${canvasName}"`);
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
        .filter((s) => typeof s.text === 'string' && typeof s.relatedTo === 'string')
        .slice(0, 2)
    : [];

  const synthesis = Array.isArray(parsed.synthesis)
    ? parsed.synthesis
        .filter((s) => typeof s.text === 'string' && Array.isArray(s.bridgedGroups))
        .slice(0, 1)
    : [];

  const wildcards = Array.isArray(parsed.wildcards)
    ? parsed.wildcards
        .filter((s) => typeof s.text === 'string' && typeof s.inspiration === 'string')
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1 | grep allSuggestions | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/thinktank/robinwater
git add src/utils/suggestions/allSuggestions.ts
git commit -m "feat: add allSuggestions module (Sonnet, combined prompt)"
```

---

## Task 7: Create new triggerSuggest orchestrator

**Files:**
- Create: `src/utils/suggestions/triggerSuggest.ts`

This replaces `src/utils/triggerSuggest.ts`. It handles all four modes, cooldowns, staggered appearance, off-screen detection, and auto-trigger.

- [ ] **Step 1: Create `src/utils/suggestions/triggerSuggest.ts`**

```typescript
import { useStore } from '../../store/useStore';
import type { GhostNode, SuggestionMode } from '../../types';
import { generateId } from '../id';
import { placeGhostNode } from '../ghostPlacement';
import { findLooseClusters } from './clusterUtils';
import type { Cluster } from './clusterUtils';
import { fetchExtensions } from './extensionSuggestions';
import { fetchSynthesis } from './synthesisSuggestions';
import { fetchWildcards } from './wildcardSuggestions';
import { fetchAll } from './allSuggestions';

const AUTO_COOLDOWN_MS = 30_000;

const COOLDOWN_MS: Record<SuggestionMode, number> = {
  extend: 10_000,
  synthesize: 10_000,
  wildcard: 10_000,
  all: 15_000,
};

// ─── Placement helpers ───────────────────────────────────────────────────────

function placeSynthesisNode(
  c1: Cluster,
  c2: Cluster,
  occupied: { x: number; y: number }[]
): { x: number; y: number } {
  const midX = (c1.centroid.x + c2.centroid.x) / 2;
  const midY = (c1.centroid.y + c2.centroid.y) / 2;
  const angle = Math.random() * Math.PI * 2;
  const jitter = 50 + Math.random() * 50;
  const startX = midX + Math.cos(angle) * jitter;
  const startY = midY + Math.sin(angle) * jitter;
  // Use spiral avoidance via placeGhostNode with null relatedToId and a fake viewport
  // by computing manually (spiral is private; we fake the occupied approach)
  const goldenAngle = 2.399963;
  const GHOST_W = 200, GHOST_H = 80, PAD = 24;
  const overlaps = (cx: number, cy: number) =>
    occupied.some((r) => Math.abs(cx - r.x) < GHOST_W + PAD && Math.abs(cy - r.y) < GHOST_H + PAD);
  if (!overlaps(startX, startY)) return { x: Math.round(startX), y: Math.round(startY) };
  let lastX = startX, lastY = startY;
  for (let i = 1; i <= 40; i++) {
    const cx = startX + Math.cos(i * goldenAngle) * (i * 50);
    const cy = startY + Math.sin(i * goldenAngle) * (i * 50);
    lastX = cx; lastY = cy;
    if (!overlaps(cx, cy)) return { x: Math.round(cx), y: Math.round(cy) };
  }
  return { x: Math.round(lastX), y: Math.round(lastY) };
}

function placeWildcardNodes(
  ideas: { x: number; y: number }[],
  count: number
): Array<{ x: number; y: number }> {
  if (ideas.length === 0) {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return { x: Math.round(Math.cos(angle) * 800), y: Math.round(Math.sin(angle) * 800) };
    });
  }

  const minX = Math.min(...ideas.map((i) => i.x));
  const maxX = Math.max(...ideas.map((i) => i.x));
  const minY = Math.min(...ideas.map((i) => i.y));
  const maxY = Math.max(...ideas.map((i) => i.y));

  const edges: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right'];
  // Fisher-Yates shuffle
  for (let i = edges.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [edges[i], edges[j]] = [edges[j], edges[i]];
  }

  return Array.from({ length: Math.min(count, 4) }, (_, i) => {
    const edge = edges[i];
    const offset = 200 + Math.random() * 200;
    let x: number, y: number;
    switch (edge) {
      case 'top':
        x = minX + Math.random() * Math.max(maxX - minX, 1);
        y = minY - offset;
        break;
      case 'bottom':
        x = minX + Math.random() * Math.max(maxX - minX, 1);
        y = maxY + offset;
        break;
      case 'left':
        x = minX - offset;
        y = minY + Math.random() * Math.max(maxY - minY, 1);
        break;
      case 'right':
      default:
        x = maxX + offset;
        y = minY + Math.random() * Math.max(maxY - minY, 1);
        break;
    }
    return { x: Math.round(x), y: Math.round(y) };
  });
}

function isOffScreen(
  ghostX: number,
  ghostY: number,
  viewport: { x: number; y: number; zoom: number }
): boolean {
  const screenX = ghostX * viewport.zoom + viewport.x;
  const screenY = ghostY * viewport.zoom + viewport.y;
  return (
    screenX < -200 ||
    screenX > window.innerWidth + 200 ||
    screenY < -200 ||
    screenY > window.innerHeight + 200
  );
}

function computeDirection(
  ghosts: Array<{ x: number; y: number }>,
  viewport: { x: number; y: number; zoom: number }
): 'N' | 'S' | 'E' | 'W' {
  const avgX = ghosts.reduce((s, g) => s + g.x, 0) / ghosts.length;
  const avgY = ghosts.reduce((s, g) => s + g.y, 0) / ghosts.length;
  const screenX = avgX * viewport.zoom + viewport.x;
  const screenY = avgY * viewport.zoom + viewport.y;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const dx = screenX - cx;
  const dy = screenY - cy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'E' : 'W';
  return dy > 0 ? 'S' : 'N';
}

// ─── Text → ID resolution ────────────────────────────────────────────────────

function resolveTextsToIds(
  textGroups: string[][],
  ideas: Array<{ id: string; text: string }>
): string[][] {
  return textGroups.map((group) =>
    group
      .map((text) => ideas.find((i) => i.text === text)?.id)
      .filter((id): id is string => Boolean(id))
  );
}

// ─── Main exports ─────────────────────────────────────────────────────────────

/** Triggered automatically 3s after a new idea is added. Extension-only. */
export async function triggerAutoSuggest(newestIdeaText?: string): Promise<void> {
  const state = useStore.getState();
  const { config, canvases, activeCanvasId, addGhostNodes, setSuggestLoading, lastAutoTriggerAt, setLastAutoTriggerAt } = state;

  if (!config?.anthropicApiKey) return;
  if (!config.aiFeatures.ghostNodes) return;

  const now = Date.now();
  if (now - lastAutoTriggerAt < AUTO_COOLDOWN_MS) return;

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  if (!canvas || canvas.ideas.length < 2) return;

  setSuggestLoading(true);
  setLastAutoTriggerAt(Date.now());

  try {
    const suggestions = await fetchExtensions(
      config.anthropicApiKey,
      canvas.name,
      canvas.ideas,
      canvas,
      'auto',
      newestIdeaText
    );

    const freshState = useStore.getState();
    if (freshState.activeCanvasId !== activeCanvasId) return;
    const freshCanvas = freshState.canvases.find((c) => c.id === freshState.activeCanvasId);
    const viewport = freshCanvas?.viewport ?? { x: 0, y: 0, zoom: 1 };
    const freshIdeas = freshCanvas?.ideas ?? canvas.ideas;

    const placedGhosts: { x: number; y: number }[] = [];
    const ghostNodes: GhostNode[] = suggestions.map((s) => {
      const relatedIdea = freshIdeas.find((i) => i.text === s.relatedTo);
      const { x, y } = placeGhostNode(relatedIdea?.id ?? null, freshIdeas, viewport, placedGhosts);
      placedGhosts.push({ x, y });
      return {
        id: generateId(),
        text: s.text,
        type: 'extension' as const,
        relatedToId: relatedIdea?.id ?? null,
        reasoning: s.reasoning,
        x,
        y,
      };
    });

    addGhostNodes(ghostNodes);
  } catch (e) {
    console.error('[triggerAutoSuggest] error:', e);
  } finally {
    setSuggestLoading(false);
  }
}

/** Manual trigger for a specific suggestion mode. */
export async function triggerSuggest(mode: SuggestionMode): Promise<void> {
  const state = useStore.getState();
  const {
    config,
    canvases,
    activeCanvasId,
    addGhostNodes,
    setSuggestLoading,
    setActiveSuggestMode,
    setSuggestCooldown,
    suggestCooldowns,
    setOffScreenGhosts,
  } = state;

  if (!config?.anthropicApiKey) return;
  if (!config.aiFeatures.ghostNodes) return;

  // Rate limit check
  if (Date.now() < suggestCooldowns[mode]) return;

  const canvas = canvases.find((c) => c.id === activeCanvasId);
  if (!canvas) return;

  const ideas = canvas.ideas;

  setSuggestLoading(true);
  setActiveSuggestMode(mode);

  // Compute clusters once (needed for synthesis, wildcard, all)
  const allClusters = findLooseClusters(ideas, canvas.connections);
  const standalone = allClusters.filter((c) => c.ideas.length === 1).flatMap((c) => c.ideas);
  const multiClusters = allClusters.filter((c) => c.ideas.length > 1);

  try {
    const freshStatePre = useStore.getState();
    if (freshStatePre.activeCanvasId !== activeCanvasId) return;

    if (mode === 'extend') {
      if (ideas.length < 2) return;
      const suggestions = await fetchExtensions(config.anthropicApiKey, canvas.name, ideas, canvas, 'manual');
      const freshState = useStore.getState();
      if (freshState.activeCanvasId !== activeCanvasId) return;
      const freshCanvas = freshState.canvases.find((c) => c.id === activeCanvasId)!;
      const viewport = freshCanvas.viewport;
      const freshIdeas = freshCanvas.ideas;

      const placedGhosts: { x: number; y: number }[] = [];
      const ghosts: GhostNode[] = suggestions.map((s) => {
        const relatedIdea = freshIdeas.find((i) => i.text === s.relatedTo);
        const { x, y } = placeGhostNode(relatedIdea?.id ?? null, freshIdeas, viewport, placedGhosts);
        placedGhosts.push({ x, y });
        return { id: generateId(), text: s.text, type: 'extension' as const, relatedToId: relatedIdea?.id ?? null, reasoning: s.reasoning, x, y };
      });
      addGhostNodes(ghosts);

    } else if (mode === 'synthesize') {
      const distinctClusters = findLooseClusters(ideas, canvas.connections).filter((c) => c.ideas.length >= 1);
      const canSynthesize = distinctClusters.length >= 2 || ideas.length >= 6;
      if (!canSynthesize) return; // caller shows error message

      const suggestions = await fetchSynthesis(config.anthropicApiKey, canvas.name, multiClusters, standalone);
      const freshState = useStore.getState();
      if (freshState.activeCanvasId !== activeCanvasId) return;
      const freshCanvas = freshState.canvases.find((c) => c.id === activeCanvasId)!;
      const freshIdeas = freshCanvas.ideas;
      const viewport = freshCanvas.viewport;

      const placedGhosts: { x: number; y: number }[] = [];
      const offScreenGhostItems: Array<{ id: string; x: number; y: number }> = [];

      const ghosts: GhostNode[] = suggestions.map((s) => {
        // Find the two clusters being bridged
        let c1: Cluster | undefined;
        let c2: Cluster | undefined;
        for (const group of s.bridgedGroups) {
          const matchingCluster = allClusters.find((cl) =>
            cl.ideas.some((idea) => group.includes(idea.text))
          );
          if (!c1) c1 = matchingCluster;
          else if (matchingCluster && matchingCluster !== c1) { c2 = matchingCluster; break; }
        }

        let x: number, y: number;
        if (c1 && c2) {
          const pos = placeSynthesisNode(c1, c2, placedGhosts);
          x = pos.x; y = pos.y;
        } else {
          // Fall back to canvas centroid
          const cx = freshIdeas.reduce((sum, i) => sum + i.x, 0) / Math.max(freshIdeas.length, 1);
          const cy = freshIdeas.reduce((sum, i) => sum + i.y, 0) / Math.max(freshIdeas.length, 1);
          const angle = Math.random() * Math.PI * 2;
          const jitter = 50 + Math.random() * 100;
          x = Math.round(cx + Math.cos(angle) * jitter);
          y = Math.round(cy + Math.sin(angle) * jitter);
        }

        placedGhosts.push({ x, y });

        // Resolve bridgedGroups texts → IDs
        const bridgedClusterIds = resolveTextsToIds(s.bridgedGroups, freshIdeas);
        const id = generateId();

        if (isOffScreen(x, y, viewport)) offScreenGhostItems.push({ id, x, y });

        return { id, text: s.text, type: 'synthesis' as const, relatedToId: null, bridgedClusterIds, reasoning: s.reasoning, x, y };
      });

      addGhostNodes(ghosts);

      if (offScreenGhostItems.length > 0) {
        setOffScreenGhosts({
          count: offScreenGhostItems.length,
          type: 'synthesis',
          direction: computeDirection(offScreenGhostItems, viewport),
          ids: offScreenGhostItems.map((g) => g.id),
        });
      }

    } else if (mode === 'wildcard') {
      const suggestions = await fetchWildcards(config.anthropicApiKey, canvas.name, ideas);
      const freshState = useStore.getState();
      if (freshState.activeCanvasId !== activeCanvasId) return;
      const freshCanvas = freshState.canvases.find((c) => c.id === activeCanvasId)!;
      const freshIdeas = freshCanvas.ideas;
      const viewport = freshCanvas.viewport;

      const positions = placeWildcardNodes(freshIdeas, suggestions.length);
      const offScreenGhostItems: Array<{ id: string; x: number; y: number }> = [];

      const ghosts: GhostNode[] = suggestions.map((s, i) => {
        const { x, y } = positions[i] ?? { x: 0, y: 0 };
        const id = generateId();
        if (isOffScreen(x, y, viewport)) offScreenGhostItems.push({ id, x, y });
        return { id, text: s.text, type: 'wildcard' as const, relatedToId: null, reasoning: s.reasoning, inspiration: s.inspiration, x, y };
      });

      addGhostNodes(ghosts);

      if (offScreenGhostItems.length > 0) {
        setOffScreenGhosts({
          count: offScreenGhostItems.length,
          type: 'wildcard',
          direction: computeDirection(offScreenGhostItems, viewport),
          ids: offScreenGhostItems.map((g) => g.id),
        });
      }

    } else if (mode === 'all') {
      const results = await fetchAll(config.anthropicApiKey, canvas.name, ideas, canvas, multiClusters, standalone);
      const freshState = useStore.getState();
      if (freshState.activeCanvasId !== activeCanvasId) return;
      const freshCanvas = freshState.canvases.find((c) => c.id === activeCanvasId)!;
      const freshIdeas = freshCanvas.ideas;
      const viewport = freshCanvas.viewport;

      // Build extension ghosts
      const placedGhosts: { x: number; y: number }[] = [];
      const extensionGhosts: GhostNode[] = results.extensions.map((s) => {
        const relatedIdea = freshIdeas.find((i) => i.text === s.relatedTo);
        const { x, y } = placeGhostNode(relatedIdea?.id ?? null, freshIdeas, viewport, placedGhosts);
        placedGhosts.push({ x, y });
        return { id: generateId(), text: s.text, type: 'extension' as const, relatedToId: relatedIdea?.id ?? null, reasoning: s.reasoning, x, y };
      });

      // Build synthesis ghosts
      const synthesisGhosts: GhostNode[] = results.synthesis.map((s) => {
        let c1: Cluster | undefined;
        let c2: Cluster | undefined;
        for (const group of s.bridgedGroups) {
          const matchingCluster = allClusters.find((cl) => cl.ideas.some((idea) => group.includes(idea.text)));
          if (!c1) c1 = matchingCluster;
          else if (matchingCluster && matchingCluster !== c1) { c2 = matchingCluster; break; }
        }
        let x: number, y: number;
        if (c1 && c2) {
          const pos = placeSynthesisNode(c1, c2, placedGhosts);
          x = pos.x; y = pos.y;
        } else {
          const cx = freshIdeas.reduce((sum, i) => sum + i.x, 0) / Math.max(freshIdeas.length, 1);
          const cy = freshIdeas.reduce((sum, i) => sum + i.y, 0) / Math.max(freshIdeas.length, 1);
          x = Math.round(cx + (Math.random() - 0.5) * 200);
          y = Math.round(cy + (Math.random() - 0.5) * 200);
        }
        placedGhosts.push({ x, y });
        const bridgedClusterIds = resolveTextsToIds(s.bridgedGroups, freshIdeas);
        return { id: generateId(), text: s.text, type: 'synthesis' as const, relatedToId: null, bridgedClusterIds, reasoning: s.reasoning, x, y };
      });

      // Build wildcard ghosts
      const wildcardPositions = placeWildcardNodes(freshIdeas, results.wildcards.length);
      const offScreenGhostItems: Array<{ id: string; x: number; y: number }> = [];
      const wildcardGhosts: GhostNode[] = results.wildcards.map((s, i) => {
        const { x, y } = wildcardPositions[i] ?? { x: 0, y: 0 };
        const id = generateId();
        if (isOffScreen(x, y, viewport)) offScreenGhostItems.push({ id, x, y });
        return { id, text: s.text, type: 'wildcard' as const, relatedToId: null, reasoning: s.reasoning, inspiration: s.inspiration, x, y };
      });

      // Staggered appearance
      addGhostNodes(extensionGhosts);
      setTimeout(() => {
        if (useStore.getState().activeCanvasId === activeCanvasId) {
          useStore.getState().addGhostNodes(synthesisGhosts);
        }
      }, 800);
      setTimeout(() => {
        if (useStore.getState().activeCanvasId === activeCanvasId) {
          useStore.getState().addGhostNodes(wildcardGhosts);
          if (offScreenGhostItems.length > 0) {
            useStore.getState().setOffScreenGhosts({
              count: offScreenGhostItems.length,
              type: 'wildcard',
              direction: computeDirection(offScreenGhostItems, viewport),
              ids: offScreenGhostItems.map((g) => g.id),
            });
          }
        }
      }, 1600);
    }

    setSuggestCooldown(mode, Date.now() + COOLDOWN_MS[mode]);
  } catch (e) {
    console.error(`[triggerSuggest:${mode}] error:`, e);
  } finally {
    setSuggestLoading(false);
    setActiveSuggestMode(null);
  }
}
```

- [ ] **Step 2: Verify TypeScript (will have errors until store is updated in next task)**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1 | grep "suggestions/triggerSuggest" | head -20
```

Expected: errors about `setActiveSuggestMode`, `setSuggestCooldown`, `suggestCooldowns`, `setOffScreenGhosts` — these get added in the next task.

- [ ] **Step 3: Commit**

```bash
cd ~/thinktank/robinwater
git add src/utils/suggestions/triggerSuggest.ts
git commit -m "feat: add triggerSuggest orchestrator with all 4 suggestion modes"
```

---

## Task 8: Update store

**Files:**
- Modify: `src/store/useStore.ts`

- [ ] **Step 1: Add new state types and fields to the `AppState` interface**

In the `AppState` interface (after line 180 `setAiPanelOpen`), add:

```typescript
  // Active suggestion mode (drives loading text)
  activeSuggestMode: SuggestionMode | null;
  setActiveSuggestMode: (m: SuggestionMode | null) => void;

  // Per-type suggestion cooldowns (unix timestamp until which mode is cooling down)
  suggestCooldowns: Record<SuggestionMode, number>;
  setSuggestCooldown: (mode: SuggestionMode, until: number) => void;

  // Off-screen ghost notification
  offScreenGhosts: {
    count: number;
    type: 'synthesis' | 'wildcard';
    direction: 'N' | 'S' | 'E' | 'W' | null;
    ids: string[];
  } | null;
  setOffScreenGhosts: (v: AppState['offScreenGhosts']) => void;
  clearOffScreenGhosts: () => void;
```

Also add the import for `SuggestionMode` at the top of the file:

```typescript
import { Idea, Viewport, AppData, Canvas, Connection, CustomTag, GhostNode, AITagDefinition, TAG_COLORS, CanvasFolder, SuggestionMode } from "../types";
```

- [ ] **Step 2: Add initial values in the `create` call**

After `isSuggestLoading: false,` (around line 221), add:

```typescript
    activeSuggestMode: null,
    suggestCooldowns: { extend: 0, synthesize: 0, wildcard: 0, all: 0 },
    offScreenGhosts: null,
```

- [ ] **Step 3: Add action implementations**

After `setQuestionsLoading: (v) => set({ isQuestionsLoading: v }),` add:

```typescript
    setActiveSuggestMode: (m) => set({ activeSuggestMode: m }),
    setSuggestCooldown: (mode, until) =>
      set((state) => ({ suggestCooldowns: { ...state.suggestCooldowns, [mode]: until } })),
    setOffScreenGhosts: (v) => set({ offScreenGhosts: v }),
    clearOffScreenGhosts: () => set({ offScreenGhosts: null }),
```

- [ ] **Step 4: Update `switchCanvas` to also clear offScreenGhosts**

In the `switchCanvas` action, add `offScreenGhosts: null` to the set call (alongside existing `ghostNodes: []`):

```typescript
    switchCanvas: (id) => {
      const state = get();
      const canvas = state.canvases.find((c) => c.id === id);
      if (canvas) {
        undoStack.length = 0;
        redoStack.length = 0;
        set({
          activeCanvasId: id,
          selectedId: null,
          selectedIds: [],
          newNodeId: null,
          connectingFrom: null,
          similarityLines: computeSimilarityLines(canvas.ideas, canvas.connections),
          ghostNodes: [],
          offScreenGhosts: null,
        });
      }
    },
```

- [ ] **Step 5: Update `acceptGhostNode` to handle synthesis bridging**

In `acceptGhostNode`, after the existing block that creates a connection for `relatedToId` (around line 608–612), add synthesis bridging logic. The full updated section after idea creation:

```typescript
      let connections = canvas.connections;

      // Extension: connect to relatedToId
      if (ghost.type !== 'synthesis' && ghost.relatedToId && canvas.ideas.find((i) => i.id === ghost.relatedToId)) {
        const conn: Connection = { id: generateId(), sourceId: ghost.relatedToId, targetId: idea.id };
        connections = [...connections, conn];
      }

      // Synthesis: connect to the closest idea in each bridged cluster
      if (ghost.type === 'synthesis' && ghost.bridgedClusterIds) {
        for (const clusterIds of ghost.bridgedClusterIds) {
          let closestId: string | null = null;
          let closestDist = Infinity;
          for (const cid of clusterIds) {
            const clusterIdea = canvas.ideas.find((i) => i.id === cid);
            if (!clusterIdea) continue;
            const dx = clusterIdea.x - idea.x;
            const dy = clusterIdea.y - idea.y;
            const dist = dx * dx + dy * dy;
            if (dist < closestDist) { closestDist = dist; closestId = cid; }
          }
          if (closestId) {
            const alreadyConnected = connections.some(
              (c) =>
                (c.sourceId === closestId && c.targetId === idea.id) ||
                (c.sourceId === idea.id && c.targetId === closestId)
            );
            if (!alreadyConnected) {
              connections = [...connections, { id: generateId(), sourceId: closestId, targetId: idea.id }];
            }
          }
        }
      }
```

Replace the old connection block (the `if (relatedToId && ...)` check) with the above.

- [ ] **Step 6: Verify TypeScript compiles cleanly**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors (all new types and fields now align).

- [ ] **Step 7: Run all tests**

```bash
cd ~/thinktank/robinwater && npm test
```

Expected: all passing (clusterUtils tests still pass).

- [ ] **Step 8: Commit**

```bash
cd ~/thinktank/robinwater
git add src/store/useStore.ts
git commit -m "feat: add activeSuggestMode, suggestCooldowns, offScreenGhosts to store; synthesis accept logic"
```

---

## Task 9: Update GhostNodeCard for per-type visual identity

**Files:**
- Modify: `src/components/GhostNodeCard.tsx`

- [ ] **Step 1: Rewrite `GhostNodeCard.tsx` with per-type styles**

Replace the file entirely with:

```typescript
import { useState, useCallback, useRef } from "react";
import { GhostNode } from "../types";
import { useStore } from "../store/useStore";
import { getDetailLevelWithHysteresis, type DetailLevel } from "../utils/zoom";

interface Props {
  ghost: GhostNode;
}

interface GhostStyle {
  border: string;
  background: string;
  textColor: string;
  label: string;
  labelColor: string;
  acceptHoverColor: string;
  pulseAnimation: string;
  tooltipPrefix: string;
}

function getGhostStyle(type: GhostNode['type'], questionType?: string): GhostStyle {
  switch (type) {
    case 'synthesis':
      return {
        border: '1px dashed #2A2A3A',
        background: 'rgba(10,10,14,0.5)',
        textColor: '#8888AA',
        label: '◆ SYNTHESIS',
        labelColor: '#4466AA',
        acceptHoverColor: '#4466AA',
        pulseAnimation: 'ghost-pulse-slow 3s ease-in-out infinite',
        tooltipPrefix: 'BRIDGES',
      };
    case 'wildcard':
      return {
        border: '1px dashed #3A2A1A',
        background: 'rgba(14,10,8,0.5)',
        textColor: '#AAAA77',
        label: '✸ WILD CARD',
        labelColor: '#CC8844',
        acceptHoverColor: '#CC8844',
        pulseAnimation: 'ghost-pulse-fast 2s ease-in-out infinite',
        tooltipPrefix: 'INSPIRED BY',
      };
    case 'question':
      return {
        border: '1px dashed #3A3520',
        background: 'rgba(10,10,10,0.5)',
        textColor: '#888888',
        label: `? ${questionType?.toUpperCase() || 'QUESTION'}`,
        labelColor: '#CCAA44',
        acceptHoverColor: '#CCAA44',
        pulseAnimation: 'ghost-pulse-slow 3s ease-in-out infinite',
        tooltipPrefix: 'QUESTION',
      };
    case 'extension':
    default:
      return {
        border: '1px dashed #2A2A2A',
        background: 'rgba(10,10,10,0.5)',
        textColor: '#888888',
        label: '✦ SUGGESTED',
        labelColor: '#444444',
        acceptHoverColor: '#44AA66',
        pulseAnimation: 'ghost-pulse-slow 3s ease-in-out infinite',
        tooltipPrefix: 'EXTENDS',
      };
  }
}

function buildTooltip(ghost: GhostNode, prefix: string): string {
  switch (ghost.type) {
    case 'synthesis': {
      const themes = (ghost.bridgedClusterIds ?? [])
        .map((ids) => ids[0] ?? '')
        .filter(Boolean)
        .slice(0, 2)
        .join(' × ');
      return themes
        ? `${prefix}: ${themes} — ${ghost.reasoning}`
        : `${prefix}: ${ghost.reasoning}`;
    }
    case 'wildcard':
      return ghost.inspiration
        ? `${prefix}: ${ghost.inspiration} — ${ghost.reasoning}`
        : ghost.reasoning;
    default:
      return `${prefix}: ${ghost.reasoning}`;
  }
}

export function GhostNodeCard({ ghost }: Props) {
  const acceptGhostNode = useStore((s) => s.acceptGhostNode);
  const dismissGhostNode = useStore((s) => s.dismissGhostNode);

  const [isHovered, setIsHovered] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [acceptHovered, setAcceptHovered] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);

  const zoom = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport.zoom ?? 1;
  });
  const detailLevelRef = useRef<DetailLevel>('full');
  const detailLevel = getDetailLevelWithHysteresis(zoom, detailLevelRef.current);
  detailLevelRef.current = detailLevel;

  const style = getGhostStyle(ghost.type, ghost.questionType);

  const handleAccept = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); acceptGhostNode(ghost.id); },
    [ghost.id, acceptGhostNode]
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDismissing(true);
      setTimeout(() => dismissGhostNode(ghost.id), 200);
    },
    [ghost.id, dismissGhostNode]
  );

  const ghostText =
    detailLevel === 'minimal'
      ? ghost.text.length > 25 ? ghost.text.slice(0, 25) + '…' : ghost.text
      : ghost.text;

  const tooltipText = buildTooltip(ghost, style.tooltipPrefix);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setAcceptHovered(false); setDismissHovered(false); }}
      style={{
        position: "absolute",
        left: ghost.x,
        top: ghost.y,
        minWidth: detailLevel === 'minimal' ? 80 : 140,
        width: detailLevel === 'minimal' ? undefined : 180,
        maxWidth: detailLevel === 'minimal' ? 180 : undefined,
        padding: detailLevel === 'full' ? "12px" : detailLevel === 'compact' ? "8px 10px" : "5px 8px",
        background: style.background,
        border: style.border,
        borderRadius: 0,
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        color: style.textColor,
        userSelect: "none",
        opacity: isDismissing ? 0 : undefined,
        transform: isDismissing ? "scale(0)" : "scale(1)",
        animation: isDismissing ? undefined : style.pulseAnimation,
        transition: isDismissing
          ? "transform 0.2s ease-in, opacity 0.2s ease-in"
          : "opacity 0.15s ease, padding 0.15s ease",
        zIndex: isHovered ? 50 : 5,
        pointerEvents: "auto",
        overflow: "hidden",
      }}
    >
      {/* Tooltip */}
      {isHovered && tooltipText && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 6,
            maxWidth: 280,
            background: "#111111",
            border: "1px solid #1A1A1A",
            padding: "6px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "#666666",
            lineHeight: 1.4,
            wordBreak: "break-word",
            whiteSpace: "normal",
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          {tooltipText}
        </div>
      )}

      {/* Text */}
      <div
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          lineHeight: 1.4,
          wordBreak: detailLevel === 'minimal' ? undefined : "break-word",
          whiteSpace: detailLevel === 'minimal' ? 'nowrap' : undefined,
          overflow: "hidden",
          textOverflow: detailLevel === 'minimal' ? 'ellipsis' : undefined,
          marginBottom: detailLevel === 'full' ? 8 : 0,
          display: detailLevel === 'compact' ? '-webkit-box' : undefined,
          WebkitLineClamp: detailLevel === 'compact' ? 2 : undefined,
          WebkitBoxOrient: detailLevel === 'compact' ? 'vertical' : undefined,
          transition: "margin-bottom 0.15s ease",
        }}
      >
        {ghostText}
      </div>

      {/* Bottom row — full level only */}
      <div
        style={{
          maxHeight: detailLevel === 'full' ? '40px' : '0px',
          opacity: detailLevel === 'full' ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.15s ease, opacity 0.12s ease',
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: "10px", color: style.labelColor, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {style.label}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onMouseEnter={() => setAcceptHovered(true)}
              onMouseLeave={() => setAcceptHovered(false)}
              onClick={handleAccept}
              style={{
                width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent",
                border: `1px solid ${acceptHovered ? style.acceptHoverColor : "#2A2A2A"}`,
                color: acceptHovered ? style.acceptHoverColor : "#444444",
                cursor: "pointer", fontSize: "13px", fontFamily: "var(--font-mono)", padding: 0,
                transition: "border-color 0.15s, color 0.15s", flexShrink: 0,
              }}
              title="Accept"
            >✓</button>
            <button
              onMouseEnter={() => setDismissHovered(true)}
              onMouseLeave={() => setDismissHovered(false)}
              onClick={handleDismiss}
              style={{
                width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent",
                border: `1px solid ${dismissHovered ? "#CC4444" : "#2A2A2A"}`,
                color: dismissHovered ? "#CC4444" : "#444444",
                cursor: "pointer", fontSize: "13px", fontFamily: "var(--font-mono)", padding: 0,
                transition: "border-color 0.15s, color 0.15s", flexShrink: 0,
              }}
              title="Dismiss"
            >✕</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS keyframes for `ghost-pulse-slow` and `ghost-pulse-fast` to `src/styles/global.css`**

Find the existing `ai-btn-pulse` animation in `global.css` and add after it:

```css
@keyframes ghost-pulse-slow {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.65; }
}

@keyframes ghost-pulse-fast {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.7; }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1 | grep GhostNodeCard | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/thinktank/robinwater
git add src/components/GhostNodeCard.tsx src/styles/global.css
git commit -m "feat: per-type visual identity in GhostNodeCard (synthesis, wildcard, extension, question)"
```

---

## Task 10: Create GhostOffScreenBanner component

**Files:**
- Create: `src/components/GhostOffScreenBanner.tsx`

- [ ] **Step 1: Create `src/components/GhostOffScreenBanner.tsx`**

```typescript
import { useEffect } from "react";
import { useStore } from "../store/useStore";

const DIRECTION_ARROW: Record<string, string> = {
  N: '↑', S: '↓', E: '→', W: '←',
};

export function GhostOffScreenBanner() {
  const offScreenGhosts = useStore((s) => s.offScreenGhosts);
  const clearOffScreenGhosts = useStore((s) => s.clearOffScreenGhosts);
  const setViewport = useStore((s) => s.setViewport);
  const ghostNodes = useStore((s) => s.ghostNodes);
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);

  // Auto-clear after 5 seconds
  useEffect(() => {
    if (!offScreenGhosts) return;
    const timer = setTimeout(() => clearOffScreenGhosts(), 5000);
    return () => clearTimeout(timer);
  }, [offScreenGhosts, clearOffScreenGhosts]);

  if (!offScreenGhosts) return null;

  const icon = offScreenGhosts.type === 'wildcard' ? '✸' : '◆';
  const label = offScreenGhosts.type === 'wildcard' ? 'WILD CARD' : 'SYNTHESIS';
  const arrow = offScreenGhosts.direction ? DIRECTION_ARROW[offScreenGhosts.direction] : '→';
  const count = offScreenGhosts.count;

  function handleClick() {
    const targetGhosts = ghostNodes.filter((g) => offScreenGhosts!.ids.includes(g.id));
    if (targetGhosts.length === 0) { clearOffScreenGhosts(); return; }

    const avgX = targetGhosts.reduce((s, g) => s + g.x, 0) / targetGhosts.length;
    const avgY = targetGhosts.reduce((s, g) => s + g.y, 0) / targetGhosts.length;

    const canvas = canvases.find((c) => c.id === activeCanvasId);
    const vp = canvas?.viewport ?? { x: 0, y: 0, zoom: 1 };

    setViewport({
      x: -avgX * vp.zoom + window.innerWidth / 2,
      y: -avgY * vp.zoom + window.innerHeight / 2,
    });

    clearOffScreenGhosts();
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: '#0E0E0E',
        border: '1px solid #222222',
        borderRadius: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: offScreenGhosts.type === 'wildcard' ? '#CC8844' : '#4466AA',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
    >
      {icon} {count} {label}{count !== 1 ? 'S' : ''} {arrow}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1 | grep GhostOffScreenBanner | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/thinktank/robinwater
git add src/components/GhostOffScreenBanner.tsx
git commit -m "feat: add GhostOffScreenBanner component for off-screen ghost notification"
```

---

## Task 11: Refactor AiControlsBar into split button with dropdown

**Files:**
- Modify: `src/components/AiControlsBar.tsx`

- [ ] **Step 1: Rewrite `AiControlsBar.tsx`**

```typescript
import { useState, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";
import { triggerAutoTag, getHasAiTags } from "../utils/triggerAutoTag";
import { triggerSuggest } from "../utils/suggestions/triggerSuggest";
import { triggerQuestions } from "../utils/triggerQuestions";
import type { SuggestionMode } from "../types";

const BASE_BUTTON_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#444444",
  border: "1px solid #1A1A1A",
  background: "#080808",
  padding: "6px 10px",
  borderRadius: 0,
  cursor: "pointer",
  transition: "border-color 0.1s ease, color 0.1s ease, opacity 0.1s ease",
  whiteSpace: "nowrap" as const,
};

const MENU_ITEMS: Array<{ mode: SuggestionMode; icon: string; label: string; iconColor: string }> = [
  { mode: 'extend',    icon: '✦', label: 'EXTEND',        iconColor: '#444444' },
  { mode: 'synthesize',icon: '◆', label: 'SYNTHESIZE',    iconColor: '#4466AA' },
  { mode: 'wildcard',  icon: '✸', label: 'WILD CARD',     iconColor: '#CC8844' },
  { mode: 'all',       icon: '✦', label: 'ALL (DEFAULT)', iconColor: '#444444' },
];

const LOADING_TEXT: Record<SuggestionMode, string> = {
  extend:    '✦ EXTENDING...',
  synthesize:'◆ SYNTHESIZING...',
  wildcard:  '✸ WILDCARDING...',
  all:       '✦ THINKING...',
};

export function AiControlsBar() {
  const config = useStore((s) => s.config);
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const isAutoTagLoading = useStore((s) => s.isAutoTagLoading);
  const setSettingsModalOpen = useStore((s) => s.setSettingsModalOpen);
  const isSuggestLoading = useStore((s) => s.isSuggestLoading);
  const isQuestionsLoading = useStore((s) => s.isQuestionsLoading);
  const activeSuggestMode = useStore((s) => s.activeSuggestMode);
  const suggestCooldowns = useStore((s) => s.suggestCooldowns);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [autoTagError, setAutoTagError] = useState<string | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [reTagPending, setReTagPending] = useState(false);
  const reTagTimer = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const arrowBtnRef = useRef<HTMLButtonElement>(null);

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);
  const ideaCount = activeCanvas?.ideas.length ?? 0;

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function onDown(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        arrowBtnRef.current && !arrowBtnRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [dropdownOpen]);

  useEffect(() => {
    return () => { if (reTagTimer.current) clearTimeout(reTagTimer.current); };
  }, []);

  async function handleSuggestMode(mode: SuggestionMode) {
    setDropdownOpen(false);
    if (!config?.anthropicApiKey) { setSettingsModalOpen(true); return; }
    if (isSuggestLoading || isAutoTagLoading || isQuestionsLoading) return;

    const now = Date.now();
    if (now < suggestCooldowns[mode]) return; // still cooling down

    // Check minimum requirements per mode
    if (mode === 'extend' && ideaCount < 2) {
      setSuggestError('✦ NEED MORE IDEAS');
      setTimeout(() => setSuggestError(null), 2000);
      return;
    }
    if (mode === 'synthesize') {
      const canvas = canvases.find((c) => c.id === activeCanvasId);
      const hasConnections = (canvas?.connections.length ?? 0) > 0;
      const enoughIdeas = ideaCount >= 6;
      if (!hasConnections && !enoughIdeas) {
        setSuggestError('◆ NEED MORE CLUSTERS');
        setTimeout(() => setSuggestError(null), 2000);
        return;
      }
    }
    if ((mode === 'all') && ideaCount < 2) {
      setSuggestError('✦ NEED MORE IDEAS');
      setTimeout(() => setSuggestError(null), 2000);
      return;
    }

    try {
      await triggerSuggest(mode);
    } catch (err) {
      console.error(`[Suggest:${mode}] error:`, err);
      setSuggestError('✦ ERROR');
      setTimeout(() => setSuggestError(null), 3000);
    }
  }

  async function handleAutoTag() {
    if (!config?.anthropicApiKey) { setSettingsModalOpen(true); return; }
    if (isAutoTagLoading) return;
    if (ideaCount < 2) {
      setAutoTagError('◈ NEED MORE IDEAS');
      setTimeout(() => setAutoTagError(null), 2000);
      return;
    }
    if (getHasAiTags()) {
      if (!reTagPending) {
        setReTagPending(true);
        if (reTagTimer.current) clearTimeout(reTagTimer.current);
        reTagTimer.current = setTimeout(() => setReTagPending(false), 3000);
        return;
      }
      setReTagPending(false);
      if (reTagTimer.current) clearTimeout(reTagTimer.current);
    }
    try {
      await triggerAutoTag();
    } catch (err) {
      console.error('[AutoTag] error:', err);
      setAutoTagError('◈ ERROR');
      setTimeout(() => setAutoTagError(null), 3000);
    }
  }

  async function handleQuestions() {
    if (!config?.anthropicApiKey) { setSettingsModalOpen(true); return; }
    if (isSuggestLoading || isAutoTagLoading || isQuestionsLoading) return;
    if (ideaCount < 2) {
      setQuestionsError('? NEED MORE IDEAS');
      setTimeout(() => setQuestionsError(null), 2000);
      return;
    }
    try {
      await triggerQuestions('canvas-wide');
    } catch (err) {
      console.error('[Questions] error:', err);
      setQuestionsError('? ERROR');
      setTimeout(() => setQuestionsError(null), 3000);
    }
  }

  // Suggest button label
  const isErr = suggestError !== null;
  const suggestMainLabel = isSuggestLoading && activeSuggestMode
    ? LOADING_TEXT[activeSuggestMode]
    : isErr
      ? suggestError!
      : '✦ SUGGEST';

  const autoTagLabel = isAutoTagLoading
    ? '◈ ANALYZING...'
    : autoTagError ?? (reTagPending ? '◈ RE-TAG? (CLICK AGAIN)' : '◈ AUTO-TAG');

  function btn(opts: { loading: boolean; loadingText: string; normalText: string; error: string | null; onClick: () => void }) {
    const isE = opts.error !== null;
    const label = opts.loading ? opts.loadingText : isE ? opts.error! : opts.normalText;
    return (
      <button
        style={{
          ...BASE_BUTTON_STYLE,
          color: isE ? '#CC4444' : '#444444',
          cursor: opts.loading ? 'default' : 'pointer',
          animation: opts.loading ? 'ai-btn-pulse 1.5s ease-in-out infinite' : undefined,
        }}
        onClick={opts.onClick}
        disabled={opts.loading}
        onMouseEnter={(e) => { if (!opts.loading && !isE) { e.currentTarget.style.borderColor = '#333333'; e.currentTarget.style.color = '#888888'; } }}
        onMouseLeave={(e) => { if (!opts.loading && !isE) { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#444444'; } }}
      >{label}</button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 4, alignItems: 'center' }}>

      {/* Split suggest button */}
      <div style={{ display: 'flex', position: 'relative' }}>

        {/* Main area → ALL mode */}
        <button
          style={{
            ...BASE_BUTTON_STYLE,
            color: isErr ? '#CC4444' : '#444444',
            borderRight: 'none',
            cursor: isSuggestLoading ? 'default' : 'pointer',
            animation: isSuggestLoading ? 'ai-btn-pulse 1.5s ease-in-out infinite' : undefined,
            paddingRight: 8,
          }}
          onClick={() => handleSuggestMode('all')}
          disabled={isSuggestLoading}
          onMouseEnter={(e) => { if (!isSuggestLoading && !isErr) { e.currentTarget.style.borderColor = '#333333'; e.currentTarget.style.color = '#888888'; } }}
          onMouseLeave={(e) => { if (!isSuggestLoading && !isErr) { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#444444'; } }}
        >
          {suggestMainLabel}
        </button>

        {/* Arrow → opens dropdown */}
        <button
          ref={arrowBtnRef}
          style={{
            ...BASE_BUTTON_STYLE,
            width: 24,
            padding: 0,
            borderLeft: '1px solid #1A1A1A',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          onClick={() => setDropdownOpen((o) => !o)}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#333333'; e.currentTarget.style.color = '#888888'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#444444'; }}
        >
          ▾
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 4,
              background: '#0E0E0E',
              border: '1px solid #222222',
              borderRadius: 0,
              zIndex: 1000,
              minWidth: 170,
              overflow: 'hidden',
            }}
          >
            {MENU_ITEMS.map((item, i) => (
              <button
                key={item.mode}
                onClick={() => handleSuggestMode(item.mode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderTop: i > 0 ? '1px solid #1A1A1A' : 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                  color: '#888888',
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                  whiteSpace: 'nowrap' as const,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1A1A1A'; e.currentTarget.style.color = '#DDDDDD'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888888'; }}
              >
                <span style={{ color: item.iconColor }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Auto-tag button */}
      {config?.aiFeatures.autoTagging !== false && (
        <button
          style={{
            ...BASE_BUTTON_STYLE,
            color: autoTagError ? '#CC4444' : '#444444',
            cursor: isAutoTagLoading ? 'default' : 'pointer',
            animation: isAutoTagLoading ? 'ai-btn-pulse 1.5s ease-in-out infinite' : undefined,
          }}
          onClick={handleAutoTag}
          disabled={isAutoTagLoading}
          onMouseEnter={(e) => { if (!isAutoTagLoading && !autoTagError) { e.currentTarget.style.borderColor = '#333333'; e.currentTarget.style.color = '#888888'; } }}
          onMouseLeave={(e) => { if (!isAutoTagLoading && !autoTagError) { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#444444'; } }}
        >
          {autoTagLabel}
        </button>
      )}

      {/* Questions button */}
      {btn({ loading: isQuestionsLoading, loadingText: '? THINKING...', normalText: '? QUESTIONS', error: questionsError, onClick: handleQuestions })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1 | grep AiControlsBar | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ~/thinktank/robinwater
git add src/components/AiControlsBar.tsx
git commit -m "feat: split suggest button with dropdown menu for all 4 suggestion modes"
```

---

## Task 12: Update Canvas.tsx and App.tsx, delete old files

**Files:**
- Modify: `src/components/Canvas.tsx`
- Modify: `src/App.tsx`
- Delete: `src/utils/ghostSuggestions.ts`
- Delete: `src/utils/triggerSuggest.ts`

- [ ] **Step 1: Add `GhostOffScreenBanner` to `Canvas.tsx`**

In `Canvas.tsx`, add the import near the top with other component imports:

```typescript
import { GhostOffScreenBanner } from "./GhostOffScreenBanner";
```

Find the section where `GhostNodeCard` components are rendered (the `aiPanelOpen && ghostNodes.map(...)` block) and add the banner above it:

```tsx
{aiPanelOpen && <GhostOffScreenBanner />}
{aiPanelOpen && ghostNodes.map((ghost) => (
  <GhostNodeCard key={ghost.id} ghost={ghost} />
))}
```

The banner needs to be positioned relative to the canvas. Since it should appear above the AI controls (outside the canvas transform), check where in the JSX hierarchy the AI controls bar renders and place the banner in the same fixed/absolute layer. If `GhostOffScreenBanner` should appear at the bottom-right of the screen above the AI bar, it should render outside the `transform`-ed canvas div. Add it in the parent container alongside the other UI overlays.

Look at how other fixed UI elements (like ZoomIndicator) are positioned in Canvas.tsx and mirror that placement.

- [ ] **Step 2: Update `App.tsx` to use `triggerAutoSuggest`**

Change the import at line 18:

```typescript
import { triggerAutoSuggest } from "./utils/suggestions/triggerSuggest";
```

Change line 185:

```typescript
      triggerAutoSuggest(newestIdeaTextRef.current);
```

- [ ] **Step 3: Delete old files**

```bash
cd ~/thinktank/robinwater
rm src/utils/ghostSuggestions.ts src/utils/triggerSuggest.ts
```

- [ ] **Step 4: Final TypeScript check**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 5: Run all tests**

```bash
cd ~/thinktank/robinwater && npm test
```

Expected: all passing.

- [ ] **Step 6: Final commit**

```bash
cd ~/thinktank/robinwater
git add -A
git commit -m "feat: wire up GhostOffScreenBanner, update App.tsx auto-trigger, remove old suggestion files"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Split suggest button with ▾ dropdown | Task 11 |
| ALL mode on main button click | Task 11 |
| EXTEND / SYNTHESIZE / WILD CARD / ALL menu items | Task 11 |
| Extension loading: `✦ EXTENDING...` | Task 11 (LOADING_TEXT) |
| Synthesis loading: `◆ SYNTHESIZING...` | Task 11 |
| Wild card loading: `✸ WILDCARDING...` | Task 11 |
| All loading: `✦ THINKING...` | Task 11 |
| Extension visual identity | Task 9 |
| Synthesis visual identity (blue tint) | Task 9 |
| Wild card visual identity (amber/warm) | Task 9 |
| Synthesis placement between cluster centroids | Task 7 |
| Wild card placement at canvas edges | Task 7 |
| Synthesis auto-connects to bridged clusters on accept | Task 8 |
| Wild card creates no connections on accept | Task 8 (relatedToId null) |
| ALL mode staggered appearance (0 / 800 / 1600ms) | Task 7 |
| Tooltip format per type | Task 9 (buildTooltip) |
| Off-screen notification banner | Task 10 |
| Clicking banner pans to off-screen ghosts | Task 10 |
| Banner auto-fades after 5s | Task 10 |
| Rate limiting (10s / 15s per type) | Task 7 (COOLDOWN_MS) |
| Synthesis min requirement (2 clusters or 6 ideas) | Task 11 |
| Wild card works with 1 idea | Task 7 (no minimum) |
| Haiku for extensions, Sonnet for synthesis/wildcard/all | Tasks 3, 4, 5, 6 |
| Auto-trigger extension-only | Task 7 (triggerAutoSuggest) |
| Ghost nodes not persisted to disk | Unchanged (ephemeral state) |
| Semantic zoom on ghost nodes | Task 9 (detailLevel preserved) |
| `◆ NEED MORE CLUSTERS` error message | Task 11 |

**Placeholder scan:** None found. All steps include complete code.

**Type consistency check:**
- `SuggestionMode` defined in `types.ts` Task 1, used in Tasks 7, 8, 11 ✓
- `GhostNode.type: 'extension' | 'synthesis' | 'wildcard' | 'question'` defined Task 1, read in Tasks 9, 7 ✓
- `GhostNode.bridgedClusterIds?: string[][]` defined Task 1, set in Task 7, read in Tasks 8, 9 ✓
- `fetchExtensions` exported from Task 3, imported in Task 7 ✓
- `fetchSynthesis` exported from Task 4, imported in Task 7 ✓
- `fetchWildcards` exported from Task 5, imported in Task 7 ✓
- `fetchAll` exported from Task 6, imported in Task 7 ✓
- `Cluster` exported from Task 2, used in Tasks 4, 6, 7 ✓
- `setActiveSuggestMode` added in Task 8, called in Task 7 ✓
- `setSuggestCooldown` added in Task 8, called in Task 7 ✓
- `setOffScreenGhosts` added in Task 8, called in Task 7 ✓
- `triggerAutoSuggest` exported from Task 7, imported in Task 12 (App.tsx) ✓
- `triggerSuggest` exported from Task 7, imported in Task 11 (AiControlsBar) ✓
