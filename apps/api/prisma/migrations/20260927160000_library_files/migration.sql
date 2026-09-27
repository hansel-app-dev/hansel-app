-- AlterTable
ALTER TABLE "AllocationPlanUpload" ADD COLUMN     "libraryFileId" UUID;

-- AlterTable
ALTER TABLE "SignDocument" ADD COLUMN     "libraryFileId" UUID;

-- AlterTable
ALTER TABLE "SignPhoto" ADD COLUMN     "libraryFileId" UUID;

-- CreateTable
CREATE TABLE "LibraryFile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sourceSiteId" UUID NOT NULL,
    "sourceKind" VARCHAR(16) NOT NULL,
    "sourceId" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mediaType" VARCHAR(32) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksumSha256" VARCHAR(44) NOT NULL,
    "uploadedById" UUID NOT NULL,
    "originalKey" VARCHAR(512) NOT NULL,
    "thumbnailKey" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,

    CONSTRAINT "LibraryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryFile_originalKey_key" ON "LibraryFile"("originalKey");

-- CreateIndex
CREATE INDEX "LibraryFile_tenantId_createdAt_id_idx" ON "LibraryFile"("tenantId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryFile_id_tenantId_key" ON "LibraryFile"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryFile_tenantId_sourceKind_sourceId_key" ON "LibraryFile"("tenantId", "sourceKind", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryRequest_tenantId_requestKey_key" ON "LibraryRequest"("tenantId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "SignDocument_signId_libraryFileId_key" ON "SignDocument"("signId", "libraryFileId");

-- CreateIndex
CREATE UNIQUE INDEX "SignPhoto_signId_libraryFileId_key" ON "SignPhoto"("signId", "libraryFileId");

-- AddForeignKey
ALTER TABLE "AllocationPlanUpload" ADD CONSTRAINT "AllocationPlanUpload_libraryFileId_tenantId_fkey" FOREIGN KEY ("libraryFileId", "tenantId") REFERENCES "LibraryFile"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignDocument" ADD CONSTRAINT "SignDocument_libraryFileId_tenantId_fkey" FOREIGN KEY ("libraryFileId", "tenantId") REFERENCES "LibraryFile"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignPhoto" ADD CONSTRAINT "SignPhoto_libraryFileId_tenantId_fkey" FOREIGN KEY ("libraryFileId", "tenantId") REFERENCES "LibraryFile"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFile" ADD CONSTRAINT "LibraryFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFile" ADD CONSTRAINT "LibraryFile_sourceSiteId_tenantId_fkey" FOREIGN KEY ("sourceSiteId", "tenantId") REFERENCES "Site"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFile" ADD CONSTRAINT "LibraryFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryRequest" ADD CONSTRAINT "LibraryRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
