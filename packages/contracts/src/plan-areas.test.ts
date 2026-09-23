/** @spec allocation-plan-add-area REQ-001,004,007,008,009 */
import { expect, it } from 'vitest';
import {
  planAreaCreateSchema,
  planAreaPatchSchema,
  planAreaSchema,
} from './plan-areas.js';
const input = {
  fileId: null,
  x: 0.1,
  y: 0.2,
  width: 0.3,
  height: 0.4,
  idempotencyKey: crypto.randomUUID(),
};
it('accepts bounded independent geometry and rejects malformed or unsupported writes', () => {
  expect(planAreaCreateSchema.parse(input)).toEqual(input);
  for (const changes of [
    { width: 0 },
    { height: -1 },
    { x: Infinity },
    { x: 0.8 },
    { y: 0.9 },
    { width: NaN },
    { tenantId: crypto.randomUUID() },
    { colour: 'Red' },
    { mounting: 'Floor' },
  ])
    expect(
      planAreaCreateSchema.safeParse({ ...input, ...changes }).success,
    ).toBe(false);
});
it('requires paired moves and concurrency, limits metadata and rejects partial resizing', () => {
  const expectedUpdatedAt = new Date().toISOString();
  for (const changes of [
    { x: 0, y: 0 },
    { code: 'Ar.02' },
    { content: '' },
    { orientation: 'up' },
  ])
    expect(
      planAreaPatchSchema.safeParse({ expectedUpdatedAt, ...changes }).success,
    ).toBe(true);
  for (const changes of [
    {},
    { x: 0.2 },
    { width: 0.2 },
    { code: ' ' },
    { code: 'x'.repeat(41) },
    { content: 'x'.repeat(201) },
    { orientation: 'north' },
    { colour: 'Blue' },
  ])
    expect(
      planAreaPatchSchema.safeParse({ expectedUpdatedAt, ...changes }).success,
    ).toBe(false);
  expect(planAreaPatchSchema.safeParse({ code: 'Ar.02' }).success).toBe(false);
});
it('reads Areas with fixed appearance independently from Sign schemas', () => {
  const { idempotencyKey: id, ...geometry } = input;
  const area = {
    ...geometry,
    id,
    code: 'Ar.01',
    content: '',
    orientation: 'down',
    type: 'Floor',
    function: 'Environmental',
    colour: 'Blue',
    updatedAt: new Date().toISOString(),
  };
  expect(planAreaSchema.parse(area)).toEqual(area);
  expect(planAreaSchema.safeParse({ ...area, colour: 'Red' }).success).toBe(
    false,
  );
});

/** @spec allocation-plan-area-transform REQ-006 */
it('accepts complete resize tuples and rejects partial or invalid resize geometry', () => {
  const expectedUpdatedAt = new Date().toISOString();
  const resize = { expectedUpdatedAt, x: 0.1, y: 0.2, width: 0.4, height: 0.5 };
  expect(planAreaPatchSchema.parse(resize)).toEqual(resize);
  for (const invalid of [
    { ...resize, height: undefined },
    { ...resize, x: undefined },
    { ...resize, width: 0 },
    { ...resize, height: Infinity },
    { ...resize, width: 1 },
    { ...resize, height: 0.9 },
  ])
    expect(planAreaPatchSchema.safeParse(invalid).success).toBe(false);
});
