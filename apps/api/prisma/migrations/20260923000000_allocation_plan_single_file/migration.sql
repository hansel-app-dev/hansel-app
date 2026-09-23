-- allocation-plan-single-file REQ-006..REQ-008. Quiesce writers before deployment.
-- No object bytes, shared Signs, media, discussion or historical Activity are deleted.
BEGIN;
LOCK TABLE "AllocationPlan", "AllocationPlanUpload", "SignPlacement" IN ACCESS EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS "AllocationPlanFileSplit" (
  "fileId" UUID PRIMARY KEY,
  "originalPlanId" UUID NOT NULL,
  "resultPlanId" UUID NOT NULL,
  "originalPosition" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$
DECLARE
  file_count BIGINT;
  placement_count BIGINT;
BEGIN
  SELECT count(*) INTO file_count FROM "AllocationPlanUpload";
  SELECT count(*) INTO placement_count FROM "SignPlacement";
  IF EXISTS (
    SELECT 1 FROM "AllocationPlan" p
    WHERE p."objectKey" IS NULL AND NOT EXISTS (
      SELECT 1 FROM "AllocationPlanUpload" u WHERE u."groupedPlanId"=p.id
    )
  ) OR EXISTS (
    SELECT 1 FROM "AllocationPlanUpload" u WHERE u."groupedPlanId" IS NOT NULL
      AND (u.status <> 'COMPLETED' OR u."verifiedObjectKey" IS NULL
        OR u."verifiedAt" IS NULL
        OR (u."allocationPlanId" IS NOT NULL AND u."allocationPlanId" <> u."groupedPlanId"))
  ) OR EXISTS (
    SELECT 1 FROM "SignPlacement" s WHERE s."fileId" IS NULL
      AND (SELECT count(*) FROM "AllocationPlanUpload" u WHERE u."groupedPlanId"=s."planId") > 1
  ) THEN
    RAISE EXCEPTION 'allocation_single_file_preflight_failed';
  END IF;

  INSERT INTO "AllocationPlanFileSplit" ("fileId","originalPlanId","resultPlanId","originalPosition")
  SELECT id, "groupedPlanId", CASE WHEN row_number() OVER (PARTITION BY "groupedPlanId" ORDER BY position,id)=1
    THEN "groupedPlanId" ELSE gen_random_uuid() END, position
  FROM "AllocationPlanUpload" u
  WHERE "groupedPlanId" IN (
    SELECT "groupedPlanId" FROM "AllocationPlanUpload" WHERE "groupedPlanId" IS NOT NULL
    GROUP BY "groupedPlanId" HAVING count(*) > 1
  ) ON CONFLICT ("fileId") DO NOTHING;

  INSERT INTO "AllocationPlan" (id,"tenantId","siteId","uploadedById",name,"createdAt","updatedAt")
  SELECT m."resultPlanId",p."tenantId",p."siteId",p."uploadedById",
    left(p.name || ' — ' || u.filename,200),p."createdAt",p."updatedAt"
  FROM "AllocationPlanFileSplit" m JOIN "AllocationPlan" p ON p.id=m."originalPlanId"
  JOIN "AllocationPlanUpload" u ON u.id=m."fileId"
  WHERE m."resultPlanId" <> m."originalPlanId"
  ON CONFLICT (id) DO NOTHING;

  -- The composite file FK cascades the new plan ID to every placement atomically.
  UPDATE "AllocationPlanUpload" u SET "groupedPlanId"=m."resultPlanId",
    "allocationPlanId"=CASE WHEN u."allocationPlanId" IS NULL THEN NULL ELSE m."resultPlanId" END,
    position=0
  FROM "AllocationPlanFileSplit" m WHERE u.id=m."fileId"
    AND (u."groupedPlanId" <> m."resultPlanId" OR u.position <> 0);
  UPDATE "AllocationPlanUpload" SET position=0 WHERE position<>0;

  IF (SELECT count(*) FROM "AllocationPlanUpload") <> file_count
    OR (SELECT count(*) FROM "SignPlacement") <> placement_count
    OR EXISTS (SELECT 1 FROM "SignPlacement" s JOIN "AllocationPlanUpload" u ON u.id=s."fileId"
      WHERE s."planId" <> u."groupedPlanId" OR s."tenantId" <> u."tenantId" OR s."siteId" <> u."siteId")
  THEN RAISE EXCEPTION 'allocation_single_file_verification_failed'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='"AllocationPlanUpload"'::regclass
    AND conname='AllocationPlanUpload_single_file_position_check') THEN
    -- Together with the existing unique (groupedPlanId, position), permits only one file.
    ALTER TABLE "AllocationPlanUpload" ADD CONSTRAINT "AllocationPlanUpload_single_file_position_check" CHECK (position=0);
  END IF;
END $$;
COMMIT;
