-- CreateTable
CREATE TABLE "SignComment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "signId" UUID NOT NULL,
    "parentId" UUID,
    "authorId" UUID NOT NULL,
    "authorName" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" JSONB NOT NULL,
    "requestKey" UUID NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignCommentReaction" (
    "commentId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "signId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "emoji" VARCHAR(16) NOT NULL,

    CONSTRAINT "SignCommentReaction_pkey" PRIMARY KEY ("commentId","authorId","emoji")
);

-- CreateTable
CREATE TABLE "SignCommentAttachment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "signId" UUID NOT NULL,
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

    CONSTRAINT "SignCommentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignCommentAttachmentObject" (
    "attachmentId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignCommentAttachmentObject_pkey" PRIMARY KEY ("attachmentId")
);

-- CreateIndex
CREATE INDEX "SignComment_tenantId_siteId_signId_parentId_createdAt_id_idx" ON "SignComment"("tenantId", "siteId", "signId", "parentId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SignComment_id_tenantId_siteId_signId_key" ON "SignComment"("id", "tenantId", "siteId", "signId");

-- CreateIndex
CREATE UNIQUE INDEX "SignComment_tenantId_authorId_requestKey_key" ON "SignComment"("tenantId", "authorId", "requestKey");

-- CreateIndex
CREATE INDEX "SignCommentAttachment_tenantId_siteId_signId_commentId_idx" ON "SignCommentAttachment"("tenantId", "siteId", "signId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "SignCommentAttachment_tenantId_requestKey_key" ON "SignCommentAttachment"("tenantId", "requestKey");

-- CreateIndex
CREATE INDEX "SignCommentAttachmentObject_expiresAt_idx" ON "SignCommentAttachmentObject"("expiresAt");

-- AddForeignKey
ALTER TABLE "SignComment" ADD CONSTRAINT "SignComment_signId_tenantId_siteId_fkey" FOREIGN KEY ("signId", "tenantId", "siteId") REFERENCES "Sign"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignComment" ADD CONSTRAINT "SignComment_parentId_tenantId_siteId_signId_fkey" FOREIGN KEY ("parentId", "tenantId", "siteId", "signId") REFERENCES "SignComment"("id", "tenantId", "siteId", "signId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignCommentReaction" ADD CONSTRAINT "SignCommentReaction_commentId_tenantId_siteId_signId_fkey" FOREIGN KEY ("commentId", "tenantId", "siteId", "signId") REFERENCES "SignComment"("id", "tenantId", "siteId", "signId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignCommentAttachment" ADD CONSTRAINT "SignCommentAttachment_signId_tenantId_siteId_fkey" FOREIGN KEY ("signId", "tenantId", "siteId") REFERENCES "Sign"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignCommentAttachment" ADD CONSTRAINT "SignCommentAttachment_commentId_tenantId_siteId_signId_fkey" FOREIGN KEY ("commentId", "tenantId", "siteId", "signId") REFERENCES "SignComment"("id", "tenantId", "siteId", "signId") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "SignComment" ADD CONSTRAINT "SignComment_body_length" CHECK (char_length("body") <= 5000);
ALTER TABLE "SignCommentAttachment" ADD CONSTRAINT "SignCommentAttachment_size" CHECK ("byteSize" > 0 AND "byteSize" <= 5242880);
