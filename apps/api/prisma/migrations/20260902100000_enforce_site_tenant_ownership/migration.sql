ALTER TABLE "SiteGrant" ADD COLUMN "tenantId" UUID;
UPDATE "SiteGrant" AS site_grant
SET "tenantId" = site."tenantId"
FROM "Site" AS site
WHERE site_grant."siteId" = site."id";
ALTER TABLE "SiteGrant" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "SiteInvitation" ADD COLUMN "tenantId" UUID;
UPDATE "SiteInvitation" AS invitation
SET "tenantId" = site."tenantId"
FROM "Site" AS site
WHERE invitation."siteId" = site."id";
ALTER TABLE "SiteInvitation" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "SiteInvitationDeliveryIntent" ADD COLUMN "tenantId" UUID;
UPDATE "SiteInvitationDeliveryIntent" AS delivery
SET "tenantId" = invitation."tenantId"
FROM "SiteInvitation" AS invitation
WHERE delivery."invitationId" = invitation."id";
ALTER TABLE "SiteInvitationDeliveryIntent" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE UNIQUE INDEX "Membership_id_tenantId_key" ON "Membership"("id", "tenantId");
CREATE UNIQUE INDEX "Site_id_tenantId_key" ON "Site"("id", "tenantId");
CREATE UNIQUE INDEX "SiteInvitation_id_tenantId_key" ON "SiteInvitation"("id", "tenantId");
CREATE UNIQUE INDEX "SiteInvitationDeliveryIntent_invitationId_tenantId_key" ON "SiteInvitationDeliveryIntent"("invitationId", "tenantId");

ALTER TABLE "Site" DROP CONSTRAINT "Site_createdByMembershipId_fkey";
ALTER TABLE "SiteGrant" DROP CONSTRAINT "SiteGrant_siteId_fkey";
ALTER TABLE "SiteGrant" DROP CONSTRAINT "SiteGrant_membershipId_fkey";
ALTER TABLE "SiteInvitation" DROP CONSTRAINT "SiteInvitation_siteId_fkey";
ALTER TABLE "SiteInvitationDeliveryIntent" DROP CONSTRAINT "SiteInvitationDeliveryIntent_invitationId_fkey";
ALTER TABLE "SiteCreationRequest" DROP CONSTRAINT "SiteCreationRequest_siteId_fkey";

ALTER TABLE "Site" ADD CONSTRAINT "Site_createdByMembershipId_tenantId_fkey" FOREIGN KEY ("createdByMembershipId", "tenantId") REFERENCES "Membership"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteGrant" ADD CONSTRAINT "SiteGrant_siteId_tenantId_fkey" FOREIGN KEY ("siteId", "tenantId") REFERENCES "Site"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteGrant" ADD CONSTRAINT "SiteGrant_membershipId_tenantId_fkey" FOREIGN KEY ("membershipId", "tenantId") REFERENCES "Membership"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteInvitation" ADD CONSTRAINT "SiteInvitation_siteId_tenantId_fkey" FOREIGN KEY ("siteId", "tenantId") REFERENCES "Site"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteInvitationDeliveryIntent" ADD CONSTRAINT "SiteInvitationDeliveryIntent_invitationId_tenantId_fkey" FOREIGN KEY ("invitationId", "tenantId") REFERENCES "SiteInvitation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteCreationRequest" ADD CONSTRAINT "SiteCreationRequest_siteId_tenantId_fkey" FOREIGN KEY ("siteId", "tenantId") REFERENCES "Site"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
