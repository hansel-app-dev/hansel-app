ALTER TABLE "Tenant"
ADD COLUMN "country" TEXT NOT NULL DEFAULT '',
ADD COLUMN "industry" TEXT NOT NULL DEFAULT '',
ADD COLUMN "placeService" TEXT NOT NULL DEFAULT '',
ADD COLUMN "organizationSize" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Tenant"
ALTER COLUMN "country" DROP DEFAULT,
ALTER COLUMN "industry" DROP DEFAULT,
ALTER COLUMN "placeService" DROP DEFAULT,
ALTER COLUMN "organizationSize" DROP DEFAULT;

ALTER TABLE "OnboardingJourney" ADD COLUMN "tenantId" UUID;
CREATE UNIQUE INDEX "OnboardingJourney_tenantId_key" ON "OnboardingJourney"("tenantId");
ALTER TABLE "OnboardingJourney" ADD CONSTRAINT "OnboardingJourney_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OrganizationProfileSubmission" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "journeyId" UUID NOT NULL,
  "submissionKeyDigest" TEXT NOT NULL,
  "credentialDigest" TEXT NOT NULL,
  "requestDigest" TEXT,
  "nextCredentialDigest" TEXT,
  "outcome" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationProfileSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationProfileSubmission_journeyId_key" ON "OrganizationProfileSubmission"("journeyId");
CREATE UNIQUE INDEX "OrganizationProfileSubmission_submissionKeyDigest_key" ON "OrganizationProfileSubmission"("submissionKeyDigest");
CREATE UNIQUE INDEX "Membership_single_owner_per_tenant" ON "Membership"("tenantId") WHERE "roleId" = 'owner';
ALTER TABLE "OrganizationProfileSubmission" ADD CONSTRAINT "OrganizationProfileSubmission_journeyId_fkey"
FOREIGN KEY ("journeyId") REFERENCES "OnboardingJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
