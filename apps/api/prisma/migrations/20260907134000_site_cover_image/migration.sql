CREATE TABLE "SiteCoverImage" (
  "id" UUID PRIMARY KEY,
  "siteId" UUID NOT NULL UNIQUE,
  "tenantId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "sessionFamilyId" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "mediaType" VARCHAR(32) NOT NULL CHECK ("mediaType" IN ('image/png', 'image/jpeg')),
  "byteSize" INTEGER NOT NULL CHECK ("byteSize" BETWEEN 1 AND 3000000),
  "checksum" VARCHAR(64) NOT NULL,
  "objectKey" VARCHAR(100) NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("siteId", "tenantId") REFERENCES "Site" ("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("membershipId", "tenantId") REFERENCES "Membership" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("sessionFamilyId") REFERENCES "ApplicationSessionFamily" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "CoverImageDeletion" (
  "objectKey" VARCHAR(100) PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION queue_cover_image_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "CoverImageDeletion" ("objectKey") VALUES (OLD."objectKey") ON CONFLICT DO NOTHING;
  RETURN OLD;
END;
$$;
CREATE TRIGGER cover_image_deleted AFTER DELETE ON "SiteCoverImage"
FOR EACH ROW EXECUTE FUNCTION queue_cover_image_deletion();
