# Export Ideas to Text File — Design Spec
**Date:** 2026-03-29
**Status:** Approved

---

## Overview

Add an export feature to Robinwater that writes all ideas from a selected canvas into a structured `.txt` file. Ideas that are manually connected are grouped into clusters with indentation showing hierarchy. Unconnected ideas appear in a standalone section. The output is optimised for feeding into other tools (e.g. Claude Code prompts).

---

## Files Changed

| File | Change |
|---|---|
| `src/utils/export.ts` | New — pure TS cluster algorithm + text formatter |
| `src/components/CanvasList.tsx` | Modified — right-click context menu on canvas rows, confirmation flash |
| `src-tauri/Cargo.toml` | Add `tauri-plugin-dialog = "2"` |
| `src-tauri/src/lib.rs` | Register `tauri_plugin_dialog::init()` |
| `src-tauri/capabilities/default.json` | Add `dialog:allow-save` + `fs:allow-write` |

---

## Right-Click Context Menu on Canvas Rows (CanvasList.tsx)

Right-clicking any canvas row in the sidebar opens a small context menu. The canvas being right-clicked is the export target — no picker needed.

**Menu items:**
- `↗ EXPORT` — triggers export flow for that canvas

**Style:** Matches the existing `ContextMenu.tsx` pattern — `background: #0F0F0F`, `border: 1px solid #222`, mono font, `11px`, uppercase. Positioned at the cursor. Closes on click-outside or Escape.

**Confirmation flash:** After a successful export, the canvas row briefly shows `✓ EXPORTED` in `#44AA66` for 2 seconds then reverts to the canvas name. If the user cancels the save dialog, nothing happens.

---

## Save Dialog & File Write

```ts
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

const filePath = await save({
  defaultPath: buildDefaultFilename(canvas.name, new Date()),
  filters: [{ name: 'Text Files', extensions: ['txt'] }],
});

if (filePath) {
  await writeTextFile(filePath, buildExportText(canvas));
}
```

**Default filename format:** `robinwater-export-[canvas-name]-[YYYY-MM-DD].txt`
Canvas name is lowercased; any character that is not alphanumeric, a hyphen, or an underscore is stripped or replaced with a hyphen.

---

## Export Algorithm (export.ts)

### `buildDefaultFilename(canvasName: string, date: Date): string`
- Lowercase the canvas name
- Replace spaces with hyphens
- Strip any character not in `[a-z0-9\-_]`
- Collapse consecutive hyphens to one
- Return `robinwater-export-${safe}-${YYYY-MM-DD}.txt`

### `buildExportText(canvas: Canvas): string`

**Step 1 — Build undirected adjacency map**
Iterate `canvas.connections`. For each `{ sourceId, targetId }`, add both directions to a `Map<string, Set<string>>`.

**Step 2 — Find connected components (BFS)**
Iterate all idea IDs. For any unvisited idea, BFS over its adjacency neighbours to collect the full component. Ideas with no connections form singleton components (standalone).

**Step 3 — Classify clusters vs standalones**
- Component size > 1 → cluster
- Component size = 1 (no connections) → standalone

**Step 4 — Pick cluster root**
Within each cluster, the root is the idea with the highest connection degree (number of entries in its adjacency set). Tiebreak: earliest `createdAt` (ISO string lexicographic comparison).

**Step 5 — Assign depths (BFS from root)**
BFS from root, tracking visited set to handle cycles. Each idea gets a depth integer (root = 0, neighbours of root = 1, etc.).

**Step 6 — Format output**
See format spec below.

---

## Output Format

```
=====================================
ROBINWATER EXPORT
CANVAS: [CANVAS NAME]
DATE: [YYYY-MM-DD HH:MM]
=====================================


--- CLUSTER ---

Idea: [ROOT IDEA TEXT]
  Description: [DESCRIPTION or "No description"]

    Idea: [DEPTH-1 IDEA]
      Description: [DESCRIPTION or "No description"]

        Idea: [DEPTH-2 IDEA]
          Description: [DESCRIPTION or "No description"]


--- CLUSTER ---

Idea: [ANOTHER ROOT]
  Description: [DESCRIPTION]

    Idea: [CHILD]
      Description: [DESCRIPTION]


--- STANDALONE IDEAS ---

Idea: [UNCONNECTED IDEA]
  Description: [DESCRIPTION or "No description"]

Idea: [ANOTHER UNCONNECTED IDEA]
  Description: [DESCRIPTION or "No description"]
```

**Indentation rules:**
- Depth 0: no indent
- Depth N: `N * 4` spaces before `Idea:`
- Description: `(N * 4) + 2` spaces before `Description:`
- Blank line between sibling ideas at the same depth

**Section rules:**
- Each cluster preceded by `--- CLUSTER ---` with a blank line above and below
- Standalone section preceded by `--- STANDALONE IDEAS ---` with a blank line above and below
- If canvas has no ideas: output header + `(No ideas on this canvas)`
- If all ideas are connected (no standalones): omit `--- STANDALONE IDEAS ---` section
- If no connections exist: omit cluster sections, only show `--- STANDALONE IDEAS ---`
- Idea text is output as-is (preserve original casing — this is human/tool readable output)

---

## Tauri Integration

### Cargo.toml
```toml
tauri-plugin-dialog = "2"
```

### lib.rs
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

### capabilities/default.json
Add to `permissions`:
```json
"dialog:allow-save",
"fs:allow-write"
```

`fs:allow-write` is unrestricted (no path scope) because the write target is a user-chosen path determined at runtime via the save dialog — a fixed scope cannot cover it.

---

## Edge Cases

| Case | Behaviour |
|---|---|
| Empty canvas | Header block + `(No ideas on this canvas)` |
| Ideas but no connections | `--- STANDALONE IDEAS ---` section only, no clusters |
| All ideas in one cluster | One cluster section, no standalone section |
| Circular connections (A→B→C→A) | BFS visited-set prevents infinite loop; root still = most-connected |
| Long idea text | Output full text, no truncation |
| Special chars in canvas name | Stripped/replaced in filename; original name used in header |
| User cancels save dialog | Modal stays open, no file written, no confirmation flash |
| Single canvas | Skip picker, go directly to save dialog |

---

## Quality Checklist

- [ ] Right-clicking a canvas row opens context menu with `↗ EXPORT`
- [ ] Context menu closes on Escape and click-outside
- [ ] Native save dialog opens with correct default filename
- [ ] Exported file has correct header with canvas name and date
- [ ] Connected ideas grouped into clusters with correct indentation
- [ ] Root of each cluster is the most-connected idea (tiebreak: earliest createdAt)
- [ ] Standalone ideas listed separately
- [ ] Empty canvas exports gracefully
- [ ] Tauri permissions configured for dialog + fs write
- [ ] Canvas row flashes `✓ EXPORTED` for 2 seconds after successful export
- [ ] Cancel save dialog → no flash, no file written
