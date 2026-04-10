import { Viewport } from "../types";

export interface ViewportBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Convert viewport state + screen dimensions to a canvas-space bounding rect.
 * Adds padding so lines approaching the edge aren't popped in/out abruptly.
 */
export function getViewportBounds(
  viewport: Viewport,
  screenWidth: number,
  screenHeight: number,
  padding = 200
): ViewportBounds {
  const left = (0 - viewport.x) / viewport.zoom - padding;
  const right = (screenWidth - viewport.x) / viewport.zoom + padding;
  const top = (0 - viewport.y) / viewport.zoom - padding;
  const bottom = (screenHeight - viewport.y) / viewport.zoom + padding;
  return { left, right, top, bottom };
}

/**
 * Fast check: does the line segment (x1,y1)→(x2,y2) intersect the rect?
 * Uses Cohen-Sutherland outcode clipping — no allocations, early exits.
 */
export function lineIntersectsViewport(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  vp: ViewportBounds
): boolean {
  let code1 = outcode(x1, y1, vp);
  let code2 = outcode(x2, y2, vp);

  while (true) {
    if ((code1 | code2) === 0) return true;
    if ((code1 & code2) !== 0) return false;
    const codeOut = code1 !== 0 ? code1 : code2;
    let x: number, y: number;
    if (codeOut & 8) {
      x = x1 + (x2 - x1) * (vp.top - y1) / (y2 - y1);
      y = vp.top;
    } else if (codeOut & 4) {
      x = x1 + (x2 - x1) * (vp.bottom - y1) / (y2 - y1);
      y = vp.bottom;
    } else if (codeOut & 2) {
      y = y1 + (y2 - y1) * (vp.right - x1) / (x2 - x1);
      x = vp.right;
    } else {
      y = y1 + (y2 - y1) * (vp.left - x1) / (x2 - x1);
      x = vp.left;
    }
    if (codeOut === code1) {
      x1 = x; y1 = y;
      code1 = outcode(x1, y1, vp);
    } else {
      x2 = x; y2 = y;
      code2 = outcode(x2, y2, vp);
    }
  }
}

function outcode(x: number, y: number, vp: ViewportBounds): number {
  let code = 0;
  if (x < vp.left) code |= 1;
  if (x > vp.right) code |= 2;
  if (y > vp.bottom) code |= 4;
  if (y < vp.top) code |= 8;
  return code;
}
