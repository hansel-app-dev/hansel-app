CREATE TABLE "OnboardingDiscoveryResponse" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "journeyId" UUID NOT NULL,
  "outcome" TEXT NOT NULL,
  "currentManagement" TEXT,
  "currentManagementOther" TEXT,
  "challenges" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingDiscoveryResponse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OnboardingDiscoveryResponse_answers_check" CHECK (
    (
      "outcome" = 'skipped'
      AND "currentManagement" IS NULL
      AND "currentManagementOther" IS NULL
      AND "challenges" IS NULL
    )
    OR
    (
      "outcome" = 'submitted'
      AND "currentManagement" IN ('pdf', 'spreadsheet', 'other')
      AND (
        ("currentManagement" = 'other' AND char_length("currentManagementOther") BETWEEN 1 AND 100)
        OR
        ("currentManagement" <> 'other' AND "currentManagementOther" IS NULL)
      )
      AND ("challenges" IS NULL OR char_length("challenges") BETWEEN 1 AND 1000)
    )
  )
);

CREATE UNIQUE INDEX "OnboardingDiscoveryResponse_journeyId_key"
ON "OnboardingDiscoveryResponse"("journeyId");

ALTER TABLE "OnboardingDiscoveryResponse"
ADD CONSTRAINT "OnboardingDiscoveryResponse_journeyId_fkey"
FOREIGN KEY ("journeyId") REFERENCES "OnboardingJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OnboardingDiscoverySubmission" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "journeyId" UUID NOT NULL,
  "submissionKeyDigest" TEXT NOT NULL,
  "credentialDigest" TEXT NOT NULL,
  "requestDigest" TEXT,
  "outcome" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingDiscoverySubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OnboardingDiscoverySubmission_outcome_check" CHECK (
    "outcome" IS NULL OR "outcome" = '/dashboard'
  )
);

CREATE UNIQUE INDEX "OnboardingDiscoverySubmission_journeyId_key"
ON "OnboardingDiscoverySubmission"("journeyId");
CREATE UNIQUE INDEX "OnboardingDiscoverySubmission_submissionKeyDigest_key"
ON "OnboardingDiscoverySubmission"("submissionKeyDigest");

ALTER TABLE "OnboardingDiscoverySubmission"
ADD CONSTRAINT "OnboardingDiscoverySubmission_journeyId_fkey"
FOREIGN KEY ("journeyId") REFERENCES "OnboardingJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
