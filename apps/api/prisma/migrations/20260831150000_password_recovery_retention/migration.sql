ALTER TABLE "PasswordRecoveryInitiation" ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "PasswordRecoveryInitiation"
SET "expiresAt" = "requestedAt" + INTERVAL '30 days';

ALTER TABLE "PasswordRecoveryInitiation" ALTER COLUMN "expiresAt" SET NOT NULL;

CREATE INDEX "PasswordRecoveryInitiation_expiresAt_idx"
ON "PasswordRecoveryInitiation"("expiresAt");
