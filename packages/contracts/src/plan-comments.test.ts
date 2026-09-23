/** @spec allocation-plan-comments REQ-004..006 */
import { expect, it } from 'vitest';
import {
  planCommentCreateSchema,
  planThreadStateSchema,
} from './plan-comments.js';
const key = '00000000-0000-4000-8000-000000000001';
const draft = {
  idempotencyKey: key,
  body: 'Check here',
  mentions: [],
  attachmentIds: [],
  threadId: null,
  x: 0.2,
  y: 0.3,
};
it('REQ-004,005: requires bounded coordinates only for roots and meaningful content', () => {
  expect(planCommentCreateSchema.safeParse(draft).success).toBe(true);
  for (const change of [
    { x: -1 },
    { y: 2 },
    { x: null },
    { body: ' ' },
    { signId: key },
    { body: '😀'.repeat(5001) },
  ])
    expect(
      planCommentCreateSchema.safeParse({ ...draft, ...change }).success,
    ).toBe(false);
  expect(
    planCommentCreateSchema.safeParse({
      ...draft,
      threadId: key,
      x: null,
      y: null,
    }).success,
  ).toBe(true);
  expect(
    planCommentCreateSchema.safeParse({ ...draft, threadId: key }).success,
  ).toBe(false);
});
it('REQ-006: requires a desired state and concurrency token', () => {
  expect(
    planThreadStateSchema.safeParse({
      resolved: true,
      expectedUpdatedAt: new Date().toISOString(),
    }).success,
  ).toBe(true);
  expect(planThreadStateSchema.safeParse({ resolved: true }).success).toBe(
    false,
  );
});
