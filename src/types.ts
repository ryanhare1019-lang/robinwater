export const TAG_COLORS = {
  red:    { bg: '#2a1a1a', border: '#ff6b6b', dot: '#ff6b6b' },
  blue:   { bg: '#1a1a2a', border: '#6b9bff', dot: '#6b9bff' },
  green:  { bg: '#1a2a1a', border: '#6bff8a', dot: '#6bff8a' },
  yellow: { bg: '#2a2a1a', border: '#ffd76b', dot: '#ffd76b' },
  purple: { bg: '#251a2a', border: '#b86bff', dot: '#b86bff' },
  orange: { bg: '#2a201a', border: '#ffaa6b', dot: '#ffaa6b' },
} as const;

export type TagColor = keyof typeof TAG_COLORS;

export interface CustomTag {
  id: string;
  name: string;
  color: string; // hex color string like "#ff6b6b"
}

export interface AITagDefinition {
  id: string;
  label: string;       // e.g., "MONETIZATION STRATEGY"
  color: string;       // auto-generated hex color from AI_TAG_PALETTE
  ideaIds: string[];   // which ideas have this tag
}

export interface Idea {
  id: string;
  text: string;
  description: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  createdAt: string;
  keywords: string[];
  tags?: string[]; // array of CustomTag IDs
  aiTags?: string[]; // array of AITagDefinition IDs
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Canvas {
  id: string;
  name: string;
  description?: string;
  ideas: Idea[];
  connections: Connection[];
  viewport: Viewport;
  tags?: CustomTag[];
  aiTagDefinitions?: AITagDefinition[];
  collapsedHubs?: string[];
}

export type SuggestionMode = 'extend' | 'synthesize' | 'wildcard' | 'all';

export interface GhostNode {
  id: string;
  text: string;
  type: 'extension' | 'synthesis' | 'wildcard' | 'question';
  relatedToId: string | null;       // extension: source idea id; others: null
  bridgedClusterIds?: string[][];   // synthesis only: [[ideaId,...],[ideaId,...]] per cluster
                                    // resolved from Claude's text arrays in triggerSuggest
  reasoning: string;
  inspiration?: string;             // wildcard only
  x: number;
  y: number;
  questionType?: 'challenge' | 'expand' | 'connect'; // question nodes only — unchanged
}

export interface CanvasFolder {
  id: string;
  name: string;
  canvasIds: string[];  // IDs of canvases in this folder
  collapsed: boolean;
}

// New multi-canvas save format
export interface AppData {
  canvases: Canvas[];
  activeCanvasId: string;
  folders?: CanvasFolder[];  // optional for backward compat
}

// Legacy v1 format for migration
export interface LegacyAppData {
  ideas: Idea[];
  viewport: Viewport;
}
