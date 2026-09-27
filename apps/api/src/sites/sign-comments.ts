import { nextPageCursor } from './pagination.js';
/** @spec sign-comments REQ-004..006,009,010,012 */
import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  signCommentCreateSchema,
  signCommentSchema,
  commentReactionSchema,
  type SignCommentCreate,
  type CommentCursor,
} from '@hansel/contracts';
import type { ApplicationPrincipal } from './sites.js';
import {
  SignageConflictError,
  SignageNotFoundError,
} from './signage-schedule.js';
import { authorizeComment, commentInitials } from './sign-comment-access.js';
const include = {
  attachments: true,
  reactions: true,
} satisfies Prisma.SignCommentInclude;
type Row = Prisma.SignCommentGetPayload<{ include: typeof include }>;
const dto = (row: Row, authorId: string) =>
  signCommentSchema.parse({
    ...row,
    author: {
      id: row.authorId,
      name: row.authorName,
      initials: commentInitials(row.authorName),
    },
    createdAt: row.createdAt.toISOString(),
    attachments: row.attachments.map((file) => ({
      id: file.id,
      filename: file.filename,
      mediaType: file.mediaType,
      byteSize: file.byteSize,
      createdAt: file.createdAt.toISOString(),
    })),
    reactions: [
      ...new Set(row.reactions.map((reaction) => reaction.emoji)),
    ].map((emoji) => ({
      emoji,
      count: row.reactions.filter((reaction) => reaction.emoji === emoji)
        .length,
      selected: row.reactions.some(
        (reaction) =>
          reaction.emoji === emoji && reaction.authorId === authorId,
      ),
    })),
  });
export class SignCommentValidationError extends Error {}
export function createSignCommentsFeature(db: PrismaClient) {
  async function eligible(
    client: Prisma.TransactionClient,
    p: ApplicationPrincipal,
    siteId: string,
    signId: string,
    query = '',
    cursor?: string,
    ids?: string[],
  ) {
    const { site } = await authorizeComment(client, p, siteId, signId);
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
    async people(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      query: string,
      cursor?: string,
    ) {
      const rows = await eligible(db, p, siteId, signId, query, cursor);
      return {
        people: rows.slice(0, 50),
        nextCursor: nextPageCursor(rows),
      };
    },
    async react(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      commentId: string,
      raw: unknown,
    ) {
      const input = commentReactionSchema.parse(raw);
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Sign" WHERE "id" = ${signId}::uuid FOR UPDATE`;
        await authorizeComment(tx, p, siteId, signId);
        if (
          !(await tx.signComment.count({
            where: { id: commentId, tenantId: p.tenantId, siteId, signId },
          }))
        )
          throw new SignageNotFoundError();
        const where = {
          commentId_authorId_emoji: {
            commentId,
            authorId: p.membershipId,
            emoji: input.emoji,
          },
        };
        if (input.selected)
          await tx.signCommentReaction.upsert({
            where,
            create: {
              commentId,
              tenantId: p.tenantId,
              siteId,
              signId,
              authorId: p.membershipId,
              emoji: input.emoji,
            },
            update: {},
          });
        else
          await tx.signCommentReaction.deleteMany({
            where: { commentId, authorId: p.membershipId, emoji: input.emoji },
          });
        const row = await tx.signComment.findUniqueOrThrow({
          where: { id: commentId },
          include,
        });
        return dto(row, p.membershipId);
      });
    },
    async list(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      parentId: string | null = null,
      cursor?: CommentCursor,
    ) {
      const { viewer } = await authorizeComment(db, p, siteId, signId);
      if (
        parentId &&
        !(await db.signComment.count({
          where: {
            id: parentId,
            tenantId: p.tenantId,
            siteId,
            signId,
            parentId: null,
          },
        }))
      )
        throw new SignageNotFoundError();
      const rows = await db.signComment.findMany({
        where: {
          tenantId: p.tenantId,
          siteId,
          signId,
          parentId,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { gt: new Date(cursor.createdAt) } },
                  {
                    createdAt: new Date(cursor.createdAt),
                    id: { gt: cursor.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 51,
        include,
      });
      const last = rows[49];
      return {
        comments: rows.slice(0, 50).map((row) => dto(row, p.membershipId)),
        nextCursor:
          rows.length > 50 && last
            ? { id: last.id, createdAt: last.createdAt.toISOString() }
            : null,
        viewer,
      };
    },
    async submit(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      raw: SignCommentCreate,
    ) {
      const input = signCommentCreateSchema.parse(raw);
      const digest = createHash('sha256')
        .update(JSON.stringify([siteId, signId, input]))
        .digest('hex');
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Sign" WHERE "id" = ${signId}::uuid FOR UPDATE`;
        const { viewer } = await authorizeComment(tx, p, siteId, signId);
        const previous = await tx.signComment.findUnique({
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
          return dto(previous, p.membershipId);
        }
        let parentId = input.parentId;
        if (parentId) {
          const parent = await tx.signComment.findFirst({
            where: { id: parentId, tenantId: p.tenantId, siteId, signId },
          });
          if (!parent) throw new SignageNotFoundError();
          parentId = parent.parentId ?? parent.id;
        }
        if (input.mentions.length) {
          const people = await eligible(tx, p, siteId, signId, '', undefined, [
            ...new Set(input.mentions.map((mention) => mention.membershipId)),
          ]);
          if (
            input.mentions.some(
              (mention) =>
                !people.some(
                  (person) =>
                    person.id === mention.membershipId &&
                    person.name === mention.name,
                ),
            )
          )
            throw new SignCommentValidationError('mention_unavailable');
        }
        const row = await tx.signComment.create({
          data: {
            tenantId: p.tenantId,
            siteId,
            signId,
            parentId,
            authorId: p.membershipId,
            authorName: viewer.name,
            body: input.body,
            mentions: input.mentions,
            requestKey: input.idempotencyKey,
            digest,
          },
          include,
        });
        if (input.attachmentIds.length) {
          const bound = await tx.signCommentAttachment.updateMany({
            where: {
              id: { in: input.attachmentIds },
              tenantId: p.tenantId,
              siteId,
              signId,
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
        return dto(
          await tx.signComment.findUniqueOrThrow({
            where: { id: row.id },
            include,
          }),
          p.membershipId,
        );
      });
    },
  };
}
