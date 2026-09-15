/** @spec sign-comments REQ-004,009 */
import type { Prisma } from '@prisma/client';
import type { ApplicationPrincipal } from './sites.js';
import { hasOrganizationCapability } from './permissions.js';
import {
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';
export const commentInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toUpperCase();
export async function authorizeComment(
  db: Prisma.TransactionClient,
  p: ApplicationPrincipal,
  siteId: string,
  signId: string,
) {
  const member = await db.membership.findFirst({
    where: { id: p.membershipId, tenantId: p.tenantId, userId: p.userId },
    include: { user: { include: { personalProfile: true } } },
  });
  if (!member || !hasOrganizationCapability(member.roleId, 'COMMENT'))
    throw new SignageForbiddenError();
  const site = await db.site.findFirst({
    where: {
      id: siteId,
      tenantId: p.tenantId,
      signs: { some: { id: signId } },
      ...(member.roleId === 'owner'
        ? {}
        : {
            OR: [
              { accessScope: 'ORGANIZATION' },
              { createdByMembershipId: member.id },
              { grants: { some: { membershipId: member.id } } },
            ],
          }),
    },
  });
  if (!site) throw new SignageNotFoundError();
  const profile = member.user.personalProfile;
  const name = (profile ? `${profile.firstName} ${profile.lastName}` : 'Member')
    .trim()
    .slice(0, 200);
  return {
    site,
    viewer: { id: member.id, name, initials: commentInitials(name) },
  };
}
