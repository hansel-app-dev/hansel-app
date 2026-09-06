CREATE TYPE "ActivityKind" AS ENUM (
  'SITE_CREATED',
  'ALLOCATION_PLAN_ADDED',
  'SIGN_TYPE_CREATED',
  'SIGN_TYPE_RENAMED',
  'SIGN_CREATED',
  'SIGN_UPDATED',
  'SITE_COMMENT_ADDED'
);

CREATE TABLE "Activity" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "siteId" UUID NOT NULL,
  "actorMembershipId" UUID NOT NULL,
  "kind" "ActivityKind" NOT NULL,
  "subjectId" UUID,
  "subjectLabel" VARCHAR(255),
  "commentText" VARCHAR(2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Activity_kind_shape_check" CHECK (
    ("kind" = 'SITE_COMMENT_ADDED' AND "commentText" IS NOT NULL AND "subjectId" IS NULL AND "subjectLabel" IS NULL)
    OR
    ("kind" <> 'SITE_COMMENT_ADDED' AND "commentText" IS NULL AND "subjectId" IS NOT NULL AND "subjectLabel" IS NOT NULL)
  )
);

CREATE INDEX "Activity_siteId_createdAt_id_idx" ON "Activity"("siteId", "createdAt", "id");
CREATE INDEX "Activity_actorMembershipId_idx" ON "Activity"("actorMembershipId");
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_siteId_tenantId_fkey" FOREIGN KEY ("siteId", "tenantId") REFERENCES "Site"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorMembershipId_tenantId_fkey" FOREIGN KEY ("actorMembershipId", "tenantId") REFERENCES "Membership"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
