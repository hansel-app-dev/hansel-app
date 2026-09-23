/** @spec allocation-plan-tool-cursors REQ-001,002,004 */
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { planCursor, planToolCursors } from './plan-tool-cursors.js';
it('maps all supplied artwork with hotspots and native fallbacks, with Hand taking pan precedence', () => {
  const expected = {
    move: ['move', 24, 17, 'default', 77, 79],
    hand: ['hand', 35, 12, 'grab', 70, 81],
    add: ['add_sign', 20, 20, 'crosshair', 86, 86],
    area: ['add_area', 20, 20, 'crosshair', 84, 84],
    line: ['add_linear', 20, 20, 'crosshair', 85, 84],
    comment: ['comment', 10, 72, 'crosshair', 78, 82],
  } as const;
  for (const tool of Object.keys(expected) as (keyof typeof expected)[]) {
    const [name, x, y, fallback, width, height] = expected[tool];
    expect(planCursor(tool)).toBe(
      `url("/assets/${name}_cursor.png") ${String(x)} ${String(y)}, ${fallback}`,
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
