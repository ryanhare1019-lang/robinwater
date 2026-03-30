import { Idea, Viewport } from "../types";
import { extractKeywords } from "./keywords";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 60;
const PADDING = 20;

function overlapsAny(cx: number, cy: number, ideas: Idea[]): boolean {
  for (const idea of ideas) {
    const iw = (idea.width || NODE_WIDTH) + PADDING;
    const ih = (idea.height || NODE_HEIGHT) + PADDING;
    const dx = Math.abs(cx - idea.x);
    const dy = Math.abs(cy - idea.y);
    if (dx < iw && dy < ih) {
      return true;
    }
  }
  return false;
}

export function findPlacement(
  text: string,
  ideas: Idea[],
  viewport: Viewport
): { x: number; y: number } {
  const keywords = extractKeywords(text);

  let bestMatch: Idea | null = null;
  let bestOverlap = 0;

  for (const idea of ideas) {
    let overlap = 0;
    for (const kw of keywords) {
      if (idea.keywords.includes(kw)) overlap++;
    }
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = idea;
    }
  }

  let x: number;
  let y: number;

  if (bestMatch && bestOverlap >= 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 150;
    x = bestMatch.x + Math.cos(angle) * dist;
    y = bestMatch.y + Math.sin(angle) * dist;
  } else {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    x = -viewport.x / viewport.zoom + (Math.random() * vw * 0.5 + vw * 0.15) / viewport.zoom;
    y = -viewport.y / viewport.zoom + (Math.random() * vh * 0.5 + vh * 0.15) / viewport.zoom;
  }

  // Iterative spiral search to find a non-overlapping position
  if (overlapsAny(x, y, ideas)) {
    const goldenAngle = 2.399963;
    let found = false;
    let lastX = x;
    let lastY = y;

    for (let i = 1; i <= 40; i++) {
      const candidateX = x + Math.cos(i * goldenAngle) * (i * 60);
      const candidateY = y + Math.sin(i * goldenAngle) * (i * 60);
      lastX = candidateX;
      lastY = candidateY;
      if (!overlapsAny(candidateX, candidateY, ideas)) {
        x = candidateX;
        y = candidateY;
        found = true;
        break;
      }
    }

    if (!found) {
      x = lastX;
      y = lastY;
    }
  }

  return { x: Math.round(x), y: Math.round(y) };
}

/** Check if a point (in canvas coords) is within the current visible viewport */
export function isInViewport(
  px: number,
  py: number,
  viewport: Viewport,
  margin = 100
): boolean {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const screenX = px * viewport.zoom + viewport.x;
  const screenY = py * viewport.zoom + viewport.y;
  return (
    screenX > -margin &&
    screenX < vw + margin &&
    screenY > -margin &&
    screenY < vh + margin
  );
}
