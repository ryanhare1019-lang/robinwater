export const TAG_COLORS = {
  red:    { bg: '#2a1a1a', border: '#ff6b6b', dot: '#ff6b6b' },
  blue:   { bg: '#1a1a2a', border: '#6b9bff', dot: '#6b9bff' },
  green:  { bg: '#1a2a1a', border: '#6bff8a', dot: '#6bff8a' },
  yellow: { bg: '#2a2a1a', border: '#ffd76b', dot: '#ffd76b' },
  purple: { bg: '#251a2a', border: '#b86bff', dot: '#b86bff' },
  orange: { bg: '#2a201a', border: '#ffaa6b', dot: '#ffaa6b' },
} as const;

export type TagColor = keyof typeof TAG_COLORS;

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
  color?: TagColor;
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
  ideas: Idea[];
  connections: Connection[];
  viewport: Viewport;
}

// New multi-canvas save format
export interface AppData {
  canvases: Canvas[];
  activeCanvasId: string;
}

// Legacy v1 format for migration
export interface LegacyAppData {
  ideas: Idea[];
  viewport: Viewport;
}
