# Connection Rendering Performance Optimization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate canvas sluggishness when many connections/similarity lines are visible by switching similarity lines to Canvas2D batch drawing, adding memoization + viewport culling to user connections, and memoizing the BFS cluster computation.

**Architecture:** Hybrid rendering — similarity lines (non-interactive, high volume, main bottleneck) move to a Canvas2D layer that batch-draws in one paint call. User connections (interactive, lower volume) stay as SVG with memoization and viewport culling. The BFS cluster computation in Canvas.tsx gets wrapped in useMemo. Store selectors get tightened to avoid cascading re-renders.

**Tech Stack:** React 19, Canvas2D API, Zustand selectors, useMemo/React.memo

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/SimilarityCanvas.tsx` | **Create** | Canvas2D batch renderer for similarity lines |
| `src/components/SimilarityLines.tsx` | **Delete** | Replaced by SimilarityCanvas |
| `src/components/ConnectionLines.tsx` | **Modify** | Add memoization, viewport culling, granular selectors |
| `src/components/Canvas.tsx` | **Modify** | Memoize BFS/cluster logic, swap SimilarityLines → SimilarityCanvas |
| `src/utils/viewportCulling.ts` | **Create** | Shared viewport intersection test for line segments |
| `src/utils/viewportCulling.test.ts` | **Create** | Tests for viewport culling utility |

---

### Task 1: Viewport Culling Utility

**Files:**
- Create: `src/utils/viewportCulling.ts`
- Create: `src/utils/viewportCulling.test.ts`

This utility determines whether a line segment (defined by two endpoints) intersects a rectangular viewport. Used by both the Canvas2D similarity renderer and the SVG connection renderer to skip offscreen lines.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/viewportCulling.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { lineIntersectsViewport, getViewportBounds } from './viewportCulling';

describe('getViewportBounds', () => {
  it('converts viewport + screen dimensions to canvas-space rect', () => {
    const bounds = getViewportBounds(
      { x: -100, y: -50, zoom: 2 },
      1000,
      800,
      0  // no padding for test clarity
    );
    // canvas coords: left = (0 - (-100)) / 2 = 50
    // right = (1000 - (-100)) / 2 = 550
    // top = (0 - (-50)) / 2 = 25
    // bottom = (800 - (-50)) / 2 = 425
    expect(bounds).toEqual({ left: 50, right: 550, top: 25, bottom: 425 });
  });

  it('handles zoom = 1, no pan', () => {
    const bounds = getViewportBounds({ x: 0, y: 0, zoom: 1 }, 1920, 1080, 0);
    expect(bounds).toEqual({ left: 0, right: 1920, top: 0, bottom: 1080 });
  });
});

describe('lineIntersectsViewport', () => {
  const viewport = { left: 0, right: 100, top: 0, bottom: 100 };

  it('returns true when both endpoints inside viewport', () => {
    expect(lineIntersectsViewport(10, 10, 90, 90, viewport)).toBe(true);
  });

  it('returns true when line crosses viewport (both endpoints outside)', () => {
    expect(lineIntersectsViewport(-50, 50, 150, 50, viewport)).toBe(true);
  });

  it('returns true when one endpoint inside', () => {
    expect(lineIntersectsViewport(50, 50, 200, 200, viewport)).toBe(true);
  });

  it('returns false when line is fully above viewport', () => {
    expect(lineIntersectsViewport(10, -50, 90, -10, viewport)).toBe(false);
  });

  it('returns false when line is fully to the right', () => {
    expect(lineIntersectsViewport(150, 10, 200, 90, viewport)).toBe(false);
  });

  it('returns false when line is fully below', () => {
    expect(lineIntersectsViewport(10, 150, 90, 200, viewport)).toBe(false);
  });

  it('returns false when diagonal line misses viewport', () => {
    // Line from top-right area to bottom-right area, both outside
    expect(lineIntersectsViewport(150, -50, 200, 150, viewport)).toBe(false);
  });

  it('returns true for a line that just clips the corner', () => {
    // Diagonal crossing near (0,0) corner
    expect(lineIntersectsViewport(-10, 10, 10, -10, viewport)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/astral/thinktank/robinwater && npx vitest run src/utils/viewportCulling.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement viewport culling utility**

Create `src/utils/viewportCulling.ts`:

```typescript
import { Viewport } from "../types";

export interface ViewportBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Convert viewport state + screen dimensions to a canvas-space bounding rect.
 * Adds padding so lines approaching the edge aren't popped in/out abruptly.
 */
export function getViewportBounds(
  viewport: Viewport,
  screenWidth: number,
  screenHeight: number,
  padding = 200
): ViewportBounds {
  const left = (0 - viewport.x) / viewport.zoom - padding;
  const right = (screenWidth - viewport.x) / viewport.zoom + padding;
  const top = (0 - viewport.y) / viewport.zoom - padding;
  const bottom = (screenHeight - viewport.y) / viewport.zoom + padding;
  return { left, right, top, bottom };
}

/**
 * Fast check: does the line segment (x1,y1)→(x2,y2) intersect the rect?
 * Uses Cohen-Sutherland outcode clipping — no allocations, early exits.
 */
export function lineIntersectsViewport(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  vp: ViewportBounds
): boolean {
  let code1 = outcode(x1, y1, vp);
  let code2 = outcode(x2, y2, vp);

  while (true) {
    if ((code1 | code2) === 0) return true;   // both inside
    if ((code1 & code2) !== 0) return false;   // both in same outside zone
    // Line straddles — clip to edge and retest
    const codeOut = code1 !== 0 ? code1 : code2;
    let x: number, y: number;
    if (codeOut & 8) {        // above
      x = x1 + (x2 - x1) * (vp.top - y1) / (y2 - y1);
      y = vp.top;
    } else if (codeOut & 4) { // below
      x = x1 + (x2 - x1) * (vp.bottom - y1) / (y2 - y1);
      y = vp.bottom;
    } else if (codeOut & 2) { // right
      y = y1 + (y2 - y1) * (vp.right - x1) / (x2 - x1);
      x = vp.right;
    } else {                  // left
      y = y1 + (y2 - y1) * (vp.left - x1) / (x2 - x1);
      x = vp.left;
    }
    if (codeOut === code1) {
      x1 = x; y1 = y;
      code1 = outcode(x1, y1, vp);
    } else {
      x2 = x; y2 = y;
      code2 = outcode(x2, y2, vp);
    }
  }
}

function outcode(x: number, y: number, vp: ViewportBounds): number {
  let code = 0;
  if (x < vp.left) code |= 1;
  if (x > vp.right) code |= 2;
  if (y > vp.bottom) code |= 4;
  if (y < vp.top) code |= 8;
  return code;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/astral/thinktank/robinwater && npx vitest run src/utils/viewportCulling.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/viewportCulling.ts src/utils/viewportCulling.test.ts
git commit -m "feat: add viewport culling utility with Cohen-Sutherland line clipping"
```

---

### Task 2: Canvas2D Similarity Line Renderer

**Files:**
- Create: `src/components/SimilarityCanvas.tsx`
- Modify: `src/components/Canvas.tsx` (swap import)
- Delete: `src/components/SimilarityLines.tsx` (after swap is verified)

Replace the SVG `<line>` approach (one DOM node per similarity line) with a single `<canvas>` element that batch-draws all lines in one paint call. No DOM nodes per line. No React reconciliation overhead.

- [ ] **Step 1: Create SimilarityCanvas component**

Create `src/components/SimilarityCanvas.tsx`:

```tsx
import { useRef, useEffect, useCallback } from "react";
import { useStore } from "../store/useStore";
import { getViewportBounds, lineIntersectsViewport } from "../utils/viewportCulling";

interface SimilarityCanvasProps {
  hiddenIds?: Set<string>;
}

export function SimilarityCanvas({ hiddenIds }: SimilarityCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const lines = useStore((s) => s.similarityLines);
  const ideas = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas ?? [];
  });
  const zoom = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport.zoom ?? 1;
  });
  const viewport = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport ?? { x: 0, y: 0, zoom: 1 };
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Resize canvas if needed
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (lines.length === 0 || zoom < 0.3) return;

    const ideasById = new Map(ideas.map((i) => [i.id, i]));
    const vpBounds = getViewportBounds(viewport, w, h);

    ctx.save();
    ctx.scale(dpr, dpr);
    // Apply viewport transform (same as the CSS transform on the parent,
    // but we draw in screen space since canvas is fixed-position)
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Read CSS variable for line color
    const lineColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--line-color")
      .trim() || "rgba(255,255,255,0.07)";

    // Batch draw tag lines (dashed, higher opacity)
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1 / viewport.zoom; // Keep 1px apparent width

    // First pass: solid keyword lines
    ctx.globalAlpha = 0.07;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (const line of lines) {
      if (line.reason === "tag") continue;
      if (hiddenIds?.has(line.fromId) || hiddenIds?.has(line.toId)) continue;
      const from = ideasById.get(line.fromId);
      const to = ideasById.get(line.toId);
      if (!from || !to) continue;

      const x1 = from.x + 100;
      const y1 = from.y + 22;
      const x2 = to.x + 100;
      const y2 = to.y + 22;

      if (!lineIntersectsViewport(x1, y1, x2, y2, vpBounds)) continue;

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // Second pass: dashed tag lines
    ctx.globalAlpha = 0.12;
    ctx.setLineDash([4 / viewport.zoom, 6 / viewport.zoom]);
    ctx.beginPath();
    for (const line of lines) {
      if (line.reason !== "tag") continue;
      if (hiddenIds?.has(line.fromId) || hiddenIds?.has(line.toId)) continue;
      const from = ideasById.get(line.fromId);
      const to = ideasById.get(line.toId);
      if (!from || !to) continue;

      const x1 = from.x + 100;
      const y1 = from.y + 22;
      const x2 = to.x + 100;
      const y2 = to.y + 22;

      if (!lineIntersectsViewport(x1, y1, x2, y2, vpBounds)) continue;

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    ctx.restore();
  }, [lines, ideas, zoom, viewport, hiddenIds]);

  useEffect(() => {
    // Cancel any pending frame before scheduling a new one
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Also redraw on window resize
  useEffect(() => {
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  if (lines.length === 0 || zoom < 0.3) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
```

**Key design decisions:**
- Canvas is **fixed-position** and draws in **screen space** (applies viewport transform itself) rather than being inside the CSS-transformed parent. This is because `<canvas>` inside a CSS-scaled parent would get blurry — we need to control the pixel ratio ourselves.
- Two batched `beginPath()/stroke()` calls — one for keyword lines (solid), one for tag lines (dashed). This means only 2 draw calls regardless of line count.
- `requestAnimationFrame` coalesces multiple state changes into a single paint.
- Viewport culling via `lineIntersectsViewport` skips offscreen lines.

- [ ] **Step 2: Swap SimilarityLines → SimilarityCanvas in Canvas.tsx**

In `src/components/Canvas.tsx`, change the import and usage:

Replace:
```typescript
import { SimilarityLines } from "./SimilarityLines";
```
With:
```typescript
import { SimilarityCanvas } from "./SimilarityCanvas";
```

Replace in the JSX (inside the `transformRef` div):
```tsx
<SimilarityLines hiddenIds={hiddenIds} />
```
With (move it **outside** the transform div, since SimilarityCanvas is fixed-position and applies its own transform):
```tsx
```

And add the SimilarityCanvas right before the outer container div:
```tsx
return (
    <>
      <SimilarityCanvas hiddenIds={hiddenIds} />
      <div
        onMouseDown={onMouseDown}
        ...
```

- [ ] **Step 3: Verify similarity lines still render correctly**

Run: `cd /home/astral/thinktank/robinwater && npm run build`
Expected: No type errors.

Manual test: Open the app, create a few ideas with shared keywords/tags, verify similarity lines appear with correct position, opacity, and dashing. Pan and zoom to confirm lines track correctly.

- [ ] **Step 4: Delete old SimilarityLines.tsx**

```bash
rm src/components/SimilarityLines.tsx
```

Verify no remaining imports:
```bash
grep -r "SimilarityLines" src/
```
Expected: No results.

- [ ] **Step 5: Commit**

```bash
git add src/components/SimilarityCanvas.tsx src/components/Canvas.tsx
git rm src/components/SimilarityLines.tsx
git commit -m "perf: replace SVG similarity lines with Canvas2D batch renderer

Eliminates hundreds of SVG DOM nodes. All similarity lines now drawn in
two batched Canvas2D stroke calls with viewport culling."
```

---

### Task 3: Memoize BFS Cluster Computation in Canvas.tsx

**Files:**
- Modify: `src/components/Canvas.tsx:34-80`

The BFS that finds connected components, hub nodes, and hidden IDs currently runs inline on every render — including during drags when only node positions change. Extract it into `useMemo` keyed on the connection array and collapsed hubs.

- [ ] **Step 1: Wrap cluster computation in useMemo**

In `src/components/Canvas.tsx`, add `useMemo` to imports (line 1):

```typescript
import { useRef, useCallback, useEffect, useState, useMemo } from "react";
```

Replace the inline cluster computation (lines 34-80) with:

```typescript
  const { hubIds, hiddenIds } = useMemo(() => {
    // Build adjacency map
    const adj = new Map<string, Set<string>>();
    for (const idea of ideas) adj.set(idea.id, new Set());
    for (const conn of connections) {
      adj.get(conn.sourceId)?.add(conn.targetId);
      adj.get(conn.targetId)?.add(conn.sourceId);
    }

    // Find connected components via BFS
    const visited = new Set<string>();
    const components: string[][] = [];
    for (const idea of ideas) {
      if (visited.has(idea.id)) continue;
      const component: string[] = [];
      const queue = [idea.id];
      visited.add(idea.id);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        component.push(curr);
        for (const neighbor of adj.get(curr) ?? []) {
          if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
        }
      }
      components.push(component);
    }

    // Find hub of each cluster
    const hubIds = new Set<string>();
    for (const comp of components) {
      if (comp.length < 2) continue;
      const hub = comp.reduce((best, id) =>
        (adj.get(id)?.size ?? 0) > (adj.get(best)?.size ?? 0) ? id : best
      );
      hubIds.add(hub);
    }

    // Compute hidden ideas
    const collapsedHubs = canvas?.collapsedHubs || [];
    const hiddenIds = new Set<string>();
    for (const hubId of collapsedHubs) {
      const comp = components.find((c) => c.includes(hubId));
      if (!comp) continue;
      for (const id of comp) {
        if (id !== hubId) hiddenIds.add(id);
      }
    }

    return { hubIds, hiddenIds, components };
  }, [ideas, connections, canvas?.collapsedHubs]);
```

Also extract `components` from the memo result since it's used for `collapsedCount` in the IdeaNode rendering.

- [ ] **Step 2: Remove the now-unused standalone variables**

Delete the old inline `adj`, `visited`, `components`, `hubIds`, `collapsedHubs`, `hiddenIds` block (lines 34-80, now replaced by the useMemo above). The `collapsedHubs` reference in the IdeaNode JSX should use `canvas?.collapsedHubs || []`.

Update the JSX that uses `components` for `collapsedCount`:

```tsx
collapsedCount={
  (canvas?.collapsedHubs || []).includes(idea.id)
    ? ((useMemo result).components.find((c) => c.includes(idea.id))?.length ?? 1) - 1
    : 0
}
```

To keep this clean, destructure `components` from the memo result:

```typescript
const { hubIds, hiddenIds, components } = useMemo(() => {
  // ... (same as above)
  return { hubIds, hiddenIds, components };
}, [ideas, connections, canvas?.collapsedHubs]);
```

- [ ] **Step 3: Verify build and behavior**

Run: `cd /home/astral/thinktank/robinwater && npm run build`
Expected: No errors.

Manual test: Open app, create a cluster of connected ideas, collapse it, verify hub/hidden logic works correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/Canvas.tsx
git commit -m "perf: memoize BFS cluster computation in Canvas

Only recomputes when connections or collapsedHubs change, not on every
node drag or viewport pan."
```

---

### Task 4: Optimize ConnectionLines with Memoization + Viewport Culling

**Files:**
- Modify: `src/components/ConnectionLines.tsx`

Three optimizations:
1. Granular zustand selectors (stop reading entire `canvases` array)
2. Memoize `ideasById` map and path data
3. Viewport culling — skip connections whose bounding box is offscreen

- [ ] **Step 1: Rewrite ConnectionLines with optimizations**

Replace `src/components/ConnectionLines.tsx` entirely:

```tsx
import { useMemo, memo } from "react";
import { useStore } from "../store/useStore";
import { getViewportBounds, lineIntersectsViewport } from "../utils/viewportCulling";

interface ConnectionLinesProps {
  hiddenIds?: Set<string>;
}

function getCurveControlPoints(
  x1: number, y1: number, x2: number, y2: number
): { cpx: number; cpy: number } {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { cpx: mx, cpy: my };
  const offset = Math.min(60, dist * 0.2);
  const nx = -dy / dist;
  const ny = dx / dist;
  return { cpx: mx + nx * offset, cpy: my + ny * offset };
}

interface PathData {
  id: string;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sourceId: string;
  targetId: string;
}

function ConnectionLinesInner({ hiddenIds }: ConnectionLinesProps) {
  // Granular selectors — only subscribe to what we need
  const ideas = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas ?? [];
  });
  const connections = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.connections ?? [];
  });
  const removeConnection = useStore((s) => s.removeConnection);
  const viewport = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport ?? { x: 0, y: 0, zoom: 1 };
  });

  // Memoize ideasById map — only rebuilds when ideas array ref changes
  const ideasById = useMemo(
    () => new Map(ideas.map((i) => [i.id, i])),
    [ideas]
  );

  // Memoize all path data — only recalculates when connections or idea positions change
  const paths = useMemo((): PathData[] => {
    const result: PathData[] = [];
    for (const conn of connections) {
      const source = ideasById.get(conn.sourceId);
      const target = ideasById.get(conn.targetId);
      if (!source || !target) continue;

      const x1 = source.x + (source.width || 200) / 2;
      const y1 = source.y + 22;
      const x2 = target.x + (target.width || 200) / 2;
      const y2 = target.y + 22;
      const { cpx, cpy } = getCurveControlPoints(x1, y1, x2, y2);

      result.push({
        id: conn.id,
        d: `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`,
        x1, y1, x2, y2,
        sourceId: conn.sourceId,
        targetId: conn.targetId,
      });
    }
    return result;
  }, [connections, ideasById]);

  // Viewport culling
  const vpBounds = useMemo(
    () => getViewportBounds(viewport, window.innerWidth, window.innerHeight),
    [viewport]
  );

  if (paths.length === 0) return null;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 20000,
        height: 20000,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {paths.map((p) => {
        // Skip hidden connections
        if (hiddenIds?.has(p.sourceId) || hiddenIds?.has(p.targetId)) return null;

        // Viewport culling — skip if both endpoints are offscreen
        if (!lineIntersectsViewport(p.x1, p.y1, p.x2, p.y2, vpBounds)) return null;

        return (
          <g key={p.id}>
            <path
              d={p.d}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={() => removeConnection(p.id)}
            />
            <path
              d={p.d}
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth={viewport.zoom < 0.2 ? 1.5 : 1}
              opacity={viewport.zoom < 0.5 ? 0.6 : 0.45}
              style={{ pointerEvents: "none" }}
            />
          </g>
        );
      })}
    </svg>
  );
}

export const ConnectionLines = memo(ConnectionLinesInner);
```

- [ ] **Step 2: Verify build**

Run: `cd /home/astral/thinktank/robinwater && npm run build`
Expected: No errors.

- [ ] **Step 3: Manual test**

Open app, verify:
- User connections still render as curved lines
- Click on a connection line to delete it — still works
- Pan around — connections that go offscreen don't cause visible pop-in (200px padding helps)
- Zoom in/out — stroke width and opacity adjust correctly

- [ ] **Step 4: Commit**

```bash
git add src/components/ConnectionLines.tsx
git commit -m "perf: add memoization and viewport culling to ConnectionLines

Granular zustand selectors, memoized path data, Cohen-Sutherland
viewport culling. Wrapped in React.memo."
```

---

### Task 5: Tighten Store Selectors to Prevent Cascading Re-renders

**Files:**
- Modify: `src/components/ConnectionLines.tsx` (already done in Task 4)
- Modify: `src/components/Canvas.tsx`

The `Canvas` component subscribes to `canvases` (the entire array) which means ANY mutation to ANY canvas triggers a re-render of Canvas and all children. We should use derived selectors that extract only what's needed.

- [ ] **Step 1: Add shallow equality selectors in Canvas.tsx**

In `src/components/Canvas.tsx`, replace the broad selectors:

Replace:
```typescript
const canvases = useStore((s) => s.canvases);
const activeCanvasId = useStore((s) => s.activeCanvasId);
// ...
const canvas = canvases.find((c) => c.id === activeCanvasId);
const ideas = canvas?.ideas || [];
const connections = canvas?.connections || [];
const viewport = canvas?.viewport || { x: 0, y: 0, zoom: 1 };
```

With targeted selectors:
```typescript
const activeCanvasId = useStore((s) => s.activeCanvasId);
const ideas = useStore((s) => {
  const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
  return canvas?.ideas || [];
});
const connections = useStore((s) => {
  const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
  return canvas?.connections || [];
});
const viewport = useStore((s) => {
  const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
  return canvas?.viewport || { x: 0, y: 0, zoom: 1 };
});
const collapsedHubs = useStore((s) => {
  const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
  return canvas?.collapsedHubs || [];
});
```

Then update `useMemo` deps to use `collapsedHubs` directly instead of `canvas?.collapsedHubs`.

Remove the `canvas` variable from the component body except where still needed (e.g., for `collapsedCount` in IdeaNode JSX — replace `canvas?.collapsedHubs || []` with `collapsedHubs`).

- [ ] **Step 2: Verify build and behavior**

Run: `cd /home/astral/thinktank/robinwater && npm run build`
Expected: No errors.

Manual test: Switch between canvases, verify each shows its own connections and ideas. Collapse/expand clusters. Undo/redo.

- [ ] **Step 3: Commit**

```bash
git add src/components/Canvas.tsx
git commit -m "perf: use granular zustand selectors in Canvas component

Avoids re-rendering the entire canvas tree when unrelated state changes."
```

---

### Task 6: Integration Testing and Edge Cases

**Files:**
- All modified files from previous tasks

- [ ] **Step 1: Run all existing tests**

```bash
cd /home/astral/thinktank/robinwater && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 2: Run production build**

```bash
cd /home/astral/thinktank/robinwater && npm run build
```
Expected: No errors or warnings.

- [ ] **Step 3: Manual integration test checklist**

Test each scenario:
- [ ] Create 10+ ideas with shared keywords → similarity lines appear (Canvas2D)
- [ ] Pan around → lines track correctly, no jitter
- [ ] Zoom to < 0.3 → similarity lines disappear
- [ ] Zoom back up → they reappear
- [ ] Create user connections between ideas → curved SVG lines appear
- [ ] Click a user connection → it deletes
- [ ] Drag a node → connections follow smoothly
- [ ] Collapse a cluster → connected lines hide
- [ ] Undo/redo → connections restore correctly
- [ ] Switch canvases → correct lines for each canvas
- [ ] Window resize → Canvas2D redraws at correct size

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address edge cases from integration testing"
```
