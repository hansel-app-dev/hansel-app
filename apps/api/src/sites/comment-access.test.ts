import { expect, it, vi } from 'vitest';
import { authorizeComment, commentInitials } from './sign-comment-access.js';
import { authorizePlanComment } from './plan-comment-access.js';
const id = '00000000-0000-4000-8000-000000000001';
const p = {
  email: 'owner@example.com',
  userId: id,
  tenantId: id,
  membershipId: id,
  roleId: 'owner',
};
it('sign-comments/allocation-plan-comments REQ-004,009: checks current membership and scoped parent/file access', async () => {
  const member = {
    id,
    roleId: 'owner',
    user: { personalProfile: { firstName: '🙂 Ava', lastName: 'Chen' } },
  };
  const db = {
    membership: { findFirst: vi.fn().mockResolvedValue(member) },
    site: { findFirst: vi.fn().mockResolvedValue({ id }) },
    allocationPlan: {
      findFirst: vi.fn().mockResolvedValue({ objectKey: 'legacy' }),
    },
    allocationPlanUpload: { count: vi.fn().mockResolvedValue(1) },
  };
  for (const read of [
    () => authorizeComment(db as never, p, id, id),
    () => authorizePlanComment(db as never, p, id, id, null),
  ]) {
    expect((await read()).viewer).toMatchObject({
      name: '🙂 Ava Chen',
      initials: '🙂A',
    });
    db.membership.findFirst.mockResolvedValueOnce(null);
    await expect(read()).rejects.toThrow();
    db.membership.findFirst.mockResolvedValueOnce({
      ...member,
      roleId: 'unknown',
    });
    await expect(read()).rejects.toThrow();
    db.site.findFirst.mockResolvedValueOnce(null);
    await expect(read()).rejects.toThrow();
    db.membership.findFirst.mockResolvedValueOnce({
      ...member,
      roleId: 'viewer',
      user: { personalProfile: null },
    });
    expect((await read()).viewer).toMatchObject({
      name: 'Member',
      initials: 'M',
    });
    expect(db.site.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  }
  db.allocationPlan.findFirst.mockResolvedValueOnce(null);
  await expect(
    authorizePlanComment(db as never, p, id, id, null),
  ).rejects.toThrow();
  db.allocationPlan.findFirst.mockResolvedValueOnce({ objectKey: null });
  await expect(
    authorizePlanComment(db as never, p, id, id, null),
  ).rejects.toThrow();
  await authorizePlanComment(db as never, p, id, id, id);
  expect(db.allocationPlanUpload.count).toHaveBeenCalledWith({
    where: {
      id,
      tenantId: id,
      siteId: id,
      groupedPlanId: id,
      status: 'COMPLETED',
      verifiedAt: { not: null },
    },
  });
  db.allocationPlanUpload.count.mockResolvedValueOnce(0);
  await expect(
    authorizePlanComment(db as never, p, id, id, id),
  ).rejects.toThrow();
  expect(commentInitials('')).toBe('');
});
