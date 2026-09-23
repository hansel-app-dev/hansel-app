-- CreateTable
CREATE TABLE "PlanArea" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "fileId" UUID,
    "code" VARCHAR(40) NOT NULL,
    "normalizedCode" VARCHAR(40) NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "content" VARCHAR(200) NOT NULL DEFAULT '',
    "orientation" VARCHAR(16) NOT NULL DEFAULT 'down',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAreaRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "key" UUID NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "areaId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanAreaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanArea_tenantId_siteId_planId_fileId_createdAt_id_idx" ON "PlanArea"("tenantId", "siteId", "planId", "fileId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PlanArea_tenantId_planId_normalizedCode_key" ON "PlanArea"("tenantId", "planId", "normalizedCode");

-- CreateIndex
CREATE UNIQUE INDEX "PlanAreaRequest_tenantId_key_key" ON "PlanAreaRequest"("tenantId", "key");

-- AddForeignKey
ALTER TABLE "PlanArea" ADD CONSTRAINT "PlanArea_planId_tenantId_siteId_fkey" FOREIGN KEY ("planId", "tenantId", "siteId") REFERENCES "AllocationPlan"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanArea" ADD CONSTRAINT "PlanArea_fileId_tenantId_siteId_planId_fkey" FOREIGN KEY ("fileId", "tenantId", "siteId", "planId") REFERENCES "AllocationPlanUpload"("id", "tenantId", "siteId", "groupedPlanId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAreaRequest" ADD CONSTRAINT "PlanAreaRequest_planId_tenantId_siteId_fkey" FOREIGN KEY ("planId", "tenantId", "siteId") REFERENCES "AllocationPlan"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "PlanArea" ADD CONSTRAINT "PlanArea_geometry_check" CHECK (
 "x" >= 0 AND "x" <= 1 AND "y" >= 0 AND "y" <= 1 AND
 "width" > 0 AND "width" <= 1 AND "height" > 0 AND "height" <= 1 AND
 "x" + "width" <= 1 AND "y" + "height" <= 1
);
ALTER TABLE "PlanArea" ADD CONSTRAINT "PlanArea_orientation_check" CHECK ("orientation" IN ('left','up-left','up','up-right','right','down-right','down','down-left'));
