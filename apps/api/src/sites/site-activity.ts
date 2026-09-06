/** @spec site-activity-feed-comments REQ-002..REQ-010 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  SiteActivityItem,
  SiteActivityPageResponse,
} from '@hansel/contracts';
import type { ApplicationPrincipal } from './sites.js';

export class SiteActivityNotFoundError extends Error {}

const accessWhere = (
  principal: ApplicationPrincipal,
): Prisma.SiteWhereInput => ({
  tenantId: principal.tenantId,
  ...(principal.roleId === 'owner'
    ? {}
    : {
        OR: [
          { accessScope: 'ORGANIZATION' },
          { createdByMembershipId: principal.membershipId },
          { grants: { some: { membershipId: principal.membershipId } } },
        ],
      }),
});

const initials = (displayName: string) =>
  displayName
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toLocaleUpperCase();

const activityInclude = {
  actor: {
    select: {
      user: {
        select: {
          email: true,
          personalProfile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  },
} satisfies Prisma.ActivityInclude;

type ActivityRecord = Prisma.ActivityGetPayload<{
  include: typeof activityInclude;
}>;

const toDto = (record: ActivityRecord): SiteActivityItem => {
  const displayName = record.actor.user.personalProfile
    ? `${record.actor.user.personalProfile.firstName} ${record.actor.user.personalProfile.lastName}`
    : 'Member';
  const base = {
    id: record.id,
    kind: record.kind,
    actor: { displayName, initials: initials(displayName) },
    createdAt: record.createdAt.toISOString(),
  };
  return record.kind === 'SITE_COMMENT_ADDED'
    ? { ...base, kind: record.kind, commentText: record.commentText ?? '' }
    : { ...base, kind: record.kind, subjectLabel: record.subjectLabel ?? '' };
};

const encodeCursor = (record: ActivityRecord) =>
  Buffer.from(
    JSON.stringify({
      createdAt: record.createdAt.toISOString(),
      id: record.id,
    }),
  ).toString('base64url');

const decodeCursor = (cursor: string | undefined) => {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as {
      createdAt?: string;
      id?: string;
    };
    if (!parsed.createdAt || !parsed.id) throw new Error('invalid_cursor');
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    throw new SiteActivityNotFoundError();
  }
};

export function createSiteActivityFeature(prisma: PrismaClient) {
  const authorize = async (principal: ApplicationPrincipal, siteId: string) => {
    if (
      (await prisma.site.count({
        where: { ...accessWhere(principal), id: siteId },
      })) !== 1
    )
      throw new SiteActivityNotFoundError();
  };
  return {
    async list(
      principal: ApplicationPrincipal,
      siteId: string,
      cursor?: string,
    ): Promise<SiteActivityPageResponse> {
      await authorize(principal, siteId);
      const after = decodeCursor(cursor);
      const records = await prisma.activity.findMany({
        where: {
          tenantId: principal.tenantId,
          siteId,
          ...(after
            ? {
                OR: [
                  { createdAt: { lt: after.createdAt } },
                  { createdAt: after.createdAt, id: { lt: after.id } },
                ],
              }
            : {}),
        },
        include: activityInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 51,
      });
      const items = records.slice(0, 50);
      return {
        items: items.map(toDto),
        nextCursor:
          records.length > 50 && items[49] ? encodeCursor(items[49]) : null,
      };
    },
    async comment(
      principal: ApplicationPrincipal,
      siteId: string,
      text: string,
    ): Promise<SiteActivityItem> {
      await authorize(principal, siteId);
      const record = await prisma.activity.create({
        data: {
          tenantId: principal.tenantId,
          siteId,
          actorMembershipId: principal.membershipId,
          kind: 'SITE_COMMENT_ADDED',
          commentText: text,
        },
        include: activityInclude,
      });
      return toDto(record);
    },
  };
}
