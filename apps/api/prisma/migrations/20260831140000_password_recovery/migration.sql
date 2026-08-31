CREATE TABLE "PasswordRecoveryInitiation" (
    "id" UUID NOT NULL,
    "identifierDigest" VARCHAR(64) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordRecoveryInitiation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordRecoveryNotificationIntent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "resetChallengeId" UUID NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "leaseOwner" VARCHAR(128),
    "leaseExpiresAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "terminalAt" TIMESTAMP(3),
    "providerId" VARCHAR(256),
    "lastErrorCode" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordRecoveryNotificationIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordRecoveryInitiation_identifierDigest_requestedAt_idx"
ON "PasswordRecoveryInitiation"("identifierDigest", "requestedAt");

CREATE INDEX "PasswordRecoveryInitiation_requestedAt_idx"
ON "PasswordRecoveryInitiation"("requestedAt");

CREATE UNIQUE INDEX "PasswordRecoveryNotificationIntent_resetChallengeId_key"
ON "PasswordRecoveryNotificationIntent"("resetChallengeId");

CREATE INDEX "PasswordRecoveryNotificationIntent_status_nextAttemptAt_idx"
ON "PasswordRecoveryNotificationIntent"("status", "nextAttemptAt");

ALTER TABLE "PasswordRecoveryNotificationIntent"
ADD CONSTRAINT "PasswordRecoveryNotificationIntent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
