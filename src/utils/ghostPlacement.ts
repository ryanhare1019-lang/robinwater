import { Idea, Viewport } from '../types';

const GHOST_WIDTH = 200;
const GHOST_HEIGHT = 80;
const PADDING = 24;

interface Rect { x: number; y: number; width?: number; height?: number }

function overlaps(cx: number, cy: number, rects: Rect[]): boolean {
  for (const r of rects) {
    const rw = (r.width || GHOST_WIDTH) + PADDING;
    const rh = (r.height || GHOST_HEIGHT) + PADDING;
    if (Math.abs(cx - r.x) < rw && Math.abs(cy - r.y) < rh) return true;
  }
  return false;
}

function spiral(startX: number, startY: number, occupied: Rect[]): { x: number; y: number } {
  if (!overlaps(startX, startY, occupied)) return { x: Math.round(startX), y: Math.round(startY) };

  const goldenAngle = 2.399963;
  let lastX = startX;
  let lastY = startY;
  for (let i = 1; i <= 60; i++) {
    const cx = startX + Math.cos(i * goldenAngle) * (i * 50);
    const cy = startY + Math.sin(i * goldenAngle) * (i * 50);
    lastX = cx; lastY = cy;
    if (!overlaps(cx, cy, occupied)) return { x: Math.round(cx), y: Math.round(cy) };
  }
  return { x: Math.round(lastX), y: Math.round(lastY) };
}

/**
 * Place a ghost node near a related idea, avoiding overlaps with existing ideas
 * and already-placed ghost nodes in the same batch.
 */
export function placeGhostNode(
  relatedToId: string | null,
  ideas: Idea[],
  viewport: Viewport,
  placedGhosts: Rect[],
  distRange: [number, number] = [100, 200],
): { x: number; y: number } {
  const related = relatedToId ? ideas.find((i) => i.id === relatedToId) : null;
  const occupied: Rect[] = [...ideas, ...placedGhosts];

  let startX: number;
  let startY: number;

  if (related) {
    const angle = Math.random() * Math.PI * 2;
    const dist = distRange[0] + Math.random() * (distRange[1] - distRange[0]);
    startX = related.x + Math.cos(angle) * dist;
    startY = related.y + Math.sin(angle) * dist;
  } else {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    startX = -viewport.x / viewport.zoom + (Math.random() * vw * 0.4 + vw * 0.3) / viewport.zoom;
    startY = -viewport.y / viewport.zoom + (Math.random() * vh * 0.4 + vh * 0.3) / viewport.zoom;
  }

  return spiral(startX, startY, occupied);
}
