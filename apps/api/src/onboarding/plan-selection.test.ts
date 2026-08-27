import { describe, expect, it, vi } from 'vitest';
import {
  createPlanSelection,
  PlanSelectionTransitionError,
} from './plan-selection.js';
import { loadPlanCatalog } from './plan-catalog.js';

const catalog = loadPlanCatalog('test');
const dependencies = () => ({
  catalog,
  contactSalesDestination: 'https://hanselapp.io/contact',
  loadPage: vi
    .fn()
    .mockResolvedValue({ firstName: 'Nabin', selectedPriceId: null }),
  save: vi.fn().mockResolvedValue(true),
  createOnboardingCredential: vi.fn().mockReturnValue('next-credential'),
  digestOnboardingCredential: vi.fn((value: string) => `digest:${value}`),
  createOnboardingCsrfProof: vi.fn().mockReturnValue('next-csrf'),
  verifyOnboardingCsrfProof: vi.fn().mockReturnValue(true),
  now: vi.fn().mockReturnValue(new Date('2026-08-27T00:00:00.000Z')),
  recordEvent: vi.fn(),
});

describe('plan selection [onboarding-plan-selection REQ-006, REQ-007, REQ-008, REQ-009, REQ-010]', () => {
  it('loads private page state from the continuation', async () => {
    const deps = dependencies();
    const module = createPlanSelection(deps);
    await expect(module.load('credential')).resolves.toMatchObject({
      firstName: 'Nabin',
      selectedInterval: 'annual',
      plans: expect.arrayContaining([
        expect.objectContaining({ priceId: 'free' }),
      ]),
    });
    expect(deps.loadPage).toHaveBeenCalledWith({
      credentialDigest: 'digest:credential',
      now: new Date('2026-08-27T00:00:00.000Z'),
    });
    expect(deps.recordEvent).toHaveBeenCalledWith('plan_selection_page_loaded');
  });

  it('restores the selected billing interval and rejects unavailable state', async () => {
    const deps = dependencies();
    deps.loadPage
      .mockResolvedValueOnce({
        firstName: 'Nabin',
        selectedPriceId: 'plus_monthly',
      })
      .mockResolvedValueOnce(null);
    await expect(
      createPlanSelection(deps).load('credential'),
    ).resolves.toMatchObject({
      selectedInterval: 'monthly',
      selectedPriceId: 'plus_monthly',
    });
    await expect(
      createPlanSelection(deps).load('credential'),
    ).rejects.toBeInstanceOf(PlanSelectionTransitionError);
  });

  it('falls back to annual if a retained catalog entry is no longer available', async () => {
    const deps = dependencies();
    deps.catalog = {
      ...catalog,
      entries: catalog.entries.filter(({ priceId }) => priceId !== 'free'),
    };
    deps.loadPage.mockResolvedValue({
      firstName: 'Nabin',
      selectedPriceId: 'free',
    });
    await expect(
      createPlanSelection(deps).load('credential'),
    ).resolves.toMatchObject({ selectedInterval: 'annual' });
  });

  it.each([
    ['plus_annual', 'payment'],
    ['free', 'organization-profile'],
    ['enterprise', 'contact-sales'],
  ] as const)('selects %s and returns %s', async (priceId, nextStep) => {
    const deps = dependencies();
    const module = createPlanSelection(deps);
    const result = await module.select('credential', 'csrf', { priceId });
    expect(result.nextStep).toBe(nextStep);
    expect(result).toMatchObject({
      onboardingCredential: 'next-credential',
      csrfProof: 'next-csrf',
    });
    expect(deps.save).toHaveBeenCalledOnce();
    expect(deps.recordEvent).toHaveBeenCalledWith('plan_selection_accepted', {
      priceId,
    });
  });

  it('rejects invalid CSRF or state generically', async () => {
    const deps = dependencies();
    deps.verifyOnboardingCsrfProof.mockReturnValue(false);
    await expect(
      createPlanSelection(deps).select('credential', 'csrf', {
        priceId: 'plus_monthly',
      }),
    ).rejects.toBeInstanceOf(PlanSelectionTransitionError);
    expect(deps.save).not.toHaveBeenCalled();
    const rejected = dependencies();
    rejected.save.mockResolvedValue(false);
    await expect(
      createPlanSelection(rejected).select('credential', 'csrf', {
        priceId: 'free',
      }),
    ).rejects.toBeInstanceOf(PlanSelectionTransitionError);
  });

  it('records and propagates unexpected persistence failures', async () => {
    const deps = dependencies();
    const failure = new Error('database unavailable');
    deps.save.mockRejectedValue(failure);
    await expect(
      createPlanSelection(deps).select('credential', 'csrf', {
        priceId: 'free',
      }),
    ).rejects.toBe(failure);
    expect(deps.recordEvent).toHaveBeenCalledWith(
      'plan_selection_unexpected_failure',
      { priceId: 'free' },
    );
  });

  it.each([
    [{ active: false }, 'inactive'],
    [{ selfService: false, contactSales: false }, 'non-selectable'],
  ] as const)('rejects an %s catalog entry', async (changes, _label) => {
    const deps = dependencies();
    deps.catalog = {
      ...catalog,
      entries: catalog.entries.map((entry) =>
        entry.priceId === 'free' ? { ...entry, ...changes } : entry,
      ),
    };
    await expect(
      createPlanSelection(deps).select('credential', 'csrf', {
        priceId: 'free',
      }),
    ).rejects.toBeInstanceOf(PlanSelectionTransitionError);
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.recordEvent).toHaveBeenCalledWith('plan_selection_rejected', {
      priceId: 'free',
    });
  });
});
