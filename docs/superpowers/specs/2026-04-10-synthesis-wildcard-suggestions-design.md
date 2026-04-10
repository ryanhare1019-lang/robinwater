# Monolite — Synthesis Suggestions & Wild Card Ideas

**Date:** 2026-04-10  
**Status:** Approved

---

## Overview

Expand the AI suggestion system from one type (extensions) to three:

1. **Extensions** (existing) — build on a single specific idea. Model: `claude-haiku-4-5-20251001`.
2. **Synthesis** (new) — bridge clusters or connect themes across the canvas. Model: `claude-sonnet-4-6`.
3. **Wild Cards** (new) — creative left-field ideas that break existing thinking patterns. Model: `claude-sonnet-4-6`.

A fourth mode, **ALL**, generates a mix of all three in one API call (Sonnet).

---

## Data Model

### `GhostNode` (expanded in `types.ts`)

```typescript
export interface GhostNode {
  id: string;
  text: string;
  type: 'extension' | 'synthesis' | 'wildcard' | 'question';
  relatedToId: string | null;        // extension: source idea id; others: null
  bridgedClusterIds?: string[][];    // synthesis: [[ideaId, ...], [ideaId, ...]] per bridged cluster
                                     // resolved from Claude's bridgedGroups (text[]) → IDs in triggerSuggest
  reasoning: string;
  inspiration?: string;              // wildcard only
  x: number;
  y: number;
  questionType?: 'challenge' | 'expand' | 'connect'; // question nodes — unchanged
}
```

### New store state

```typescript
// Off-screen ghost notification
offScreenGhosts: {
  count: number;
  type: 'synthesis' | 'wildcard';
  direction: 'N' | 'S' | 'E' | 'W' | null;
  ids: string[];
} | null;
setOffScreenGhosts: (v: typeof offScreenGhosts) => void;
clearOffScreenGhosts: () => void;

// Per-type cooldowns (replaces single suggestCooldownUntil)
suggestCooldowns: Record<'extend' | 'synthesize' | 'wildcard' | 'all', number>;
setSuggestCooldown: (mode: 'extend' | 'synthesize' | 'wildcard' | 'all', until: number) => void;
```

---

## Module Structure (Approach B)

```
src/utils/suggestions/
  clusterUtils.ts          — shared BFS + centroid helpers
  extensionSuggestions.ts  — haiku prompt; replaces ghostSuggestions.ts logic
  synthesisSuggestions.ts  — sonnet prompt; synthesis results
  wildcardSuggestions.ts   — sonnet prompt; wildcard results
  allSuggestions.ts        — sonnet prompt; combined ALL mode
  triggerSuggest.ts        — orchestrator; replaces src/utils/triggerSuggest.ts
```

`src/utils/ghostSuggestions.ts` and `src/utils/triggerSuggest.ts` are replaced by the subfolder.

### `clusterUtils.ts` exports

```typescript
interface Cluster {
  ideas: Idea[];
  centroid: { x: number; y: number };
}

// Connected components via BFS
findClusters(ideas: Idea[], connections: Connection[]): Cluster[]

// Also groups spatially-close (< 300px) unconnected ideas as loose clusters
findLooseClusters(ideas: Idea[], connections: Connection[], proximityPx?: number): Cluster[]
```

---

## Placement Logic

### Extension
Unchanged — uses existing `placeGhostNode()` near the related idea.

### Synthesis
1. Run `findClusters()` for connected components, supplement with `findLooseClusters()` (300px threshold).
2. For each suggestion, find the two clusters it bridges by matching `bridgedGroups` idea texts.
3. Place at midpoint of the two cluster centroids + 50–100px random jitter.
4. Fall back to overall canvas centroid if bridging 3+ clusters or no match.
5. Use existing `spiral()` avoidance to prevent stacking.

### Wild Card
1. Compute bounding box of all existing ideas (min/max x,y).
2. Place 200–400px outside a randomly chosen edge (top/bottom/left/right).
3. One wildcard per edge max.
4. After placement, check visibility in current viewport — if off-screen, set `offScreenGhosts` in store.

### Off-screen detection
A ghost is off-screen if its canvas position transformed through the viewport lands outside `[0, window.innerWidth] × [0, window.innerHeight]`.

---

## Accept Behavior

| Type | Auto-connect | Logic |
|------|-------------|-------|
| Extension | Yes → `relatedToId` | Unchanged |
| Synthesis | Yes → closest idea in each bridged cluster | New ~10 lines in `acceptGhostNode` |
| Wild Card | No | `relatedToId` is null → existing guard skips connection |
| Question | Unchanged | Unchanged |

Synthesis connect logic: loop `bridgedClusterIds`, for each cluster array find the real idea with minimum distance to the new node, create a connection.

---

## UI Changes

### Split suggest button (`AiControlsBar.tsx`)

```
┌──────────────────┬───┐
│  ✦ SUGGEST       │ ▾ │
└──────────────────┴───┘
```

- **Main area** → ALL mode
- **▾ area** → 24px wide, 1px divider at `#1A1A1A`, opens dropdown above button
- Dropdown: `#0E0E0E` bg, `1px solid #222222` border, 0 border-radius, z-index above everything
- Menu items: `11px` mono, uppercase, `#888888`, `8px 14px` padding, hover bg `#1A1A1A` / text `#DDDDDD`
- Closes on click-outside, selection, or Escape

**Menu:**
```
✦  EXTEND
◆  SYNTHESIZE
✸  WILD CARD
✦  ALL (DEFAULT)
```

**Loading states:**
- Extend: `✦ EXTENDING...`
- Synthesize: `◆ SYNTHESIZING...`
- Wild Card: `✸ WILDCARDING...`
- All: `✦ THINKING...`

**Rate limiting:**
- Extend / Synthesize / Wild Card: 10s cooldown, independent
- ALL: 15s cooldown

**Minimum requirements:**
- Synthesis: needs ≥ 2 distinct clusters OR ≥ 6 ideas. Shows `◆ NEED MORE CLUSTERS` for 2s if not met.
- Wild Card: no minimum — works with 1 idea.
- Extension: existing ≥ 2 ideas requirement unchanged.

### `GhostNodeCard.tsx` visual identities

| Type | Border | Bg | Text color | Label | Label color | Accept hover | Pulse |
|------|--------|----|------------|-------|-------------|--------------|-------|
| Extension | `1px dashed #2A2A2A` | `rgba(10,10,10,0.5)` | `#888888` | `✦ SUGGESTED` | `#444444` | `#44AA66` | 3s, 0.35–0.65 |
| Synthesis | `1px dashed #2A2A3A` | `rgba(10,10,14,0.5)` | `#8888AA` | `◆ SYNTHESIS` | `#4466AA` | `#4466AA` | 3s, 0.35–0.65 |
| Wild Card | `1px dashed #3A2A1A` | `rgba(14,10,8,0.5)` | `#AAAA77` | `✸ WILD CARD` | `#CC8844` | `#CC8844` | 2s, 0.3–0.7 |
| Question | `1px dashed #3A3520` | `rgba(10,10,10,0.5)` | `#888888` | `? TYPE` | `#CCAA44` | unchanged | unchanged |

**Tooltip format per type:**
- Extension: `EXTENDS: [parent idea] — [reasoning]`
- Synthesis: `BRIDGES: [theme 1] × [theme 2] — [reasoning]`
- Wild Card: `INSPIRED BY: [inspiration] — [reasoning]`
- Question: unchanged

### Off-screen notification (new component `GhostOffScreenBanner.tsx`)

```
┌──────────────────────────────┐
│  ✸ 2 WILD CARDS  →          │
└──────────────────────────────┘
```
- Rendered in `Canvas.tsx` above the AI controls area
- Reads `offScreenGhosts` from store
- Clicking pans viewport to center on off-screen ghost nodes
- Auto-fades after 5s (`clearOffScreenGhosts`)
- Only shown for synthesis and wildcard types

### ALL mode stagger
1. Extensions appear immediately
2. Synthesis appears after 800ms
3. Wild cards appear after 1600ms

---

## Models

| Type | Model |
|------|-------|
| Extension | `claude-haiku-4-5-20251001` |
| Synthesis | `claude-sonnet-4-6` |
| Wild Card | `claude-sonnet-4-6` |
| ALL | `claude-sonnet-4-6` |

---

## Auto-trigger

Auto-trigger (on new idea added) only generates **extensions**. Synthesis and wild cards are never auto-triggered — too disruptive.

---

## Files Changed

**Modified:**
- `src/types.ts` — expand `GhostNode`
- `src/store/useStore.ts` — new state fields, expand `acceptGhostNode`
- `src/components/AiControlsBar.tsx` — split button + dropdown
- `src/components/GhostNodeCard.tsx` — per-type visual identity + tooltip format
- `src/components/Canvas.tsx` — render `GhostOffScreenBanner`

**New:**
- `src/utils/suggestions/clusterUtils.ts`
- `src/utils/suggestions/extensionSuggestions.ts`
- `src/utils/suggestions/synthesisSuggestions.ts`
- `src/utils/suggestions/wildcardSuggestions.ts`
- `src/utils/suggestions/allSuggestions.ts`
- `src/utils/suggestions/triggerSuggest.ts`
- `src/components/GhostOffScreenBanner.tsx`

**Deleted (replaced by subfolder):**
- `src/utils/ghostSuggestions.ts`
- `src/utils/triggerSuggest.ts`
