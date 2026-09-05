import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function analyzeAccessibility(page: Page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await new AxeBuilder({ page }).analyze();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes('Axe is already running') ||
        attempt === 4
      )
        throw error;
      await page.waitForTimeout(100);
    }
  }
  throw new Error('Accessibility analysis did not complete.');
}

async function authFormStyle(page: Page) {
  return page.evaluate(() => {
    const section = document.querySelector('section');
    const heading = section?.querySelector('h1');
    const form = section?.querySelector('form');
    const input = form?.querySelector('input');
    const primaryAction = form?.querySelector('button');
    const providerAction = [...document.querySelectorAll('button, a')].find(
      (element) => element.textContent.includes('Continue with Google'),
    );
    if (
      !section ||
      !heading ||
      !form ||
      !input ||
      !primaryAction ||
      !providerAction?.parentElement
    )
      throw new Error('Authentication form is incomplete.');

    const sectionStyle = getComputedStyle(section);
    const headingStyle = getComputedStyle(heading);
    const formStyle = getComputedStyle(form);
    const inputStyle = getComputedStyle(input);
    const primaryStyle = getComputedStyle(primaryAction);
    const providerStyle = getComputedStyle(providerAction);
    const providerGroupStyle = getComputedStyle(providerAction.parentElement);
    return {
      field: {
        borderColor: inputStyle.borderColor,
        borderRadius: inputStyle.borderRadius,
        fontSize: inputStyle.fontSize,
        height: input.getBoundingClientRect().height,
        paddingInline: `${inputStyle.paddingLeft} ${inputStyle.paddingRight}`,
      },
      form: { rowGap: formStyle.rowGap },
      heading: {
        fontSize: headingStyle.fontSize,
        fontWeight: headingStyle.fontWeight,
        letterSpacing: headingStyle.letterSpacing,
      },
      primaryAction: {
        backgroundColor: primaryStyle.backgroundColor,
        borderRadius: primaryStyle.borderRadius,
        fontSize: primaryStyle.fontSize,
        fontWeight: primaryStyle.fontWeight,
        height: primaryAction.getBoundingClientRect().height,
        widthMode:
          primaryAction.getBoundingClientRect().width ===
          form.getBoundingClientRect().width
            ? 'full'
            : 'content',
      },
      providerAction: {
        borderColor: providerStyle.borderColor,
        borderRadius: providerStyle.borderRadius,
        columnGap: providerStyle.columnGap,
        fontSize: providerStyle.fontSize,
        fontWeight: providerStyle.fontWeight,
        height: providerAction.getBoundingClientRect().height,
      },
      providerGroup: { rowGap: providerGroupStyle.rowGap },
      section: {
        paddingTop: sectionStyle.paddingTop,
        rowGap: sectionStyle.rowGap,
        width: section.getBoundingClientRect().width,
      },
    };
  });
}

const stories = [
  ['button-states', 'design-system-button--states', 'button', 'Primary action'],
  ['text-field-states', 'design-system-textfield--states', 'textbox', 'Email'],
  [
    'provider-action-states',
    'design-system-provideraction--providers',
    'button',
    'Continue with Google',
  ],
  [
    'auth-form-layout',
    'design-system-authformlayout--default',
    'textbox',
    'Email',
  ],
  [
    'select-field-states',
    'design-system-selectfield--states',
    'combobox',
    'Job title',
  ],
] as const;

for (const [snapshotName, storyId, focusRole, focusName] of stories) {
  test(`${snapshotName} is accessible and visually stable [AC-005, REQ-008, REQ-009]`, async ({
    page,
  }) => {
    await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await expect(page.locator('#storybook-root')).toBeVisible();
    await page.locator('[data-focus-start]').focus();
    await page.keyboard.press('Tab');
    const focusedControl = page.getByRole(focusRole, {
      name: focusName,
      exact: true,
    });
    await expect(focusedControl).toBeFocused();
    await expect(focusedControl).toHaveCSS('outline-style', 'solid');

    const accessibility = await analyzeAccessibility(page);
    expect(accessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot(`${snapshotName}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    });
  });
}

test('onboarding account creation is accessible and visually stable [AC-053, REQ-082, REQ-083]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-account-creation--default&viewMode=story',
  );
  const heading = page.getByRole('heading', { name: "Let's get started" });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS('font-family', /Figtree/);
  await expect(page.getByLabel('Email')).toHaveAttribute(
    'placeholder',
    'you@gmail.com',
  );
  await expect(
    page.getByRole('button', { name: 'Create with email' }),
  ).toBeVisible();
  const googleProvider = page.getByRole('button', {
    name: 'Continue with Google',
  });
  await expect(googleProvider.locator('img')).toHaveCount(1);
  await expect(googleProvider).toHaveCSS('column-gap', '16px');

  const accessibility = await analyzeAccessibility(page);
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-account-creation.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('onboarding and login share one authentication form composition [design-system-foundation AC-007, REQ-014]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-account-creation--default&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: "Let's get started" }),
  ).toBeVisible();
  const onboardingStyle = await authFormStyle(page);

  await page.goto(
    '/iframe.html?id=authentication-login--default&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Log in to your account' }),
  ).toBeVisible();
  const loginStyle = await authFormStyle(page);

  expect(onboardingStyle).toEqual(loginStyle);
});

test('login is accessible and visually stable at desktop, narrow, and 200% zoom [user-login AC-005, REQ-019, REQ-022]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=authentication-login--default&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Log in to your account' }),
  ).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveCSS('font-family', /Figtree/);
  for (const provider of ['Google', 'Microsoft', 'Apple']) {
    const providerLink = page.getByRole('link', {
      name: `Continue with ${provider}`,
    });
    await expect(providerLink.locator('img')).toHaveCount(1);
    await expect(providerLink).toHaveCSS('column-gap', '16px');
  }
  await expect(page.getByTestId('auth-provider-divider')).toBeVisible();
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('login-default.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await expect(page).toHaveScreenshot('login-narrow.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(
    page.getByRole('link', { name: 'Continue with Apple' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(640);
});

for (const [name, storyId, heading] of [
  [
    'forgot-password',
    'authentication-forgotpassword--default',
    'Forgot your password?',
  ],
  [
    'reset-password',
    'authentication-resetpassword--default',
    'Reset your password',
  ],
] as const) {
  test(`${name} is accessible, responsive, and visually stable [password-recovery REQ-020, REQ-022; AC-005, AC-007]`, async ({
    page,
  }) => {
    await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    expect((await analyzeAccessibility(page)).violations).toEqual([]);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    });
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    await page.setViewportSize({ width: 320, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await page.setViewportSize({ width: 640, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(640);
  });
}

test('personal profile is accessible and visually stable [REQ-086]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-about-you--default&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Tell us about you' }),
  ).toBeVisible();
  await expect(page.getByLabel('Job title')).toHaveValue('');
  const accessibility = await analyzeAccessibility(page);
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-about-you.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('plan card is accessible and visually stable [onboarding-plan-selection REQ-015]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=design-system-plancard--normal&viewMode=story',
  );
  await expect(page.getByRole('button', { name: 'Choose Plus' })).toBeVisible();
  const accessibility = await analyzeAccessibility(page);
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('plan-card-normal.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

for (const state of ['selected', 'disabled', 'free', 'enterprise']) {
  test(`plan card ${state} state is accessible and visually stable [onboarding-plan-selection REQ-015, REQ-017]`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=design-system-plancard--${state}&viewMode=story`,
    );
    await expect(page.getByRole('article')).toBeVisible();
    const accessibility = await analyzeAccessibility(page);
    expect(accessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot(`plan-card-${state}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    });
  });
}

test('plan selection is accessible and visually stable [onboarding-plan-selection REQ-001, REQ-015]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-plan-selection--annual&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Welcome Nabin, choose your plan' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Annual' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const accessibility = await analyzeAccessibility(page);
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-plan-selection.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page).toHaveScreenshot('onboarding-plan-selection-narrow.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

for (const state of [
  'monthly',
  'selected',
  'free-selected',
  'enterprise-selected',
  'submitting-disabled',
  'load-failure',
]) {
  test(`plan selection ${state} state is accessible and visually stable [onboarding-plan-selection REQ-015, REQ-017]`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=onboarding-plan-selection--${state}&viewMode=story`,
    );
    await expect(page.getByRole('main')).toBeVisible();
    const accessibility = await analyzeAccessibility(page);
    expect(accessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot(
      `onboarding-plan-selection-${state}.png`,
      {
        animations: 'disabled',
        fullPage: true,
        maxDiffPixelRatio: 0.001,
      },
    );
  });
}

test('organization profile matches Figma and remains accessible [onboarding-organization-profile REQ-001, REQ-014]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-organization-profile--normal&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Now your organization' }),
  ).toBeVisible();
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-organization-profile.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page).toHaveScreenshot(
    'onboarding-organization-profile-narrow.png',
    { animations: 'disabled', fullPage: true, maxDiffPixelRatio: 0.001 },
  );
});

for (const state of [
  'dependent-options',
  'validation-error',
  'load-failure',
  'submitting',
]) {
  test(`organization profile ${state} is accessible and visually stable [onboarding-organization-profile REQ-014]`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=onboarding-organization-profile--${state}&viewMode=story`,
    );
    await expect(page.getByRole('main')).toBeVisible();
    expect((await analyzeAccessibility(page)).violations).toEqual([]);
    await expect(page).toHaveScreenshot(
      `onboarding-organization-profile-${state}.png`,
      { animations: 'disabled', fullPage: true, maxDiffPixelRatio: 0.001 },
    );
  });
}

test('discovery matches Figma and remains accessible [onboarding-discovery REQ-001, REQ-015..REQ-017]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-discovery--normal&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Could you tell us more?' }),
  ).toBeVisible();
  await expect(
    page.getByLabel('How do you manage your signage currently?'),
  ).toHaveValue('');
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-discovery.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await expect(page).toHaveScreenshot('onboarding-discovery-narrow.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

for (const state of [
  'other-selected',
  'validation-error',
  'submitting',
  'load-failure',
  'server-failure',
]) {
  test(`discovery ${state} is accessible and visually stable [onboarding-discovery REQ-015..REQ-017]`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=onboarding-discovery--${state}&viewMode=story`,
    );
    await expect(page.getByRole('main')).toBeVisible();
    expect((await analyzeAccessibility(page)).violations).toEqual([]);
    await expect(page).toHaveScreenshot(`onboarding-discovery-${state}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    });
  });
}

test('dashboard matches Figma, remains accessible, and reflows at 320px [dashboard-home REQ-001..REQ-004, REQ-015..REQ-018]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=dashboard-home--figma-sample&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Dashboard', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('John Smith')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Widget title', level: 2 }),
  ).toHaveCount(4);
  const navigation = page.getByRole('navigation');
  for (const label of [
    'Dashboard',
    'Sites',
    'Libraries',
    'Styleguide',
    'Documents',
  ])
    await expect(navigation).toContainText(label);
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('dashboard-home.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('dashboard-home-narrow.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('dashboard retry is keyboard reachable and accessible [dashboard-home REQ-012, REQ-016..REQ-018]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=dashboard-home--retryable-failure&viewMode=story',
  );
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeFocused();
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('dashboard-home-retryable-failure.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('dashboard account menu is accessible and reflows at 320px [dashboard-logout REQ-001..REQ-003, REQ-011]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=dashboard-home--account-menu-open&viewMode=story',
  );
  await expect(page.getByRole('menuitem', { name: 'Log out' })).toBeFocused();
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('dashboard-account-menu.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('dashboard-account-menu-narrow.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('Sites empty state matches Figma, remains accessible, and reflows at 320px [sites-empty-state REQ-001, REQ-005..REQ-012]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-empty-state--figma-empty&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Sites', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No sites', level: 2 }),
  ).toBeVisible();
  await expect(page.getByText('John Smith')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New site' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Grid view' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'List view' })).toBeDisabled();
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('sites-empty-state.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('sites-empty-state-narrow.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(640);
});

test('Sites retry state is keyboard reachable and accessible [sites-empty-state REQ-002, REQ-008, REQ-011, REQ-012]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-empty-state--retryable-failure&viewMode=story',
  );
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeFocused();
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
});

test('Sites populated grid and list match Figma, preserve latest-first order, and remain accessible [sites-populated-state REQ-001, REQ-009..REQ-015, REQ-020..REQ-025; sites-latest-first REQ-003, REQ-007]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-populated-page--figma-grid&viewMode=story',
  );
  const grid = page.getByRole('list', { name: 'Sites grid' });
  await expect(grid).toBeVisible();
  await expect(grid.getByRole('link').first()).toHaveAccessibleName(
    "Mother's & Children's Hospital",
  );
  await expect(grid.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText('Workspace Name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('sites-populated-grid.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.goto(
    '/iframe.html?id=sites-populated-page--figma-list&viewMode=story',
  );
  const table = page.getByRole('table', { name: 'Sites list' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('link').first()).toHaveAccessibleName(
    "Mother's & Children's Hospital",
  );
  await expect(table.locator('tbody tr')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('sites-populated-list.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('Sites populated state reflows at 320px and 200% zoom [sites-populated-state REQ-020..REQ-023]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(
    '/iframe.html?id=sites-populated-page--figma-grid&viewMode=story',
  );
  await expect(page.getByRole('list', { name: 'Sites grid' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('sites-populated-grid-narrow.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(page.getByRole('button', { name: 'List view' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(640);
});

test('Sites and authentication use the same shared primary Button color [design-system-foundation REQ-004, REQ-014; sites-empty-state REQ-004, REQ-005]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=authentication-login--default&viewMode=story',
  );
  const loginColor = await page
    .getByRole('button', { name: 'Log in' })
    .evaluate((button) => getComputedStyle(button).backgroundColor);

  await page.goto(
    '/iframe.html?id=sites-empty-state--figma-empty&viewMode=story',
  );
  const sitesColor = await page
    .getByRole('button', { name: 'New site' })
    .first()
    .evaluate((button) => getComputedStyle(button).backgroundColor);

  expect(loginColor).toBe('rgb(72, 84, 99)');
  expect(sitesColor).toBe(loginColor);
});

test('Add site scopes match the cookbook, remain accessible, and reflow narrowly [sites-access-scope REQ-001..REQ-005, REQ-022..REQ-025]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-add-site-modal--step-one&viewMode=story',
  );
  await expect(
    page.getByRole('dialog', { name: 'Add new site' }),
  ).toBeVisible();
  await expect(page.getByText('Step 1 of 1')).toBeVisible();
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('sites-add-site-step-one.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.goto(
    '/iframe.html?id=sites-add-site-modal--step-two&viewMode=story',
  );
  await expect(page.getByText('Step 2 of 2')).toBeVisible();
  await expect(page.getByText('Nabin Singh', { exact: true })).toBeVisible();
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('sites-add-site-step-two.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await expect(page).toHaveScreenshot('sites-add-site-step-two-narrow.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%';
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

for (const [name, storyId] of [
  ['sites-add-site-access-open.png', 'sites-add-site-modal--organization-open'],
  ['sites-add-site-private.png', 'sites-add-site-modal--private'],
  ['sites-add-site-access-free.png', 'sites-add-site-modal--free-plan'],
  [
    'sites-add-site-long-organization.png',
    'sites-add-site-modal--long-organization-name',
  ],
] as const) {
  test(`captures ${storyId} in the access-scope regression matrix [sites-access-scope REQ-024, REQ-025]`, async ({
    page,
  }) => {
    await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await expect(
      page.getByRole('dialog', { name: 'Add new site' }),
    ).toBeVisible();
    expect((await analyzeAccessibility(page)).violations).toEqual([]);
    await expect(page).toHaveScreenshot(name, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    });
  });
}

for (const [name, storyId] of [
  [
    'sites-add-site-members.png',
    'sites-add-site-modal--internal-and-external-members',
  ],
  ['sites-add-site-paid-seat.png', 'sites-add-site-modal--paid-seat-warning'],
  ['sites-add-site-pending.png', 'sites-add-site-modal--pending-creation'],
  ['sites-add-site-failure.png', 'sites-add-site-modal--server-failure'],
] as const) {
  test(`captures ${storyId} in the Add Site regression matrix [sites-add-new REQ-020, REQ-021]`, async ({
    page,
  }) => {
    await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await expect(page.locator('#storybook-root')).not.toBeEmpty();
    expect((await analyzeAccessibility(page)).violations).toEqual([]);
    await expect(page).toHaveScreenshot(name, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    });
  });
}

test('Site details Activity shell is accessible and visually stable at desktop [site-details-activity-shell AC-001, AC-002, AC-005, REQ-017..REQ-020]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto('/iframe.html?id=sites-site-activity--loaded&viewMode=story');
  await expect(
    page.getByRole('heading', {
      name: 'Building A – General Teaching Space',
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Application' }).getByRole('link', {
      name: 'Building A – General Teaching Space',
    }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Share site' })).toBeDisabled();
  await expect(
    page.getByRole('navigation', { name: 'Site sections' }),
  ).toContainText('Signage Schedule');
  await expect(page.getByRole('heading', { name: 'Widget title' })).toHaveCount(
    4,
  );
  await expect(page.getByRole('region', { name: 'Activity' })).toContainText(
    'Site activity will appear here.',
  );
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('site-details-activity-shell.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('Site details Activity shell reflows at narrow width and 200% zoom [site-details-activity-shell AC-005, REQ-016, REQ-019, REQ-020]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/iframe.html?id=sites-site-activity--narrow&viewMode=story');
  await expect(page.getByRole('region', { name: 'Activity' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot(
    'site-details-activity-shell-narrow.png',
    {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    },
  );

  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto('/iframe.html?id=sites-site-activity--loaded&viewMode=story');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('email verification is accessible and visually stable [AC-002, REQ-006, REQ-084]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-verify-email--waiting&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Verify your account' }),
  ).toBeVisible();
  await expect(page.getByLabel('Verification code')).toHaveAttribute(
    'autocomplete',
    'one-time-code',
  );
  const accessibility = await analyzeAccessibility(page);
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-verify-email.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});
