CREATE TYPE "AllocationPlanUploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'EXPIRED');

CREATE TABLE "AllocationPlan" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "siteId" UUID NOT NULL,
  "uploadedById" UUID NOT NULL,
  "objectKey" VARCHAR(512) NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "mediaType" VARCHAR(32) NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "checksumSha256" VARCHAR(44) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AllocationPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AllocationPlanUploadBatch" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "siteId" UUID NOT NULL,
  "keyDigest" VARCHAR(64) NOT NULL,
  "requestDigest" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AllocationPlanUploadBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AllocationPlanUpload" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "siteId" UUID NOT NULL,
  "uploadedById" UUID NOT NULL,
  "allocationPlanId" UUID,
  "objectKey" VARCHAR(512) NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "mediaType" VARCHAR(32) NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "checksumSha256" VARCHAR(44) NOT NULL,
  "status" "AllocationPlanUploadStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionCode" VARCHAR(64),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AllocationPlanUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AllocationPlan_objectKey_key" ON "AllocationPlan"("objectKey");
CREATE UNIQUE INDEX "AllocationPlan_id_tenantId_key" ON "AllocationPlan"("id", "tenantId");
CREATE INDEX "AllocationPlan_siteId_createdAt_id_idx" ON "AllocationPlan"("siteId", "createdAt", "id");
CREATE UNIQUE INDEX "AllocationPlanUploadBatch_tenantId_keyDigest_key" ON "AllocationPlanUploadBatch"("tenantId", "keyDigest");
CREATE UNIQUE INDEX "AllocationPlanUploadBatch_id_tenantId_key" ON "AllocationPlanUploadBatch"("id", "tenantId");
CREATE INDEX "AllocationPlanUploadBatch_siteId_idx" ON "AllocationPlanUploadBatch"("siteId");
CREATE UNIQUE INDEX "AllocationPlanUpload_allocationPlanId_key" ON "AllocationPlanUpload"("allocationPlanId");
CREATE UNIQUE INDEX "AllocationPlanUpload_objectKey_key" ON "AllocationPlanUpload"("objectKey");
CREATE UNIQUE INDEX "AllocationPlanUpload_id_tenantId_key" ON "AllocationPlanUpload"("id", "tenantId");
CREATE UNIQUE INDEX "AllocationPlanUpload_allocationPlanId_tenantId_key" ON "AllocationPlanUpload"("allocationPlanId", "tenantId");
CREATE INDEX "AllocationPlanUpload_siteId_status_idx" ON "AllocationPlanUpload"("siteId", "status");
CREATE INDEX "AllocationPlanUpload_status_expiresAt_idx" ON "AllocationPlanUpload"("status", "expiresAt");

ALTER TABLE "AllocationPlan" ADD CONSTRAINT "AllocationPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllocationPlan" ADD CONSTRAINT "AllocationPlan_siteId_tenantId_fkey" FOREIGN KEY ("siteId", "tenantId") REFERENCES "Site"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllocationPlan" ADD CONSTRAINT "AllocationPlan_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AllocationPlanUploadBatch" ADD CONSTRAINT "AllocationPlanUploadBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllocationPlanUploadBatch" ADD CONSTRAINT "AllocationPlanUploadBatch_siteId_tenantId_fkey" FOREIGN KEY ("siteId", "tenantId") REFERENCES "Site"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllocationPlanUpload" ADD CONSTRAINT "AllocationPlanUpload_batchId_tenantId_fkey" FOREIGN KEY ("batchId", "tenantId") REFERENCES "AllocationPlanUploadBatch"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllocationPlanUpload" ADD CONSTRAINT "AllocationPlanUpload_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllocationPlanUpload" ADD CONSTRAINT "AllocationPlanUpload_siteId_tenantId_fkey" FOREIGN KEY ("siteId", "tenantId") REFERENCES "Site"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllocationPlanUpload" ADD CONSTRAINT "AllocationPlanUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AllocationPlanUpload" ADD CONSTRAINT "AllocationPlanUpload_allocationPlanId_tenantId_fkey" FOREIGN KEY ("allocationPlanId", "tenantId") REFERENCES "AllocationPlan"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
