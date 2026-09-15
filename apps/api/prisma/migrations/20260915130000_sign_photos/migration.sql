CREATE TABLE "SignPhoto" (
  "id" UUID NOT NULL PRIMARY KEY, "tenantId" UUID NOT NULL, "siteId" UUID NOT NULL, "signId" UUID NOT NULL,
  "uploadedById" UUID NOT NULL, "requestKey" UUID NOT NULL, "digest" VARCHAR(64) NOT NULL,
  "filename" VARCHAR(255) NOT NULL, "mediaType" VARCHAR(32) NOT NULL, "byteSize" INTEGER NOT NULL,
  "checksumSha256" VARCHAR(44) NOT NULL, "completed" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignPhoto_sign_fkey" FOREIGN KEY ("signId", "tenantId", "siteId") REFERENCES "Sign"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SignPhoto_size_check" CHECK ("byteSize" > 0 AND "byteSize" <= 5242880)
);
CREATE UNIQUE INDEX "SignPhoto_tenantId_requestKey_key" ON "SignPhoto"("tenantId", "requestKey");
CREATE INDEX "SignPhoto_tenantId_siteId_signId_id_idx" ON "SignPhoto"("tenantId", "siteId", "signId", "id");
CREATE TABLE "SignPhotoObject" ("photoId" UUID NOT NULL PRIMARY KEY, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "SignPhotoObject_expiresAt_idx" ON "SignPhotoObject"("expiresAt");
