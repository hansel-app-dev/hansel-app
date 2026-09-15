ALTER TABLE "Sign" ADD COLUMN "mounting" VARCHAR(32) NOT NULL DEFAULT 'Wall-mounted',
 ADD COLUMN "function" VARCHAR(32) NOT NULL DEFAULT 'Wayfinder',
 ADD COLUMN "colour" VARCHAR(32) NOT NULL DEFAULT 'Red',
 ADD COLUMN "orientation" VARCHAR(16) NOT NULL DEFAULT 'down';
CREATE UNIQUE INDEX "Sign_id_tenantId_siteId_key" ON "Sign"("id", "tenantId", "siteId");
CREATE UNIQUE INDEX "AllocationPlanUpload_id_tenantId_siteId_groupedPlanId_key" ON "AllocationPlanUpload"("id", "tenantId", "siteId", "groupedPlanId");
CREATE TABLE "SignPlacement" (
 "signId" UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "siteId" UUID NOT NULL,
 "planId" UUID NOT NULL, "fileId" UUID, "x" DOUBLE PRECISION NOT NULL, "y" DOUBLE PRECISION NOT NULL,
 CONSTRAINT "SignPlacement_coordinates_check" CHECK ("x" >= 0 AND "x" <= 1 AND "y" >= 0 AND "y" <= 1),
 CONSTRAINT "SignPlacement_signId_tenantId_siteId_fkey" FOREIGN KEY ("signId", "tenantId", "siteId") REFERENCES "Sign"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "SignPlacement_planId_tenantId_siteId_fkey" FOREIGN KEY ("planId", "tenantId", "siteId") REFERENCES "AllocationPlan"("id", "tenantId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "SignPlacement_fileId_tenantId_siteId_planId_fkey" FOREIGN KEY ("fileId", "tenantId", "siteId", "planId") REFERENCES "AllocationPlanUpload"("id", "tenantId", "siteId", "groupedPlanId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SignPlacement_signId_tenantId_siteId_key" ON "SignPlacement"("signId", "tenantId", "siteId");
CREATE INDEX "SignPlacement_tenantId_siteId_planId_fileId_idx" ON "SignPlacement"("tenantId", "siteId", "planId", "fileId");
CREATE TABLE "PlanSignRequest" (
 "id" UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "siteId" UUID NOT NULL, "planId" UUID NOT NULL,
 "key" UUID NOT NULL, "digest" VARCHAR(64) NOT NULL, "signId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PlanSignRequest_planId_tenantId_siteId_fkey" FOREIGN KEY ("planId", "tenantId", "siteId") REFERENCES "AllocationPlan"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlanSignRequest_tenantId_key_key" ON "PlanSignRequest"("tenantId", "key");
