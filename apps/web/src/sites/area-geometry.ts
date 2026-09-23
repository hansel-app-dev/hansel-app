/** @spec allocation-plan-add-area REQ-004,009,011 */
export interface AreaPoint {
  x: number;
  y: number;
}
export const clampAreaCoordinate = (n: number) => Math.max(0, Math.min(1, n));
export function areaPoint(
  x: number,
  y: number,
  box: { left: number; top: number; width: number; height: number },
): AreaPoint {
  return {
    x: clampAreaCoordinate((x - box.left) / box.width),
    y: clampAreaCoordinate((y - box.top) / box.height),
  };
}
export function areaRectangle(a: AreaPoint, b: AreaPoint) {
  const x = Math.min(a.x, b.x),
    y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.min(Math.abs(a.x - b.x), 1 - x),
    height: Math.min(Math.abs(a.y - b.y), 1 - y),
  };
}
export function moveArea(
  a: { width: number; height: number },
  x: number,
  y: number,
) {
  return {
    x: Math.max(0, Math.min(1 - a.width, x)),
    y: Math.max(0, Math.min(1 - a.height, y)),
  };
}

/** @spec allocation-plan-area-transform REQ-002 */
export const areaResizeHandles = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
] as const;
export type AreaResizeHandle = (typeof areaResizeHandles)[number];
export interface AreaRectangle extends AreaPoint {
  width: number;
  height: number;
}
export function resizeArea(
  a: AreaRectangle,
  handle: AreaResizeHandle,
  delta: AreaPoint,
  minimum: AreaPoint,
): AreaRectangle {
  let left = a.x,
    top = a.y,
    right = a.x + a.width,
    bottom = a.y + a.height;
  const minWidth = minimum.x,
    minHeight = minimum.y;
  if (handle.includes('w') && delta.x !== 0)
    left = Math.max(0, Math.min(right - minWidth, left + delta.x));
  if (handle.includes('e') && delta.x !== 0)
    right = Math.min(1, Math.max(left + minWidth, right + delta.x));
  if (handle.includes('n') && delta.y !== 0)
    top = Math.max(0, Math.min(bottom - minHeight, top + delta.y));
  if (handle.includes('s') && delta.y !== 0)
    bottom = Math.min(1, Math.max(top + minHeight, bottom + delta.y));
  return {
    x: left,
    y: top,
    width: left === a.x && right === a.x + a.width ? a.width : right - left,
    height: top === a.y && bottom === a.y + a.height ? a.height : bottom - top,
  };
}
