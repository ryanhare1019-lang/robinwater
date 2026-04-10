import { describe, it, expect } from 'vitest';
import { lineIntersectsViewport, getViewportBounds } from './viewportCulling';

describe('getViewportBounds', () => {
  it('converts viewport + screen dimensions to canvas-space rect', () => {
    const bounds = getViewportBounds(
      { x: -100, y: -50, zoom: 2 },
      1000,
      800,
      0  // no padding for test clarity
    );
    expect(bounds).toEqual({ left: 50, right: 550, top: 25, bottom: 425 });
  });

  it('handles zoom = 1, no pan', () => {
    const bounds = getViewportBounds({ x: 0, y: 0, zoom: 1 }, 1920, 1080, 0);
    expect(bounds).toEqual({ left: 0, right: 1920, top: 0, bottom: 1080 });
  });
});

describe('lineIntersectsViewport', () => {
  const viewport = { left: 0, right: 100, top: 0, bottom: 100 };

  it('returns true when both endpoints inside viewport', () => {
    expect(lineIntersectsViewport(10, 10, 90, 90, viewport)).toBe(true);
  });

  it('returns true when line crosses viewport (both endpoints outside)', () => {
    expect(lineIntersectsViewport(-50, 50, 150, 50, viewport)).toBe(true);
  });

  it('returns true when one endpoint inside', () => {
    expect(lineIntersectsViewport(50, 50, 200, 200, viewport)).toBe(true);
  });

  it('returns false when line is fully above viewport', () => {
    expect(lineIntersectsViewport(10, -50, 90, -10, viewport)).toBe(false);
  });

  it('returns false when line is fully to the right', () => {
    expect(lineIntersectsViewport(150, 10, 200, 90, viewport)).toBe(false);
  });

  it('returns false when line is fully below', () => {
    expect(lineIntersectsViewport(10, 150, 90, 200, viewport)).toBe(false);
  });

  it('returns false when diagonal line misses viewport', () => {
    expect(lineIntersectsViewport(150, -50, 200, 150, viewport)).toBe(false);
  });

  it('returns true for a line that just clips the corner', () => {
    expect(lineIntersectsViewport(-10, 10, 10, -10, viewport)).toBe(true);
  });
});
