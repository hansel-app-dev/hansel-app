/** @spec allocation-plan-add-linear REQ-001,004,008,010 */
import { expect, it } from 'vitest';
import {
  planSignCreateSchema,
  planSignPatchSchema,
  planSignSchema,
} from './plan-signs.js';
const input = {
  fileId: null,
  x: 0.2,
  y: 0.3,
  endX: 0.7,
  endY: 0.3,
  placementKind: 'linear',
  mounting: 'Safety Decal',
  idempotencyKey: crypto.randomUUID(),
};
it('REQ-004 accepts a bounded straight segment and rejects incomplete or degenerate geometry', () => {
  expect(planSignCreateSchema.safeParse(input).success).toBe(true);
  for (const change of [
    { endX: undefined },
    { endY: 2 },
    { endX: NaN },
    { endX: 0.2, endY: 0.3 },
    { placementKind: 'point' },
    { mounting: 'Floor' },
  ])
    expect(
      planSignCreateSchema.safeParse({ ...input, ...change }).success,
    ).toBe(false);
  expect(
    planSignCreateSchema.safeParse({ ...input, endX: 0.2, endY: 0.8 }).success,
  ).toBe(true);
});
it('REQ-010 only accepts complete endpoint changes', () => {
  const expectedUpdatedAt = new Date().toISOString();
  expect(
    planSignPatchSchema.safeParse({
      expectedUpdatedAt,
      x: 0,
      y: 0,
      endX: 1,
      endY: 1,
    }).success,
  ).toBe(true);
  for (const changes of [
    { endX: 1 },
    { endX: 1, endY: 1 },
    { x: 0, y: 0, endX: 0, endY: 0 },
  ])
    expect(
      planSignPatchSchema.safeParse({ expectedUpdatedAt, ...changes }).success,
    ).toBe(false);
});
it('REQ-008 validates appearance against placement kind in responses', () => {
  const sign = {
    id: crypto.randomUUID(),
    fileId: null,
    x: 0.2,
    y: 0.3,
    endX: 0.7,
    endY: 0.3,
    placementKind: 'linear',
    mounting: 'Safety Decal',
    code: 'Pr.01',
    content: '',
    function: 'Regulatory/Statutory',
    colour: 'Orange',
    orientation: 'down',
    updatedAt: new Date().toISOString(),
  };
  expect(planSignSchema.safeParse(sign).success).toBe(true);
  for (const changes of [
    { colour: 'Red' },
    { mounting: 'Floor' },
    { endX: null },
  ])
    expect(planSignSchema.safeParse({ ...sign, ...changes }).success).toBe(
      false,
    );
  expect(
    planSignSchema.safeParse({
      ...sign,
      placementKind: 'point',
      endX: null,
      endY: null,
      colour: 'Red',
    }).success,
  ).toBe(true);
});
