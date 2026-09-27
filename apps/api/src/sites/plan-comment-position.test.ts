import { afterEach, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createPlanCommentsFeature } from './plan-comments.js';
import { authorizePlanComment } from './plan-comment-access.js';
import {
  SignageConflictError,
  SignageNotFoundError,
  SignageForbiddenError,
} from './signage-schedule.js';
vi.mock('./plan-comment-access.js', () => ({
  authorizePlanComment: vi.fn().mockResolvedValue({}),
  commentInitials: () => 'TV',
}));
afterEach(() => vi.clearAllMocks());
const id = '00000000-0000-4000-8000-000000000001';
const now = new Date('2026-09-27T00:00:00.000Z');
const principal = {
  tenantId: id,
  membershipId: id,
  userId: id,
  roleId: 'viewer',
  email: 'viewer@example.test',
};
const row = {
  id,
  tenantId: id,
  siteId: id,
  planId: id,
  fileId: null,
  x: 0.2,
  y: 0.3,
  authorId: id,
  authorName: 'Test Viewer',
  preview: 'Keep this discussion',
  resolved: false,
  resolvedAt: null,
  resolvedById: null,
  createdAt: now,
  updatedAt: now,
};
const input = { x: 0.6, y: 0.7, expectedUpdatedAt: now.toISOString() };
function fixture() {
  const tx = {
    $queryRaw: vi.fn(),
    allocationPlanCommentThread: {
      findFirst: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue({
        ...row,
        x: input.x,
        y: input.y,
        updatedAt: new Date(now.getTime() + 1),
      }),
    },
  };
  const db = {
    ...tx,
    $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  return {
    tx,
    feature: createPlanCommentsFeature(db as unknown as PrismaClient),
  };
}
it('allocation-plan-comment-moving REQ-001,005,008: authorizes a Viewer and updates only coordinates/timestamp transactionally', async () => {
  const { feature, tx } = fixture();
  const result = await feature.position(principal, id, id, null, id, input);
  expect(authorizePlanComment).toHaveBeenCalledWith(
    tx,
    principal,
    id,
    id,
    null,
  );
  expect(tx.$queryRaw).toHaveBeenCalled();
  expect(tx.allocationPlanCommentThread.findFirst).toHaveBeenCalledWith({
    where: { id, tenantId: id, siteId: id, planId: id, fileId: null },
  });
  expect(tx.allocationPlanCommentThread.update).toHaveBeenCalledWith({
    where: { id },
    data: {
      x: 0.6,
      y: 0.7,
      updatedAt: expect.any(Date),
    },
  });
  expect(result).toMatchObject({
    x: 0.6,
    y: 0.7,
    preview: row.preview,
    createdAt: now.toISOString(),
    resolved: false,
  });
});
it('allocation-plan-comment-moving REQ-007: replays desired coordinates but never overwrites stale or resolved threads', async () => {
  const { feature, tx } = fixture();
  tx.allocationPlanCommentThread.findFirst.mockResolvedValue({
    ...row,
    x: input.x,
    y: input.y,
  });
  await expect(
    feature.position(principal, id, id, null, id, {
      ...input,
      expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
    }),
  ).resolves.toMatchObject({ x: input.x });
  expect(tx.allocationPlanCommentThread.update).not.toHaveBeenCalled();
  tx.allocationPlanCommentThread.findFirst.mockResolvedValue({
    ...row,
    resolved: true,
  });
  await expect(
    feature.position(principal, id, id, null, id, input),
  ).rejects.toBeInstanceOf(SignageConflictError);
  tx.allocationPlanCommentThread.findFirst.mockResolvedValue(row);
  await expect(
    feature.position(principal, id, id, null, id, {
      ...input,
      expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
    }),
  ).rejects.toBeInstanceOf(SignageConflictError);
});
it('allocation-plan-comment-moving REQ-008: missing, revoked and invalid inputs never write', async () => {
  const { feature, tx } = fixture();
  tx.allocationPlanCommentThread.findFirst.mockResolvedValue(null);
  await expect(
    feature.position(principal, id, id, null, id, input),
  ).rejects.toBeInstanceOf(SignageNotFoundError);
  vi.mocked(authorizePlanComment).mockRejectedValueOnce(
    new SignageForbiddenError(),
  );
  await expect(
    feature.position(principal, id, id, null, id, input),
  ).rejects.toBeInstanceOf(SignageForbiddenError);
  await expect(
    feature.position(principal, id, id, null, id, { ...input, x: 2 }),
  ).rejects.toThrow();
  expect(tx.allocationPlanCommentThread.update).not.toHaveBeenCalled();
});
