-- CreateTable
CREATE TABLE "AllocationPlanCommentThread" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "fileId" UUID,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "authorId" UUID NOT NULL,
    "authorName" VARCHAR(200) NOT NULL,
    "preview" VARCHAR(160) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationPlanCommentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationPlanComment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "authorName" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" JSONB NOT NULL,
    "requestKey" UUID NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllocationPlanComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationPlanCommentAttachment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "fileId" UUID,
    "commentId" UUID,
    "uploadedById" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mediaType" VARCHAR(32) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksumSha256" VARCHAR(44) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllocationPlanCommentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationPlanCommentAttachmentObject" (
    "attachmentId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationPlanCommentAttachmentObject_pkey" PRIMARY KEY ("attachmentId")
);

-- CreateIndex
CREATE INDEX "AllocationPlanCommentThread_tenantId_siteId_planId_fileId_r_idx" ON "AllocationPlanCommentThread"("tenantId", "siteId", "planId", "fileId", "resolved", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationPlanCommentThread_id_tenantId_siteId_planId_key" ON "AllocationPlanCommentThread"("id", "tenantId", "siteId", "planId");

-- CreateIndex
CREATE INDEX "AllocationPlanComment_threadId_createdAt_id_idx" ON "AllocationPlanComment"("threadId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationPlanComment_id_tenantId_siteId_planId_key" ON "AllocationPlanComment"("id", "tenantId", "siteId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationPlanComment_tenantId_authorId_requestKey_key" ON "AllocationPlanComment"("tenantId", "authorId", "requestKey");

-- CreateIndex
CREATE INDEX "AllocationPlanCommentAttachment_tenantId_siteId_planId_file_idx" ON "AllocationPlanCommentAttachment"("tenantId", "siteId", "planId", "fileId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationPlanCommentAttachment_tenantId_requestKey_key" ON "AllocationPlanCommentAttachment"("tenantId", "requestKey");

-- CreateIndex
CREATE INDEX "AllocationPlanCommentAttachmentObject_expiresAt_idx" ON "AllocationPlanCommentAttachmentObject"("expiresAt");

-- AddForeignKey
ALTER TABLE "AllocationPlanCommentThread" ADD CONSTRAINT "AllocationPlanCommentThread_planId_tenantId_siteId_fkey" FOREIGN KEY ("planId", "tenantId", "siteId") REFERENCES "AllocationPlan"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationPlanCommentThread" ADD CONSTRAINT "AllocationPlanCommentThread_fileId_tenantId_siteId_planId_fkey" FOREIGN KEY ("fileId", "tenantId", "siteId", "planId") REFERENCES "AllocationPlanUpload"("id", "tenantId", "siteId", "groupedPlanId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationPlanComment" ADD CONSTRAINT "AllocationPlanComment_threadId_tenantId_siteId_planId_fkey" FOREIGN KEY ("threadId", "tenantId", "siteId", "planId") REFERENCES "AllocationPlanCommentThread"("id", "tenantId", "siteId", "planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationPlanCommentAttachment" ADD CONSTRAINT "AllocationPlanCommentAttachment_planId_tenantId_siteId_fkey" FOREIGN KEY ("planId", "tenantId", "siteId") REFERENCES "AllocationPlan"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationPlanCommentAttachment" ADD CONSTRAINT "AllocationPlanCommentAttachment_fileId_tenantId_siteId_pla_fkey" FOREIGN KEY ("fileId", "tenantId", "siteId", "planId") REFERENCES "AllocationPlanUpload"("id", "tenantId", "siteId", "groupedPlanId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationPlanCommentAttachment" ADD CONSTRAINT "AllocationPlanCommentAttachment_commentId_tenantId_siteId__fkey" FOREIGN KEY ("commentId", "tenantId", "siteId", "planId") REFERENCES "AllocationPlanComment"("id", "tenantId", "siteId", "planId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AllocationPlanCommentThread" ADD CONSTRAINT "plan_comment_coordinates" CHECK ("x" >= 0 AND "x" <= 1 AND "y" >= 0 AND "y" <= 1);
ALTER TABLE "AllocationPlanCommentThread" ADD CONSTRAINT "plan_comment_resolution" CHECK (("resolved" AND "resolvedAt" IS NOT NULL AND "resolvedById" IS NOT NULL) OR (NOT "resolved" AND "resolvedAt" IS NULL AND "resolvedById" IS NULL));
