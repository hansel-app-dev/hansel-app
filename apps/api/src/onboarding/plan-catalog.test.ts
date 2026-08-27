import { describe, expect, it } from 'vitest';
import { loadPlanCatalog } from './plan-catalog.js';

describe('plan catalog [onboarding-plan-selection REQ-002, REQ-003, REQ-004, REQ-018]', () => {
  it('publishes the approved no-trial dummy catalog', () => {
    const catalog = loadPlanCatalog('test');
    expect(catalog.entries.map(({ priceId }) => priceId)).toEqual([
      'free',
      'plus_monthly',
      'plus_annual',
      'pro_monthly',
      'pro_annual',
      'enterprise',
    ]);
    expect(catalog.entries[0]).toMatchObject({
      amountMinor: 0,
      maximumSites: 1,
      paymentRequired: false,
    });
    expect(JSON.stringify(catalog)).not.toContain('trial');
    expect(
      catalog.entries.map(
        ({
          priceId,
          amountMinor,
          monthlyEquivalentMinor,
          additionalSiteAmountMinor,
          active,
          selfService,
          contactSales,
          displayOrder,
        }) => ({
          priceId,
          amountMinor,
          monthlyEquivalentMinor,
          additionalSiteAmountMinor,
          active,
          selfService,
          contactSales,
          displayOrder,
        }),
      ),
    ).toEqual([
      {
        priceId: 'free',
        amountMinor: 0,
        monthlyEquivalentMinor: 0,
        additionalSiteAmountMinor: null,
        active: true,
        selfService: true,
        contactSales: false,
        displayOrder: 0,
      },
      {
        priceId: 'plus_monthly',
        amountMinor: 5000,
        monthlyEquivalentMinor: 5000,
        additionalSiteAmountMinor: 1500,
        active: true,
        selfService: true,
        contactSales: false,
        displayOrder: 1,
      },
      {
        priceId: 'plus_annual',
        amountMinor: 39000,
        monthlyEquivalentMinor: 3250,
        additionalSiteAmountMinor: 1500,
        active: true,
        selfService: true,
        contactSales: false,
        displayOrder: 2,
      },
      {
        priceId: 'pro_monthly',
        amountMinor: 15000,
        monthlyEquivalentMinor: 15000,
        additionalSiteAmountMinor: 1500,
        active: true,
        selfService: true,
        contactSales: false,
        displayOrder: 3,
      },
      {
        priceId: 'pro_annual',
        amountMinor: 117000,
        monthlyEquivalentMinor: 9750,
        additionalSiteAmountMinor: 1500,
        active: true,
        selfService: true,
        contactSales: false,
        displayOrder: 4,
      },
      {
        priceId: 'enterprise',
        amountMinor: null,
        monthlyEquivalentMinor: null,
        additionalSiteAmountMinor: null,
        active: true,
        selfService: false,
        contactSales: true,
        displayOrder: 5,
      },
    ]);
  });

  it('rejects the dummy catalog in production', () => {
    expect(() => loadPlanCatalog('production')).toThrow(
      'Dummy plan catalog is not permitted in production.',
    );
  });

  it('rejects Stripe test lookup keys in a production catalog', () => {
    const catalog = loadPlanCatalog('test');
    expect(() =>
      loadPlanCatalog('production', { ...catalog, dummy: false }),
    ).toThrow('Stripe test lookup keys are not permitted in production.');
  });
});
