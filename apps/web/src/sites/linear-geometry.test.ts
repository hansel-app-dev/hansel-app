/** @spec allocation-plan-add-linear REQ-004,010 */
import { expect, it } from 'vitest';
import { moveLinear, linearLength, linearPoint } from './linear-geometry.js';
it('REQ-010 translates a segment as a whole at every boundary', () => {
  const line = { x: 0.8, y: 0.7, endX: 0.2, endY: 0.1 };
  expect(moveLinear(line, 1, 1)).toEqual({ x: 1, y: 1, endX: 0.4, endY: 0.4 });
  expect(moveLinear(line, -1, -1)).toEqual({
    x: 0.6,
    y: 0.6,
    endX: 0,
    endY: 0,
  });
});
it('REQ-004 uses rendered dimensions for minimum length and bounded source coordinates', () => {
  expect(
    linearLength(
      { x: 0, y: 0, endX: 0.03, endY: 0.04 },
      { width: 100, height: 100 },
    ),
  ).toBe(5);
  expect(
    linearPoint(0, 300, { left: 10, top: 20, width: 100, height: 100 }),
  ).toEqual({ x: 0, y: 1 });
});
