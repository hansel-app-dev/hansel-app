import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedPlanSelectionJourney } from '../apps/api/e2e-support/plan-selection.js';
import { seedOrganizationProfileJourney } from '../apps/api/e2e-support/organization-profile.js';
import { seedDiscoveryJourney } from '../apps/api/e2e-support/discovery.js';
import { seedDashboardSession } from '../apps/api/e2e-support/dashboard.js';
import {
  countryOptions,
  discoveryManagementOptions,
  industryOptions,
  organizationSizeOptions,
  placeServiceOptions,
} from '../packages/contracts/src/index.js';

const plan = (
  priceId: string,
  planId: string,
  billingInterval: string | null,
  contactSales = false,
) => ({
  priceId,
  planId,
  displayName: planId.charAt(0).toUpperCase() + planId.slice(1),
  description: 'Dummy plan',
  features: ['Feature one', 'Feature two', 'Feature three'],
  billingInterval,
  currency: 'USD',
  amountMinor: contactSales ? null : 0,
  monthlyEquivalentMinor: contactSales ? null : 0,
  additionalSiteAmountMinor:
    planId === 'plus' || planId === 'pro' ? 1500 : null,
  paymentRequired: planId === 'plus' || planId === 'pro',
  maximumSites: planId === 'free' ? 1 : null,
  contactSales,
});
const planPage = {
  firstName: 'Nabin',
  selectedInterval: 'annual',
  selectedPriceId: null,
  plans: [
    plan('free', 'free', null),
    plan('plus_monthly', 'plus', 'monthly'),
    plan('plus_annual', 'plus', 'annual'),
    plan('pro_monthly', 'pro', 'monthly'),
    plan('pro_annual', 'pro', 'annual'),
    plan('enterprise', 'enterprise', null, true),
  ],
};
const organizationPage = {
  submissionKey: 'x'.repeat(43),
  countries: countryOptions,
  industries: industryOptions,
  placesByIndustry: placeServiceOptions,
  sizes: organizationSizeOptions,
};
const discoveryPage = {
  submissionKey: 'd'.repeat(43),
  methods: discoveryManagementOptions,
};

async function enterPlanSelection(
  page: Page,
  profile: Record<string, string> | null = null,
) {
  await page.context().clearCookies();
  await page.route('**/api/onboarding/email-verification/verify', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nextStep: 'personal-profile' }),
    }),
  );
  await page.route('**/api/onboarding/personal-profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        route.request().method() === 'GET'
          ? { profile }
          : { nextStep: 'plan-selection' },
      ),
    }),
  );
  await page.goto('/onboarding/verify-email');
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.evaluate(() => {
    document.cookie = 'hansel_onboarding_csrf=proof; SameSite=Strict';
  });
  await page.getByLabel('First name').fill('Nabin');
  await page.getByLabel('Last name').fill('Singh');
  await page.getByLabel('Job title', { exact: true }).selectOption('manager');
  await page
    .getByLabel('Department', { exact: true })
    .selectOption('marketing_communications');
  await page.getByRole('button', { name: 'Next' }).click();
}

test('authenticated dashboard renders the Figma shell and reflows at 320px [dashboard-home REQ-001..REQ-007, REQ-015..REQ-018]', async ({
  page,
}) => {
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'private, no-store' },
      body: JSON.stringify({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
    }),
  );
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Dashboard', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Nabin Singh')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Widget title', level: 2 }),
  ).toHaveCount(4);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test('direct authenticated Sites access renders the Figma empty state and uses shared navigation [sites-empty-state REQ-001..REQ-004, REQ-008, REQ-012, REQ-013]', async ({
  page,
}) => {
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'private, no-store' },
      body: JSON.stringify({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
    }),
  );
  await page.route('**/api/sites', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'private, no-store' },
      body: JSON.stringify({
        organizationName: 'Hansel',
        canCreateSite: true,
        canInviteMembers: true,
        creator: {
          email: 'owner@example.com',
          displayName: 'Owner',
          initials: 'O',
        },
        siteLimitReached: false,
        maximumSites: null,
        members: [],
        sites: [],
      }),
    }),
  );

  await page.goto('/sites');
  await expect(page).toHaveURL(/\/sites$/);
  await expect(
    page.getByRole('heading', { name: 'No sites', level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'New site' })).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Sites' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeFocused();

  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: 'Widget title', level: 2 }),
  ).toHaveCount(4);
  await page.getByRole('link', { name: 'Sites' }).click();
  await expect(page).toHaveURL(/\/sites$/);
});

test('private application pages redirect generic authentication failures and Dashboard retries server failures [dashboard-home REQ-012, REQ-016, REQ-018; sites-empty-state REQ-002, REQ-012]', async ({
  page,
}) => {
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'authentication_required' }),
    }),
  );
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Log in to your account' }),
  ).toBeVisible();

  await page.goto('/sites');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Log in to your account' }),
  ).toBeVisible();

  await page.unroute('**/api/dashboard');
  let attempts = 0;
  await page.route('**/api/dashboard', (route) => {
    attempts += 1;
    return route.fulfill(
      attempts <= 2
        ? { status: 503, body: 'unavailable' }
        : {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              viewer: {
                displayName: 'Nabin Singh',
                initials: 'NS',
                roleLabel: 'Owner',
              },
            }),
          },
    );
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Sites' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeFocused();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Nabin Singh')).toBeVisible();
});

test('authenticated user logs out through the account menu and cannot return with Back [dashboard-logout REQ-001..REQ-012]', async ({
  browser,
}) => {
  const seeded = await seedDashboardSession();
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
  });
  const page = await context.newPage();
  try {
    await context.addCookies([
      {
        name: 'hansel_access',
        value: seeded.accessCredential,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
      {
        name: 'hansel_refresh',
        value: seeded.refreshCredential,
        domain: '127.0.0.1',
        path: '/api/dashboard',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await page.route('**/api/dashboard**', async (route) => {
      const requestUrl = new URL(route.request().url());
      const response = await route.fetch({
        url: `${seeded.apiUrl}${requestUrl.pathname}${requestUrl.search}`,
      });
      await route.fulfill({ response });
    });
    await page.goto('/');
    await page.goto('/dashboard');
    const account = page.getByRole('button', { name: 'Nabin Singh, Owner' });
    await account.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Log out' })).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.setViewportSize({ width: 320, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    const logoutResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/dashboard/logout') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    expect((await logoutResponse).status()).toBe(204);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('heading', { name: 'Log in to your account' }),
    ).toBeVisible();
    expect(
      (await context.cookies()).filter(({ name }) =>
        ['hansel_access', 'hansel_refresh'].includes(name),
      ),
    ).toEqual([]);
    expect(await seeded.readFamily()).toMatchObject({
      revokedAt: expect.any(Date),
      revocationReason: 'user_logout',
    });

    await page.evaluate(() => {
      window.history.back();
    });
    await expect(page).not.toHaveURL(/\/dashboard$/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
    await seeded.disconnect();
  }
});

test('matches the Figma-derived flow and validates required values [AC-002, AC-035, AC-052, REQ-005, REQ-016, REQ-082]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/onboarding');

  await expect(
    page.getByRole('heading', { name: "Let's get started" }),
  ).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute(
    'placeholder',
    'you@gmail.com',
  );
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Microsoft' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Apple' }),
  ).toBeVisible();

  const createWithEmail = page.getByRole('button', {
    name: 'Create with email',
  });
  await expect(createWithEmail).toBeVisible();
  await createWithEmail.click();

  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Use at least 15 characters.')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test('verification requires a deliberate six-digit submission and supports resend [AC-002, REQ-006, REQ-007, REQ-084]', async ({
  page,
}) => {
  await page.route(
    '**/api/onboarding/email-verification/verify',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nextStep: 'personal-profile' }),
      });
    },
  );
  await page.route(
    '**/api/onboarding/email-verification/resend',
    async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'accepted' }),
      });
    },
  );
  await page.route('**/api/onboarding/personal-profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profile: null }),
    }),
  );
  await page.goto('/onboarding/verify-email');
  await expect(
    page.getByRole('heading', { name: 'Verify your account' }),
  ).toBeVisible();
  await page.getByLabel('Verification code').fill('123');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Enter all six digits')).toBeVisible();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/onboarding\/about-you$/);
  await expect(
    page.getByRole('heading', { name: 'Tell us about you' }),
  ).toBeVisible();
});

test('personal profile matches the approved catalogs and advances [REQ-086]', async ({
  page,
}) => {
  await page.route(
    '**/api/onboarding/email-verification/verify',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nextStep: 'personal-profile' }),
      });
    },
  );
  await page.route('**/api/onboarding/personal-profile', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        route.request().method() === 'GET'
          ? { profile: null }
          : { nextStep: 'plan-selection' },
      ),
    }),
  );
  await page.route('**/api/onboarding/plan-selection', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(planPage),
    }),
  );
  await page.goto('/onboarding/verify-email');
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.evaluate(() => {
    document.cookie = 'hansel_onboarding_csrf=csrf-proof; SameSite=Strict';
  });
  await expect(
    page.getByRole('heading', { name: 'Tell us about you' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Enter your first name.')).toBeVisible();
  await page.getByLabel('First name').fill('Nabin');
  await page.getByLabel('Last name').fill('Singh');
  await page.getByLabel('Job title', { exact: true }).selectOption('other');
  await page.getByLabel('Other job title').fill('Founder');
  await page
    .getByLabel('Department', { exact: true })
    .selectOption('marketing_communications');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/onboarding\/plan-selection$/);
  await expect(
    page.getByRole('heading', { name: 'Welcome Nabin, choose your plan' }),
  ).toBeVisible();
});

test('plan selection defaults annual, switches monthly, and Free bypasses payment [onboarding-plan-selection AC-001, AC-003, AC-004]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route('**/api/onboarding/email-verification/verify', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nextStep: 'personal-profile' }),
    }),
  );
  await page.route('**/api/onboarding/personal-profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nextStep: 'plan-selection' }),
    }),
  );
  await page.route('**/api/onboarding/plan-selection', async (route) => {
    if (route.request().method() === 'GET')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(planPage),
      });
    else
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nextStep: 'organization-profile' }),
      });
  });
  await page.goto('/onboarding/verify-email');
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.evaluate(() => {
    document.cookie = 'hansel_onboarding_csrf=proof; SameSite=Strict';
  });
  await page.getByLabel('First name').fill('Nabin');
  await page.getByLabel('Last name').fill('Singh');
  await page.getByLabel('Job title', { exact: true }).selectOption('manager');
  await page
    .getByLabel('Department', { exact: true })
    .selectOption('marketing_communications');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Annual' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute(
    'href',
    '/onboarding/about-you',
  );
  await page.getByRole('button', { name: 'Annual' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByText('Save 35%')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Monthly' }).click();
  await expect(page.getByRole('button', { name: 'Monthly' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.evaluate(() => {
    document.cookie = 'hansel_onboarding_csrf=proof; SameSite=Strict';
  });
  await page.getByRole('button', { name: 'Or try it for free' }).click();
  await expect(page).toHaveURL(/\/onboarding\/organization-profile$/);
});

test('organization profile follows Figma, filters choices, validates, and advances [onboarding-organization-profile REQ-001..REQ-015]', async ({
  page,
}) => {
  let submitted: unknown;
  await page.route('**/api/onboarding/organization-profile', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(organizationPage),
      });
      return;
    }
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nextStep: 'discovery' }),
    });
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/onboarding/organization-profile');
  await page.evaluate(() => {
    document.cookie = 'hansel_onboarding_csrf=proof; SameSite=Strict';
  });
  await expect(
    page.getByRole('heading', { name: 'Now your organization' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  const organization = page.getByRole('textbox', { name: 'Organization' });
  await expect(organization).toBeFocused();
  await organization.fill('Hansel');
  await page.getByLabel('Country').selectOption('AU');
  await page.getByLabel('Industry or sector').selectOption('healthcare');
  await expect(page.getByRole('option', { name: 'Clinics' })).toBeAttached();
  await expect(page.getByRole('option', { name: 'Airports' })).toHaveCount(0);
  await page.getByLabel('Type of place or service').selectOption('clinics');
  await page.getByLabel('Size').selectOption('employees_11_50');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/onboarding\/discovery$/);
  expect(submitted).toMatchObject({
    organizationName: 'Hansel',
    country: 'AU',
    industry: 'healthcare',
    placeService: 'clinics',
    organizationSize: 'employees_11_50',
  });
});

test('discovery follows Figma, validates conditional Other, restores organization details, and completes [onboarding-discovery REQ-001..REQ-017]', async ({
  page,
}) => {
  let submitted: unknown;
  await page.route('**/api/onboarding/discovery', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(discoveryPage),
      });
      return;
    }
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nextStep: 'dashboard',
        destination: '/dashboard',
      }),
    });
  });
  await page.route('**/api/onboarding/organization-profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...organizationPage,
        profile: {
          organizationName: 'Hansel saved',
          country: 'AU',
          industry: 'healthcare',
          placeService: 'clinics',
          organizationSize: 'employees_11_50',
        },
      }),
    }),
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/onboarding/discovery');
  await page.evaluate(() => {
    document.cookie = 'hansel_onboarding_csrf=proof; SameSite=Strict';
  });
  await expect(
    page.getByRole('heading', { name: 'Could you tell us more?' }),
  ).toBeVisible();
  const management = page.getByLabel(
    'How do you manage your signage currently?',
  );
  await expect(management).toHaveValue('');
  await expect(management.getByRole('option')).toHaveText([
    'Select',
    'PDF',
    'Spreadsheet',
    'Other',
  ]);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(management).toBeFocused();
  await management.selectOption('other');
  await page.getByLabel('Other tools').fill('Custom CMS');
  await management.selectOption('spreadsheet');
  await expect(page.getByLabel('Other tools')).toHaveCount(0);
  await page.getByLabel('Biggest challenges your team faces').fill('Updates');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/onboarding\/organization-profile$/);
  await expect(page.getByRole('textbox', { name: 'Organization' })).toHaveValue(
    'Hansel saved',
  );
  await page.goto('/onboarding/discovery');
  await management.selectOption('spreadsheet');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(submitted).toEqual({
    action: 'submit',
    currentManagement: 'spreadsheet',
    submissionKey: discoveryPage.submissionKey,
  });
});

test('discovery skip ignores visible answers [onboarding-discovery REQ-005, REQ-010]', async ({
  page,
}) => {
  let submitted: unknown;
  await page.route('**/api/onboarding/discovery', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(discoveryPage),
      });
      return;
    }
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nextStep: 'dashboard',
        destination: '/dashboard',
      }),
    });
  });
  await page.goto('/onboarding/discovery');
  await page.evaluate(() => {
    document.cookie = 'hansel_onboarding_csrf=proof; SameSite=Strict';
  });
  await page
    .getByLabel('How do you manage your signage currently?')
    .selectOption('pdf');
  await page.getByLabel('Biggest challenges your team faces').fill('Ignored');
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(submitted).toEqual({
    action: 'skip',
    submissionKey: discoveryPage.submissionKey,
  });
});

test('paid and Enterprise plan outcomes are server-authored [onboarding-plan-selection REQ-006, REQ-008]', async ({
  page,
}) => {
  let outcome: 'payment' | 'contact-sales' = 'payment';
  await page.route('**/api/onboarding/plan-selection', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(planPage),
      });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        outcome === 'payment'
          ? { nextStep: 'payment' }
          : {
              nextStep: 'contact-sales',
              destination: 'https://sales.example.com/hansel',
            },
      ),
    });
  });
  await enterPlanSelection(page);
  await page.getByRole('button', { name: 'Choose Plus' }).click();
  await expect(page).toHaveURL(/\/onboarding\/payment$/);

  await enterPlanSelection(page);
  await page.getByRole('button', { name: 'Choose Pro' }).click();
  await expect(page).toHaveURL(/\/onboarding\/payment$/);

  outcome = 'contact-sales';
  await page.route('https://sales.example.com/**', (route) =>
    route.fulfill({ status: 200, body: 'Sales' }),
  );
  await enterPlanSelection(page);
  await page.getByRole('button', { name: 'Schedule a call' }).click();
  await expect(page).toHaveURL('https://sales.example.com/hansel');
});

test('a failed plan choice stays selected and Back restores the personal profile [REQ-011, REQ-014, onboarding-plan-selection REQ-012, REQ-013]', async ({
  page,
}) => {
  const profile = {
    firstName: 'Nabin',
    lastName: 'Singh',
    jobTitle: 'manager',
    department: 'marketing_communications',
  };
  await page.route('**/api/onboarding/plan-selection', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(planPage),
        })
      : route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'onboarding_transition_failed' }),
        }),
  );
  await enterPlanSelection(page, profile);
  await page.getByRole('button', { name: 'Choose Plus' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'could not save your plan',
  );
  await expect(page.getByLabel('Plus plan, selected')).toBeVisible();
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/onboarding\/about-you$/);
  await expect(
    page.getByRole('heading', { name: 'Tell us about you' }),
  ).toBeVisible();
  await expect(page.getByLabel('First name')).toHaveValue('Nabin');
  await expect(page.getByLabel('Last name')).toHaveValue('Singh');
  await expect(page.getByLabel('Job title', { exact: true })).toHaveValue(
    'manager',
  );
  await expect(page.getByLabel('Department', { exact: true })).toHaveValue(
    'marketing_communications',
  );
});

test('personal profile matches its visual and accessibility contract [REQ-054, REQ-086]', async ({
  page,
}) => {
  await page.route('**/api/onboarding/email-verification/verify', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nextStep: 'personal-profile' }),
    }),
  );
  await page.route('**/api/onboarding/personal-profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          firstName: 'Nabin',
          lastName: 'Singh',
          jobTitle: 'manager',
          department: 'marketing_communications',
        },
      }),
    }),
  );
  await page.goto('/onboarding/verify-email');
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tell us about you' }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-about-you-progressive.png', {
    fullPage: true,
  });
  await page
    .getByLabel('Department', { exact: true })
    .selectOption('facilities_management_campus_maintenance');
  const firstNameBox = await page.getByLabel('First name').boundingBox();
  const departmentBox = await page
    .getByLabel('Department', { exact: true })
    .boundingBox();
  expect(departmentBox?.width).toBe(firstNameBox?.width);
});

test('an expired personal-profile session logs out and returns to onboarding [REQ-014, REQ-086]', async ({
  page,
}) => {
  await page.goto('/onboarding/about-you');
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole('heading', { name: "Let's get started" }),
  ).toBeVisible();
  await expect(
    page.getByText('Your onboarding session is unavailable.'),
  ).toHaveCount(0);
});

test('plan selection and profile edits remain functional without JavaScript [REQ-011, REQ-014, REQ-054, onboarding-plan-selection REQ-012, REQ-017]', async ({
  browser,
}) => {
  const { baseUrl, credential, csrfProof, disconnect } =
    await seedPlanSelectionJourney();
  const context = await browser.newContext({
    baseURL: baseUrl,
    javaScriptEnabled: false,
  });
  await context.addCookies([
    {
      name: 'hansel_onboarding',
      value: credential,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'hansel_onboarding_csrf',
      value: csrfProof,
      domain: '127.0.0.1',
      path: '/',
      sameSite: 'Strict',
    },
  ]);
  const page = await context.newPage();
  const response = await page.goto('/onboarding/plan-selection');
  expect((await response?.request().allHeaders())?.cookie).toContain(
    'hansel_onboarding=',
  );
  await expect(
    page.getByRole('heading', { name: 'Welcome Nabin, choose your plan' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/onboarding\/about-you$/);
  await expect(page.getByLabel('First name')).toHaveValue('Nabin');
  await expect(page.getByLabel('Last name')).toHaveValue('Singh');
  await expect(page.getByLabel('Job title', { exact: true })).toHaveValue(
    'manager',
  );
  await expect(page.getByLabel('Department', { exact: true })).toHaveValue(
    'marketing_communications',
  );
  await page.getByLabel('First name').fill('Updated');
  const [profileSubmission] = await Promise.all([
    page.waitForRequest('**/api/onboarding/personal-profile'),
    page.getByRole('button', { name: 'Next' }).click(),
  ]);
  const profileSubmissionHeaders = await profileSubmission.allHeaders();
  expect(profileSubmissionHeaders.origin).toBe('null');
  expect(profileSubmissionHeaders['sec-fetch-site']).toBe('same-origin');
  await expect(
    page.getByRole('heading', { name: 'Welcome Updated, choose your plan' }),
  ).toBeVisible();
  const [submission] = await Promise.all([
    page.waitForRequest('**/api/onboarding/plan-selection'),
    page.getByRole('button', { name: 'Or try it for free' }).click(),
  ]);
  const submissionHeaders = await submission.allHeaders();
  expect(submissionHeaders.origin).toBe('null');
  expect(submissionHeaders['sec-fetch-site']).toBe('same-origin');
  const submissionCookies = submissionHeaders.cookie ?? '';
  expect(submissionCookies).toContain('hansel_onboarding=');
  expect(submissionCookies).toContain('hansel_onboarding_csrf=');
  await expect(page).toHaveURL(/\/onboarding\/organization-profile$/);
  await context.close();
  await disconnect();
});

test('organization profile remains functional without JavaScript and persists through PostgreSQL [onboarding-organization-profile REQ-012, REQ-016]', async ({
  browser,
}) => {
  const { baseUrl, credential, csrfProof, assertPersisted, disconnect } =
    await seedOrganizationProfileJourney();
  const context = await browser.newContext({
    baseURL: baseUrl,
    javaScriptEnabled: false,
  });
  await context.addCookies([
    {
      name: 'hansel_onboarding',
      value: credential,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'hansel_onboarding_csrf',
      value: csrfProof,
      domain: '127.0.0.1',
      path: '/',
      sameSite: 'Strict',
    },
  ]);
  const page = await context.newPage();
  await page.goto('/onboarding/organization-profile');
  await page.getByRole('textbox', { name: 'Organization' }).fill('Hansel E2E');
  await page.getByLabel('Country').selectOption('AU');
  await page.getByLabel('Industry or sector').selectOption('healthcare');
  await page.getByLabel('Type of place or service').selectOption('clinics');
  await page.getByLabel('Size').selectOption('employees_11_50');
  const [submission] = await Promise.all([
    page.waitForRequest('**/api/onboarding/organization-profile'),
    page.getByRole('button', { name: 'Next' }).click(),
  ]);
  expect((await submission.allHeaders()).origin).toBe('null');
  await expect(page).toHaveURL(/\/onboarding\/discovery$/);
  await expect.poll(assertPersisted).toBe('Hansel E2E');
  await context.close();
  await disconnect();
});

test('discovery remains functional without JavaScript and completes through PostgreSQL [onboarding-discovery REQ-008, REQ-011, REQ-017]', async ({
  browser,
}) => {
  const {
    baseUrl,
    credential,
    csrfProof,
    assertPersisted,
    countSessions,
    expireAccess,
    disconnect,
  } = await seedDiscoveryJourney();
  const context = await browser.newContext({
    baseURL: baseUrl,
    javaScriptEnabled: false,
  });
  await context.addCookies([
    {
      name: 'hansel_onboarding',
      value: credential,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'hansel_onboarding_csrf',
      value: csrfProof,
      domain: '127.0.0.1',
      path: '/',
      sameSite: 'Strict',
    },
  ]);
  const page = await context.newPage();
  await page.goto('/onboarding/discovery');
  await page
    .getByLabel('How do you manage your signage currently?')
    .selectOption('pdf');
  await page
    .getByLabel('Biggest challenges your team faces')
    .fill('Content updates');
  const [submission] = await Promise.all([
    page.waitForRequest('**/api/onboarding/discovery'),
    page.getByRole('button', { name: 'Next' }).click(),
  ]);
  expect((await submission.allHeaders()).origin).toBe('null');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect.poll(assertPersisted).toMatchObject({
    currentStep: 'COMPLETE',
    discoveryResponse: {
      outcome: 'submitted',
      currentManagement: 'pdf',
      currentManagementOther: null,
      challenges: 'Content updates',
    },
  });
  await expect.poll(countSessions).toBe(1);
  await expireAccess();
  const dashboardResponse = await context.request.get(
    `${baseUrl}/api/dashboard`,
  );
  expect(dashboardResponse.status()).toBe(200);
  expect(dashboardResponse.headers()['set-cookie']).toContain('hansel_access=');
  expect(dashboardResponse.headers()['set-cookie']).toContain(
    'hansel_refresh=',
  );
  await expect(dashboardResponse.json()).resolves.toEqual({
    viewer: {
      displayName: 'Nabin Singh',
      initials: 'NS',
      roleLabel: 'Owner',
    },
  });
  await context.close();
  await disconnect();
});
