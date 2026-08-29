CREATE TYPE "EmailMessageKind" AS ENUM ('ONBOARDING_WELCOME');
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'TERMINAL');

CREATE TABLE "EmailDeliveryIntent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "journeyId" UUID NOT NULL,
  "kind" "EmailMessageKind" NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL,
  "leaseOwner" VARCHAR(128),
  "leaseExpiresAt" TIMESTAMP(3),
  "providerMessageId" VARCHAR(256),
  "terminalFailureReason" VARCHAR(64),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailDeliveryIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailDeliveryIntent_attemptCount_check" CHECK ("attemptCount" >= 0 AND "attemptCount" <= 5),
  CONSTRAINT "EmailDeliveryIntent_lease_check" CHECK (
    ("leaseOwner" IS NULL AND "leaseExpiresAt" IS NULL)
    OR ("leaseOwner" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
  ),
  CONSTRAINT "EmailDeliveryIntent_state_check" CHECK (
    ("status" = 'PENDING' AND "deliveredAt" IS NULL AND "providerMessageId" IS NULL AND "terminalFailureReason" IS NULL)
    OR ("status" = 'DELIVERED' AND "deliveredAt" IS NOT NULL AND "providerMessageId" IS NOT NULL AND "terminalFailureReason" IS NULL)
    OR ("status" = 'TERMINAL' AND "deliveredAt" IS NULL AND "providerMessageId" IS NULL AND "terminalFailureReason" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "EmailDeliveryIntent_journeyId_kind_key"
ON "EmailDeliveryIntent"("journeyId", "kind");
CREATE INDEX "EmailDeliveryIntent_status_nextAttemptAt_leaseExpiresAt_idx"
ON "EmailDeliveryIntent"("status", "nextAttemptAt", "leaseExpiresAt");

ALTER TABLE "EmailDeliveryIntent"
ADD CONSTRAINT "EmailDeliveryIntent_journeyId_fkey"
FOREIGN KEY ("journeyId") REFERENCES "OnboardingJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
