CREATE TABLE "PersonalProfile" (
    "userId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobTitleOther" TEXT,
    "department" TEXT NOT NULL,
    "departmentOther" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PersonalProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "OnboardingContinuation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "credentialDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingContinuation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingContinuation_userId_key" ON "OnboardingContinuation"("userId");
CREATE UNIQUE INDEX "OnboardingContinuation_credentialDigest_key" ON "OnboardingContinuation"("credentialDigest");
CREATE INDEX "OnboardingContinuation_expiresAt_idx" ON "OnboardingContinuation"("expiresAt");

ALTER TABLE "PersonalProfile" ADD CONSTRAINT "PersonalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingContinuation" ADD CONSTRAINT "OnboardingContinuation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
