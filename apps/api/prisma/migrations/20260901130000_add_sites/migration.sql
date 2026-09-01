CREATE TYPE "SiteOrganizationAccess" AS ENUM ('VIEW_COMMENT', 'EDIT_MANAGE');
CREATE TYPE "SiteRole" AS ENUM ('ADMINISTRATOR', 'EDITOR', 'VIEWER');
CREATE TYPE "SiteInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "Site" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "createdByMembershipId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "organizationAccess" "SiteOrganizationAccess" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteGrant" (
  "id" UUID NOT NULL,
  "siteId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "role" "SiteRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteInvitation" (
  "id" UUID NOT NULL,
  "siteId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" "SiteRole" NOT NULL,
  "tokenDigest" VARCHAR(64) NOT NULL,
  "status" "SiteInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteInvitationDeliveryIntent" (
  "id" UUID NOT NULL,
  "invitationId" UUID NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL,
  "leaseOwner" VARCHAR(128),
  "leaseExpiresAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "terminalAt" TIMESTAMP(3),
  "providerId" VARCHAR(256),
  "lastErrorCode" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteInvitationDeliveryIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteCreationRequest" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "keyDigest" VARCHAR(64) NOT NULL,
  "requestDigest" VARCHAR(64) NOT NULL,
  "siteId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteCreationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Site_tenantId_createdAt_idx" ON "Site"("tenantId", "createdAt");
CREATE UNIQUE INDEX "SiteGrant_siteId_membershipId_key" ON "SiteGrant"("siteId", "membershipId");
CREATE INDEX "SiteGrant_membershipId_idx" ON "SiteGrant"("membershipId");
CREATE UNIQUE INDEX "SiteInvitation_tokenDigest_key" ON "SiteInvitation"("tokenDigest");
CREATE UNIQUE INDEX "SiteInvitation_siteId_email_key" ON "SiteInvitation"("siteId", "email");
CREATE INDEX "SiteInvitation_email_status_idx" ON "SiteInvitation"("email", "status");
CREATE INDEX "SiteInvitation_expiresAt_idx" ON "SiteInvitation"("expiresAt");
CREATE UNIQUE INDEX "SiteInvitationDeliveryIntent_invitationId_key" ON "SiteInvitationDeliveryIntent"("invitationId");
CREATE INDEX "SiteInvitationDeliveryIntent_status_nextAttemptAt_leaseExpiresAt_idx" ON "SiteInvitationDeliveryIntent"("status", "nextAttemptAt", "leaseExpiresAt");
CREATE UNIQUE INDEX "SiteCreationRequest_tenantId_keyDigest_key" ON "SiteCreationRequest"("tenantId", "keyDigest");
CREATE INDEX "SiteCreationRequest_siteId_idx" ON "SiteCreationRequest"("siteId");

ALTER TABLE "Site" ADD CONSTRAINT "Site_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Site" ADD CONSTRAINT "Site_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteGrant" ADD CONSTRAINT "SiteGrant_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteGrant" ADD CONSTRAINT "SiteGrant_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteInvitation" ADD CONSTRAINT "SiteInvitation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteInvitationDeliveryIntent" ADD CONSTRAINT "SiteInvitationDeliveryIntent_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "SiteInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteCreationRequest" ADD CONSTRAINT "SiteCreationRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteCreationRequest" ADD CONSTRAINT "SiteCreationRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
