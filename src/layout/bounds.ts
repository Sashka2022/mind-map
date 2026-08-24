import type { Point } from '../types';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Expands `bounds` into the smallest box that's symmetric around `center`
 * on both axes. Used to keep the root visually anchored in the middle of
 * the canvas/page even when one branch is bigger or deeper than its
 * opposite — the shorter side gets extra (unused) margin instead of the
 * root drifting off-center.
 */
export function symmetrizeBounds(bounds: Bounds, center: Point): Bounds {
  const leftExtent = center.x - bounds.x;
  const rightExtent = bounds.x + bounds.width - center.x;
  const topExtent = center.y - bounds.y;
  const bottomExtent = bounds.y + bounds.height - center.y;

  const halfWidth = Math.max(leftExtent, rightExtent, 0);
  const halfHeight = Math.max(topExtent, bottomExtent, 0);

  return {
    x: center.x - halfWidth,
    y: center.y - halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  };
}
