ALTER TABLE "OnboardingPlanSelection"
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "OnboardingPlanSelection"
DROP CONSTRAINT "OnboardingPlanSelection_pkey";

ALTER TABLE "OnboardingPlanSelection"
ADD CONSTRAINT "OnboardingPlanSelection_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "OnboardingPlanSelection_userId_key"
ON "OnboardingPlanSelection"("userId");
