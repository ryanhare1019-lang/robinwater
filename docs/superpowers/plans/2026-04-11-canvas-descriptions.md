# Canvas Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional text descriptions to canvases — visible on hover in the sidebar, editable via a popover, and injected into all AI suggestion prompts for richer context.

**Architecture:** Description is a new optional field on the `Canvas` type, managed via a new store action. The `CanvasList` sidebar renders a dim description line on row hover and opens a fixed-position popover when clicked. All four AI suggestion `buildUserMessage` helpers are updated to prepend the description to the canvas name when present.

**Tech Stack:** TypeScript, React, Zustand (state), Vitest (tests)

---

## File Map

| File | Change |
|------|--------|
| `src/types.ts` | Add `description?: string` to `Canvas` interface |
| `src/store/useStore.ts` | Add `updateCanvasDescription` action; update `createDefaultCanvas` |
| `src/utils/suggestions/extensionSuggestions.ts` | Export `buildUserMessage`; include description in prompt |
| `src/utils/suggestions/synthesisSuggestions.ts` | Export `buildUserMessage`; add `canvasDescription?` param |
| `src/utils/suggestions/wildcardSuggestions.ts` | Export `buildUserMessage`; add `canvasDescription?` param |
| `src/utils/suggestions/allSuggestions.ts` | Export `buildUserMessage`; include description from `canvas.description` |
| `src/utils/suggestions/triggerSuggest.ts` | Pass `canvas.description` to `fetchSynthesis` and `fetchWildcards` |
| `src/utils/suggestions/suggestions.test.ts` | New — tests for description inclusion in all four `buildUserMessage` helpers |
| `src/components/CanvasList.tsx` | Hover description line + description edit popover |

---

### Task 1: Add `description` field to Canvas type

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add `description` to the Canvas interface**

In `src/types.ts`, update the `Canvas` interface (currently at line 51):

```ts
export interface Canvas {
  id: string;
  name: string;
  description?: string;   // optional; treat absent/undefined as ''
  ideas: Idea[];
  connections: Connection[];
  viewport: Viewport;
  tags?: CustomTag[];
  aiTagDefinitions?: AITagDefinition[];
  collapsedHubs?: string[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add description field to Canvas type"
```

---

### Task 2: Add `updateCanvasDescription` to store

**Files:**
- Modify: `src/store/useStore.ts`

- [ ] **Step 1: Initialize `description` in `createDefaultCanvas`**

`createDefaultCanvas` is defined around line 43. Add the field:

```ts
function createDefaultCanvas(name = "Ideas"): Canvas {
  return {
    id: generateId(),
    name,
    description: '',
    ideas: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    tags: [],
    aiTagDefinitions: [],
    collapsedHubs: [],
  };
}
```

- [ ] **Step 2: Add the action signature to `AppState`**

In the `AppState` interface (after `renameCanvas` around line 93), add:

```ts
updateCanvasDescription: (id: string, description: string) => void;
```

- [ ] **Step 3: Implement the action**

In the `create<AppState>` body, after the `renameCanvas` implementation (around line 485):

```ts
updateCanvasDescription: (id, description) => {
  set((state) => ({
    canvases: state.canvases.map((c) =>
      c.id === id ? { ...c, description } : c
    ),
  }));
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/store/useStore.ts
git commit -m "feat: add updateCanvasDescription store action"
```

---

### Task 3: Write failing tests for AI prompt description inclusion

**Files:**
- Create: `src/utils/suggestions/suggestions.test.ts`

These tests will fail until Tasks 4–7 export the functions and add description support.

- [ ] **Step 1: Create the test file**

```ts
// src/utils/suggestions/suggestions.test.ts
import { describe, it, expect } from 'vitest';
import type { Canvas, Idea, Connection } from '../../types';
import { buildUserMessage as buildExtensionMsg } from './extensionSuggestions';
import { buildUserMessage as buildSynthesisMsg } from './synthesisSuggestions';
import { buildUserMessage as buildWildcardMsg } from './wildcardSuggestions';
import { buildUserMessage as buildAllMsg } from './allSuggestions';
import type { Cluster } from './clusterUtils';

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  id: 'i1',
  text: 'example idea',
  description: '',
  x: 0, y: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  keywords: [],
  ...overrides,
});

const makeCanvas = (overrides: Partial<Canvas> = {}): Canvas => ({
  id: 'c1',
  name: 'Test Canvas',
  description: '',
  ideas: [makeIdea()],
  connections: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  tags: [],
  aiTagDefinitions: [],
  ...overrides,
});

const makeCluster = (ideas: Idea[]): Cluster => ({
  ideas,
  centroid: { x: 0, y: 0 },
});

describe('extension buildUserMessage', () => {
  it('includes description when present', () => {
    const canvas = makeCanvas({ description: 'mobile UX exploration' });
    const msg = buildExtensionMsg('Test Canvas', canvas.ideas, canvas, 'manual');
    expect(msg).toContain('Test Canvas — mobile UX exploration');
  });

  it('omits description separator when description is empty', () => {
    const canvas = makeCanvas({ description: '' });
    const msg = buildExtensionMsg('Test Canvas', canvas.ideas, canvas, 'manual');
    expect(msg).not.toContain(' — ');
    expect(msg).toContain('"Test Canvas"');
  });
});

describe('synthesis buildUserMessage', () => {
  it('includes description when present', () => {
    const msg = buildSynthesisMsg('Test Canvas', [], [], 'mobile UX exploration');
    expect(msg).toContain('Test Canvas — mobile UX exploration');
  });

  it('omits description separator when description is empty', () => {
    const msg = buildSynthesisMsg('Test Canvas', [], []);
    expect(msg).not.toContain(' — ');
    expect(msg).toContain('"Test Canvas"');
  });
});

describe('wildcard buildUserMessage', () => {
  it('includes description when present', () => {
    const msg = buildWildcardMsg('Test Canvas', [], 'mobile UX exploration');
    expect(msg).toContain('Test Canvas — mobile UX exploration');
  });

  it('omits description separator when description is empty', () => {
    const msg = buildWildcardMsg('Test Canvas', []);
    expect(msg).not.toContain(' — ');
    expect(msg).toContain('"Test Canvas"');
  });
});

describe('all buildUserMessage', () => {
  it('includes description when present', () => {
    const canvas = makeCanvas({ description: 'mobile UX exploration' });
    const msg = buildAllMsg('Test Canvas', canvas.ideas, canvas, [], []);
    expect(msg).toContain('Test Canvas — mobile UX exploration');
  });

  it('omits description separator when description is empty', () => {
    const canvas = makeCanvas({ description: '' });
    const msg = buildAllMsg('Test Canvas', canvas.ideas, canvas, [], []);
    expect(msg).not.toContain(' — ');
    expect(msg).toContain('"Test Canvas"');
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
cd ~/thinktank/robinwater && npm test -- suggestions.test.ts
```

Expected: FAIL — `buildUserMessage` is not exported from any of the four modules.

---

### Task 4: Update `extensionSuggestions.ts`

**Files:**
- Modify: `src/utils/suggestions/extensionSuggestions.ts`

- [ ] **Step 1: Export `buildUserMessage` and add description to the opening line**

Replace the `function buildUserMessage(` declaration with `export function buildUserMessage(` and update the first line of the returned message:

```ts
export function buildUserMessage(
  canvasName: string,
  ideas: Idea[],
  canvas: Canvas,
  triggerMode: 'manual' | 'auto',
  newestIdeaText?: string
): string {
  const lines: string[] = [];
  const canvasLabel = canvas.description?.trim()
    ? `${canvasName} — ${canvas.description.trim()}`
    : canvasName;
  lines.push(`Here are the ideas currently on my canvas "${canvasLabel}":`);
  // ... rest of function unchanged
```

The rest of the function body stays exactly the same.

- [ ] **Step 2: Run the extension tests**

```bash
cd ~/thinktank/robinwater && npm test -- suggestions.test.ts
```

Expected: the two `extension buildUserMessage` tests now PASS; the others still fail.

---

### Task 5: Update `synthesisSuggestions.ts`

**Files:**
- Modify: `src/utils/suggestions/synthesisSuggestions.ts`

- [ ] **Step 1: Export `buildUserMessage` and add `canvasDescription?` param**

Replace `function buildUserMessage(` with:

```ts
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
  // ... rest of function unchanged
```

- [ ] **Step 2: Update `fetchSynthesis` signature and call**

```ts
export async function fetchSynthesis(
  apiKey: string,
  canvasName: string,
  clusters: Cluster[],
  standalone: Idea[],
  canvasDescription?: string
): Promise<SynthesisResult[]> {
  const userMessage = buildUserMessage(canvasName, clusters, standalone, canvasDescription);
  // ... rest unchanged
```

- [ ] **Step 3: Run the synthesis tests**

```bash
cd ~/thinktank/robinwater && npm test -- suggestions.test.ts
```

Expected: synthesis tests now PASS; wildcard and all still fail.

---

### Task 6: Update `wildcardSuggestions.ts`

**Files:**
- Modify: `src/utils/suggestions/wildcardSuggestions.ts`

- [ ] **Step 1: Export `buildUserMessage` and add `canvasDescription?` param**

Replace `function buildUserMessage(` with:

```ts
export function buildUserMessage(
  canvasName: string,
  ideas: Idea[],
  canvasDescription?: string
): string {
  const themes = extractTopThemes(ideas);
  const sample = ideas.slice(-8);

  const lines: string[] = [];
  const canvasLabel = canvasDescription?.trim()
    ? `${canvasName} — ${canvasDescription.trim()}`
    : canvasName;
  lines.push(`Here's a summary of what's on my canvas "${canvasLabel}":`);
  // ... rest of function unchanged
```

- [ ] **Step 2: Update `fetchWildcards` signature and call**

```ts
export async function fetchWildcards(
  apiKey: string,
  canvasName: string,
  ideas: Idea[],
  canvasDescription?: string
): Promise<WildcardResult[]> {
  const userMessage = buildUserMessage(canvasName, ideas, canvasDescription);
  // ... rest unchanged
```

- [ ] **Step 3: Run the wildcard tests**

```bash
cd ~/thinktank/robinwater && npm test -- suggestions.test.ts
```

Expected: wildcard tests now PASS; all still fails.

---

### Task 7: Update `allSuggestions.ts`

**Files:**
- Modify: `src/utils/suggestions/allSuggestions.ts`

- [ ] **Step 1: Export `buildUserMessage` and read description from canvas**

Replace `function buildUserMessage(` with:

```ts
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
  // ... rest of function unchanged
```

- [ ] **Step 2: Run all suggestion tests**

```bash
cd ~/thinktank/robinwater && npm test -- suggestions.test.ts
```

Expected: ALL 8 tests PASS.

- [ ] **Step 3: Run the full test suite**

```bash
cd ~/thinktank/robinwater && npm test
```

Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/utils/suggestions/extensionSuggestions.ts \
        src/utils/suggestions/synthesisSuggestions.ts \
        src/utils/suggestions/wildcardSuggestions.ts \
        src/utils/suggestions/allSuggestions.ts \
        src/utils/suggestions/suggestions.test.ts
git commit -m "feat: include canvas description in AI suggestion prompts"
```

---

### Task 8: Wire description through `triggerSuggest.ts`

**Files:**
- Modify: `src/utils/suggestions/triggerSuggest.ts`

The two call sites that need updating are `fetchSynthesis` and `fetchWildcards` — they now accept an optional `canvasDescription` param. `fetchExtensions` and `fetchAll` already receive the canvas object, so they read `canvas.description` directly.

- [ ] **Step 1: Pass `canvas.description` to `fetchSynthesis` in `triggerSuggest`**

Find the call to `fetchSynthesis` (around line 276):

```ts
const suggestions = await fetchSynthesis(
  config.anthropicApiKey,
  canvas.name,
  multiClusters,
  standalone,
  canvas.description   // add this
);
```

- [ ] **Step 2: Pass `canvas.description` to `fetchWildcards` in `triggerSuggest`**

Find the call to `fetchWildcards` (around line 326):

```ts
const suggestions = await fetchWildcards(
  config.anthropicApiKey,
  canvas.name,
  ideas,
  canvas.description   // add this
);
```

- [ ] **Step 3: Also update the `mode === 'all'` path** — `fetchAll` receives `canvas` directly so no change needed; double-check by searching for any other `fetchSynthesis`/`fetchWildcards` calls in the file and updating them too.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
cd ~/thinktank/robinwater && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/suggestions/triggerSuggest.ts
git commit -m "feat: pass canvas description to AI suggestion fetchers"
```

---

### Task 9: Canvas description UI in `CanvasList.tsx`

**Files:**
- Modify: `src/components/CanvasList.tsx`

This task adds hover-reveal description display and a click-to-edit popover.

- [ ] **Step 1: Add state for hover tracking and description editing**

Near the top of `CanvasList()` after the existing state declarations (around line 53), add:

```ts
const updateCanvasDescription = useStore((s) => s.updateCanvasDescription);

const [hoveredCanvasId, setHoveredCanvasId] = useState<string | null>(null);
const [descEditId, setDescEditId] = useState<string | null>(null);
const [descEditValue, setDescEditValue] = useState('');
const [descEditPos, setDescEditPos] = useState<{ top: number } | null>(null);
const descInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 2: Add close-on-outside-click for the description popover**

After the existing context menu `useEffect` (around line 239), add:

```ts
useEffect(() => {
  if (!descEditId) return;
  const onMouseDown = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('[data-desc-popover]')) {
      updateCanvasDescription(descEditId, descEditValue.trim());
      setDescEditId(null);
    }
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDescEditId(null); // cancel — do not save
    }
  };
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('keydown', onKeyDown);
  return () => {
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('keydown', onKeyDown);
  };
}, [descEditId, descEditValue, updateCanvasDescription]);
```

- [ ] **Step 3: Auto-focus description input when popover opens**

Add this `useEffect` right after the one above:

```ts
useEffect(() => {
  if (descEditId) {
    setTimeout(() => descInputRef.current?.focus(), 0);
  }
}, [descEditId]);
```

- [ ] **Step 4: Add the description line to `renderCanvasRow`**

Inside `renderCanvasRow`, in the non-editing, non-deleting branch (the `<>` fragment around line 376), add the description line after the idea count `<span>`:

```tsx
{/* Description line — only visible on hover */}
{hoveredCanvasId === c.id && (
  <div
    style={{
      width: '100%',
      paddingLeft: indented ? 12 : 8,
      paddingBottom: 4,
      marginTop: -2,
    }}
    onClick={(e) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setDescEditId(c.id);
      setDescEditValue(c.description ?? '');
      setDescEditPos({ top: rect.top });
    }}
  >
    <span
      style={{
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
        fontStyle: 'italic',
        cursor: 'text',
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        opacity: 0.7,
      }}
    >
      {c.description?.trim() || 'add a description...'}
    </span>
  </div>
)}
```

- [ ] **Step 5: Wire hover state and enable wrapping on the canvas row outer div**

Still inside `renderCanvasRow`, find the outer `<div>` (around line 302). Add `flexWrap: 'wrap'` to its `style` object (so the description line — which has `width: '100%'` — wraps below the name/count row), and update `onMouseEnter`/`onMouseLeave`:

```tsx
style={{
  // existing style properties...
  flexWrap: 'wrap',   // ADD THIS — lets the description line wrap to next row
}}
onMouseEnter={(e) => {
  if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
  setHoveredCanvasId(c.id);
}}
onMouseLeave={(e) => {
  if (!isActive) e.currentTarget.style.background = 'transparent';
  setHoveredCanvasId(null);
}}
```

- [ ] **Step 6: Render the description edit popover**

Inside the returned JSX of `CanvasList`, after the context menu block (around line 745), add:

```tsx
{/* Description edit popover */}
{descEditId && descEditPos && (
  <div
    data-desc-popover=""
    style={{
      position: 'fixed',
      left: 224,
      top: descEditPos.top - 4,
      zIndex: 3000,
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-default)',
      padding: '10px 12px',
      width: 220,
      boxShadow: '4px 4px 20px rgba(0,0,0,0.5)',
    }}
  >
    <div
      style={{
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-tertiary)',
        marginBottom: 6,
      }}
    >
      DESCRIPTION
    </div>
    <input
      ref={descInputRef}
      value={descEditValue}
      onChange={(e) => setDescEditValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          updateCanvasDescription(descEditId, descEditValue.trim());
          setDescEditId(null);
        }
        // Escape is handled by the window listener
      }}
      placeholder="what is this canvas for?"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 0,
        color: 'var(--text-primary)',
        fontSize: 'var(--body-size)',
        fontFamily: 'var(--font-mono)',
        padding: '5px 7px',
        outline: 'none',
      }}
    />
    <div
      style={{
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
        marginTop: 5,
        textAlign: 'right',
        opacity: 0.7,
      }}
    >
      enter to save · esc to cancel
    </div>
  </div>
)}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd ~/thinktank/robinwater && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Run full test suite**

```bash
cd ~/thinktank/robinwater && npm test
```

Expected: all tests pass.

- [ ] **Step 9: Manual smoke test**

Start the app: `npm run dev` (or `npm run tauri` if testing in the desktop shell).

Verify:
1. Hover a canvas row → dim italic description line appears below the name
2. If no description: shows `add a description...` placeholder
3. Click the description line → popover appears to the right of the sidebar
4. Type a description → press `Enter` → popover closes, description saved
5. Hover the same row again → new description text appears
6. Open popover again → press `Escape` → popover closes, old value restored
7. Open popover → click elsewhere on the canvas → popover closes and saves

- [ ] **Step 10: Commit**

```bash
git add src/components/CanvasList.tsx
git commit -m "feat: canvas description hover display and edit popover"
```
