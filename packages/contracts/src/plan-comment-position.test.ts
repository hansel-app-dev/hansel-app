import { expect, it } from 'vitest';
import { planThreadPositionSchema } from './plan-comments.js';

it('allocation-plan-comment-moving REQ-008: accepts only bounded paired coordinates and a timestamp', () => {
  const input = {
    x: 0.2,
    y: 0.8,
    expectedUpdatedAt: '2026-09-27T00:00:00.000Z',
  };
  expect(planThreadPositionSchema.parse(input)).toEqual(input);
  expect(
    planThreadPositionSchema.parse({ ...input, x: 0, y: 1 }),
  ).toMatchObject({ x: 0, y: 1 });
  for (const bad of [
    { ...input, x: -0.1 },
    { ...input, y: 1.1 },
    { ...input, x: NaN },
    { ...input, y: Infinity },
    { ...input, x: '0.2' },
    { ...input, y: undefined },
    { ...input, expectedUpdatedAt: undefined },
    { ...input, expectedUpdatedAt: 'invalid' },
    { ...input, resolved: true },
  ])
    expect(planThreadPositionSchema.safeParse(bad).success).toBe(false);
});
