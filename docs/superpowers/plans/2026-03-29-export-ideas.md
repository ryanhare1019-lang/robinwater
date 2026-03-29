# Export Ideas to Text File — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click export to canvas rows in the sidebar that writes a structured `.txt` file grouping connected ideas into clusters.

**Architecture:** Pure-TS export utility (`src/utils/export.ts`) handles the cluster algorithm and text formatting with no Tauri dependencies (making it fully testable). A right-click context menu added to `CanvasList.tsx` calls the utility, opens a native save dialog via `tauri-plugin-dialog`, and writes the file via `tauri-plugin-fs`. No new React components needed.

**Tech Stack:** TypeScript, React, Tauri v2 (`tauri-plugin-dialog`, `tauri-plugin-fs`), Vitest

---

### Task 1: Add tauri-plugin-dialog (Rust side)

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add dependency to Cargo.toml**

Replace the full contents of `src-tauri/Cargo.toml`:

```toml
[package]
name = "robinwater"
version = "1.0.0"
edition = "2021"

[lib]
name = "robinwater_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2: Register the plugin in lib.rs**

Replace the full contents of `src-tauri/src/lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Add permissions to capabilities**

Replace the full contents of `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/nicegui/nicegui/main/nicegui/resources/tauri_capabilities.schema.json",
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
    "fs:allow-write"
  ]
}
```

- [ ] **Step 4: Verify Rust compiles**

```bash
cd /home/astral/thinktank/robinwater/src-tauri && cargo check
```

Expected: no errors (unused import warnings are fine).

- [ ] **Step 5: Commit**

```bash
cd /home/astral/thinktank/robinwater
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: add tauri-plugin-dialog for native save dialog"
```

---

### Task 2: Install @tauri-apps/plugin-dialog (JS side)

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the package**

```bash
cd /home/astral/thinktank/robinwater && npm install @tauri-apps/plugin-dialog
```

Expected: `@tauri-apps/plugin-dialog` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @tauri-apps/plugin-dialog"
```

---

### Task 3: Implement export utility with tests

**Files:**
- Create: `src/utils/export.ts`
- Create: `src/utils/export.test.ts`
- Modify: `package.json` (add vitest + test script)

- [ ] **Step 1: Install vitest**

```bash
cd /home/astral/thinktank/robinwater && npm install -D vitest
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add `"test": "vitest run"` to the `scripts` block. Find the `scripts` section and add the line — keep all existing scripts, just add the new one.

- [ ] **Step 3: Write failing tests**

Create `src/utils/export.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildDefaultFilename, buildExportText } from './export';
import type { Canvas, Idea } from '../types';

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  id: 'idea-1',
  text: 'Test idea',
  description: '',
  x: 0,
  y: 0,
  createdAt: '2026-03-29T10:00:00.000Z',
  keywords: [],
  ...overrides,
});

const emptyCanvas: Canvas = {
  id: 'c1',
  name: 'Test Canvas',
  ideas: [],
  connections: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe('buildDefaultFilename', () => {
  it('lowercases and hyphenates canvas name', () => {
    const result = buildDefaultFilename('My Ideas', new Date(2026, 2, 29));
    expect(result).toBe('robinwater-export-my-ideas-2026-03-29.txt');
  });

  it('strips special characters and collapses hyphens', () => {
    const result = buildDefaultFilename('Ideas & Stuff!', new Date(2026, 2, 29));
    expect(result).toBe('robinwater-export-ideas-stuff-2026-03-29.txt');
  });

  it('collapses multiple spaces to a single hyphen', () => {
    const result = buildDefaultFilename('A  B', new Date(2026, 2, 29));
    expect(result).toBe('robinwater-export-a-b-2026-03-29.txt');
  });
});

describe('buildExportText', () => {
  it('outputs (No ideas on this canvas) for empty canvas', () => {
    const result = buildExportText(emptyCanvas);
    expect(result).toContain('(No ideas on this canvas)');
    expect(result).toContain('CANVAS: Test Canvas');
  });

  it('outputs standalone ideas when no connections exist', () => {
    const canvas: Canvas = {
      ...emptyCanvas,
      ideas: [
        makeIdea({ id: 'a', text: 'First idea', description: 'desc a' }),
        makeIdea({ id: 'b', text: 'Second idea', description: '' }),
      ],
      connections: [],
    };
    const result = buildExportText(canvas);
    expect(result).toContain('--- STANDALONE IDEAS ---');
    expect(result).toContain('Idea: First idea');
    expect(result).toContain('  Description: desc a');
    expect(result).toContain('  Description: No description');
    expect(result).not.toContain('--- CLUSTER ---');
  });

  it('groups connected ideas into a cluster', () => {
    const canvas: Canvas = {
      ...emptyCanvas,
      ideas: [
        makeIdea({ id: 'a', text: 'Root', description: 'root desc', createdAt: '2026-01-01T00:00:00.000Z' }),
        makeIdea({ id: 'b', text: 'Child', description: '', createdAt: '2026-01-02T00:00:00.000Z' }),
      ],
      connections: [{ id: 'c1', sourceId: 'a', targetId: 'b' }],
    };
    const result = buildExportText(canvas);
    expect(result).toContain('--- CLUSTER ---');
    expect(result).toContain('Idea: Root');
    expect(result).toContain('    Idea: Child');
    expect(result).not.toContain('--- STANDALONE IDEAS ---');
  });

  it('picks the most-connected idea as cluster root', () => {
    // 'a' connects to both 'b' and 'c' (degree 2); b and c have degree 1 → a is root
    const canvas: Canvas = {
      ...emptyCanvas,
      ideas: [
        makeIdea({ id: 'a', text: 'Hub', createdAt: '2026-01-01T00:00:00.000Z' }),
        makeIdea({ id: 'b', text: 'Spoke B', createdAt: '2026-01-02T00:00:00.000Z' }),
        makeIdea({ id: 'c', text: 'Spoke C', createdAt: '2026-01-03T00:00:00.000Z' }),
      ],
      connections: [
        { id: 'conn1', sourceId: 'a', targetId: 'b' },
        { id: 'conn2', sourceId: 'a', targetId: 'c' },
      ],
    };
    const result = buildExportText(canvas);
    const hubIdx = result.indexOf('Idea: Hub');
    const spokeBIdx = result.indexOf('Idea: Spoke B');
    const spokeCIdx = result.indexOf('Idea: Spoke C');
    expect(hubIdx).toBeGreaterThanOrEqual(0);
    expect(spokeBIdx).toBeGreaterThan(hubIdx);
    expect(spokeCIdx).toBeGreaterThan(hubIdx);
  });

  it('separates clusters from standalones in mixed canvas', () => {
    const canvas: Canvas = {
      ...emptyCanvas,
      ideas: [
        makeIdea({ id: 'a', text: 'Connected A', createdAt: '2026-01-01T00:00:00.000Z' }),
        makeIdea({ id: 'b', text: 'Connected B', createdAt: '2026-01-02T00:00:00.000Z' }),
        makeIdea({ id: 'c', text: 'Lone Wolf', createdAt: '2026-01-03T00:00:00.000Z' }),
      ],
      connections: [{ id: 'conn1', sourceId: 'a', targetId: 'b' }],
    };
    const result = buildExportText(canvas);
    expect(result).toContain('--- CLUSTER ---');
    expect(result).toContain('--- STANDALONE IDEAS ---');
    expect(result).toContain('Idea: Lone Wolf');
  });

  it('handles circular connections without infinite loop', () => {
    const canvas: Canvas = {
      ...emptyCanvas,
      ideas: [
        makeIdea({ id: 'a', text: 'A', createdAt: '2026-01-01T00:00:00.000Z' }),
        makeIdea({ id: 'b', text: 'B', createdAt: '2026-01-02T00:00:00.000Z' }),
        makeIdea({ id: 'c', text: 'C', createdAt: '2026-01-03T00:00:00.000Z' }),
      ],
      connections: [
        { id: 'conn1', sourceId: 'a', targetId: 'b' },
        { id: 'conn2', sourceId: 'b', targetId: 'c' },
        { id: 'conn3', sourceId: 'c', targetId: 'a' },
      ],
    };
    expect(() => buildExportText(canvas)).not.toThrow();
    const result = buildExportText(canvas);
    expect(result).toMatch(/Idea: A/);
    expect(result).toMatch(/Idea: B/);
    expect(result).toMatch(/Idea: C/);
  });
});
```

- [ ] **Step 4: Run tests — expect failure**

```bash
cd /home/astral/thinktank/robinwater && npm test
```

Expected: FAIL — `Cannot find module './export'`

- [ ] **Step 5: Implement export.ts**

Create `src/utils/export.ts`:

```typescript
import type { Canvas, Idea } from '../types';

export function buildDefaultFilename(canvasName: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const safe = canvasName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `robinwater-export-${safe}-${yyyy}-${mm}-${dd}.txt`;
}

export function buildExportText(canvas: Canvas): string {
  const lines: string[] = [];

  // Header
  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-') + ' ' + [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join(':');

  lines.push('=====================================');
  lines.push('ROBINWATER EXPORT');
  lines.push(`CANVAS: ${canvas.name}`);
  lines.push(`DATE: ${dateStr}`);
  lines.push('=====================================');

  if (canvas.ideas.length === 0) {
    lines.push('');
    lines.push('(No ideas on this canvas)');
    return lines.join('\n');
  }

  // Build undirected adjacency map
  const adj = new Map<string, Set<string>>();
  for (const idea of canvas.ideas) adj.set(idea.id, new Set());
  for (const conn of canvas.connections) {
    adj.get(conn.sourceId)?.add(conn.targetId);
    adj.get(conn.targetId)?.add(conn.sourceId);
  }

  // Find connected components via BFS
  const globalVisited = new Set<string>();
  const components: string[][] = [];
  for (const idea of canvas.ideas) {
    if (globalVisited.has(idea.id)) continue;
    const component: string[] = [];
    const queue = [idea.id];
    globalVisited.add(idea.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adj.get(current) ?? []) {
        if (!globalVisited.has(neighbor)) {
          globalVisited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  const ideaById = new Map<string, Idea>(canvas.ideas.map(i => [i.id, i]));
  const clusters = components.filter(c => c.length > 1);
  const standalones = components.filter(c => c.length === 1).map(c => c[0]);

  // Format each cluster
  for (const component of clusters) {
    // Root = most connections; tiebreak = earliest createdAt
    const root = component.reduce((best, id) => {
      const bestDeg = adj.get(best)?.size ?? 0;
      const idDeg = adj.get(id)?.size ?? 0;
      if (idDeg > bestDeg) return id;
      if (idDeg === bestDeg) {
        const bestTime = ideaById.get(best)?.createdAt ?? '';
        const idTime = ideaById.get(id)?.createdAt ?? '';
        return idTime < bestTime ? id : best;
      }
      return best;
    });

    lines.push('');
    lines.push('--- CLUSTER ---');
    lines.push('');

    // DFS from root — depth determines indentation, visited set handles cycles
    const dfsVisited = new Set<string>();
    function dfs(id: string, depth: number): void {
      dfsVisited.add(id);
      const idea = ideaById.get(id)!;
      const ideaIndent = ' '.repeat(depth * 4);
      const descIndent = ' '.repeat(depth * 4 + 2);
      lines.push(`${ideaIndent}Idea: ${idea.text}`);
      lines.push(`${descIndent}Description: ${idea.description || 'No description'}`);
      const children = [...(adj.get(id) ?? [])].filter(n => !dfsVisited.has(n));
      for (const child of children) {
        lines.push('');
        dfs(child, depth + 1);
      }
    }
    dfs(root, 0);
  }

  // Format standalones
  if (standalones.length > 0) {
    lines.push('');
    lines.push('--- STANDALONE IDEAS ---');
    lines.push('');
    for (const id of standalones) {
      const idea = ideaById.get(id)!;
      lines.push(`Idea: ${idea.text}`);
      lines.push(`  Description: ${idea.description || 'No description'}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
```

- [ ] **Step 6: Run tests — expect all to pass**

```bash
cd /home/astral/thinktank/robinwater && npm test
```

Expected: all 9 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils/export.ts src/utils/export.test.ts package.json package-lock.json
git commit -m "feat: add export utility with cluster algorithm and text formatter"
```

---

### Task 4: Wire up right-click context menu in CanvasList

**Files:**
- Modify: `src/components/CanvasList.tsx`

Adds: `ctxMenu` state for the right-click menu position/target, `exportedId` state for the 2-second confirmation flash, `onContextMenu` handler on each canvas row, the context menu panel, `handleExport` async function, and click-outside + Escape close logic.

- [ ] **Step 1: Replace CanvasList.tsx**

Full replacement of `src/components/CanvasList.tsx`:

```typescript
import { useState, useRef, useCallback, useEffect } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "../store/useStore";
import { buildDefaultFilename, buildExportText } from "../utils/export";

export function CanvasList() {
  const canvases = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
  const setLeftSidebarOpen = useStore((s) => s.setLeftSidebarOpen);
  const switchCanvas = useStore((s) => s.switchCanvas);
  const addCanvas = useStore((s) => s.addCanvas);
  const renameCanvas = useStore((s) => s.renameCanvas);
  const deleteCanvas = useStore((s) => s.deleteCanvas);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ canvasId: string; x: number; y: number } | null>(null);
  const [exportedId, setExportedId] = useState<string | null>(null);

  const deleteTimer = useRef<ReturnType<typeof setTimeout>>();
  const exportTimer = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback((id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const finishRename = useCallback(() => {
    if (editingId && editName.trim()) renameCanvas(editingId, editName.trim());
    setEditingId(null);
  }, [editingId, editName, renameCanvas]);

  const handleDelete = useCallback(
    (id: string) => {
      if (deletingId === id) {
        deleteCanvas(id);
        setDeletingId(null);
      } else {
        setDeletingId(id);
        if (deleteTimer.current) clearTimeout(deleteTimer.current);
        deleteTimer.current = setTimeout(() => setDeletingId(null), 3000);
      }
    },
    [deletingId, deleteCanvas]
  );

  const handleExport = useCallback(async (canvasId: string) => {
    setCtxMenu(null);
    const canvas = canvases.find((c) => c.id === canvasId);
    if (!canvas) return;

    const filePath = await save({
      defaultPath: buildDefaultFilename(canvas.name, new Date()),
      filters: [{ name: "Text Files", extensions: ["txt"] }],
    });

    if (!filePath) return; // user cancelled

    await writeTextFile(filePath, buildExportText(canvas));

    setExportedId(canvasId);
    if (exportTimer.current) clearTimeout(exportTimer.current);
    exportTimer.current = setTimeout(() => setExportedId(null), 2000);
  }, [canvases]);

  // Close context menu on click-outside or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-canvas-ctx-menu]")) {
        setCtxMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxMenu(null);
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ctxMenu]);

  const menuItemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "8px 14px",
    background: "none",
    border: "none",
    color: "var(--text-primary)",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    textAlign: "left",
    cursor: "pointer",
    transition: "background 0.1s ease",
    borderRadius: 0,
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
        style={{
          position: "fixed",
          top: 14,
          left: 14,
          zIndex: 1001,
          background: "none",
          border: "1px solid var(--border-default)",
          borderRadius: 0,
          color: "var(--text-secondary)",
          fontSize: "var(--label-size)",
          fontFamily: "var(--font-mono)",
          width: 28,
          height: 28,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          transition: "border-color 0.15s ease, color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--border-strong)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-default)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
      >
        {leftSidebarOpen ? "\u2212" : "+"}
      </button>

      {/* Sidebar panel */}
      {leftSidebarOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            width: 220,
            background: "var(--bg-surface)",
            borderRight: "1px solid var(--border-default)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            animation: "slide-in-left 0.25s var(--ease-out) forwards",
            willChange: "transform",
            fontFamily: "var(--font-mono)",
            borderRadius: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 16px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <span
              style={{
                fontSize: "var(--label-size)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--text-tertiary)",
                fontWeight: 400,
              }}
            >
              CANVASES
            </span>
            <span
              onClick={() => setLeftSidebarOpen(false)}
              style={{
                fontSize: "var(--label-size)",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              [{"\u2212"}]
            </span>
          </div>

          {/* Canvas list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {canvases.map((c) => {
              const isActive = c.id === activeCanvasId;
              const isEditing = editingId === c.id;
              const isConfirmDelete = deletingId === c.id;
              const isExported = exportedId === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (!isEditing && !isConfirmDelete) switchCanvas(c.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ canvasId: c.id, x: e.clientX, y: e.clientY });
                  }}
                  style={{
                    padding: "8px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderLeft: isActive
                      ? "3px solid var(--text-secondary)"
                      : "3px solid transparent",
                    background: isActive ? "var(--bg-active)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: "var(--body-size)",
                    transition: "background 0.1s ease",
                    borderRadius: 0,
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {isConfirmDelete ? (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        fontSize: "var(--label-size)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "var(--accent-red)" }}>DELETE?</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                        style={{
                          background: "none",
                          border: "1px solid var(--accent-red)",
                          borderRadius: 0,
                          color: "var(--accent-red)",
                          cursor: "pointer",
                          fontSize: "var(--label-size)",
                          fontFamily: "var(--font-mono)",
                          padding: "1px 6px",
                        }}
                      >
                        Y
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                        style={{
                          background: "none",
                          border: "1px solid var(--text-tertiary)",
                          borderRadius: 0,
                          color: "var(--text-tertiary)",
                          cursor: "pointer",
                          fontSize: "var(--label-size)",
                          fontFamily: "var(--font-mono)",
                          padding: "1px 6px",
                        }}
                      >
                        N
                      </button>
                    </div>
                  ) : isEditing ? (
                    <input
                      ref={inputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={finishRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") finishRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "1px solid var(--border-focus)",
                        borderRadius: 0,
                        color: "var(--text-primary)",
                        fontSize: "var(--body-size)",
                        fontFamily: "var(--font-mono)",
                        padding: "2px 6px",
                      }}
                    />
                  ) : (
                    <>
                      {isActive && (
                        <span style={{ color: "var(--text-secondary)", fontSize: "var(--body-size)" }}>
                          {"\u25B8"}
                        </span>
                      )}
                      <span
                        style={{
                          flex: 1,
                          fontSize: "var(--body-size)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: isExported ? "#44AA66" : undefined,
                          transition: "color 0.15s ease",
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startRename(c.id, c.name);
                        }}
                      >
                        {isExported ? "✓ EXPORTED" : c.name}
                      </span>
                      <span style={{ fontSize: "var(--label-size)", color: "var(--text-tertiary)" }}>
                        {c.ideas.length}
                      </span>
                      {canvases.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-tertiary)",
                            fontSize: "var(--body-size)",
                            fontFamily: "var(--font-mono)",
                            cursor: "pointer",
                            padding: "0 2px",
                            opacity: 0.5,
                            transition: "opacity 0.1s ease",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
                        >
                          x
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* New canvas button */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => addCanvas()}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-tertiary)",
                fontSize: "var(--label-size)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                padding: "8px 0",
                width: "100%",
                textAlign: "left",
                transition: "color 0.1s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
            >
              + NEW CANVAS
            </button>
          </div>
        </div>
      )}

      {/* Canvas right-click context menu */}
      {ctxMenu && (
        <div
          data-canvas-ctx-menu=""
          style={{
            position: "fixed",
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 3000,
            background: "var(--bg-raised)",
            border: "1px solid var(--border-default)",
            borderRadius: 0,
            padding: 0,
            minWidth: 140,
          }}
        >
          <button
            onClick={() => handleExport(ctxMenu.canvasId)}
            style={menuItemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-active)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            ↗ EXPORT
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Run the dev server and manually test**

```bash
cd /home/astral/thinktank/robinwater && cargo tauri dev
```

Manual test checklist:
1. Open the sidebar (click `+` top-left)
2. Right-click a canvas row → context menu appears with `↗ EXPORT`
3. Press Escape → context menu closes without exporting
4. Right-click again → click elsewhere → menu closes
5. Right-click → click `↗ EXPORT` → native OS save dialog opens with filename `robinwater-export-[name]-YYYY-MM-DD.txt`
6. Cancel the save dialog → no flash, no file written
7. Right-click → Export → pick a location → file is written, canvas row shows `✓ EXPORTED` in green for 2 seconds then reverts to canvas name
8. Open the exported file — verify header, clusters, and standalones are formatted correctly

- [ ] **Step 3: Commit**

```bash
git add src/components/CanvasList.tsx
git commit -m "feat: right-click export on canvas rows with native save dialog"
```
