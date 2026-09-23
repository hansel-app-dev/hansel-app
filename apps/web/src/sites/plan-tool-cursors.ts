/** @spec allocation-plan-tool-cursors REQ-001..004
 * Images are 3× assets; hotspots use rounded CSS pixels: arrow tip, fingertip, plus center and bubble tail.
 */
export const planToolCursors = {
  move: 'image-set(url("/assets/move_cursor.png") 3x) 8 6, default',
  hand: 'image-set(url("/assets/hand_cursor.png") 3x) 12 4, grab',
  add: 'image-set(url("/assets/add_sign_cursor.png") 3x) 7 7, crosshair',
  area: 'image-set(url("/assets/add_area_cursor.png") 3x) 7 7, crosshair',
  line: 'image-set(url("/assets/add_linear_cursor.png") 3x) 7 7, crosshair',
  comment: 'image-set(url("/assets/comment_cursor.png") 3x) 3 24, crosshair',
} as const;
export function planCursor(
  tool: keyof typeof planToolCursors,
  panning = false,
) {
  return planToolCursors[panning ? 'hand' : tool];
}
