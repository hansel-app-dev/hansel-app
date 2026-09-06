CREATE TYPE "SignTypeColor" AS ENUM ('SLATE', 'RED', 'TEAL');
CREATE TYPE "SignStatus" AS ENUM ('UNSPECIFIED', 'IN_PROGRESS', 'APPROVED');

CREATE TABLE "SignType" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "siteId" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL, "normalizedName" VARCHAR(80) NOT NULL,
  "color" "SignTypeColor" NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SignType_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Sign" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "siteId" UUID NOT NULL, "signTypeId" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL, "normalizedCode" VARCHAR(40) NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1,
  "location" VARCHAR(200) NOT NULL DEFAULT '', "content" VARCHAR(200) NOT NULL DEFAULT '',
  "comments" VARCHAR(1000) NOT NULL DEFAULT '', "status" "SignStatus" NOT NULL DEFAULT 'UNSPECIFIED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sign_pkey" PRIMARY KEY ("id"), CONSTRAINT "Sign_quantity_check" CHECK ("quantity" BETWEEN 1 AND 9999)
);
CREATE UNIQUE INDEX "SignType_id_tenantId_siteId_key" ON "SignType"("id", "tenantId", "siteId");
CREATE UNIQUE INDEX "SignType_tenantId_siteId_normalizedName_key" ON "SignType"("tenantId", "siteId", "normalizedName");
CREATE INDEX "SignType_siteId_createdAt_idx" ON "SignType"("siteId", "createdAt");
CREATE UNIQUE INDEX "Sign_tenantId_siteId_normalizedCode_key" ON "Sign"("tenantId", "siteId", "normalizedCode");
CREATE INDEX "Sign_signTypeId_normalizedCode_idx" ON "Sign"("signTypeId", "normalizedCode");
ALTER TABLE "SignType" ADD CONSTRAINT "SignType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignType" ADD CONSTRAINT "SignType_siteId_tenantId_fkey" FOREIGN KEY ("siteId", "tenantId") REFERENCES "Site"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sign" ADD CONSTRAINT "Sign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sign" ADD CONSTRAINT "Sign_siteId_tenantId_fkey" FOREIGN KEY ("siteId", "tenantId") REFERENCES "Site"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sign" ADD CONSTRAINT "Sign_signTypeId_tenantId_siteId_fkey" FOREIGN KEY ("signTypeId", "tenantId", "siteId") REFERENCES "SignType"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE;
