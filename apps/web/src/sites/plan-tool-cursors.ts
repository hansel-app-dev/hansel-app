/** @spec allocation-plan-tool-cursors REQ-001..004
 * Hotspots use source PNG pixels: arrow tip, fingertip, plus center and bubble tail.
 */
export const planToolCursors = {
  move: 'url("/assets/move_cursor.png") 24 17, default',
  hand: 'url("/assets/hand_cursor.png") 35 12, grab',
  add: 'url("/assets/add_sign_cursor.png") 20 20, crosshair',
  area: 'url("/assets/add_area_cursor.png") 20 20, crosshair',
  line: 'url("/assets/add_linear_cursor.png") 20 20, crosshair',
  comment: 'url("/assets/comment_cursor.png") 10 72, crosshair',
} as const;
export function planCursor(
  tool: keyof typeof planToolCursors,
  panning = false,
) {
  return planToolCursors[panning ? 'hand' : tool];
}
