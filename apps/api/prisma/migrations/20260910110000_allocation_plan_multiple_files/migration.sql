-- allocation-plan-multiple-files REQ-008, REQ-009: additive backfill; no stored bytes move.
ALTER TABLE "AllocationPlan" ADD COLUMN "name" VARCHAR(400);
UPDATE "AllocationPlan" SET "name" = "filename";
ALTER TABLE "AllocationPlan" ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "objectKey" DROP NOT NULL, ALTER COLUMN "filename" DROP NOT NULL,
  ALTER COLUMN "mediaType" DROP NOT NULL, ALTER COLUMN "byteSize" DROP NOT NULL,
  ALTER COLUMN "checksumSha256" DROP NOT NULL,
  ADD COLUMN "creationKey" VARCHAR(64), ADD COLUMN "creationDigest" VARCHAR(64);
CREATE UNIQUE INDEX "AllocationPlan_id_tenantId_siteId_key" ON "AllocationPlan"("id", "tenantId", "siteId");
CREATE UNIQUE INDEX "AllocationPlan_tenantId_creationKey_key" ON "AllocationPlan"("tenantId", "creationKey");
ALTER TABLE "AllocationPlanUploadBatch" ADD COLUMN "grouped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AllocationPlanUpload" ADD COLUMN "groupedPlanId" UUID,
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "verifiedObjectKey" VARCHAR(512), ADD COLUMN "verifiedAt" TIMESTAMP(3);
UPDATE "AllocationPlanUpload" u SET "groupedPlanId" = p."id", "verifiedObjectKey" = p."objectKey", "verifiedAt" = p."createdAt"
  FROM "AllocationPlan" p WHERE u."allocationPlanId" = p."id";
-- Legacy plans without an upload intent receive an associated immutable file record.
INSERT INTO "AllocationPlanUploadBatch" ("id", "tenantId", "siteId", "keyDigest", "requestDigest", "createdAt")
 SELECT p."id", p."tenantId", p."siteId", 'backfill-' || p."id", 'backfill', p."createdAt"
 FROM "AllocationPlan" p WHERE NOT EXISTS (SELECT 1 FROM "AllocationPlanUpload" u WHERE u."allocationPlanId" = p."id");
INSERT INTO "AllocationPlanUpload" ("id", "batchId", "tenantId", "siteId", "uploadedById", "allocationPlanId", "groupedPlanId", "objectKey", "filename", "mediaType", "byteSize", "checksumSha256", "status", "expiresAt", "createdAt", "updatedAt", "verifiedAt", "verifiedObjectKey")
 SELECT p."id", p."id", p."tenantId", p."siteId", p."uploadedById", p."id", p."id", p."objectKey", p."filename", p."mediaType", p."byteSize", p."checksumSha256", 'COMPLETED', p."createdAt", p."createdAt", p."updatedAt", p."createdAt", p."objectKey"
 FROM "AllocationPlan" p WHERE NOT EXISTS (SELECT 1 FROM "AllocationPlanUpload" u WHERE u."allocationPlanId" = p."id");
CREATE UNIQUE INDEX "AllocationPlanUpload_groupedPlanId_position_key" ON "AllocationPlanUpload"("groupedPlanId", "position");
ALTER TABLE "AllocationPlanUpload" ADD CONSTRAINT "AllocationPlanUpload_groupedPlanId_tenantId_siteId_fkey"
 FOREIGN KEY ("groupedPlanId", "tenantId", "siteId") REFERENCES "AllocationPlan"("id", "tenantId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;
