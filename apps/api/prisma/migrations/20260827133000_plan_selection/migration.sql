CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

CREATE TABLE "OnboardingPlanSelection" (
  "userId" UUID NOT NULL,
  "planId" TEXT NOT NULL,
  "priceId" TEXT NOT NULL,
  "billingInterval" "BillingInterval",
  "amountMinor" INTEGER,
  "currency" TEXT NOT NULL,
  "paymentRequired" BOOLEAN NOT NULL,
  "maximumSites" INTEGER,
  "catalogVersion" TEXT NOT NULL,
  "selectedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingPlanSelection_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "OnboardingPlanSelection"
ADD CONSTRAINT "OnboardingPlanSelection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
