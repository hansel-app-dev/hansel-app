/** @spec allocation-plan-add-area REQ-004,009,011 */
import { expect, it } from 'vitest';
import { areaRectangle, moveArea, areaPoint } from './area-geometry.js';
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
