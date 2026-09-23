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
