import type {
  PlanSelectionPageResponse,
  PlanSelectionRequest,
  PlanSelectionResponse,
} from '@hansel/contracts';
import { findCatalogEntry, type PlanCatalog } from './plan-catalog.js';

export class PlanSelectionTransitionError extends Error {}

interface PlanSelectionDependencies {
  catalog: PlanCatalog;
  contactSalesDestination: string;
  loadPage(input: { credentialDigest: string; now: Date }): Promise<{
    firstName: string;
    selectedPriceId: PlanSelectionPageResponse['selectedPriceId'];
  } | null>;
  save(input: {
    credentialDigest: string;
    nextCredentialDigest: string;
    nextCredentialExpiresAt: Date;
    now: Date;
    catalogVersion: string;
    entry: PlanCatalog['entries'][number];
  }): Promise<boolean>;
  createOnboardingCredential(): string;
  digestOnboardingCredential(credential: string): string;
  createOnboardingCsrfProof(credential: string): string;
  verifyOnboardingCsrfProof(credential: string, proof: string): boolean;
  now(): Date;
  recordEvent: (name: string, details?: Record<string, string>) => void;
}

export function createPlanSelection(dependencies: PlanSelectionDependencies) {
  return {
    async load(credential: string): Promise<PlanSelectionPageResponse> {
      const state = await dependencies.loadPage({
        credentialDigest: dependencies.digestOnboardingCredential(credential),
        now: dependencies.now(),
      });
      if (!state) throw new PlanSelectionTransitionError();
      dependencies.recordEvent('plan_selection_page_loaded');
      const selected = state.selectedPriceId
        ? findCatalogEntry(dependencies.catalog, state.selectedPriceId)
        : null;
      return {
        firstName: state.firstName,
        selectedInterval: selected?.billingInterval ?? 'annual',
        selectedPriceId: state.selectedPriceId,
        plans: dependencies.catalog.entries.map(
          ({
            active: _active,
            selfService: _selfService,
            displayOrder: _displayOrder,
            stripePriceLookupKey: _lookup,
            ...entry
          }) => entry,
        ),
      };
    },
    async select(
      credential: string,
      csrfProof: string,
      input: PlanSelectionRequest,
    ): Promise<
      PlanSelectionResponse & {
        onboardingCredential: string;
        csrfProof: string;
      }
    > {
      dependencies.recordEvent('plan_selection_attempted', {
        priceId: input.priceId,
      });
      const entry = findCatalogEntry(dependencies.catalog, input.priceId);
      if (
        !entry ||
        !entry.active ||
        (!entry.selfService && !entry.contactSales) ||
        !dependencies.verifyOnboardingCsrfProof(credential, csrfProof)
      ) {
        dependencies.recordEvent('plan_selection_rejected', {
          priceId: input.priceId,
        });
        throw new PlanSelectionTransitionError();
      }
      const nextCredential = dependencies.createOnboardingCredential();
      const now = dependencies.now();
      let accepted: boolean;
      try {
        accepted = await dependencies.save({
          credentialDigest: dependencies.digestOnboardingCredential(credential),
          nextCredentialDigest:
            dependencies.digestOnboardingCredential(nextCredential),
          nextCredentialExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
          now,
          catalogVersion: dependencies.catalog.version,
          entry,
        });
      } catch (error) {
        dependencies.recordEvent('plan_selection_unexpected_failure', {
          priceId: input.priceId,
        });
        throw error;
      }
      if (!accepted) {
        dependencies.recordEvent('plan_selection_rejected', {
          priceId: input.priceId,
        });
        throw new PlanSelectionTransitionError();
      }
      dependencies.recordEvent('plan_selection_accepted', {
        priceId: input.priceId,
      });
      if (entry.priceId === 'free')
        dependencies.recordEvent('plan_selection_free_selected');
      if (entry.contactSales)
        dependencies.recordEvent('plan_selection_enterprise_selected');
      dependencies.recordEvent('plan_selection_transition_succeeded', {
        destination: entry.contactSales
          ? 'contact-sales'
          : entry.paymentRequired
            ? 'payment'
            : 'organization-profile',
      });
      const security = {
        onboardingCredential: nextCredential,
        csrfProof: dependencies.createOnboardingCsrfProof(nextCredential),
      };
      if (entry.contactSales)
        return {
          nextStep: 'contact-sales',
          destination: dependencies.contactSalesDestination,
          ...security,
        };
      return {
        nextStep: entry.paymentRequired ? 'payment' : 'organization-profile',
        ...security,
      };
    },
  };
}
