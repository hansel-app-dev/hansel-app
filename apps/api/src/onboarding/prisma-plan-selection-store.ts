import type { PrismaClient } from '@prisma/client';
import type { PlanPriceId } from '@hansel/contracts';
import type { PlanCatalog } from './plan-catalog.js';

class TransitionRejected extends Error {}

export function createPrismaPlanSelectionStore(prisma: PrismaClient) {
  return {
    async loadPage(input: { credentialDigest: string; now: Date }) {
      const continuation = await prisma.onboardingContinuation.findUnique({
        where: { credentialDigest: input.credentialDigest },
        select: {
          expiresAt: true,
          user: {
            select: {
              personalProfile: { select: { firstName: true } },
              planSelection: { select: { priceId: true } },
              journeys: {
                where: {
                  entryPath: 'NEW_ORGANIZATION',
                  currentStep: 'PLAN_SELECTION',
                },
                select: { id: true },
              },
            },
          },
        },
      });
      if (
        !continuation ||
        continuation.expiresAt <= input.now ||
        !continuation.user.personalProfile ||
        continuation.user.journeys.length !== 1
      )
        return null;
      return {
        firstName: continuation.user.personalProfile.firstName,
        selectedPriceId:
          (continuation.user.planSelection?.priceId as
            PlanPriceId | undefined) ?? null,
      };
    },
    async save(input: {
      credentialDigest: string;
      nextCredentialDigest: string;
      nextCredentialExpiresAt: Date;
      now: Date;
      catalogVersion: string;
      entry: PlanCatalog['entries'][number];
    }): Promise<boolean> {
      try {
        return await prisma.$transaction(async (transaction) => {
          const continuation =
            await transaction.onboardingContinuation.findUnique({
              where: { credentialDigest: input.credentialDigest },
              select: { userId: true, expiresAt: true },
            });
          if (!continuation || continuation.expiresAt <= input.now)
            throw new TransitionRejected();
          const nextStep = input.entry.contactSales
            ? 'PLAN_SELECTION'
            : input.entry.paymentRequired
              ? 'PAYMENT'
              : 'ORGANIZATION_PROFILE';
          const transition = await transaction.onboardingJourney.updateMany({
            where: {
              userId: continuation.userId,
              entryPath: 'NEW_ORGANIZATION',
              currentStep: 'PLAN_SELECTION',
            },
            data: { currentStep: nextStep },
          });
          if (transition.count !== 1) throw new TransitionRejected();
          await transaction.onboardingPlanSelection.upsert({
            where: { userId: continuation.userId },
            create: {
              userId: continuation.userId,
              planId: input.entry.planId,
              priceId: input.entry.priceId,
              billingInterval: input.entry.billingInterval
                ? (input.entry.billingInterval.toUpperCase() as
                    'MONTHLY' | 'ANNUAL')
                : null,
              amountMinor: input.entry.amountMinor,
              currency: input.entry.currency,
              paymentRequired: input.entry.paymentRequired,
              maximumSites: input.entry.maximumSites,
              catalogVersion: input.catalogVersion,
              selectedAt: input.now,
            },
            update: {
              planId: input.entry.planId,
              priceId: input.entry.priceId,
              billingInterval: input.entry.billingInterval
                ? (input.entry.billingInterval.toUpperCase() as
                    'MONTHLY' | 'ANNUAL')
                : null,
              amountMinor: input.entry.amountMinor,
              currency: input.entry.currency,
              paymentRequired: input.entry.paymentRequired,
              maximumSites: input.entry.maximumSites,
              catalogVersion: input.catalogVersion,
              selectedAt: input.now,
            },
          });
          await transaction.onboardingContinuation.update({
            where: { userId: continuation.userId },
            data: {
              credentialDigest: input.nextCredentialDigest,
              expiresAt: input.nextCredentialExpiresAt,
            },
          });
          return true;
        });
      } catch (error) {
        if (error instanceof TransitionRejected) return false;
        throw error;
      }
    },
  };
}
