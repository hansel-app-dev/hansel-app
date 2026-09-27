import { describe, expect, it, vi } from 'vitest';
import { createSignCommentsFeature } from './sign-comments.js';
import { createPlanCommentsFeature } from './plan-comments.js';
import type { PlanCommentCreate, SignCommentCreate } from '@hansel/contracts';
const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const p = {
  email: 'owner@example.com',
  userId: id,
  tenantId: id,
  membershipId: id,
  roleId: 'viewer',
};
const now = new Date('2026-09-10T00:00:00Z');
const draft: SignCommentCreate = {
  idempotencyKey: id,
  parentId: null,
  body: 'Hello',
  mentions: [],
  attachmentIds: [],
};
const planDraft: PlanCommentCreate = {
  idempotencyKey: id,
  threadId: null,
  x: 0.2,
  y: 0.3,
  body: 'Hello',
  mentions: [],
  attachmentIds: [],
};
function setup() {
  const member = {
    id,
    roleId: 'viewer',
    user: { personalProfile: { firstName: 'Ava', lastName: 'Chen' } },
  };
  const attachment = {
    id,
    filename: 'file.png',
    mediaType: 'image/png',
    byteSize: 8,
    createdAt: now,
  };
  const row = {
    id,
    parentId: null as string | null,
    threadId: id,
    authorId: id,
    authorName: 'Ava Chen',
    body: 'Hello',
    mentions: [],
    createdAt: now,
    attachments: [attachment],
    reactions: [
      { emoji: '👍', authorId: other },
      { emoji: '👍', authorId: id },
      { emoji: '👀', authorId: other },
    ],
    digest: '',
  };
  const thread = {
    id,
    fileId: null,
    x: 0.2,
    y: 0.3,
    authorId: id,
    authorName: 'Ava Chen',
    preview: 'Hello',
    resolved: false,
    resolvedAt: null as Date | null,
    resolvedById: null as string | null,
    createdAt: now,
    updatedAt: now,
  };
  const comments = {
    findMany: vi.fn().mockResolvedValue([row]),
    findFirst: vi.fn().mockResolvedValue(row),
    findUnique: vi.fn().mockResolvedValue(null),
    findUniqueOrThrow: vi.fn().mockResolvedValue(row),
    count: vi.fn().mockResolvedValue(1),
    create: vi
      .fn()
      .mockImplementation(({ data }: { data: typeof row }) =>
        Promise.resolve(Object.assign(row, data)),
      ),
  };
  const threads = {
    findMany: vi.fn().mockResolvedValue([thread]),
    findFirst: vi.fn().mockResolvedValue(thread),
    findUniqueOrThrow: vi.fn().mockResolvedValue(thread),
    count: vi.fn().mockResolvedValue(0),
    create: vi
      .fn()
      .mockImplementation(({ data }: { data: typeof thread }) =>
        Promise.resolve(Object.assign(thread, data)),
      ),
    update: vi
      .fn()
      .mockImplementation(({ data }: { data: typeof thread }) =>
        Promise.resolve(Object.assign(thread, data)),
      ),
  };
  const attachments = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
  const db = {
    membership: {
      findFirst: vi.fn().mockResolvedValue(member),
      findMany: vi
        .fn()
        .mockResolvedValue([
          member,
          { id: other, user: { personalProfile: null } },
        ]),
    },
    site: {
      findFirst: vi.fn().mockResolvedValue({
        id,
        accessScope: 'ORGANIZATION',
        createdByMembershipId: id,
      }),
    },
    allocationPlan: {
      findFirst: vi.fn().mockResolvedValue({ objectKey: 'legacy' }),
    },
    signComment: comments,
    allocationPlanComment: comments,
    allocationPlanCommentThread: threads,
    signCommentAttachment: attachments,
    allocationPlanCommentAttachment: attachments,
    signCommentReaction: { upsert: vi.fn(), deleteMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi
      .fn()
      .mockImplementation((work: (tx: unknown) => Promise<unknown>) =>
        Promise.resolve(work(db)),
      ),
  };
  return {
    db,
    row,
    thread,
    comments,
    threads,
    attachments,
    member,
    sign: createSignCommentsFeature(db as never),
    plan: createPlanCommentsFeature(db as never),
  };
}
for (const kind of ['sign', 'plan'] as const)
  describe(`${kind} comments [sign-comments/allocation-plan-comments REQ-004..012]`, () => {
    const args = [p, id, id] as const;
    it('paginates comments and eligible people without exposing inaccessible context', async () => {
      const s = setup();
      const people = (query = '', cursor?: string) =>
        kind === 'sign'
          ? s.sign.people(...args, query, cursor)
          : s.plan.people(...args, null, query, cursor);
      expect((await people()).people).toEqual([
        { id, name: 'Ava Chen', initials: 'AC' },
        { id: other, name: 'Member', initials: 'M' },
      ]);
      s.db.site.findFirst.mockResolvedValue({
        id,
        accessScope: 'PRIVATE',
        createdByMembershipId: id,
      });
      s.db.membership.findMany.mockResolvedValue(
        Array.from({ length: 51 }, () => s.member),
      );
      expect((await people('Av', id)).nextCursor).toBe(id);
      const read = (cursor?: { id: string; createdAt: string }) =>
        kind === 'sign'
          ? s.sign.list(...args, id, cursor)
          : s.plan.history(...args, null, id, cursor);
      expect((await read()).nextCursor).toBeNull();
      s.comments.findMany.mockResolvedValue(
        Array.from({ length: 51 }, () => s.row),
      );
      expect(
        (await read({ id, createdAt: now.toISOString() })).nextCursor,
      ).toEqual({ id, createdAt: now.toISOString() });
      if (kind === 'sign') {
        expect((await s.sign.list(...args)).comments[0]?.reactions).toEqual([
          { emoji: '👍', count: 2, selected: true },
          { emoji: '👀', count: 1, selected: false },
        ]);
        s.comments.count.mockResolvedValueOnce(0);
      } else s.threads.findFirst.mockResolvedValueOnce(null);
      await expect(read()).rejects.toThrow();
    });
    it('submits roots and replies, binds attachments and replays only identical requests', async () => {
      const s = setup();
      const submit = (
        extra: Partial<SignCommentCreate & PlanCommentCreate> = {},
      ) =>
        kind === 'sign'
          ? s.sign.submit(...args, { ...draft, ...extra })
          : s.plan.submit(...args, null, { ...planDraft, ...extra });
      expect(await submit()).toMatchObject(
        kind === 'sign'
          ? { body: 'Hello' }
          : { comment: { body: 'Hello' }, thread: { x: 0.2, y: 0.3 } },
      );
      s.comments.findUnique.mockResolvedValueOnce(s.row);
      await expect(submit()).resolves.toBeDefined();
      s.comments.findUnique.mockResolvedValueOnce(s.row);
      await expect(submit({ body: 'Changed' })).rejects.toThrow();
      const reply =
        kind === 'sign' ? { parentId: id } : { threadId: id, x: null, y: null };
      await submit({
        ...reply,
        attachmentIds: [id],
        body: '@Ava Chen',
        mentions: [{ membershipId: id, name: 'Ava Chen', start: 0, end: 9 }],
      });
      expect(s.attachments.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            uploadedById: id,
            completed: true,
            commentId: null,
          }),
        }),
      );
      s.attachments.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(submit({ ...reply, attachmentIds: [id] })).rejects.toThrow(
        'attachment_unavailable',
      );
      await expect(
        submit({
          ...reply,
          body: '@Other',
          mentions: [{ membershipId: other, name: 'Other', start: 0, end: 6 }],
        }),
      ).rejects.toThrow('mention_unavailable');
      await expect(
        submit({
          ...reply,
          body: '@Ava Chen',
          mentions: [
            { membershipId: other, name: 'Ava Chen', start: 0, end: 9 },
          ],
        }),
      ).rejects.toThrow('mention_unavailable');
      if (kind === 'sign') {
        s.row.parentId = other;
        await submit(reply);
        s.comments.findFirst.mockResolvedValueOnce(null);
      } else {
        s.thread.resolved = true;
        await expect(submit(reply)).rejects.toThrow();
        s.thread.resolved = false;
        s.threads.findFirst.mockResolvedValueOnce(null);
      }
      await expect(submit(reply)).rejects.toThrow();
      if (kind === 'plan') {
        s.threads.count.mockResolvedValueOnce(5000);
        await expect(submit()).rejects.toThrow('comment_capacity_reached');
      }
    });
  });
it('sign-comments REQ-012: idempotently selects and removes scoped reactions', async () => {
  const s = setup();
  await s.sign.react(p, id, id, id, { emoji: '👍', selected: true });
  expect(s.db.signCommentReaction.upsert).toHaveBeenCalledOnce();
  await s.sign.react(p, id, id, id, { emoji: '👍', selected: false });
  expect(s.db.signCommentReaction.deleteMany).toHaveBeenCalledOnce();
  s.comments.count.mockResolvedValueOnce(0);
  await expect(
    s.sign.react(p, id, id, id, { emoji: '👍', selected: true }),
  ).rejects.toThrow();
});
it('allocation-plan-comments REQ-005: resolves/reopens using optimistic tokens and safe same-state replay', async () => {
  const s = setup(),
    args = [p, id, id, null, id] as const;
  await expect(
    s.plan.state(...args, {
      resolved: false,
      expectedUpdatedAt: now.toISOString(),
    }),
  ).resolves.toMatchObject({ resolved: false });
  await expect(
    s.plan.state(...args, {
      resolved: true,
      expectedUpdatedAt: new Date(0).toISOString(),
    }),
  ).rejects.toThrow();
  await expect(
    s.plan.state(...args, {
      resolved: true,
      expectedUpdatedAt: now.toISOString(),
    }),
  ).resolves.toMatchObject({ resolved: true, resolvedById: id });
  expect(s.thread.resolvedAt).toBeInstanceOf(Date);
  await expect(
    s.plan.state(...args, {
      resolved: false,
      expectedUpdatedAt: s.thread.updatedAt.toISOString(),
    }),
  ).resolves.toMatchObject({
    resolved: false,
    resolvedAt: null,
    resolvedById: null,
  });
  s.threads.findFirst.mockResolvedValueOnce(null);
  await expect(
    s.plan.state(...args, {
      resolved: true,
      expectedUpdatedAt: now.toISOString(),
    }),
  ).rejects.toThrow();
});
