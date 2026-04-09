import { create } from "zustand";
import { Idea, Viewport, AppData, Canvas, Connection, CustomTag, GhostNode, AITagDefinition } from "../types";
import { AppConfig, loadConfig } from "../utils/config";
import { extractKeywords } from "../utils/keywords";
import { findPlacement, overlapsAny } from "../utils/placement";
import { computeSimilarityLines, SimilarityLine } from "../utils/similarity";
import { getTagColor } from "../utils/aiTags";

function generateId(): string {
  return crypto.randomUUID();
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
  newNodeId: string | null;
  similarityLines: SimilarityLine[];
  leftSidebarOpen: boolean;
  connectingFrom: string | null; // node id when in connection mode
  contextMenuNodeId: string | null;
  contextMenuPos: { x: number; y: number } | null;
  deletingNodeId: string | null; // for exit animation

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
  tagFlashTimers: ReturnType<typeof setTimeout>[];
  applyAiTags: (tagDefinitions: AITagDefinition[]) => void;
  removeAiTag: (tagId: string) => void;
  renameAiTag: (tagId: string, newLabel: string) => void;
  setAutoTagLoading: (v: boolean) => void;
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
    newNodeId: null,
    similarityLines: [],
    leftSidebarOpen: false,
    connectingFrom: null,
    contextMenuNodeId: null,
    contextMenuPos: null,
    deletingNodeId: null,
    ghostNodes: [],
    isSuggestLoading: false,
    isQuestionsLoading: false,
    lastAddedAt: 0,
    lastAutoTriggerAt: 0,
    isAutoTagLoading: false,
    tagJustTagged: [],
    tagFlashTimers: [],
    settingsModalOpen: false,
    suggestCooldownUntil: 0,

    addIdea: (text: string) => {
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
        similarityLines: computeSimilarityLines(ideas),
        lastAddedAt: Date.now(),
      });
    },

    addConnectedIdea: (text, parentId) => {
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
        similarityLines: computeSimilarityLines(ideas),
        lastAddedAt: Date.now(),
      });
    },

    updateIdea: (id, updates) => {
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
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, ideas,
        })),
        similarityLines: computeSimilarityLines(ideas),
      });
    },

    deleteIdea: (id) => {
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
        similarityLines: computeSimilarityLines(ideas),
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

    setSelectedId: (id) => set({ selectedId: id }),
    clearNewNode: () => set({ newNodeId: null }),

    hydrate: (data) => {
      const active = data.canvases.find((c) => c.id === data.activeCanvasId) || data.canvases[0];
      set({
        canvases: data.canvases,
        activeCanvasId: active.id,
        similarityLines: computeSimilarityLines(active.ideas),
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
        newNodeId: null,
        similarityLines: [],
      }));
    },

    switchCanvas: (id) => {
      const state = get();
      const canvas = state.canvases.find((c) => c.id === id);
      if (canvas) {
        set({
          activeCanvasId: id,
          selectedId: null,
          newNodeId: null,
          connectingFrom: null,
          similarityLines: computeSimilarityLines(canvas.ideas),
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
      const state = get();
      if (state.canvases.length <= 1) return;
      const remaining = state.canvases.filter((c) => c.id !== id);
      const newActive = state.activeCanvasId === id ? remaining[0].id : state.activeCanvasId;
      const newActiveCanvas = remaining.find((c) => c.id === newActive)!;
      set({
        canvases: remaining,
        activeCanvasId: newActive,
        selectedId: null,
        similarityLines: computeSimilarityLines(newActiveCanvas.ideas),
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
      const conn: Connection = { id: generateId(), sourceId, targetId };
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, connections: [...c.connections, conn],
        })),
        connectingFrom: null,
      });
    },

    removeConnection: (id) => {
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

      const canvas = getActiveCanvas(state);
      const keywords = extractKeywords(ghost.text);

      // For question nodes, find or create a yellow tag
      let questionTagId: string | undefined;
      let updatedTags = canvas.tags || [];
      if (ghost.type === 'question') {
        // yellow dot color from TAG_COLORS
        const YELLOW_COLOR = '#ffd76b';
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
        similarityLines: computeSimilarityLines(ideas),
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
      const state = get();
      // Build a lookup: ideaId -> array of tag ids
      const ideaTagMap: Record<string, string[]> = {};
      for (const tag of tagDefinitions) {
        for (const ideaId of tag.ideaIds) {
          if (!ideaTagMap[ideaId]) ideaTagMap[ideaId] = [];
          ideaTagMap[ideaId].push(tag.id);
        }
      }

      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c,
          aiTagDefinitions: tagDefinitions,
          ideas: c.ideas.map((idea) => ({
            ...idea,
            aiTags: ideaTagMap[idea.id] || [],
          })),
        })),
      });

      // Cancel any existing flash timers before starting new ones
      get().tagFlashTimers.forEach((t) => clearTimeout(t));

      // Staggered flash animation
      const taggedIdeaIds = Object.keys(ideaTagMap);
      const timerIds: ReturnType<typeof setTimeout>[] = [];
      taggedIdeaIds.forEach((ideaId, idx) => {
        const outerTimer = setTimeout(() => {
          set((s) => ({ tagJustTagged: [...s.tagJustTagged, ideaId] }));
          const innerTimer = setTimeout(() => {
            set((s) => ({ tagJustTagged: s.tagJustTagged.filter((id) => id !== ideaId) }));
            // Clear the timer array once all flashes are done
            if (idx === taggedIdeaIds.length - 1) {
              set({ tagFlashTimers: [] });
            }
          }, 600);
          timerIds.push(innerTimer);
        }, idx * 100);
        timerIds.push(outerTimer);
      });
      set({ tagFlashTimers: timerIds });
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

    // Tag management
    addTag: (name, color) => {
      const state = get();
      const tag: CustomTag = { id: generateId(), name, color };
      set({
        canvases: updateActiveCanvas(state.canvases, state.activeCanvasId, (c) => ({
          ...c, tags: [...(c.tags || []), tag],
        })),
      });
    },

    removeTag: (id) => {
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
