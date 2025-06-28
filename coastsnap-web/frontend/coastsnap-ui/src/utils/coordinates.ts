/**
 * Coordinate conversion utilities
 */
import type { Point2D } from '../types';
import { WORLD_BOUNDS } from '../types';

/**
 * Convert world coordinates to pixel coordinates
 */
export function worldToPixel(pt: Point2D, img: { width: number; height: number }): Point2D {
  return {
    x: ((pt.x - WORLD_BOUNDS.xMin) / (WORLD_BOUNDS.xMax - WORLD_BOUNDS.xMin)) * img.width,
    y: ((pt.y - WORLD_BOUNDS.yMin) / (WORLD_BOUNDS.yMax - WORLD_BOUNDS.yMin)) * img.height,
  };
}

/**
 * Convert pixel coordinates to world coordinates
 */
export function pixelToWorld(pt: Point2D, img: { width: number; height: number }): Point2D {
  return {
    x: (pt.x / img.width) * (WORLD_BOUNDS.xMax - WORLD_BOUNDS.xMin) + WORLD_BOUNDS.xMin,
    y: (pt.y / img.height) * (WORLD_BOUNDS.yMax - WORLD_BOUNDS.yMin) + WORLD_BOUNDS.yMin,
  };
}

/**
 * Densify a line by adding interpolated points
 */
export function densifyLine(worldPts: Point2D[], spacing: number): Point2D[] {
  const dense: Point2D[] = [];
  for (let i = 0; i < worldPts.length - 1; i++) {
    const p0 = worldPts[i];
    const p1 = worldPts[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const segLen = Math.hypot(dx, dy);
    const n = Math.max(1, Math.round(segLen / spacing));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      dense.push({ x: p0.x + t * dx, y: p0.y + t * dy });
    }
  }
  dense.push(worldPts[worldPts.length - 1]);
  return dense;
}