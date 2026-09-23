/** @spec allocation-plan-comments REQ-004,009 */
import type { Prisma } from '@prisma/client';
import type { ApplicationPrincipal } from './sites.js';
import { hasOrganizationCapability } from './permissions.js';
import {
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';
import { commentInitials } from './sign-comment-access.js';
export { commentInitials };
export async function authorizePlanComment(
  db: Prisma.TransactionClient,
  p: ApplicationPrincipal,
  siteId: string,
  planId: string,
  fileId: string | null,
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
      allocationPlans: { some: { id: planId } },
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
  const plan = await db.allocationPlan.findFirst({
    where: { id: planId, siteId, tenantId: p.tenantId },
  });
  if (
    !plan ||
    (fileId === null
      ? !plan.objectKey
      : !(await db.allocationPlanUpload.count({
          where: {
            id: fileId,
            tenantId: p.tenantId,
            siteId,
            groupedPlanId: planId,
            status: 'COMPLETED',
            verifiedAt: { not: null },
          },
        })))
  )
    throw new SignageNotFoundError();
  const profile = member.user.personalProfile;
  const name = (profile ? `${profile.firstName} ${profile.lastName}` : 'Member')
    .trim()
    .slice(0, 200);
  return {
    site,
    viewer: { id: member.id, name, initials: commentInitials(name) },
  };
}
