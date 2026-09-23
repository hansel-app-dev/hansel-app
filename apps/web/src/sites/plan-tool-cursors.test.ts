/** @spec allocation-plan-tool-cursors REQ-001,002,004 */
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { planCursor, planToolCursors } from './plan-tool-cursors.js';
it('maps all supplied artwork with hotspots and native fallbacks, with Hand taking pan precedence', () => {
  const expected = {
    move: ['move', 8, 6, 'default', 77, 79],
    hand: ['hand', 12, 4, 'grab', 70, 81],
    add: ['add_sign', 7, 7, 'crosshair', 86, 86],
    area: ['add_area', 7, 7, 'crosshair', 84, 84],
    line: ['add_linear', 7, 7, 'crosshair', 85, 84],
    comment: ['comment', 3, 24, 'crosshair', 78, 82],
  } as const;
  for (const tool of Object.keys(expected) as (keyof typeof expected)[]) {
    const [name, x, y, fallback, width, height] = expected[tool];
    expect(planCursor(tool)).toBe(
      `image-set(url("/assets/${name}_cursor.png") 3x) ${String(x)} ${String(y)}, ${fallback}`,
    );
    expect(planCursor(tool, true)).toBe(planToolCursors.hand);
    const runtime = readFileSync(`public/assets/${name}_cursor.png`);
    expect(
      runtime.equals(
        readFileSync(
          `../../specs/features/allocation-plan-tool-cursors/references/${name}_cursor.png`,
        ),
      ),
    ).toBe(true);
    expect(runtime.readUInt32BE(16)).toBe(width);
    expect(runtime.readUInt32BE(20)).toBe(height);
  }
});
