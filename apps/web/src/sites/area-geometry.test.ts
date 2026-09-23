/** @spec allocation-plan-add-area REQ-004,009,011 */
import { expect, it } from 'vitest';
import {
  areaRectangle,
  moveArea,
  areaPoint,
  resizeArea,
  areaResizeHandles,
} from './area-geometry.js';
it('normalizes either drawing direction and clamps to the source drawing', () => {
  expect(areaRectangle({ x: 0.8, y: 0.9 }, { x: 0.2, y: 0.1 })).toEqual({
    x: 0.2,
    y: 0.1,
    width: 0.6000000000000001,
    height: 0.8,
  });
  expect(
    areaPoint(150, -20, { left: 0, top: 0, width: 100, height: 100 }),
  ).toEqual({ x: 1, y: 0 });
  expect(moveArea({ width: 0.4, height: 0.3 }, 1, -1)).toEqual({
    x: 0.6,
    y: 0,
  });
});

/** @spec allocation-plan-area-transform REQ-002 */
it('resizes eight handles with fixed opposite edges, bounded extents and minimum size', () => {
  const original = { x: 0.2, y: 0.3, width: 0.4, height: 0.3 };
  for (const handle of areaResizeHandles) {
    const next = resizeArea(
      original,
      handle,
      { x: -1, y: -1 },
      { x: 0.01, y: 0.01 },
    );
    expect(next.x).toBeGreaterThanOrEqual(0);
    expect(next.y).toBeGreaterThanOrEqual(0);
    expect(next.width).toBeGreaterThanOrEqual(0.009999);
    expect(next.height).toBeGreaterThanOrEqual(0.009999);
    if (handle.includes('w')) expect(next.x + next.width).toBeCloseTo(0.6);
    if (handle.includes('n')) expect(next.y + next.height).toBeCloseTo(0.6);
    const expanded = resizeArea(
      original,
      handle,
      { x: 2, y: 2 },
      { x: 0.01, y: 0.01 },
    );
    expect(expanded.x + expanded.width).toBeLessThanOrEqual(1);
    expect(expanded.y + expanded.height).toBeLessThanOrEqual(1);
  }
  expect(
    resizeArea(original, 'se', { x: 0, y: 0 }, { x: 0.01, y: 0.01 }),
  ).toEqual(original);
  const tiny = { x: 0.2, y: 0.3, width: 0.001, height: 0.001 };
  expect(
    resizeArea(tiny, 'e', { x: 0.0001, y: 0 }, { x: 0.01, y: 0.01 }).width,
  ).toBeCloseTo(0.01);
  expect(
    resizeArea(tiny, 'e', { x: 0.1, y: 0 }, { x: 0.01, y: 0.01 }).height,
  ).toBe(0.001);
});
