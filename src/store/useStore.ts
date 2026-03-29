import { create } from "zustand";
import { Idea, Viewport, AppData, Canvas, Connection, TagColor } from "../types";
import { extractKeywords } from "../utils/keywords";
import { findPlacement } from "../utils/placement";
import { computeSimilarityLines, SimilarityLine } from "../utils/similarity";

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
  updateIdea: (id: string, updates: Partial<Pick<Idea, "text" | "description" | "x" | "y" | "width" | "height" | "color">>) => void;
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
    selectedId: null,
    newNodeId: null,
    similarityLines: [],
    leftSidebarOpen: false,
    connectingFrom: null,
    contextMenuNodeId: null,
    contextMenuPos: null,
    deletingNodeId: null,

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
  };
});

export function getActiveViewport(): Viewport {
  const state = useStore.getState();
  return getActiveCanvas(state).viewport;
}
