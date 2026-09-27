import { nextPageCursor } from './pagination.js';
/** @spec allocation-plan-comments REQ-001,004..006,008..012 */
import { createHash } from 'node:crypto';
import type {
  Prisma,
  PrismaClient,
  AllocationPlanCommentThread,
} from '@prisma/client';
import {
  planCommentCreateSchema,
  planThreadStateSchema,
  planThreadPositionSchema,
  planCommentThreadSchema,
  signCommentSchema,
  type CommentCursor,
  type PlanCommentCreate,
} from '@hansel/contracts';
import type { ApplicationPrincipal } from './sites.js';
import {
  SignageConflictError,
  SignageNotFoundError,
} from './signage-schedule.js';
import { SignCommentValidationError } from './sign-comments.js';
import {
  authorizePlanComment,
  commentInitials,
} from './plan-comment-access.js';
const include = {
  attachments: true,
} satisfies Prisma.AllocationPlanCommentInclude;
type Row = Prisma.AllocationPlanCommentGetPayload<{ include: typeof include }>;
const dto = (row: Row) =>
  signCommentSchema.parse({
    ...row,
    parentId: null,
    author: {
      id: row.authorId,
      name: row.authorName,
      initials: commentInitials(row.authorName),
    },
    createdAt: row.createdAt.toISOString(),
    reactions: [],
    attachments: row.attachments.map((f) => ({
      id: f.id,
      filename: f.filename,
      mediaType: f.mediaType,
      byteSize: f.byteSize,
      createdAt: f.createdAt.toISOString(),
    })),
  });
const threadDto = (r: AllocationPlanCommentThread) =>
  planCommentThreadSchema.parse({
    ...r,
    author: {
      id: r.authorId,
      name: r.authorName,
      initials: commentInitials(r.authorName),
    },
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  });
const after = (c?: CommentCursor) =>
  c
    ? {
        OR: [
          { createdAt: { gt: new Date(c.createdAt) } },
          { createdAt: new Date(c.createdAt), id: { gt: c.id } },
        ],
      }
    : {};
const next = (rows: { id: string; createdAt: Date }[], limit: number) => {
  const last = rows[limit - 1];
  return rows.length > limit && last
    ? { id: last.id, createdAt: last.createdAt.toISOString() }
    : null;
};
export function createPlanCommentsFeature(db: PrismaClient) {
  async function eligible(
    client: Prisma.TransactionClient,
    p: ApplicationPrincipal,
    siteId: string,
    planId: string,
    fileId: string | null,
    query = '',
    cursor?: string,
    ids?: string[],
  ) {
    const { site } = await authorizePlanComment(
      client,
      p,
      siteId,
      planId,
      fileId,
    );
    const rows = await client.membership.findMany({
      where: {
        tenantId: p.tenantId,
        ...(ids ? { id: { in: ids } } : cursor ? { id: { gt: cursor } } : {}),
        ...(site.accessScope === 'ORGANIZATION'
          ? {}
          : {
              OR: [
                { roleId: 'owner' },
                { id: site.createdByMembershipId },
                { siteGrants: { some: { siteId } } },
              ],
            }),
        ...(query
          ? {
              user: {
                personalProfile: {
                  OR: [
                    { firstName: { contains: query, mode: 'insensitive' } },
                    { lastName: { contains: query, mode: 'insensitive' } },
                  ],
                },
              },
            }
          : {}),
      },
      include: { user: { include: { personalProfile: true } } },
      orderBy: { id: 'asc' },
      take: ids ? 20 : 51,
    });
    return rows.map((row) => {
      const profile = row.user.personalProfile;
      const name = (
        profile ? `${profile.firstName} ${profile.lastName}` : 'Member'
      )
        .trim()
        .slice(0, 200);
      return { id: row.id, name, initials: commentInitials(name) };
    });
  }
  return {
    /** @spec allocation-plan-comment-moving REQ-001,005,007,008 */
    async position(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      fileId: string | null,
      id: string,
      raw: unknown,
    ) {
      const input = planThreadPositionSchema.parse(raw);
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "AllocationPlan" WHERE "id" = ${planId}::uuid FOR UPDATE`;
        await authorizePlanComment(tx, p, siteId, planId, fileId);
        const row = await tx.allocationPlanCommentThread.findFirst({
          where: { id, tenantId: p.tenantId, siteId, planId, fileId },
        });
        if (!row) throw new SignageNotFoundError();
        if (row.resolved) throw new SignageConflictError();
        // An uncertain successful request can safely be retried without rewriting.
        if (row.x === input.x && row.y === input.y) return threadDto(row);
        if (row.updatedAt.toISOString() !== input.expectedUpdatedAt)
          throw new SignageConflictError();
        return threadDto(
          await tx.allocationPlanCommentThread.update({
            where: { id },
            data: {
              x: input.x,
              y: input.y,
              updatedAt: new Date(
                Math.max(Date.now(), row.updatedAt.getTime() + 1),
              ),
            },
          }),
        );
      });
    },
    async people(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      fileId: string | null,
      query: string,
      cursor?: string,
    ) {
      const rows = await eligible(db, p, siteId, planId, fileId, query, cursor);
      return {
        people: rows.slice(0, 50),
        nextCursor: nextPageCursor(rows),
      };
    },
    /** @spec allocation-plan-comments-always-visible REQ-003 */
    async markers(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      fileId: string | null,
      cursor?: CommentCursor,
    ) {
      const { viewer } = await authorizePlanComment(
        db,
        p,
        siteId,
        planId,
        fileId,
      );
      const rows = await db.allocationPlanCommentThread.findMany({
        where: {
          tenantId: p.tenantId,
          siteId,
          planId,
          fileId,
          ...after(cursor),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 101,
      });
      return {
        threads: rows.slice(0, 100).map(threadDto),
        nextCursor: next(rows, 100),
        viewer,
      };
    },
    async history(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      fileId: string | null,
      id: string,
      cursor?: CommentCursor,
    ) {
      const { viewer } = await authorizePlanComment(
        db,
        p,
        siteId,
        planId,
        fileId,
      );
      const thread = await db.allocationPlanCommentThread.findFirst({
        where: { id, tenantId: p.tenantId, siteId, planId, fileId },
      });
      if (!thread) throw new SignageNotFoundError();
      const rows = await db.allocationPlanComment.findMany({
        where: { threadId: id, ...after(cursor) },
        include,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 51,
      });
      return {
        thread: threadDto(thread),
        comments: rows.slice(0, 50).map(dto),
        nextCursor: next(rows, 50),
        viewer,
      };
    },
    async state(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      fileId: string | null,
      id: string,
      raw: unknown,
    ) {
      const input = planThreadStateSchema.parse(raw);
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "AllocationPlan" WHERE "id" = ${planId}::uuid FOR UPDATE`;
        await authorizePlanComment(tx, p, siteId, planId, fileId);
        const row = await tx.allocationPlanCommentThread.findFirst({
          where: { id, tenantId: p.tenantId, siteId, planId, fileId },
        });
        if (!row) throw new SignageNotFoundError();
        if (row.resolved === input.resolved) return threadDto(row);
        if (row.updatedAt.toISOString() !== input.expectedUpdatedAt)
          throw new SignageConflictError();
        return threadDto(
          await tx.allocationPlanCommentThread.update({
            where: { id },
            data: {
              resolved: input.resolved,
              resolvedAt: input.resolved ? new Date() : null,
              resolvedById: input.resolved ? p.membershipId : null,
              updatedAt: new Date(
                Math.max(Date.now(), row.updatedAt.getTime() + 1),
              ),
            },
          }),
        );
      });
    },
    async submit(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      fileId: string | null,
      raw: PlanCommentCreate,
    ) {
      const input = planCommentCreateSchema.parse(raw);
      const digest = createHash('sha256')
        .update(JSON.stringify([siteId, planId, fileId, input]))
        .digest('hex');
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "AllocationPlan" WHERE "id" = ${planId}::uuid FOR UPDATE`;
        const { viewer } = await authorizePlanComment(
          tx,
          p,
          siteId,
          planId,
          fileId,
        );
        const previous = await tx.allocationPlanComment.findUnique({
          where: {
            tenantId_authorId_requestKey: {
              tenantId: p.tenantId,
              authorId: p.membershipId,
              requestKey: input.idempotencyKey,
            },
          },
          include,
        });
        if (previous) {
          if (previous.digest !== digest) throw new SignageConflictError();
          return {
            comment: dto(previous),
            thread: threadDto(
              await tx.allocationPlanCommentThread.findUniqueOrThrow({
                where: { id: previous.threadId },
              }),
            ),
          };
        }
        let thread = input.threadId
          ? await tx.allocationPlanCommentThread.findFirst({
              where: {
                id: input.threadId,
                tenantId: p.tenantId,
                siteId,
                planId,
                fileId,
              },
            })
          : null;
        if (input.threadId && !thread) throw new SignageNotFoundError();
        if (thread?.resolved) throw new SignageConflictError();
        if (input.mentions.length) {
          const people = await eligible(
            tx,
            p,
            siteId,
            planId,
            fileId,
            '',
            undefined,
            [...new Set(input.mentions.map((m) => m.membershipId))],
          );
          if (
            input.mentions.some(
              (m) =>
                !people.some(
                  (person) =>
                    person.id === m.membershipId && person.name === m.name,
                ),
            )
          )
            throw new SignCommentValidationError('mention_unavailable');
        }
        if (!thread) {
          if (
            (await tx.allocationPlanCommentThread.count({
              where: { planId },
            })) >= 5000
          )
            throw new SignCommentValidationError('comment_capacity_reached');
          thread = await tx.allocationPlanCommentThread.create({
            data: {
              tenantId: p.tenantId,
              siteId,
              planId,
              fileId,
              x: Number(input.x),
              y: Number(input.y),
              authorId: p.membershipId,
              authorName: viewer.name,
              preview: Array.from(input.body).slice(0, 160).join(''),
            },
          });
        }
        const row = await tx.allocationPlanComment.create({
          data: {
            tenantId: p.tenantId,
            siteId,
            planId,
            threadId: thread.id,
            authorId: p.membershipId,
            authorName: viewer.name,
            body: input.body,
            mentions: input.mentions,
            requestKey: input.idempotencyKey,
            digest,
          },
        });
        if (input.attachmentIds.length) {
          const bound = await tx.allocationPlanCommentAttachment.updateMany({
            where: {
              id: { in: input.attachmentIds },
              tenantId: p.tenantId,
              siteId,
              planId,
              fileId,
              uploadedById: p.userId,
              commentId: null,
              completed: true,
              expiresAt: { gt: new Date() },
            },
            data: { commentId: row.id },
          });
          if (bound.count !== input.attachmentIds.length)
            throw new SignCommentValidationError('attachment_unavailable');
        }
        return {
          thread: threadDto(thread),
          comment: dto(
            await tx.allocationPlanComment.findUniqueOrThrow({
              where: { id: row.id },
              include,
            }),
          ),
        };
      });
    },
  };
}
