CREATE TYPE "SiteAccessScope" AS ENUM ('ORGANIZATION', 'PEOPLE_INVITED', 'PRIVATE');

ALTER TABLE "Site"
ADD COLUMN "accessScope" "SiteAccessScope" NOT NULL DEFAULT 'ORGANIZATION',
ALTER COLUMN "organizationAccess" DROP NOT NULL;

ALTER TABLE "Site"
ALTER COLUMN "accessScope" DROP DEFAULT;

ALTER TABLE "Site"
ADD CONSTRAINT "Site_access_scope_capability_check"
CHECK (
  ("accessScope" = 'ORGANIZATION' AND "organizationAccess" IS NOT NULL)
  OR
  ("accessScope" IN ('PEOPLE_INVITED', 'PRIVATE') AND "organizationAccess" IS NULL)
);
