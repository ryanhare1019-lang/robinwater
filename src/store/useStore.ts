import { create } from "zustand";
import { Idea, Viewport, AppData, Canvas, Connection, CustomTag, GhostNode, AITagDefinition, TAG_COLORS } from "../types";
import { AppConfig, loadConfig } from "../utils/config";
import { extractKeywords } from "../utils/keywords";
import { findPlacement, overlapsAny } from "../utils/placement";
import { computeSimilarityLines, SimilarityLine } from "../utils/similarity";
import { getTagColor } from "../utils/aiTags";
import { generateId } from "../utils/id";

// Module-level storage for flash animation timers — not persisted to disk
let flashTimers: ReturnType<typeof setTimeout>[] = [];

// Undo/redo history stacks — module-level, not persisted
interface HistoryEntry {
  canvasId: string;
  ideas: Idea[];
  connections: Connection[];
  tags: CustomTag[];
  aiTagDefinitions: AITagDefinition[];
}

const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];
const MAX_HISTORY = 50;

function snapshotCanvas(canvas: Canvas): HistoryEntry {
  return {
    canvasId: canvas.id,
    ideas: [...canvas.ideas],
    connections: [...canvas.connections],
    tags: [...(canvas.tags || [])],
    aiTagDefinitions: [...(canvas.aiTagDefinitions || [])],
  };
}

function pushHistory(state: { canvases: Canvas[]; activeCanvasId: string }): void {
  const canvas = getActiveCanvas(state);
  undoStack.push(snapshotCanvas(canvas));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0; // clear redo on new action
}

function createDefaultCanvas(name = "Ideas"): Canvas {
  return {
    id: generateId(),
    name,
    ideas: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    tags: [],
    aiTagDefinitions: [],
  };
}

interface AppState {
  // Multi-canvas
  canvases: Canvas[];
  activeCanvasId: string;

  // UI state
  selectedId: string | null;
  selectedIds: string[];
  newNodeId: string | null;
  similarityLines: SimilarityLine[];
  leftSidebarOpen: boolean;
  connectingFrom: string | null; // node id when in connection mode
  contextMenuNodeId: string | null;
  contextMenuPos: { x: number; y: number } | null;
  deletingNodeId: string | null; // for exit animation

  // Multi-select actions
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
  deleteIdeas: (ids: string[]) => void;

  // Actions
  addIdea: (text: string) => void;
  addConnectedIdea: (text: string, parentId: string) => void;
  updateIdea: (id: string, updates: Partial<Pick<Idea, "text" | "description" | "x" | "y" | "width" | "height" | "tags">>) => void;
  deleteIdea: (id: string) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  setSelectedId: (id: string | null) => void;
  clearNewNode: () => void;
  hydrate: (data: AppData) => void;
  getSnapshot: () => AppData;

  // Canvas management
  addCanvas: (name?: string) => void;
  switchCanvas: (id: string) => void;
  renameCanvas: (id: string, name: string) => void;
  deleteCanvas: (id: string) => void;
  setLeftSidebarOpen: (open: boolean) => void;

  // Connections
  addConnection: (sourceId: string, targetId: string) => void;
  removeConnection: (id: string) => void;
  setConnectingFrom: (id: string | null) => void;

  // Context menu
  setContextMenu: (nodeId: string | null, pos: { x: number; y: number } | null) => void;

  // Delete animation
  setDeletingNodeId: (id: string | null) => void;

  // Hover preview
  hoverPreview: { nodeId: string; rect: { left: number; top: number; right: number; bottom: number } } | null;
  setHoverPreview: (state: { nodeId: string; rect: { left: number; top: number; right: number; bottom: number } } | null) => void;

  // Tag management
  addTag: (name: string, color: string) => void;
  removeTag: (id: string) => void;

  // Config
  config: AppConfig | null;
  setConfig: (config: AppConfig) => void;
  reloadConfig: () => Promise<void>;

  // Settings modal
  settingsModalOpen: boolean;
  setSettingsModalOpen: (v: boolean) => void;

  // Suggest cooldown
  suggestCooldownUntil: number;
  setSuggestCooldownUntil: (t: number) => void;

  // Ghost nodes
  ghostNodes: GhostNode[];
  isSuggestLoading: boolean;
  isQuestionsLoading: boolean;
  addGhostNodes: (nodes: GhostNode[]) => void;
  acceptGhostNode: (id: string) => void;
  dismissGhostNode: (id: string) => void;
  setSuggestLoading: (v: boolean) => void;
  setQuestionsLoading: (v: boolean) => void;

  // Auto-trigger timing
  lastAddedAt: number;
  lastAutoTriggerAt: number;
  setLastAutoTriggerAt: (t: number) => void;

  // AI Tagging
  isAutoTagLoading: boolean;
  tagJustTagged: string[];
  applyAiTags: (tagDefinitions: AITagDefinition[]) => void;
  removeAiTag: (tagId: string) => void;
  removeAiTagFromIdea: (tagId: string, ideaId: string) => void;
  renameAiTag: (tagId: string, newLabel: string) => void;
  setAutoTagLoading: (v: boolean) => void;

  // Search
  searchOpen: boolean;
  searchQuery: string;
  searchTagFilter: string | null;
  searchConnectionFilter: 'any' | 'connected' | 'unconnected';
  searchDateFilter: 'any' | 'today' | 'week';
  setSearchOpen: (v: boolean) => void;
  setSearchQuery: (q: string) => void;
  setSearchTagFilter: (id: string | null) => void;
  setSearchConnectionFilter: (f: 'any' | 'connected' | 'unconnected') => void;
  setSearchDateFilter: (f: 'any' | 'today' | 'week') => void;
  resetSearch: () => void;

  // Shortcuts overlay
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;

  // AI panel visibility
  aiPanelOpen: boolean;
  setAiPanelOpen: (v: boolean) => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;

  // Cluster collapse
  toggleClusterCollapse: (hubId: string) => void;
}

function getActiveCanvas(state: { canvases: Canvas[]; activeCanvasId: string }): Canvas {
  return state.canvases.find((c) => c.id === state.activeCanvasId) || state.canvases[0];
}

function updateActiveCanvas(
  canvases: Canvas[],
  activeCanvasId: string,
  updater: (canvas: Canvas) => Canvas
): Canvas[] {
  return canvases.map((c) => (c.id === activeCanvasId ? updater(c) : c));
}

export const useStore = create<AppState>((set, get) => {
  const defaultCanvas = createDefaultCanvas();

  return {
    canvases: [defaultCanvas],
    activeCanvasId: defaultCanvas.id,
    config: null,
    selectedId: null,
    selectedIds: [],
    newNodeId: null,
    similarityLines: [],
    leftSidebarOpen: false,
    connectingFrom: null,
    contextMenuNodeId: null,
    contextMenuPos: null,
    deletingNodeId: null,
    hoverPreview: null,
    ghostNodes: [],
    isSuggestLoading: false,
    isQuestionsLoading: false,
    lastAddedAt: 0,
    lastAutoTriggerAt: 0,
    isAutoTagLoading: false,
    tagJustTagged: [],
    settingsModalOpen: false,
    suggestCooldownUntil: 0,
    searchOpen: false,
    searchQuery: '',
    searchTagFilter: null,
    searchConnectionFilter: 'any',
    searchDateFilter: 'any',
    shortcutsOpen: false,
    aiPanelOpen: true,

    addIdea: (text: string) => {
      pushHistory(get());
      const state = get();
      const canvas = getActiveCanvas(state);
      const keywords = extractKeywords(text);
      const { x, y } = findPlacement(text, canvas.ideas, canvas.viewport);
      const idea: Idea = {
        id: generateId(),
        text,
        description: "",
        x, y,
        createdAt: new Date().toISOString(),
        keywords,
      };
      const ideas = [...canvas.ideas, idea];
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, ideas,
        })),
        newNodeId: idea.id,
        similarityLines: computeSimilarityLines(ideas, canvas.connections),
        lastAddedAt: Date.now(),
      });
    },

    addConnectedIdea: (text, parentId) => {
      pushHistory(get());
      const state = get();
      const canvas = getActiveCanvas(state);
      const parent = canvas.ideas.find((i) => i.id === parentId);
      const keywords = extractKeywords(text);

      let x: number;
      let y: number;
      if (parent) {
        // Spawn at least 280px away so we clear the parent node's bounding box (~200×80)
        // then spiral-search if still overlapping another idea
        const angle = Math.random() * Math.PI * 2;
        const dist = 280 + Math.random() * 120;
        x = parent.x + Math.cos(angle) * dist;
        y = parent.y + Math.sin(angle) * dist;
        if (overlapsAny(x, y, canvas.ideas)) {
          const goldenAngle = 2.399963;
          for (let i = 1; i <= 40; i++) {
            const cx = parent.x + Math.cos(angle + i * goldenAngle) * (dist + i * 40);
            const cy = parent.y + Math.sin(angle + i * goldenAngle) * (dist + i * 40);
            if (!overlapsAny(cx, cy, canvas.ideas)) { x = cx; y = cy; break; }
            if (i === 40) { x = cx; y = cy; }
          }
        }
        x = Math.round(x);
        y = Math.round(y);
      } else {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const vp = canvas.viewport;
        x = Math.round(-vp.x / vp.zoom + (Math.random() * vw * 0.5 + vw * 0.15) / vp.zoom);
        y = Math.round(-vp.y / vp.zoom + (Math.random() * vh * 0.5 + vh * 0.15) / vp.zoom);
      }

      const idea: Idea = {
        id: generateId(),
        text,
        description: "",
        x,
        y,
        createdAt: new Date().toISOString(),
        keywords,
      };
      const conn: Connection = { id: generateId(), sourceId: parentId, targetId: idea.id };
      const ideas = [...canvas.ideas, idea];
      const connections = [...canvas.connections, conn];

      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, ideas, connections,
        })),
        newNodeId: idea.id,
        similarityLines: computeSimilarityLines(ideas, connections),
        lastAddedAt: Date.now(),
      });
    },

    updateIdea: (id, updates) => {
      if (updates.text !== undefined || updates.description !== undefined || updates.tags !== undefined) {
        pushHistory(get());
      }
      const state = get();
      const canvas = getActiveCanvas(state);
      const ideas = canvas.ideas.map((idea) => {
        if (idea.id !== id) return idea;
        const updated = { ...idea, ...updates };
        if (updates.text !== undefined) {
          updated.keywords = extractKeywords(updates.text);
        }
        return updated;
      });
      const nextState: Partial<AppState> = {
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, ideas,
        })),
      };
      // Only recompute similarity when keywords or tags may have changed, not on position/size drags
      if (updates.text !== undefined || updates.tags !== undefined) {
        nextState.similarityLines = computeSimilarityLines(ideas, canvas.connections);
      }
      set(nextState);
    },

    deleteIdea: (id) => {
      pushHistory(get());
      const state = get();
      const canvas = getActiveCanvas(state);
      const ideas = canvas.ideas.filter((i) => i.id !== id);
      const connections = canvas.connections.filter(
        (c) => c.sourceId !== id && c.targetId !== id
      );
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, ideas, connections,
        })),
        selectedId: state.selectedId === id ? null : state.selectedId,
        similarityLines: computeSimilarityLines(ideas, connections),
        deletingNodeId: null,
      });
    },

    setViewport: (partial) => {
      const state = get();
      const canvas = getActiveCanvas(state);
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, viewport: { ...canvas.viewport, ...partial },
        })),
      });
    },

    setSelectedId: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),
    clearNewNode: () => set({ newNodeId: null }),

    addToSelection: (id) => set((state) => ({
      selectedIds: state.selectedIds.includes(id) ? state.selectedIds : [...state.selectedIds, id],
    })),
    removeFromSelection: (id) => set((state) => ({
      selectedIds: state.selectedIds.filter((s) => s !== id),
      selectedId: state.selectedId === id ? (state.selectedIds.filter((s) => s !== id)[0] ?? null) : state.selectedId,
    })),
    setSelectedIds: (ids) => set({ selectedIds: ids, selectedId: ids[ids.length - 1] ?? null }),
    clearSelection: () => set({ selectedIds: [], selectedId: null }),

    deleteIdeas: (ids) => {
      pushHistory(get());
      const state = get();
      const idSet = new Set(ids);
      const canvas = getActiveCanvas(state);
      const ideas = canvas.ideas.filter((i) => !idSet.has(i.id));
      const connections = canvas.connections.filter(
        (c) => !idSet.has(c.sourceId) && !idSet.has(c.targetId)
      );
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, ideas, connections,
        })),
        selectedId: idSet.has(state.selectedId ?? '') ? null : state.selectedId,
        selectedIds: [],
        similarityLines: computeSimilarityLines(ideas, connections),
      });
    },

    hydrate: (data) => {
      const active = data.canvases.find((c) => c.id === data.activeCanvasId) || data.canvases[0];
      set({
        canvases: data.canvases,
        activeCanvasId: active.id,
        similarityLines: computeSimilarityLines(active.ideas, active.connections),
      });
    },

    getSnapshot: (): AppData => {
      const state = get();
      return {
        canvases: state.canvases,
        activeCanvasId: state.activeCanvasId,
      };
    },

    // Canvas management
    addCanvas: (name) => {
      const canvas = createDefaultCanvas(name || "Untitled");
      set((state) => ({
        canvases: [...state.canvases, canvas],
        activeCanvasId: canvas.id,
        selectedId: null,
        selectedIds: [],
        newNodeId: null,
        similarityLines: [],
      }));
    },

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
        });
      }
    },

    renameCanvas: (id, name) => {
      set((state) => ({
        canvases: state.canvases.map((c) =>
          c.id === id ? { ...c, name } : c
        ),
      }));
    },

    deleteCanvas: (id) => {
      undoStack.length = 0;
      redoStack.length = 0;
      const state = get();
      if (state.canvases.length <= 1) return;
      const remaining = state.canvases.filter((c) => c.id !== id);
      const newActive = state.activeCanvasId === id ? remaining[0].id : state.activeCanvasId;
      const newActiveCanvas = remaining.find((c) => c.id === newActive)!;
      set({
        canvases: remaining,
        activeCanvasId: newActive,
        selectedId: null,
        selectedIds: [],
        similarityLines: computeSimilarityLines(newActiveCanvas.ideas, newActiveCanvas.connections),
      });
    },

    setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),

    // Connections
    addConnection: (sourceId, targetId) => {
      if (sourceId === targetId) return;
      const state = get();
      const canvas = getActiveCanvas(state);
      // Check for duplicate
      const exists = canvas.connections.some(
        (c) =>
          (c.sourceId === sourceId && c.targetId === targetId) ||
          (c.sourceId === targetId && c.targetId === sourceId)
      );
      if (exists) return;
      pushHistory(get());
      const conn: Connection = { id: generateId(), sourceId, targetId };
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, connections: [...c.connections, conn],
        })),
        connectingFrom: null,
      });
    },

    removeConnection: (id) => {
      pushHistory(get());
      const state = get();
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, connections: c.connections.filter((conn) => conn.id !== id),
        })),
      });
    },

    setConnectingFrom: (id) => set({ connectingFrom: id, contextMenuNodeId: null, contextMenuPos: null }),

    setContextMenu: (nodeId, pos) => set({ contextMenuNodeId: nodeId, contextMenuPos: pos }),

    setDeletingNodeId: (id) => set({ deletingNodeId: id }),

    setHoverPreview: (state) => set({ hoverPreview: state }),

    // Config
    setConfig: (config) => set({ config }),
    reloadConfig: async () => {
      const config = await loadConfig();
      set({ config });
    },

    // Settings modal
    setSettingsModalOpen: (v) => set({ settingsModalOpen: v }),

    // Suggest cooldown
    setSuggestCooldownUntil: (t) => set({ suggestCooldownUntil: t }),

    // Ghost nodes
    addGhostNodes: (nodes) => set((state) => ({ ghostNodes: [...state.ghostNodes, ...nodes] })),

    acceptGhostNode: (id) => {
      const state = get();
      const ghost = state.ghostNodes.find((g) => g.id === id);
      if (!ghost) return;
      pushHistory(get());

      const canvas = getActiveCanvas(state);
      const keywords = extractKeywords(ghost.text);

      // For question nodes, find or create a yellow tag
      let questionTagId: string | undefined;
      let updatedTags = canvas.tags || [];
      if (ghost.type === 'question') {
        const YELLOW_COLOR = TAG_COLORS.yellow.dot;
        const existing = updatedTags.find((t) => t.color === YELLOW_COLOR);
        if (existing) {
          questionTagId = existing.id;
        } else {
          const newTag: CustomTag = { id: generateId(), name: 'Question', color: YELLOW_COLOR };
          updatedTags = [...updatedTags, newTag];
          questionTagId = newTag.id;
        }
      }

      const idea: Idea = {
        id: generateId(),
        text: ghost.text,
        description: "",
        x: ghost.x,
        y: ghost.y,
        createdAt: new Date().toISOString(),
        keywords,
        ...(questionTagId ? { tags: [questionTagId] } : {}),
      };

      const relatedToId = ghost.relatedToId;
      let connections = canvas.connections;
      if (relatedToId && canvas.ideas.find((i) => i.id === relatedToId)) {
        const conn: Connection = { id: generateId(), sourceId: relatedToId, targetId: idea.id };
        connections = [...connections, conn];
      }

      const ideas = [...canvas.ideas, idea];
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c,
          ideas,
          connections,
          tags: updatedTags,
        })),
        ghostNodes: state.ghostNodes.filter((g) => g.id !== id),
        newNodeId: idea.id,
        similarityLines: computeSimilarityLines(ideas, connections),
      });
    },

    dismissGhostNode: (id) => set((state) => ({
      ghostNodes: state.ghostNodes.filter((g) => g.id !== id),
    })),

    setSuggestLoading: (v) => set({ isSuggestLoading: v }),

    setQuestionsLoading: (v) => set({ isQuestionsLoading: v }),

    setLastAutoTriggerAt: (t) => set({ lastAutoTriggerAt: t }),

    // AI Tagging
    setAutoTagLoading: (v) => set({ isAutoTagLoading: v }),

    applyAiTags: (tagDefinitions) => {
      pushHistory(get());
      const state = get();
      // Build a lookup: ideaId -> array of tag ids
      const ideaTagMap: Record<string, string[]> = {};
      for (const tag of tagDefinitions) {
        for (const ideaId of tag.ideaIds) {
          if (!ideaTagMap[ideaId]) ideaTagMap[ideaId] = [];
          ideaTagMap[ideaId].push(tag.id);
        }
      }

      // Create CustomTag entries for new AI tags so they appear in the Tags bar
      const canvas = getActiveCanvas(state);
      const existingTagNames = new Set((canvas?.tags || []).map((t) => t.name.toUpperCase()));
      const newCustomTags: CustomTag[] = tagDefinitions
        .filter((aiTag) => !existingTagNames.has(aiTag.label.toUpperCase()))
        .map((aiTag) => ({
          id: aiTag.id,
          name: aiTag.label,
          color: aiTag.color,
        }));

      const updatedIdeas = canvas.ideas.map((idea) => {
        const aiTagIds = ideaTagMap[idea.id] || [];
        // Also add AI tag IDs to idea.tags[] so Tags bar filtering works
        const newTagIds = newCustomTags.map((t) => t.id).filter((id) => aiTagIds.includes(id));
        const existingTagIds = idea.tags || [];
        const mergedTagIds = [
          ...existingTagIds,
          ...newTagIds.filter((id) => !existingTagIds.includes(id)),
        ];
        return {
          ...idea,
          aiTags: aiTagIds,
          tags: mergedTagIds,
        };
      });

      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c,
          aiTagDefinitions: tagDefinitions,
          tags: [...(c.tags || []), ...newCustomTags],
          ideas: updatedIdeas,
        })),
        similarityLines: computeSimilarityLines(updatedIdeas, canvas.connections),
      });

      // Cancel any existing flash timers before starting new ones
      flashTimers.forEach((t) => clearTimeout(t));
      flashTimers = [];

      // Staggered flash animation
      const taggedIdeaIds = Object.keys(ideaTagMap);
      taggedIdeaIds.forEach((ideaId, idx) => {
        const outerTimer = setTimeout(() => {
          set((s) => ({ tagJustTagged: [...s.tagJustTagged, ideaId] }));
          const innerTimer = setTimeout(() => {
            set((s) => ({ tagJustTagged: s.tagJustTagged.filter((id) => id !== ideaId) }));
          }, 600);
          flashTimers.push(innerTimer);
        }, idx * 100);
        flashTimers.push(outerTimer);
      });
    },

    removeAiTag: (tagId) => {
      const state = get();
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c,
          aiTagDefinitions: (c.aiTagDefinitions || []).filter((t) => t.id !== tagId),
          ideas: c.ideas.map((idea) => ({
            ...idea,
            aiTags: idea.aiTags?.filter((id) => id !== tagId),
          })),
        })),
      });
    },

    removeAiTagFromIdea: (tagId, ideaId) => {
      const state = get();
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c,
          ideas: c.ideas.map((idea) =>
            idea.id === ideaId
              ? { ...idea, aiTags: idea.aiTags?.filter((id) => id !== tagId) }
              : idea
          ),
        })),
      });
    },

    renameAiTag: (tagId, newLabel) => {
      const state = get();
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c,
          aiTagDefinitions: (c.aiTagDefinitions || []).map((t) =>
            t.id === tagId ? { ...t, label: newLabel, color: getTagColor(newLabel) } : t
          ),
        })),
      });
    },

    // Search
    setSearchOpen: (v) => set({ searchOpen: v }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    setSearchTagFilter: (id) => set({ searchTagFilter: id }),
    setSearchConnectionFilter: (f) => set({ searchConnectionFilter: f }),
    setSearchDateFilter: (f) => set({ searchDateFilter: f }),
    resetSearch: () => set({
      searchQuery: '',
      searchTagFilter: null,
      searchConnectionFilter: 'any',
      searchDateFilter: 'any',
    }),

    // Shortcuts overlay
    setShortcutsOpen: (v) => set({ shortcutsOpen: v }),

    // AI panel
    setAiPanelOpen: (v) => set({ aiPanelOpen: v }),

    // Undo / redo
    undo: () => {
      if (undoStack.length === 0) return;
      const state = get();
      const canvas = getActiveCanvas(state);

      // Save current state to redo stack
      redoStack.push(snapshotCanvas(canvas));

      // Pop from undo stack
      const entry = undoStack.pop()!;

      // Only restore if same canvas — cross-canvas undo is confusing
      if (entry.canvasId !== state.activeCanvasId) return;

      set({
        canvases: state.canvases.map((c) =>
          c.id === entry.canvasId
            ? { ...c, ideas: entry.ideas, connections: entry.connections, tags: entry.tags, aiTagDefinitions: entry.aiTagDefinitions }
            : c
        ),
        similarityLines: computeSimilarityLines(entry.ideas, entry.connections),
        selectedId: null,
        selectedIds: [],
      });
    },

    redo: () => {
      if (redoStack.length === 0) return;
      const state = get();
      const canvas = getActiveCanvas(state);

      undoStack.push(snapshotCanvas(canvas));

      const entry = redoStack.pop()!;

      if (entry.canvasId !== state.activeCanvasId) return;

      set({
        canvases: state.canvases.map((c) =>
          c.id === entry.canvasId
            ? { ...c, ideas: entry.ideas, connections: entry.connections, tags: entry.tags, aiTagDefinitions: entry.aiTagDefinitions }
            : c
        ),
        similarityLines: computeSimilarityLines(entry.ideas, entry.connections),
        selectedId: null,
        selectedIds: [],
      });
    },

    // Cluster collapse
    toggleClusterCollapse: (hubId) => {
      const state = get();
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => {
          const current = c.collapsedHubs || [];
          const isCollapsed = current.includes(hubId);
          return {
            ...c,
            collapsedHubs: isCollapsed
              ? current.filter((id) => id !== hubId)
              : [...current, hubId],
          };
        }),
      });
    },

    // Tag management
    addTag: (name, color) => {
      pushHistory(get());
      const state = get();
      const tag: CustomTag = { id: generateId(), name, color };
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, tags: [...(c.tags || []), tag],
        })),
      });
    },

    removeTag: (id) => {
      pushHistory(get());
      const state = get();
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c,
          tags: (c.tags || []).filter((t) => t.id !== id),
          ideas: c.ideas.map((idea) => ({
            ...idea,
            tags: idea.tags?.filter((tagId) => tagId !== id),
          })),
        })),
      });
    },
  };
});

export function getActiveViewport(): Viewport {
  const state = useStore.getState();
  return getActiveCanvas(state).viewport;
}
