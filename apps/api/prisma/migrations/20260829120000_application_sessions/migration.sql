CREATE TYPE "ApplicationCredentialKind" AS ENUM ('ACCESS', 'REFRESH');

CREATE TABLE "ApplicationSessionFamily" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationSessionFamily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationSessionCredential" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "familyId" UUID NOT NULL,
  "kind" "ApplicationCredentialKind" NOT NULL,
  "credentialDigest" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationSessionCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationSessionCredential_consumption_check" CHECK (
    "kind" = 'REFRESH' OR "consumedAt" IS NULL
  )
);

CREATE INDEX "ApplicationSessionFamily_userId_revokedAt_idx"
ON "ApplicationSessionFamily"("userId", "revokedAt");
CREATE INDEX "ApplicationSessionFamily_tenantId_revokedAt_idx"
ON "ApplicationSessionFamily"("tenantId", "revokedAt");
CREATE UNIQUE INDEX "ApplicationSessionCredential_credentialDigest_key"
ON "ApplicationSessionCredential"("credentialDigest");
CREATE INDEX "ApplicationSessionCredential_familyId_kind_expiresAt_idx"
ON "ApplicationSessionCredential"("familyId", "kind", "expiresAt");

ALTER TABLE "ApplicationSessionFamily"
ADD CONSTRAINT "ApplicationSessionFamily_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationSessionFamily"
ADD CONSTRAINT "ApplicationSessionFamily_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationSessionCredential"
ADD CONSTRAINT "ApplicationSessionCredential_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "ApplicationSessionFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;
