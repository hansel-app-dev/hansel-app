CREATE TABLE "SignDocument" (
  "id" UUID NOT NULL PRIMARY KEY, "tenantId" UUID NOT NULL, "siteId" UUID NOT NULL, "signId" UUID NOT NULL,
  "uploadedById" UUID NOT NULL, "requestKey" UUID NOT NULL, "digest" VARCHAR(64) NOT NULL,
  "filename" VARCHAR(255) NOT NULL, "mediaType" VARCHAR(32) NOT NULL, "byteSize" INTEGER NOT NULL,
  "checksumSha256" VARCHAR(44) NOT NULL, "completed" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignDocument_sign_fkey" FOREIGN KEY ("signId", "tenantId", "siteId") REFERENCES "Sign"("id", "tenantId", "siteId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SignDocument_size_check" CHECK ("byteSize" > 0 AND "byteSize" <= 5242880)
);
CREATE UNIQUE INDEX "SignDocument_tenantId_requestKey_key" ON "SignDocument"("tenantId", "requestKey");
CREATE INDEX "SignDocument_tenantId_siteId_signId_id_idx" ON "SignDocument"("tenantId", "siteId", "signId", "id");
CREATE TABLE "SignDocumentObject" ("documentId" UUID NOT NULL PRIMARY KEY, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "SignDocumentObject_expiresAt_idx" ON "SignDocumentObject"("expiresAt");
