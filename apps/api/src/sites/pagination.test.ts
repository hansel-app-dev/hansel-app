import { expect, it } from 'vitest';
import { nextPageCursor } from './pagination.js';
it('returns a cursor only when an extra row exists and the visible boundary has an identity', () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({ id: String(i) }));
  expect(nextPageCursor([])).toBeNull();
  expect(nextPageCursor(rows.slice(0, 50))).toBeNull();
  expect(nextPageCursor(rows)).toBe('49');
  expect(nextPageCursor(rows, 2)).toBe('1');
  const sparse = [...rows];
  Reflect.deleteProperty(sparse, 49);
  expect(nextPageCursor(sparse)).toBeNull();
});
