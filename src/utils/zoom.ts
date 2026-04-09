export type DetailLevel = 'full' | 'compact' | 'minimal';

/**
 * Compute detail level from zoom with hysteresis to prevent threshold flickering.
 *
 * Thresholds (zooming OUT): full→compact at 0.65, compact→minimal at 0.35
 * Thresholds (zooming IN):  minimal→compact at 0.38, compact→full at 0.68
 *
 * Pass the CURRENT (previous render) level as `currentLevel` so hysteresis works.
 * On first render, pass 'full' as currentLevel — the function will immediately
 * return the correct level for whatever zoom the app starts at.
 */
export function getDetailLevelWithHysteresis(
  zoom: number,
  currentLevel: DetailLevel
): DetailLevel {
  switch (currentLevel) {
    case 'full':
      if (zoom < 0.65) return 'compact';
      return 'full';
    case 'compact':
      if (zoom >= 0.68) return 'full';
      if (zoom < 0.35) return 'minimal';
      return 'compact';
    case 'minimal':
      if (zoom >= 0.38) return 'compact';
      return 'minimal';
  }
}
