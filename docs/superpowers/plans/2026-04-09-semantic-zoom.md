# Semantic Zoom + Hover Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-mode node rendering with a 3-level semantic zoom system (full/compact/minimal), and add a hover preview overlay card that shows full node details at any zoom level.

**Architecture:** Zoom level detection lives in a shared utility (`src/utils/zoom.ts`). Each `IdeaNode` subscribes to viewport zoom and computes its own `detailLevel` locally using hysteresis via a ref. The hover preview is a fixed-position overlay rendered in `App.tsx` (outside the canvas transform container) and driven by a `hoverPreview` slice in the store. Connection line opacity and similarity line visibility are adjusted at low zoom inside their respective SVG components.

**Tech Stack:** React 19, Zustand, Tauri/Vite, TypeScript — no new dependencies.

> **NOTE:** Step 1 (core zoom transform) from the spec is already implemented. The canvas already uses a single `transform: scale(zoom)` container with `transformOrigin: '0 0'`, no transition on the transform, multiplicative zoom factors, correct zoom-toward-cursor math, and clamp 0.15–4.0. Start at Task 1 (zoom utilities).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/zoom.ts` | **Create** | `getDetailLevel()` with hysteresis |
| `src/components/IdeaNode.tsx` | **Modify** | Semantic zoom levels + hover trigger |
| `src/components/GhostNodeCard.tsx` | **Modify** | Semantic zoom (compact/minimal) |
| `src/components/NodeHoverPreview.tsx` | **Create** | Fixed-position overlay card |
| `src/components/ZoomIndicator.tsx` | **Create** | Bottom-left zoom readout |
| `src/components/ConnectionLines.tsx` | **Modify** | Opacity bump at zoom < 0.5 |
| `src/components/SimilarityLines.tsx` | **Modify** | Hide below zoom 0.3 |
| `src/store/useStore.ts` | **Modify** | Add `hoverPreview` state slice |
| `src/App.tsx` | **Modify** | Mount ZoomIndicator + NodeHoverPreview |
| `src/styles/global.css` | **Modify** | Add `@keyframes preview-enter` |

---

## Task 1: Zoom utility — `getDetailLevelWithHysteresis`

**Files:**
- Create: `src/utils/zoom.ts`

- [ ] **Step 1: Create the utility**

```typescript
// src/utils/zoom.ts

export type DetailLevel = 'full' | 'compact' | 'minimal';

/**
 * Compute detail level from zoom with hysteresis to prevent threshold flickering.
 *
 * Thresholds (zooming OUT): full→compact at 0.65, compact→minimal at 0.35
 * Thresholds (zooming IN):  minimal→compact at 0.38, compact→full at 0.68
 *
 * Pass the CURRENT (previous render) level as `currentLevel` so hysteresis works.
 * On first render, pass 'full' as currentLevel — the function will immediately
 * return the correct level for whatever zoom the app starts at.
 */
export function getDetailLevelWithHysteresis(
  zoom: number,
  currentLevel: DetailLevel
): DetailLevel {
  switch (currentLevel) {
    case 'full':
      if (zoom < 0.65) return 'compact';
      return 'full';
    case 'compact':
      if (zoom >= 0.68) return 'full';
      if (zoom < 0.35) return 'minimal';
      return 'compact';
    case 'minimal':
      if (zoom >= 0.38) return 'compact';
      return 'minimal';
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/thinktank/robinwater
git add src/utils/zoom.ts
git commit -m "feat: add zoom detail level utility with hysteresis"
```

---

## Task 2: IdeaNode — semantic zoom levels

**Files:**
- Modify: `src/components/IdeaNode.tsx`

The node renders in three modes based on `detailLevel`. Dimensions and padding change per level. The label row, separator, and AI tags section are hidden at compact/minimal using `max-height` + `opacity` CSS transitions (elements stay in DOM, just collapse). The content area always renders but adjusts its text truncation and padding per level. Color tag bar is always visible.

- [ ] **Step 1: Add zoom subscription and detailLevel computation**

At the top of `IdeaNode`, after the existing store subscriptions, add:

```typescript
import { getDetailLevelWithHysteresis, type DetailLevel } from "../utils/zoom";

// Inside IdeaNode component, after existing store hooks:
const zoom = useStore((s) => {
  const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
  return canvas?.viewport.zoom ?? 1;
});
const detailLevelRef = useRef<DetailLevel>('full');
const detailLevel = getDetailLevelWithHysteresis(zoom, detailLevelRef.current);
detailLevelRef.current = detailLevel;
```

- [ ] **Step 2: Replace node container style**

Replace the existing `style={{...}}` on the outer `<div ref={nodeRef}>` with:

```typescript
style={{
  position: "absolute",
  left: idea.x,
  top: idea.y,
  width: idea.width || undefined,
  height: idea.height || undefined,
  minWidth: detailLevel === 'full' ? 200 : detailLevel === 'compact' ? 140 : 100,
  maxWidth: (idea.width !== undefined || idea.height !== undefined)
    ? undefined
    : detailLevel === 'full' ? 340 : detailLevel === 'compact' ? 280 : 200,
  background: "var(--bg-surface)",
  border: `1px solid ${borderColor}`,
  borderLeft: isSelected
    ? `3px solid var(--text-secondary)`
    : `1px solid ${borderColor}`,
  borderRadius: 0,
  color: "var(--text-primary)",
  fontSize: "var(--body-size)",
  lineHeight: 1.5,
  fontWeight: 400,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.01em",
  cursor: isConnecting ? "crosshair" : "default",
  userSelect: "none",
  overflow: "hidden",
  transform: isDeleting
    ? "scale(0)"
    : isDragging
    ? "scale(1.03)"
    : "scale(1)",
  opacity: isDeleting ? 0 : 1,
  transition: isDeleting
    ? "transform 0.25s ease-in, opacity 0.25s ease-in"
    : isDragging
    ? "transform 0.15s ease"
    : "border-color 0.2s ease, transform 0.15s var(--ease-out), opacity 0.15s ease, min-width 0.15s ease, max-width 0.15s ease",
  animation: entering
    ? "node-enter 0.45s var(--ease-spring) forwards, creation-glow 2.5s ease-out forwards"
    : undefined,
  willChange: "transform, opacity",
  zIndex: isDragging ? 100 : isSelected ? 10 : 1,
}}
```

- [ ] **Step 3: Replace the label row (IDEA + date)**

Replace the entire label row `<div>` (the one with "IDEA" and `formatDate`) with:

```tsx
{/* Label row — full level only */}
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 14px",
    fontSize: "var(--label-size)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "var(--text-tertiary)",
    fontWeight: 400,
    maxHeight: detailLevel === 'full' ? '40px' : '0px',
    opacity: detailLevel === 'full' ? 1 : 0,
    overflow: "hidden",
    transition: "max-height 0.15s ease, opacity 0.12s ease",
  }}
>
  <span>IDEA</span>
  {hasDescription && (
    <span style={{ color: "var(--text-secondary)", fontSize: "10px", opacity: 0.5, lineHeight: 1 }}>·</span>
  )}
  <span>{formatDate(idea.createdAt)}</span>
</div>
```

- [ ] **Step 4: Replace the separator**

```tsx
{/* Separator — full level only */}
<div
  style={{
    maxHeight: detailLevel === 'full' ? '1px' : '0px',
    opacity: detailLevel === 'full' ? 1 : 0,
    overflow: "hidden",
    background: "var(--border-subtle)",
    transition: "max-height 0.15s ease, opacity 0.12s ease",
  }}
/>
```

- [ ] **Step 5: Replace the AI tags section**

```tsx
{/* AI Tags — full level only */}
{ideaAiTags.length > 0 && (
  <div
    style={{
      padding: "4px 14px 8px",
      display: "flex",
      flexWrap: "wrap",
      gap: "4px",
      maxHeight: detailLevel === 'full' ? '120px' : '0px',
      opacity: detailLevel === 'full' ? 1 : 0,
      overflow: "hidden",
      transition: "max-height 0.15s ease, opacity 0.12s ease",
    }}
  >
    {ideaAiTags.map((tagDef) => (
      <span
        key={tagDef.id}
        style={{
          fontSize: "9px",
          fontFamily: "monospace",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          padding: "2px 4px 2px 6px",
          border: `1px solid ${tagDef.color}40`,
          background: `${tagDef.color}1F`,
          color: `${tagDef.color}B3`,
          borderRadius: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {tagDef.label}
        {isHovered && (
          <span
            onMouseDown={(e) => { e.stopPropagation(); removeAiTagFromIdea(tagDef.id, idea.id); }}
            style={{ cursor: "pointer", opacity: 0.5, lineHeight: 1, fontSize: "10px" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
          >
            ×
          </span>
        )}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 6: Replace the content area**

The content area handles all three levels. Minimal shows first 25 chars single line; compact shows 2-line clamp; full shows existing behavior.

```typescript
// Compute before the JSX return:
const hasCustomSize = idea.width !== undefined || idea.height !== undefined;

const contentText =
  detailLevel === 'minimal'
    ? (idea.text.length > 25 ? idea.text.slice(0, 25) + '…' : idea.text)
    : hasCustomSize
    ? idea.text
    : idea.text.length > 120
    ? idea.text.slice(0, 120) + '\u2026'
    : idea.text;
```

```tsx
{/* Content */}
<div
  style={{
    padding: detailLevel === 'full'
      ? "8px 14px 12px"
      : detailLevel === 'compact'
      ? "8px 12px"
      : "6px 10px",
    whiteSpace: detailLevel === 'minimal' ? 'nowrap' : hasCustomSize ? 'normal' : undefined,
    display: detailLevel === 'minimal' ? 'block' : hasCustomSize ? undefined : '-webkit-box',
    WebkitLineClamp: detailLevel === 'compact' ? 2 : hasCustomSize ? undefined : 4,
    WebkitBoxOrient: detailLevel === 'minimal' || hasCustomSize ? undefined : 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    wordBreak: detailLevel === 'minimal' ? undefined : 'break-word',
    transition: "padding 0.15s ease",
  }}
>
  {contentText}
</div>
```

Also remove the old `displayText` / `showFullText` variable declarations (they are replaced by `contentText`).

- [ ] **Step 7: Resize handle — only at full detail**

The resize handle should only appear at full detail zoom (since it's only useful when reading the node):

Change the resize handle wrapper from:
```tsx
{(isSelected || isDragging) && !isDeleting && (
```
to:
```tsx
{(isSelected || isDragging) && !isDeleting && detailLevel === 'full' && (
```

- [ ] **Step 8: Manual test**

- Run `npm run tauri dev`
- Zoom out slowly: at 0.65 the label row and date should fade away, node should narrow
- At 0.35 it should collapse to a single-line chip
- Zoom back in: at 0.38 it should expand to compact, at 0.68 to full
- Check that text doesn't re-wrap as you zoom (proportional scaling only)
- Check that nodes with custom sizes don't shrink (minWidth/maxWidth are overridden when idea.width is set)

- [ ] **Step 9: Commit**

```bash
git add src/components/IdeaNode.tsx src/utils/zoom.ts
git commit -m "feat: semantic zoom levels in IdeaNode (full/compact/minimal)"
```

---

## Task 3: GhostNodeCard — semantic zoom

**Files:**
- Modify: `src/components/GhostNodeCard.tsx`

Ghost nodes follow the same level rules: at minimal, show a truncated single-line preview; at compact, show 2-line text; at full, current behavior.

- [ ] **Step 1: Add zoom subscription and detailLevel**

```typescript
import { getDetailLevelWithHysteresis, type DetailLevel } from "../utils/zoom";

// Inside GhostNodeCard, after existing hooks:
const zoom = useStore((s) => {
  const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
  return canvas?.viewport.zoom ?? 1;
});
const detailLevelRef = useRef<DetailLevel>('full');
const detailLevel = getDetailLevelWithHysteresis(zoom, detailLevelRef.current);
detailLevelRef.current = detailLevel;
```

Add `useRef` to the import from react.

- [ ] **Step 2: Adjust outer container style**

Replace the outer `<div>` style to adjust width and padding per level:

```typescript
style={{
  position: "absolute",
  left: ghost.x,
  top: ghost.y,
  minWidth: detailLevel === 'minimal' ? 80 : 140,
  width: detailLevel === 'minimal' ? undefined : 180,
  maxWidth: detailLevel === 'minimal' ? 180 : undefined,
  padding: detailLevel === 'full' ? "12px" : detailLevel === 'compact' ? "8px 10px" : "5px 8px",
  background: "rgba(10, 10, 10, 0.5)",
  border: `1px dashed ${borderColor}`,
  borderRadius: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "13px",
  color: "#888888",
  userSelect: "none",
  opacity: isDismissing ? 0 : 0.65,
  transform: isDismissing ? "scale(0)" : "scale(1)",
  transition: isDismissing
    ? "transform 0.2s ease-in, opacity 0.2s ease-in"
    : "opacity 0.15s ease, padding 0.15s ease",
  zIndex: isHovered ? 50 : 5,
  pointerEvents: "auto",
  overflow: "hidden",
}}
```

- [ ] **Step 3: Adjust text content per level**

Replace the text `<div>` content:

```typescript
const ghostText =
  detailLevel === 'minimal'
    ? (ghost.text.length > 25 ? ghost.text.slice(0, 25) + '…' : ghost.text)
    : ghost.text;
```

```tsx
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
```

- [ ] **Step 4: Hide bottom row at compact/minimal**

Wrap the bottom row (label + accept/dismiss buttons) in a max-height collapse:

```tsx
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
    {/* ... existing bottom row content unchanged ... */}
  </div>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/GhostNodeCard.tsx
git commit -m "feat: semantic zoom levels in GhostNodeCard"
```

---

## Task 4: Store — hover preview state

**Files:**
- Modify: `src/store/useStore.ts`

- [ ] **Step 1: Add type and state to AppState interface**

In the `AppState` interface (around line 65), add:

```typescript
// Hover preview
hoverPreview: { nodeId: string; rect: { left: number; top: number; right: number; bottom: number } } | null;
setHoverPreview: (state: { nodeId: string; rect: { left: number; top: number; right: number; bottom: number } } | null) => void;
```

- [ ] **Step 2: Add initial state and action to the create() body**

In the `create<AppState>((set, get) => { return { ... } })` object, add:

```typescript
hoverPreview: null,
setHoverPreview: (state) => set({ hoverPreview: state }),
```

- [ ] **Step 3: Commit**

```bash
git add src/store/useStore.ts
git commit -m "feat: add hoverPreview state to store"
```

---

## Task 5: NodeHoverPreview component

**Files:**
- Create: `src/components/NodeHoverPreview.tsx`
- Modify: `src/styles/global.css` (add keyframe)

- [ ] **Step 1: Add preview-enter keyframe to global.css**

In `src/styles/global.css`, after the existing `@keyframes` blocks, add:

```css
@keyframes preview-enter {
  from { opacity: 0; transform: translateX(4px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes preview-enter-left {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

- [ ] **Step 2: Create NodeHoverPreview.tsx**

```tsx
// src/components/NodeHoverPreview.tsx
import { useStore } from "../store/useStore";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

const EMPTY_AI_DEFS: import("../types").AITagDefinition[] = [];

export function NodeHoverPreview() {
  const hoverPreview = useStore((s) => s.hoverPreview);
  const zoom = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport.zoom ?? 1;
  });
  const idea = useStore((s) => {
    if (!s.hoverPreview) return null;
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas.find((i) => i.id === s.hoverPreview!.nodeId) ?? null;
  });
  const allIdeas = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas ?? [];
  });
  const connections = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.connections ?? [];
  });
  const aiTagDefs = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.aiTagDefinitions ?? EMPTY_AI_DEFS;
  });

  // Don't show at full detail zoom (>= 0.65) or when no preview active
  if (!hoverPreview || zoom >= 0.65 || !idea) return null;

  const { rect } = hoverPreview;
  const PREVIEW_WIDTH = 320;
  const MARGIN = 12;

  // Prefer right side; flip to left if it would overflow screen
  const rightSide = rect.right + MARGIN + PREVIEW_WIDTH <= window.innerWidth - 16;
  const left = rightSide
    ? rect.right + MARGIN
    : rect.left - PREVIEW_WIDTH - MARGIN;

  // Vertically center with the node, clamped to viewport
  const nodeCenter = (rect.top + rect.bottom) / 2;
  const top = Math.max(16, Math.min(window.innerHeight - 200, nodeCenter - 80));

  // Resolve connected ideas
  const connectedIds = connections
    .filter((c) => c.sourceId === idea.id || c.targetId === idea.id)
    .map((c) => (c.sourceId === idea.id ? c.targetId : c.sourceId));
  const connectedIdeas = allIdeas.filter((i) => connectedIds.includes(i.id));

  // Resolve AI tags
  const ideaAiTags = (idea.aiTags || [])
    .map((id) => aiTagDefs.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  const dividerStyle = {
    height: 1,
    background: "#1A1A1A",
    margin: "12px 0",
  };

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        width: PREVIEW_WIDTH,
        maxHeight: "80vh",
        overflowY: "auto",
        background: "#0C0C0C",
        border: "1px solid #222222",
        zIndex: 3000,
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        color: "var(--text-primary)",
        pointerEvents: "none",
        padding: "14px 16px",
        animation: `${rightSide ? 'preview-enter' : 'preview-enter-left'} 0.15s ease forwards`,
      }}
    >
      {/* Header: IDEA label + date */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: "10px",
        }}
      >
        <span>IDEA</span>
        <span>{formatDate(idea.createdAt)}</span>
      </div>

      <div style={dividerStyle} />

      {/* Full idea text */}
      <div
        style={{
          fontSize: "12px",
          lineHeight: 1.55,
          color: "var(--text-primary)",
          wordBreak: "break-word",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          marginBottom: "12px",
        }}
      >
        {idea.text}
      </div>

      <div style={dividerStyle} />

      {/* Description */}
      <div style={{ marginBottom: "12px" }}>
        <div
          style={{
            fontSize: "9px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text-tertiary)",
            marginBottom: 6,
          }}
        >
          DESCRIPTION
        </div>
        <div
          style={{
            fontSize: "12px",
            lineHeight: 1.55,
            color: idea.description?.trim() ? "var(--text-secondary)" : "#333333",
            wordBreak: "break-word",
          }}
        >
          {idea.description?.trim() || "NO DESCRIPTION"}
        </div>
      </div>

      {/* AI Tags (if any) */}
      {ideaAiTags.length > 0 && (
        <>
          <div style={dividerStyle} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: "12px" }}>
            {ideaAiTags.map((tagDef) => (
              <span
                key={tagDef.id}
                style={{
                  fontSize: "9px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "2px 6px",
                  border: `1px solid ${tagDef.color}40`,
                  background: `${tagDef.color}1F`,
                  color: `${tagDef.color}B3`,
                }}
              >
                {tagDef.label}
              </span>
            ))}
          </div>
        </>
      )}

      <div style={dividerStyle} />

      {/* Connections */}
      <div>
        <div
          style={{
            fontSize: "9px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text-tertiary)",
            marginBottom: 6,
          }}
        >
          CONNECTIONS
        </div>
        {connectedIdeas.length > 0 ? (
          <div
            style={{
              fontSize: "11px",
              color: "#555555",
              lineHeight: 1.6,
              wordBreak: "break-word",
            }}
          >
            {connectedIdeas.map((ci, idx) => (
              <span key={ci.id}>
                {idx > 0 && <span style={{ color: "#333333" }}>,&nbsp;</span>}
                {ci.text.length > 40 ? ci.text.slice(0, 40) + '…' : ci.text}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "11px", color: "#333333" }}>NO CONNECTIONS</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NodeHoverPreview.tsx src/styles/global.css
git commit -m "feat: NodeHoverPreview overlay component"
```

---

## Task 6: IdeaNode — hover preview trigger

**Files:**
- Modify: `src/components/IdeaNode.tsx`

- [ ] **Step 1: Add hover preview trigger logic**

Add `hoverTimer` ref and `setHoverPreview` store action inside `IdeaNode`:

```typescript
const setHoverPreview = useStore((s) => s.setHoverPreview);
const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 2: Replace onMouseEnter/onMouseLeave handlers**

Replace the inline `onMouseEnter` and `onMouseLeave` props on the outer `<div>`:

```tsx
onMouseEnter={() => {
  if (entering || isDragging || isDeleting) return;
  setIsHovered(true);
  // Schedule hover preview — only at compact/minimal zoom, not in connect mode
  const currentZoom = detailLevelRef.current !== 'full' && !connectingFrom;
  if (currentZoom && nodeRef.current) {
    const capturedRef = nodeRef.current;
    hoverTimer.current = setTimeout(() => {
      const rect = capturedRef.getBoundingClientRect();
      setHoverPreview({
        nodeId: idea.id,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      });
    }, 300);
  }
}}
onMouseLeave={() => {
  setIsHovered(false);
  if (hoverTimer.current) {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }
  setHoverPreview(null);
}}
```

Note: `detailLevelRef.current !== 'full'` is used instead of `detailLevel !== 'full'` to avoid a stale closure issue (the handler is re-created on each render so `detailLevel` is always current — either form works).

- [ ] **Step 3: Clear hover preview on drag start**

In the drag `onMouseDown` handler, after `setIsDragging(true)`, clear any active preview:

```typescript
setHoverPreview(null);
if (hoverTimer.current) {
  clearTimeout(hoverTimer.current);
  hoverTimer.current = null;
}
```

Also add a cleanup `useEffect` for the timer:

```typescript
useEffect(() => {
  return () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/IdeaNode.tsx
git commit -m "feat: hover preview trigger in IdeaNode (300ms delay)"
```

---

## Task 7: Mount NodeHoverPreview and ZoomIndicator in App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import and add components**

Add imports at the top of `App.tsx`:

```typescript
import { NodeHoverPreview } from "./components/NodeHoverPreview";
import { ZoomIndicator } from "./components/ZoomIndicator";
```

In the `return (...)` JSX, after `<ContextMenu />`, add:

```tsx
<NodeHoverPreview />
<ZoomIndicator />
```

These render outside the canvas transform container so they appear in viewport space. Both are fixed-position, so they won't affect layout.

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: mount NodeHoverPreview and ZoomIndicator in App"
```

---

## Task 8: Connection line opacity adjustments

**Files:**
- Modify: `src/components/ConnectionLines.tsx`
- Modify: `src/components/SimilarityLines.tsx`

- [ ] **Step 1: ConnectionLines — bump opacity at low zoom**

In `ConnectionLines.tsx`, add a zoom subscription:

```typescript
const zoom = useStore((s) => {
  const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
  return canvas?.viewport.zoom ?? 1;
});
```

Change the visible path's `opacity` from the hardcoded `0.45` to:

```tsx
opacity={zoom < 0.5 ? 0.6 : 0.45}
strokeWidth={zoom < 0.2 ? 1.5 : 1}
```

- [ ] **Step 2: SimilarityLines — hide below zoom 0.3**

In `SimilarityLines.tsx`, add a zoom subscription:

```typescript
const zoom = useStore((s) => {
  const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
  return canvas?.viewport.zoom ?? 1;
});
```

After the early return for empty lines, add:

```typescript
// Similarity lines are too subtle to be useful at very low zoom
if (zoom < 0.3) return null;
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ConnectionLines.tsx src/components/SimilarityLines.tsx
git commit -m "feat: adjust connection line visibility at low zoom"
```

---

## Task 9: ZoomIndicator component

**Files:**
- Create: `src/components/ZoomIndicator.tsx`

- [ ] **Step 1: Create ZoomIndicator.tsx**

```tsx
// src/components/ZoomIndicator.tsx
import { useStore } from "../store/useStore";

export function ZoomIndicator() {
  const zoom = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.viewport.zoom ?? 1;
  });
  const setViewport = useStore((s) => s.setViewport);
  const ideas = useStore((s) => {
    const canvas = s.canvases.find((c) => c.id === s.activeCanvasId);
    return canvas?.ideas ?? [];
  });

  const handleClick = () => {
    if (ideas.length === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
    } else {
      const midX = ideas.reduce((sum, i) => sum + i.x, 0) / ideas.length;
      const midY = ideas.reduce((sum, i) => sum + i.y, 0) / ideas.length;
      setViewport({
        x: window.innerWidth / 2 - midX,
        y: window.innerHeight / 2 - midY,
        zoom: 1,
      });
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 600,
        fontSize: "10px",
        fontFamily: "var(--font-mono)",
        color: "#333333",
        cursor: "pointer",
        userSelect: "none",
        letterSpacing: "0.04em",
        transition: "color 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#666666")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#333333")}
      title="Click to reset zoom (Ctrl+0)"
    >
      {zoom.toFixed(2)}x
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ZoomIndicator.tsx
git commit -m "feat: ZoomIndicator bottom-left zoom level display"
```

---

## Task 10: Manual QA pass

Run the app and test the full checklist from the spec:

- [ ] `npm run tauri dev`
- [ ] Zoom to 0.15 — nodes in minimal mode, chip-style, proportionally correct (no text re-wrap)
- [ ] Zoom to 0.5 — compact mode, 2-line text, no labels/tags/date
- [ ] Zoom to 1.0 — full mode, all elements visible
- [ ] Zoom to 2.0 and 4.0 — full mode, crisp text, no layout issues
- [ ] Slowly zoom from 1.0 to 0.5: label row and separator fade out smoothly
- [ ] Slowly zoom from 0.5 to 0.3: content collapses to single line
- [ ] Zoom back in from 0.3: hysteresis kicks in — switches to compact at 0.38, full at 0.68
- [ ] Hover over a node at zoom 0.5 for 300ms — preview card appears on right side
- [ ] Hover over a node near right edge — preview flips to left side
- [ ] Hover preview shows full text, description (or "NO DESCRIPTION"), AI tags, connections
- [ ] Hover preview disappears when cursor leaves node
- [ ] Hover preview does NOT appear at zoom >= 0.65
- [ ] Hover preview does NOT appear in connection mode (right-click connecting)
- [ ] Zoom indicator shows current zoom in bottom-left corner
- [ ] Click zoom indicator — resets to zoom 1.0 centered on ideas (same as Ctrl+0)
- [ ] Create a new node at zoom 0.3 — node appears, then immediately shows in minimal mode
- [ ] Drag a node at zoom 0.3 — drags correctly (coords are in canvas space, unaffected by zoom)
- [ ] Drag a node at zoom 3.0 — same
- [ ] Connection lines visible at zoom 0.3 (opacity bumped)
- [ ] Similarity lines hidden at zoom < 0.3
- [ ] Ghost nodes follow semantic zoom (compact/minimal)
- [ ] Right sidebar still opens and works

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Step 1: Core zoom transform fix | ✅ Already done (previous session) |
| Level 1 FULL: full content, 200px–340px | Task 2 |
| Level 2 COMPACT: text only, 2 lines, 140px–280px | Task 2 |
| Level 3 MINIMAL: 25 chars, single line, 100px–200px | Task 2 |
| Smooth transitions between levels | Task 2 (max-height + opacity) |
| Hysteresis at thresholds | Task 1 + 2 |
| Color tag left-border at all levels | Task 2 (unchanged, always visible) |
| Hover preview after 300ms | Task 5 + 6 |
| Preview in viewport space | Task 5 (fixed position in App) |
| Preview: full text, description, AI tags, connections | Task 5 |
| Preview: position right/flip left | Task 5 |
| Preview: entrance/exit animation | Task 5 (global.css keyframe) |
| Preview NOT at zoom >= 0.65 | Task 5 (conditional render) |
| Preview NOT during drag/connect mode | Task 6 |
| Connection lines: opacity bump at zoom < 0.5 | Task 8 |
| Similarity lines: hide below zoom 0.3 | Task 8 |
| Zoom indicator bottom-left | Task 9 |
| Zoom indicator click → reset | Task 9 |
| Ghost nodes follow semantic zoom | Task 3 |
