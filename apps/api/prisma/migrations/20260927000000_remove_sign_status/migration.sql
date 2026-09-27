-- signage-schedule-remove-status REQ-004: backup and quiesce Sign traffic first.
BEGIN;
ALTER TABLE "Sign" DROP COLUMN "status";
DROP TYPE "SignStatus";
COMMIT;
