CREATE TABLE "PasswordAuthenticationState" (
    "userId" UUID NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordAuthenticationState_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "PasswordLockNotificationIntent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lockStartedAt" TIMESTAMP(3) NOT NULL,
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

    CONSTRAINT "PasswordLockNotificationIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordAuthenticationState_lockedUntil_idx"
ON "PasswordAuthenticationState"("lockedUntil");

CREATE UNIQUE INDEX "PasswordLockNotificationIntent_userId_lockStartedAt_key"
ON "PasswordLockNotificationIntent"("userId", "lockStartedAt");

CREATE INDEX "PasswordLockNotificationIntent_status_nextAttemptAt_idx"
ON "PasswordLockNotificationIntent"("status", "nextAttemptAt");

ALTER TABLE "PasswordAuthenticationState"
ADD CONSTRAINT "PasswordAuthenticationState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasswordLockNotificationIntent"
ADD CONSTRAINT "PasswordLockNotificationIntent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ExternalAuthProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'APPLE');
CREATE TYPE "ExternalAuthIntent" AS ENUM ('LOGIN', 'ONBOARDING');

CREATE TABLE "ExternalIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "ExternalAuthProvider" NOT NULL,
    "subject" VARCHAR(512) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalAuthorizationTransaction" (
    "id" UUID NOT NULL,
    "provider" "ExternalAuthProvider" NOT NULL,
    "intent" "ExternalAuthIntent" NOT NULL,
    "stateDigest" VARCHAR(64) NOT NULL,
    "nonceDigest" VARCHAR(64) NOT NULL,
    "pkceVerifierDigest" VARCHAR(64),
    "sealedSecrets" TEXT NOT NULL,
    "redirectUri" VARCHAR(2048) NOT NULL,
    "termsVersion" VARCHAR(64),
    "privacyVersion" VARCHAR(64),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalAuthorizationTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalIdentity_provider_subject_key" ON "ExternalIdentity"("provider", "subject");
CREATE UNIQUE INDEX "ExternalIdentity_provider_userId_key" ON "ExternalIdentity"("provider", "userId");
CREATE INDEX "ExternalIdentity_userId_idx" ON "ExternalIdentity"("userId");
CREATE UNIQUE INDEX "ExternalAuthorizationTransaction_stateDigest_key" ON "ExternalAuthorizationTransaction"("stateDigest");
CREATE INDEX "ExternalAuthorizationTransaction_provider_expiresAt_consumedAt_idx" ON "ExternalAuthorizationTransaction"("provider", "expiresAt", "consumedAt");
CREATE INDEX "ExternalAuthorizationTransaction_expiresAt_idx" ON "ExternalAuthorizationTransaction"("expiresAt");

ALTER TABLE "ExternalIdentity"
ADD CONSTRAINT "ExternalIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
