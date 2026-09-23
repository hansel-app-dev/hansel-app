/** @spec allocation-plan-add-linear REQ-004,010 */
export interface LinearGeometry {
  x: number;
  y: number;
  endX: number;
  endY: number;
}
export const clampLinear = (value: number) => Math.max(0, Math.min(1, value));
export function linearPoint(
  x: number,
  y: number,
  box: { left: number; top: number; width: number; height: number },
) {
  return {
    x: clampLinear((x - box.left) / box.width),
    y: clampLinear((y - box.top) / box.height),
  };
}
export function linearLength(
  line: LinearGeometry,
  box: { width: number; height: number },
) {
  return Math.hypot(
    (line.endX - line.x) * box.width,
    (line.endY - line.y) * box.height,
  );
}
export function moveLinear(
  line: LinearGeometry,
  dx: number,
  dy: number,
): LinearGeometry {
  const x = Math.max(
    -Math.min(line.x, line.endX),
    Math.min(1 - Math.max(line.x, line.endX), dx),
  );
  const y = Math.max(
    -Math.min(line.y, line.endY),
    Math.min(1 - Math.max(line.y, line.endY), dy),
  );
  const round = (value: number) => Math.round(value * 1e12) / 1e12;
  return {
    x: round(line.x + x),
    y: round(line.y + y),
    endX: round(line.endX + x),
    endY: round(line.endY + y),
  };
}
