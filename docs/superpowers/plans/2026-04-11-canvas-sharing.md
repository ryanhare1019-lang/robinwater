# Canvas Sharing (.monolite Files) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export individual canvases as `.monolite` JSON files and import them back, enabling canvas sharing via any file transfer method.

**Architecture:** Serialization/validation logic lives in a pure utility (`monoliteFile.ts`), import state lives in the Zustand store, and UI is split between a new modal component (`MonoliteImportModal.tsx`) and additions to the existing `CanvasList.tsx`. No new Tauri plugins are required — dialog and fs are already installed. We only need to add `dialog:allow-open` and `fs:allow-read-text-file` permissions.

**Tech Stack:** TypeScript, React 18, Zustand, `@tauri-apps/plugin-dialog` (open + save), `@tauri-apps/plugin-fs` (readTextFile + writeTextFile), Vitest for tests.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/utils/monoliteFile.ts` | Serialize canvas → JSON, deserialize + validate JSON → canvas |
| Create | `src/utils/monoliteFile.test.ts` | Tests for all serialization and validation paths |
| Create | `src/components/MonoliteImportModal.tsx` | Confirmation modal (name, idea count, date) + error modal |
| Modify | `src-tauri/capabilities/default.json` | Add `dialog:allow-open`, `fs:allow-read-text-file` |
| Modify | `src/store/useStore.ts` | Add `importCanvas` action + `importFlashIds` state |
| Modify | `src/styles/global.css` | Add `@keyframes import-fade-in` |
| Modify | `src/components/IdeaNode.tsx` | Apply staggered fade-in for imported nodes |
| Modify | `src/components/CanvasList.tsx` | Add "SHARE AS .MONOLITE" to ctx menu + IMPORT button + toast |

---

## Task 1: Tauri Permissions

**Files:**
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add `dialog:allow-open` and `fs:allow-read-text-file`**

In `src-tauri/capabilities/default.json`, add two new entries to the `"permissions"` array. The final array should be:

```json
{
  "$schema": "https://schemas.tauri.app/config/v2/capability",
  "identifier": "default",
  "description": "Default permissions for Robinwater",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-appdata-read-recursive",
    "fs:allow-appdata-write-recursive",
    "fs:allow-appdata-meta-recursive",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "dialog:allow-save",
    "dialog:allow-open",
    "fs:allow-write-text-file",
    "fs:allow-read-text-file",
    "http:default",
    {
      "identifier": "http:allow-fetch",
      "allow": [
        { "url": "https://api.anthropic.com/**" },
        { "url": "https://api.github.com/**" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/capabilities/default.json
git commit -m "feat: add dialog:allow-open and fs:allow-read-text-file permissions"
```

---

## Task 2: Serialization / Validation Utility

**Files:**
- Create: `src/utils/monoliteFile.ts`
- Create: `src/utils/monoliteFile.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/monoliteFile.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Canvas } from '../types';
import {
  serializeCanvas,
  buildMonoliteFilename,
  parseMonoliteFile,
  type MonoliteParseResult,
} from './monoliteFile';

const makeCanvas = (overrides: Partial<Canvas> = {}): Canvas => ({
  id: 'c1',
  name: 'Test Canvas',
  ideas: [
    {
      id: 'idea-1',
      text: 'Hello <script>alert(1)</script>',
      description: 'A <b>test</b>',
      x: 100,
      y: 200,
      createdAt: '2026-04-01T10:00:00.000Z',
      keywords: ['hello'],
    },
  ],
  connections: [{ id: 'conn-1', sourceId: 'idea-1', targetId: 'idea-2' }],
  viewport: { x: 0, y: 0, zoom: 1 },
  aiTagDefinitions: [
    { id: 'tag-1', label: 'STUFF', color: '#ff0000', ideaIds: ['idea-1'] },
  ],
  tags: [],
  ...overrides,
});

describe('buildMonoliteFilename', () => {
  it('lowercases, hyphenates, and appends .monolite extension', () => {
    expect(buildMonoliteFilename('Real Madrid Squad')).toBe('real-madrid-squad-monolite.monolite');
  });

  it('strips special characters', () => {
    expect(buildMonoliteFilename('Ideas: 2026!')).toBe('ideas-2026-monolite.monolite');
  });

  it('collapses consecutive hyphens', () => {
    expect(buildMonoliteFilename('A  B')).toBe('a-b-monolite.monolite');
  });
});

describe('serializeCanvas', () => {
  it('produces valid JSON with monolite_version and canvas fields', () => {
    const json = serializeCanvas(makeCanvas());
    const parsed = JSON.parse(json);
    expect(parsed.monolite_version).toBe('1.0');
    expect(parsed.canvas.name).toBe('Test Canvas');
    expect(typeof parsed.exported_at).toBe('string');
  });

  it('includes ideas, connections, and aiTagDefinitions', () => {
    const json = serializeCanvas(makeCanvas());
    const parsed = JSON.parse(json);
    expect(parsed.canvas.ideas).toHaveLength(1);
    expect(parsed.canvas.connections).toHaveLength(1);
    expect(parsed.canvas.aiTagDefinitions).toHaveLength(1);
  });

  it('excludes viewport from canvas data', () => {
    const json = serializeCanvas(makeCanvas());
    const parsed = JSON.parse(json);
    expect(parsed.canvas.viewport).toBeUndefined();
  });

  it('sanitizes HTML from idea text and description', () => {
    const json = serializeCanvas(makeCanvas());
    const parsed = JSON.parse(json);
    expect(parsed.canvas.ideas[0].text).toBe('Hello alert(1)');
    expect(parsed.canvas.ideas[0].description).toBe('A test');
  });
});

describe('parseMonoliteFile', () => {
  const goodFile = () => JSON.stringify({
    monolite_version: '1.0',
    exported_at: '2026-04-11T14:00:00.000Z',
    canvas: {
      name: 'Imported Canvas',
      ideas: [
        {
          id: 'idea-1',
          text: 'Idea one',
          description: '',
          x: 50,
          y: 60,
          createdAt: '2026-04-01T10:00:00.000Z',
          keywords: [],
        },
      ],
      connections: [],
      aiTagDefinitions: [],
    },
  });

  it('returns success result for a valid file', () => {
    const result = parseMonoliteFile(goodFile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.name).toBe('Imported Canvas');
    expect(result.canvas.ideas).toHaveLength(1);
    expect(result.exportedAt).toBe('2026-04-11T14:00:00.000Z');
  });

  it('errors on invalid JSON', () => {
    const result = parseMonoliteFile('not json{{{');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID FILE: NOT VALID JSON');
  });

  it('errors when monolite_version is missing', () => {
    const result = parseMonoliteFile(JSON.stringify({ canvas: { name: 'x', ideas: [] } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID FILE: NOT A MONOLITE FILE');
  });

  it('errors when canvas or ideas is missing', () => {
    const result = parseMonoliteFile(JSON.stringify({ monolite_version: '1.0', canvas: { name: 'x' } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID FILE: MISSING CANVAS DATA');
  });

  it('errors when ideas is not an array', () => {
    const result = parseMonoliteFile(JSON.stringify({
      monolite_version: '1.0',
      canvas: { name: 'x', ideas: 'bad' },
    }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('INVALID FILE: CORRUPTED IDEAS DATA');
  });

  it('skips ideas missing required fields and reports warning count', () => {
    const raw = JSON.stringify({
      monolite_version: '1.0',
      exported_at: '2026-04-11T00:00:00.000Z',
      canvas: {
        name: 'Test',
        ideas: [
          { id: 'a', text: 'Good', x: 0, y: 0, createdAt: '2026-01-01T00:00:00.000Z', description: '', keywords: [] },
          { id: 'b', text: 'No position' }, // missing x, y, createdAt
        ],
        connections: [],
        aiTagDefinitions: [],
      },
    });
    const result = parseMonoliteFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.ideas).toHaveLength(1);
    expect(result.skippedCount).toBe(1);
  });

  it('warns (but succeeds) when monolite_version is a future version', () => {
    const raw = JSON.stringify({
      monolite_version: '99.0',
      exported_at: '2026-04-11T00:00:00.000Z',
      canvas: { name: 'Futuristic', ideas: [], connections: [], aiTagDefinitions: [] },
    });
    const result = parseMonoliteFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.versionWarning).toBe(true);
  });

  it('rejects files over 10MB', () => {
    const bigString = 'x'.repeat(10 * 1024 * 1024 + 1);
    const result = parseMonoliteFile(bigString);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('TOO LARGE');
  });

  it('sanitizes HTML in imported idea text and description', () => {
    const raw = JSON.stringify({
      monolite_version: '1.0',
      exported_at: '2026-04-11T00:00:00.000Z',
      canvas: {
        name: 'x',
        ideas: [
          {
            id: 'a',
            text: '<script>evil()</script>Hello',
            description: '<b>bold</b>',
            x: 0, y: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            keywords: [],
          },
        ],
        connections: [],
        aiTagDefinitions: [],
      },
    });
    const result = parseMonoliteFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.ideas[0].text).toBe('Hello');
    expect(result.canvas.ideas[0].description).toBe('bold');
  });

  it('degrades gracefully when connections is missing', () => {
    const raw = JSON.stringify({
      monolite_version: '1.0',
      exported_at: '2026-04-11T00:00:00.000Z',
      canvas: { name: 'x', ideas: [] },
    });
    const result = parseMonoliteFile(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.connections).toEqual([]);
    expect(result.canvas.aiTagDefinitions).toEqual([]);
  });

  it('generates new UUIDs — no original IDs survive', () => {
    const result = parseMonoliteFile(goodFile());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.ideas[0].id).not.toBe('idea-1');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/astral/thinktank/robinwater && npx vitest run src/utils/monoliteFile.test.ts 2>&1 | tail -20
```

Expected: FAIL — `monoliteFile.ts` doesn't exist yet.

- [ ] **Step 3: Implement `src/utils/monoliteFile.ts`**

Create `src/utils/monoliteFile.ts`:

```typescript
import type { Canvas, Idea, Connection, AITagDefinition } from '../types';

const SUPPORTED_VERSION = '1.0';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const LARGE_CANVAS_THRESHOLD = 5000;

export interface MonoliteFileCanvas {
  name: string;
  ideas: Idea[];
  connections: Connection[];
  aiTagDefinitions: AITagDefinition[];
}

export interface MonoliteFile {
  monolite_version: string;
  exported_at: string;
  canvas: MonoliteFileCanvas;
}

export type MonoliteParseResult =
  | { ok: true; canvas: MonoliteFileCanvas; exportedAt: string; skippedCount: number; versionWarning: boolean; largeCanvasWarning: boolean }
  | { ok: false; error: string };

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

export function buildMonoliteFilename(canvasName: string): string {
  const safe = canvasName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safe}-monolite.monolite`;
}

export function serializeCanvas(canvas: Canvas): string {
  const sanitizeIdea = (idea: Idea): Idea => ({
    ...idea,
    text: stripHtml(idea.text),
    description: stripHtml(idea.description),
  });

  const file: MonoliteFile = {
    monolite_version: SUPPORTED_VERSION,
    exported_at: new Date().toISOString(),
    canvas: {
      name: canvas.name,
      ideas: canvas.ideas.map(sanitizeIdea),
      connections: canvas.connections,
      aiTagDefinitions: canvas.aiTagDefinitions ?? [],
    },
  };

  return JSON.stringify(file, null, 2);
}

function isValidIdea(idea: unknown): idea is Idea {
  if (!idea || typeof idea !== 'object') return false;
  const i = idea as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    typeof i.text === 'string' &&
    typeof i.x === 'number' &&
    typeof i.y === 'number' &&
    typeof i.createdAt === 'string'
  );
}

export function parseMonoliteFile(raw: string): MonoliteParseResult {
  // Size check first
  if (raw.length > MAX_FILE_BYTES) {
    return { ok: false, error: 'INVALID FILE: TOO LARGE (MAX 10MB)' };
  }

  // JSON validity
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'INVALID FILE: NOT VALID JSON' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'INVALID FILE: NOT A MONOLITE FILE' };
  }

  const file = parsed as Record<string, unknown>;

  // Version check
  if (typeof file.monolite_version !== 'string') {
    return { ok: false, error: 'INVALID FILE: NOT A MONOLITE FILE' };
  }

  // Canvas object check
  const canvasRaw = file.canvas as Record<string, unknown> | undefined;
  if (!canvasRaw || typeof canvasRaw.name !== 'string' || !('ideas' in canvasRaw)) {
    return { ok: false, error: 'INVALID FILE: MISSING CANVAS DATA' };
  }

  if (!Array.isArray(canvasRaw.ideas)) {
    return { ok: false, error: 'INVALID FILE: CORRUPTED IDEAS DATA' };
  }

  // Version warning
  const versionWarning = file.monolite_version !== SUPPORTED_VERSION;

  // Filter and sanitize ideas — skip bad ones, don't fail
  const allIdeas = canvasRaw.ideas as unknown[];
  const validIdeas: Idea[] = [];
  let skippedCount = 0;

  // ID remapping: old id → new id
  const idMap = new Map<string, string>();

  for (const raw of allIdeas) {
    if (!isValidIdea(raw)) {
      skippedCount++;
      continue;
    }
    const newId = crypto.randomUUID();
    idMap.set(raw.id, newId);
    validIdeas.push({
      ...raw,
      id: newId,
      text: stripHtml(raw.text),
      description: stripHtml(raw.description ?? ''),
    });
  }

  // Remap connections — skip any referencing missing IDs
  const rawConnections = Array.isArray(canvasRaw.connections) ? canvasRaw.connections as unknown[] : [];
  const connections: Connection[] = rawConnections
    .filter((c): c is { id: string; sourceId: string; targetId: string } =>
      !!c && typeof c === 'object' &&
      typeof (c as Record<string, unknown>).sourceId === 'string' &&
      typeof (c as Record<string, unknown>).targetId === 'string'
    )
    .filter((c) => idMap.has(c.sourceId) && idMap.has(c.targetId))
    .map((c) => ({
      id: crypto.randomUUID(),
      sourceId: idMap.get(c.sourceId)!,
      targetId: idMap.get(c.targetId)!,
    }));

  // Remap AI tag definitions
  const rawTags = Array.isArray(canvasRaw.aiTagDefinitions) ? canvasRaw.aiTagDefinitions as unknown[] : [];
  const aiTagDefinitions: AITagDefinition[] = rawTags
    .filter((t): t is { id: string; label: string; color: string; ideaIds: string[] } =>
      !!t && typeof t === 'object' &&
      typeof (t as Record<string, unknown>).label === 'string' &&
      typeof (t as Record<string, unknown>).color === 'string' &&
      Array.isArray((t as Record<string, unknown>).ideaIds)
    )
    .map((t) => ({
      id: crypto.randomUUID(),
      label: t.label,
      color: t.color,
      ideaIds: t.ideaIds.filter((id) => idMap.has(id)).map((id) => idMap.get(id)!),
    }));

  const largeCanvasWarning = validIdeas.length > LARGE_CANVAS_THRESHOLD;

  return {
    ok: true,
    canvas: {
      name: canvasRaw.name,
      ideas: validIdeas,
      connections,
      aiTagDefinitions,
    },
    exportedAt: typeof file.exported_at === 'string' ? file.exported_at : '',
    skippedCount,
    versionWarning,
    largeCanvasWarning,
  };
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
cd /home/astral/thinktank/robinwater && npx vitest run src/utils/monoliteFile.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/monoliteFile.ts src/utils/monoliteFile.test.ts
git commit -m "feat: add monolite file serialization, validation, and UUID remapping"
```

---

## Task 3: Store — importCanvas Action + importFlashIds

**Files:**
- Modify: `src/store/useStore.ts`

- [ ] **Step 1: Add `importFlashIds` state and `importCanvas` action to the interface**

In `src/store/useStore.ts`, add to the `AppState` interface (after the existing `undo`/`redo` entries near line 200):

```typescript
  // Import flash animation
  importFlashIds: string[];
  setImportFlashIds: (ids: string[]) => void;

  // Import a canvas (new UUIDs already assigned by parseMonoliteFile)
  importCanvas: (canvas: import('../utils/monoliteFile').MonoliteFileCanvas) => string;
```

- [ ] **Step 2: Implement in the `create()` call**

In `src/store/useStore.ts`, inside the `return {}` of `create()`, add after the existing `undo`/`redo` implementations:

```typescript
    importFlashIds: [],
    setImportFlashIds: (ids) => set({ importFlashIds: ids }),

    importCanvas: (fileCanvas) => {
      const state = get();

      // Resolve name collision: if name exists, append (2), (3), ...
      let name = fileCanvas.name;
      const existingNames = new Set(state.canvases.map((c) => c.name));
      if (existingNames.has(name)) {
        let n = 2;
        while (existingNames.has(`${name} (${n})`)) n++;
        name = `${name} (${n})`;
      }

      const newCanvas: Canvas = {
        id: generateId(),
        name,
        ideas: fileCanvas.ideas,
        connections: fileCanvas.connections,
        viewport: { x: 0, y: 0, zoom: 1 },
        tags: [],
        aiTagDefinitions: fileCanvas.aiTagDefinitions,
        collapsedHubs: [],
      };

      set((state) => ({
        canvases: [...state.canvases, newCanvas],
        activeCanvasId: newCanvas.id,
        selectedId: null,
        selectedIds: [],
        newNodeId: null,
        connectingFrom: null,
        ghostNodes: [],
        offScreenGhosts: null,
        similarityLines: computeSimilarityLines(newCanvas.ideas, newCanvas.connections),
        importFlashIds: newCanvas.ideas.map((i) => i.id),
      }));

      // Center viewport on midpoint of all ideas
      if (newCanvas.ideas.length > 0) {
        const midX = newCanvas.ideas.reduce((sum, i) => sum + i.x, 0) / newCanvas.ideas.length;
        const midY = newCanvas.ideas.reduce((sum, i) => sum + i.y, 0) / newCanvas.ideas.length;
        // Offset so midpoint lands at center of window
        const vpX = -(midX - window.innerWidth / 2);
        const vpY = -(midY - window.innerHeight / 2);
        set((state) => ({
          canvases: state.canvases.map((c) =>
            c.id === newCanvas.id ? { ...c, viewport: { x: vpX, y: vpY, zoom: 1 } } : c
          ),
        }));
      }

      // Clear flash after animation completes (ideas.length * 50ms stagger + 600ms fade)
      const clearDelay = newCanvas.ideas.length * 50 + 600;
      setTimeout(() => set({ importFlashIds: [] }), clearDelay);

      return newCanvas.id; // return new canvas name for toast
    },
```

- [ ] **Step 3: Commit**

```bash
git add src/store/useStore.ts
git commit -m "feat: add importCanvas store action with name collision handling and viewport centering"
```

---

## Task 4: Import Fade-in Animation

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/components/IdeaNode.tsx`

- [ ] **Step 1: Add keyframe to global.css**

In `src/styles/global.css`, add after the `@keyframes node-exit` block (around line 132):

```css
@keyframes import-fade-in {
  0%   { opacity: 0; transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 2: Apply staggered animation in IdeaNode.tsx**

In `src/components/IdeaNode.tsx`, add the following after the existing `isNew` / `entering` lines (around line 120):

```typescript
  const importFlashIds = useStore((s) => s.importFlashIds);
  const importIdx = importFlashIds.indexOf(idea.id);
  const isImporting = importIdx >= 0;
```

Then in the node's outer `div` style (around line 430, where `animation` is set), update to:

```typescript
        animation: entering
          ? "node-enter 0.45s var(--ease-spring) forwards, creation-glow 2.5s ease-out forwards"
          : isImporting
          ? `import-fade-in 0.4s var(--ease-out) ${importIdx * 50}ms both`
          : undefined,
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css src/components/IdeaNode.tsx
git commit -m "feat: staggered fade-in animation for imported nodes"
```

---

## Task 5: Import Confirmation Modal

**Files:**
- Create: `src/components/MonoliteImportModal.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/MonoliteImportModal.tsx`:

```typescript
import type { MonoliteFileCanvas } from '../utils/monoliteFile';

interface ImportModalProps {
  canvas: MonoliteFileCanvas;
  exportedAt: string;
  skippedCount: number;
  versionWarning: boolean;
  largeCanvasWarning: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function formatExportDate(iso: string): string {
  if (!iso) return 'UNKNOWN DATE';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    }).toUpperCase() + ' AT ' + d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    }).toUpperCase();
  } catch {
    return 'UNKNOWN DATE';
  }
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 4000,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 0,
  minWidth: 320,
  maxWidth: 420,
  fontFamily: 'var(--font-mono)',
};

const sectionStyle: React.CSSProperties = {
  padding: '20px 20px 0',
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.12em',
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-primary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 16,
  wordBreak: 'break-word' as const,
};

const warningStyle: React.CSSProperties = {
  margin: '0 20px 12px',
  padding: '8px 10px',
  background: 'rgba(204, 136, 0, 0.08)',
  border: '1px solid rgba(204, 136, 0, 0.25)',
  fontSize: 10,
  letterSpacing: '0.06em',
  color: '#CC8800',
  textTransform: 'uppercase',
  lineHeight: 1.5,
};

const btnRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '16px 20px 20px',
  borderTop: '1px solid var(--border-subtle)',
};

const btnBase: React.CSSProperties = {
  flex: 1,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '8px 12px',
  borderRadius: 0,
  cursor: 'pointer',
  transition: 'border-color 0.1s ease, color 0.1s ease',
};

export function MonoliteImportModal({
  canvas,
  exportedAt,
  skippedCount,
  versionWarning,
  largeCanvasWarning,
  onConfirm,
  onCancel,
}: ImportModalProps) {
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 11,
          letterSpacing: '0.1em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
        }}>
          IMPORT CANVAS
        </div>

        {/* Data */}
        <div style={sectionStyle}>
          <div style={labelStyle}>NAME</div>
          <div style={valueStyle}>{canvas.name}</div>

          <div style={labelStyle}>IDEAS</div>
          <div style={valueStyle}>
            {canvas.ideas.length} {canvas.ideas.length === 1 ? 'IDEA' : 'IDEAS'}
            {canvas.connections.length > 0 && `, ${canvas.connections.length} ${canvas.connections.length === 1 ? 'CONNECTION' : 'CONNECTIONS'}`}
          </div>

          <div style={labelStyle}>EXPORTED</div>
          <div style={{ ...valueStyle, marginBottom: 12 }}>{formatExportDate(exportedAt)}</div>
        </div>

        {/* Warnings */}
        {versionWarning && (
          <div style={warningStyle}>
            THIS FILE WAS CREATED WITH A NEWER VERSION OF MONOLITE. SOME DATA MAY NOT IMPORT CORRECTLY.
          </div>
        )}
        {skippedCount > 0 && (
          <div style={warningStyle}>
            WARNING: {skippedCount} {skippedCount === 1 ? 'IDEA' : 'IDEAS'} SKIPPED (MISSING DATA)
          </div>
        )}
        {largeCanvasWarning && (
          <div style={warningStyle}>
            THIS CANVAS HAS {canvas.ideas.length} IDEAS. IMPORTING MAY BE SLOW.
          </div>
        )}

        {/* Buttons */}
        <div style={btnRowStyle}>
          <button
            style={{
              ...btnBase,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onClick={onConfirm}
          >
            IMPORT
          </button>
          <button
            style={{
              ...btnBase,
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-tertiary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
            onClick={onCancel}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MonoliteImportModal.tsx
git commit -m "feat: MonoliteImportModal with canvas preview and warning handling"
```

---

## Task 6: Error Modal Component

**Files:**
- Modify: `src/components/MonoliteImportModal.tsx`

- [ ] **Step 1: Add MonoliteErrorModal to the same file**

Append to the bottom of `src/components/MonoliteImportModal.tsx`:

```typescript
interface ErrorModalProps {
  message: string;
  onClose: () => void;
}

export function MonoliteErrorModal({ message, onClose }: ErrorModalProps) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, minWidth: 280, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 11,
          letterSpacing: '0.1em',
          color: '#CC4444',
          textTransform: 'uppercase',
        }}>
          IMPORT ERROR
        </div>
        <div style={{ padding: '16px 20px', fontSize: 11, color: '#CC4444', letterSpacing: '0.06em', lineHeight: 1.6, textTransform: 'uppercase' }}>
          {message}
        </div>
        <div style={{ ...btnRowStyle, borderTop: '1px solid var(--border-subtle)' }}>
          <button
            style={{
              ...btnBase,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MonoliteImportModal.tsx
git commit -m "feat: add MonoliteErrorModal for import validation errors"
```

---

## Task 7: Wire Up Export and Import in CanvasList

**Files:**
- Modify: `src/components/CanvasList.tsx`

This is the largest task. Make all changes, then commit once at the end.

- [ ] **Step 1: Update imports at the top of `src/components/CanvasList.tsx`**

Add these imports after the existing ones at lines 1-6:

```typescript
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { serializeCanvas, buildMonoliteFilename, parseMonoliteFile } from "../utils/monoliteFile";
import type { MonoliteFileCanvas } from "../utils/monoliteFile";
import { MonoliteImportModal, MonoliteErrorModal } from "./MonoliteImportModal";
```

- [ ] **Step 2: Add state variables**

Inside `CanvasList()`, add these state variables after the existing `const [exportedId, setExportedId] = useState<string | null>(null);` line (≈line 52):

```typescript
  const importCanvas = useStore((s) => s.importCanvas);

  // Monolite import state
  const [importPending, setImportPending] = useState<{
    canvas: MonoliteFileCanvas;
    exportedAt: string;
    skippedCount: number;
    versionWarning: boolean;
    largeCanvasWarning: boolean;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importToast, setImportToast] = useState<string | null>(null);
  const importToastTimer = useRef<ReturnType<typeof setTimeout>>();
  const [sharedId, setSharedId] = useState<string | null>(null);
  const sharedTimer = useRef<ReturnType<typeof setTimeout>>();
```

- [ ] **Step 3: Add the `handleShareMonolite` function**

Add after the existing `handleExportMarkdown` function (≈line 144), before the cleanup `useEffect`:

```typescript
  const handleShareMonolite = useCallback(async (canvasId: string) => {
    setCtxMenu(null);
    const canvas = canvases.find((c) => c.id === canvasId);
    if (!canvas) return;

    try {
      const filePath = await save({
        defaultPath: buildMonoliteFilename(canvas.name),
        filters: [{ name: 'Monolite Canvas', extensions: ['monolite'] }],
      });
      if (!filePath) return;

      await writeTextFile(filePath, serializeCanvas(canvas));

      setSharedId(canvasId);
      if (sharedTimer.current) clearTimeout(sharedTimer.current);
      sharedTimer.current = setTimeout(() => setSharedId(null), 2000);
    } catch (err) {
      console.error('Monolite export failed:', err);
    }
  }, [canvases]);

  const handleImportMonolite = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Monolite Canvas', extensions: ['monolite'] }],
      });
      if (!selected || typeof selected !== 'string') return;

      const raw = await readTextFile(selected);
      const result = parseMonoliteFile(raw);

      if (!result.ok) {
        setImportError(result.error);
        return;
      }

      setImportPending({
        canvas: result.canvas,
        exportedAt: result.exportedAt,
        skippedCount: result.skippedCount,
        versionWarning: result.versionWarning,
        largeCanvasWarning: result.largeCanvasWarning,
      });
    } catch (err) {
      console.error('Monolite import failed:', err);
      setImportError('IMPORT FAILED: COULD NOT READ FILE');
    }
  }, []);

  const confirmImport = useCallback(() => {
    if (!importPending) return;
    importCanvas(importPending.canvas);
    const name = importPending.canvas.name.toUpperCase();
    const count = importPending.canvas.ideas.length;
    setImportPending(null);
    setImportToast(`✓ IMPORTED: ${name} (${count} ${count === 1 ? 'IDEA' : 'IDEAS'})`);
    if (importToastTimer.current) clearTimeout(importToastTimer.current);
    importToastTimer.current = setTimeout(() => setImportToast(null), 3000);
  }, [importPending, importCanvas]);
```

- [ ] **Step 4: Clean up the new timers in the cleanup `useEffect`**

Update the existing cleanup `useEffect` (≈line 147) to also clear the new timers:

```typescript
  useEffect(() => {
    return () => {
      clearTimeout(deleteTimer.current);
      clearTimeout(exportTimer.current);
      clearTimeout(sharedTimer.current);
      clearTimeout(importToastTimer.current);
    };
  }, []);
```

- [ ] **Step 5: Add "SHARE AS .MONOLITE" to the right-click context menu**

In the ctx menu JSX (≈line 662), after the `↗ EXPORT .MD` button, add:

```tsx
          <button
            onClick={() => handleShareMonolite(ctxMenu.canvasId)}
            style={{
              ...menuItemStyle,
              color: sharedId === ctxMenu.canvasId ? '#44AA66' : 'var(--text-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            {sharedId === ctxMenu.canvasId ? '✓ SHARED' : '↗ SHARE AS .MONOLITE'}
          </button>
```

- [ ] **Step 6: Add the IMPORT button to the sidebar bottom area**

In the sidebar bottom section (≈line 597, the `{/* Settings button */}` div), add an import button before the settings button:

```tsx
          {/* Import button */}
          <button
            onClick={handleImportMonolite}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              padding: "0 0 8px",
              textAlign: "left",
              transition: "color 0.1s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            ↓ IMPORT .MONOLITE
          </button>
```

- [ ] **Step 7: Render modals and toast at the bottom of the returned JSX**

At the very end of the `CanvasList` return (just before the final closing `</>`), add:

```tsx
      {/* Monolite import confirmation modal */}
      {importPending && (
        <MonoliteImportModal
          canvas={importPending.canvas}
          exportedAt={importPending.exportedAt}
          skippedCount={importPending.skippedCount}
          versionWarning={importPending.versionWarning}
          largeCanvasWarning={importPending.largeCanvasWarning}
          onConfirm={confirmImport}
          onCancel={() => setImportPending(null)}
        />
      )}

      {/* Monolite import error modal */}
      {importError && (
        <MonoliteErrorModal
          message={importError}
          onClose={() => setImportError(null)}
        />
      )}

      {/* Import success toast */}
      {importToast && (
        <div style={{
          position: 'fixed',
          bottom: 56,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-default)',
          padding: '8px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          color: '#44AA66',
          textTransform: 'uppercase',
          zIndex: 3500,
          pointerEvents: 'none',
          animation: 'chip-enter 0.2s ease forwards',
        }}>
          {importToast}
        </div>
      )}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/CanvasList.tsx
git commit -m "feat: wire up monolite export and import in CanvasList sidebar"
```

---

## Task 8: Manual End-to-End Verification

No new code — just test the feature works.

- [ ] **Step 1: Start the app**

```bash
cd /home/astral/thinktank/robinwater && cargo tauri dev
```

- [ ] **Step 2: Export test**

1. Add 3+ ideas to a canvas and connect some
2. Right-click the canvas name in the sidebar
3. Click "↗ SHARE AS .MONOLITE"
4. Save to desktop as e.g. `test-monolite.monolite`
5. Confirm button shows "✓ SHARED" briefly
6. Open the saved file in a text editor — verify it has `monolite_version`, `exported_at`, ideas, connections

- [ ] **Step 3: Import test**

1. Click "↓ IMPORT .MONOLITE" in the sidebar
2. Select the file you just saved
3. Confirm the modal shows correct name, idea count, and date
4. Click IMPORT
5. Verify: new canvas appears, all nodes fade in with stagger, viewport is centered, toast shows

- [ ] **Step 4: Collision test**

Import the same file again. Confirm the new canvas is named `[original] (2)`.

- [ ] **Step 5: Error handling test**

Create a file called `bad.monolite` containing `{ "not_monolite": true }`, try to import it.
Confirm error modal shows "INVALID FILE: NOT A MONOLITE FILE".

- [ ] **Step 6: Run unit tests**

```bash
cd /home/astral/thinktank/robinwater && npx vitest run src/utils/monoliteFile.test.ts
```

Expected: all pass.

---

## Quality Checklist Cross-Reference

| Spec requirement | Task |
|-----------------|------|
| Export menu with .monolite option | Task 7 step 5 |
| Canvas picker for .monolite export | uses existing Tauri save dialog |
| Save dialog defaults to correct filename | Task 7 step 3 (`handleShareMonolite`) |
| Exported file is valid JSON with correct structure | Task 2 (`serializeCanvas`) |
| Export includes ideas, connections, tags | Task 2 |
| Export excludes viewport, ghost nodes, config | Task 2 (only `canvas.ideas/connections/aiTagDefinitions` exported) |
| Import button opens file picker | Task 7 step 3 (`handleImportMonolite`) |
| Confirmation modal shows name, count, date | Task 5 |
| New UUIDs generated, no ID collisions | Task 2 (`parseMonoliteFile` UUID remapping) |
| Internal references updated (connections, tags) | Task 2 |
| Name collision appends "(2)", "(3)"... | Task 3 (`importCanvas`) |
| Imported canvas selected, viewport centered | Task 3 (`importCanvas`) |
| Staggered fade-in animation | Task 4 |
| Invalid files show errors | Task 6 |
| Missing connections/tags degrade gracefully | Task 2 |
| HTML sanitized | Task 2 (`stripHtml` on import and export) |
| Files over 10MB rejected | Task 2 |
| Importing twice creates two canvases | Task 3 (new UUID for canvas id each time) |
| Success notification | Task 7 step 7 (toast) |
