# Canvas Descriptions Design

**Date:** 2026-04-11  
**Status:** Approved

## Overview

Add optional text descriptions to canvases. Descriptions serve two purposes: helping users remember what each canvas is for, and giving the AI suggestion engine richer context to generate better ideas.

## Data Layer

**`src/types.ts`** — add optional `description` field to `Canvas`:

```ts
export interface Canvas {
  id: string;
  name: string;
  description?: string;   // NEW — optional, empty string when unset
  ideas: Idea[];
  connections: Connection[];
  viewport: Viewport;
  tags?: CustomTag[];
  aiTagDefinitions?: AITagDefinition[];
  collapsedHubs?: string[];
}
```

**`src/store/useStore.ts`**:
- `createDefaultCanvas` initializes `description: ''`
- New action: `updateCanvasDescription(id: string, description: string) => void` — updates the matching canvas in `canvases[]` and persists via the existing save mechanism

No migration needed — `description` is optional and absent in existing saves; it will be treated as `''`.

## UI — CanvasList.tsx

All new state and popover logic lives in `CanvasList.tsx`, alongside the existing rename/delete/context menu state. No new components.

### Hover reveal

When a canvas row is hovered, render a dim italic line directly below the canvas name:
- If description is non-empty: show the description text, truncated with ellipsis
- If description is empty: show `add a description...` as a placeholder
- The line is not rendered when the row is not hovered (no extra height in the default list)
- Clicking anywhere on this line opens the description popover

### Edit popover

Triggered by clicking the description line. State: `descEditId: string | null` and `descEditValue: string`.

**Positioning:** `position: fixed`, aligned to the right edge of the sidebar (left: 220px) at the vertical position of the hovered row. Same general approach as the existing context menu.

**Contents:**
```
┌─────────────────────────────┐
│ DESCRIPTION                 │
│ ┌─────────────────────────┐ │
│ │ UX exploration for...   │ │
│ └─────────────────────────┘ │
│ enter to save · esc to cancel│
└─────────────────────────────┘
```

- Single `<input>` pre-filled with current description value
- `Enter` → save (calls `updateCanvasDescription`) and close
- `Escape` → cancel (restores previous value) and close
- Click outside → save and close (via `mousedown` listener, same pattern as context menu)
- Auto-focuses input on open

**Visual style:** matches existing context menu — `background: var(--bg-raised)`, `border: 1px solid var(--border-default)`, monospace font, `var(--label-size)` for the label, `var(--body-size)` for the input.

## AI Integration

Pass the canvas description alongside the canvas name in all four suggestion fetchers. If description is empty or whitespace, omit it — the prompt reads the same as before.

Format: `"Canvas Name — description text"` on the opening context line, e.g.:
```
Here are the ideas currently on my canvas "App Redesign — UX exploration for mobile v3":
```

Each fetcher needs a small signature change since not all currently receive the canvas object:

- **`extensionSuggestions.ts`** — already receives the full `Canvas` object; read `canvas.description` directly in `buildUserMessage`
- **`synthesisSuggestions.ts`** — add `canvasDescription?: string` param to `fetchSynthesis` and `buildUserMessage`; call site in `triggerSuggest.ts` passes `canvas.description`
- **`wildcardSuggestions.ts`** — add `canvasDescription?: string` param to `fetchWildcards` and `buildUserMessage`; call site passes `canvas.description`
- **`allSuggestions.ts`** — has its own `buildUserMessage` (does not delegate); already receives the `Canvas` object, so read `canvas.description` directly

All four update their opening context line using: `canvasDescription?.trim() ? `"${canvasName} — ${canvasDescription}"` : `"${canvasName}"`

## Out of Scope

- Per-canvas description shown anywhere on the canvas itself (only in sidebar)
- Description included in `.monolite` export format (not needed for MVP)
- Multi-line / rich text descriptions
