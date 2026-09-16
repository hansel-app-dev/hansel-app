-- Existing subject-only Microsoft identities require an explicit ownership review.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ExternalIdentity" WHERE provider = 'MICROSOFT') THEN
    RAISE EXCEPTION 'Existing Microsoft identities require issuer/subject migration review';
  END IF;
END $$;
CREATE TABLE "MicrosoftPendingSignup" (
 "credentialDigest" VARCHAR(64) PRIMARY KEY,
 "subject" VARCHAR(512) NOT NULL,
 "termsVersion" VARCHAR(64) NOT NULL,
 "privacyVersion" VARCHAR(64) NOT NULL,
 "consentedAt" TIMESTAMP(3) NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "email" TEXT,
 "codeDigest" VARCHAR(64),
 "codeExpiresAt" TIMESTAMP(3),
 "sentAt" TIMESTAMP(3),
 "delivered" BOOLEAN NOT NULL DEFAULT false,
 "failedAttempts" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "MicrosoftPendingSignup_expiresAt_idx" ON "MicrosoftPendingSignup"("expiresAt");
CREATE TABLE "MicrosoftVerificationSend" (
 "id" UUID PRIMARY KEY,
 "emailDigest" VARCHAR(64) NOT NULL,
 "sentAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "MicrosoftVerificationSend_emailDigest_sentAt_idx" ON "MicrosoftVerificationSend"("emailDigest", "sentAt");
CREATE INDEX "MicrosoftVerificationSend_sentAt_idx" ON "MicrosoftVerificationSend"("sentAt");
